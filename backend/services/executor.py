"""Workflow execution engine: sequential steps, retries, context passing, DB-backed state."""
import logging
from datetime import datetime, timezone
from typing import Any

from core.database import get_connection, return_connection
from core import db_pg
from services.unbound_client import call_llm
from services.criteria import evaluate_criteria
from services.context import extract_context
from utils.enums import WorkflowExecutionStatus, StepAttemptStatus

logger = logging.getLogger(__name__)

MAX_RETRIES_PER_STEP = 3


def _utc_now():
    return datetime.now(timezone.utc)


def run_execution(execution_id: int) -> None:
    """
    Run a workflow execution to completion (or failure). Call from a background thread.
    Uses its own DB connection. Persists every attempt; retries per step up to MAX_RETRIES_PER_STEP.
    """
    conn = get_connection()
    try:
        ex = db_pg.execution_get(conn, execution_id)
        if not ex:
            logger.error("Execution %s not found", execution_id)
            return
        if ex["status"] != WorkflowExecutionStatus.PENDING.value:
            logger.warning("Execution %s already running or finished: %s", execution_id, ex["status"])
            return

        workflow_id = ex["workflow_id"]
        steps = db_pg.step_list_by_workflow(conn, workflow_id)
        if not steps:
            db_pg.execution_update(
                conn, execution_id, WorkflowExecutionStatus.COMPLETED.value,
                current_step_index=None, started_at=_utc_now(), finished_at=_utc_now(),
            )
            conn.commit()
            return

        db_pg.execution_update(
            conn, execution_id, WorkflowExecutionStatus.RUNNING.value,
            current_step_index=0, started_at=_utc_now(), finished_at=None,
        )
        conn.commit()

        context_from_previous = ""
        for step_index, step in enumerate(steps):
            step_id = step["id"]
            db_pg.execution_update(conn, execution_id, WorkflowExecutionStatus.RUNNING.value, current_step_index=step_index, started_at=None, finished_at=None)
            conn.commit()

            prompt_with_context = step["prompt"]
            if context_from_previous:
                prompt_with_context = f"{step['prompt']}\n\n--- Context from previous step ---\n{context_from_previous}"

            attempt_number = 0
            passed = False
            last_response = ""
            last_failure_reason = None

            while attempt_number < MAX_RETRIES_PER_STEP:
                attempt_number += 1
                logger.info("Execution %s step %s attempt %s", execution_id, step_id, attempt_number)

                attempt_id = db_pg.step_attempt_insert(
                    conn, execution_id, step_id, attempt_number,
                    status=StepAttemptStatus.RUNNING.value, prompt_sent=prompt_with_context,
                    response=None, criteria_passed=None, failure_reason=None, tokens_used=None,
                )
                conn.commit()

                try:
                    result = call_llm(prompt_with_context, step["model"])
                    last_response = result.content
                    passed, last_failure_reason = evaluate_criteria(step["completion_criteria"], last_response)
                    db_pg.step_attempt_update(
                        conn, attempt_id,
                        status=StepAttemptStatus.PASSED.value if passed else StepAttemptStatus.FAILED.value,
                        response=last_response, criteria_passed=passed, failure_reason=last_failure_reason,
                        tokens_used=result.tokens_used,
                    )
                    conn.commit()
                except Exception as e:
                    logger.exception("Execution %s step %s attempt %s LLM error: %s", execution_id, step_id, attempt_number, e)
                    db_pg.step_attempt_update(
                        conn, attempt_id,
                        status=StepAttemptStatus.FAILED.value, response=None, criteria_passed=False,
                        failure_reason=str(e), tokens_used=None,
                    )
                    conn.commit()
                    last_failure_reason = str(e)

                if passed:
                    break

            if not passed:
                db_pg.execution_update(
                    conn, execution_id, WorkflowExecutionStatus.FAILED.value,
                    current_step_index=step_index, started_at=None, finished_at=_utc_now(),
                )
                conn.commit()
                return

            context_from_previous = extract_context(last_response, step["context_strategy"])

        db_pg.execution_update(
            conn, execution_id, WorkflowExecutionStatus.COMPLETED.value,
            current_step_index=len(steps) - 1, started_at=None, finished_at=_utc_now(),
        )
        conn.commit()
    except Exception as e:
        logger.exception("Execution %s failed: %s", execution_id, e)
        try:
            db_pg.execution_update(
                conn, execution_id, WorkflowExecutionStatus.FAILED.value,
                current_step_index=None, started_at=None, finished_at=_utc_now(),
            )
            conn.commit()
        except Exception:
            conn.rollback()
        raise
    finally:
        return_connection(conn)
