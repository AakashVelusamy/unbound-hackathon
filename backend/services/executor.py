"""Workflow execution engine: sequential steps, retries, context passing, DB-backed state."""
import logging
from datetime import datetime, timezone

from core.database import get_connection, return_connection
from core import db_pg
from core.config import settings
from services.unbound_client import call_llm
from services.criteria import evaluate_criteria
from services.context import extract_context
from services.alerts import send_alert
from utils.enums import WorkflowExecutionStatus, StepAttemptStatus, FailureType

logger = logging.getLogger(__name__)

DEFAULT_MAX_RETRIES = 3


def _utc_now():
    return datetime.now(timezone.utc)


def _effective_model(step: dict) -> str:
    """Resolve 'auto' from completion criteria: regex/valid_json → kimi-k2-instruct-0905; else → kimi-k2p5."""
    step_model = step.get("model") or "kimi-k2-instruct-0905"
    if step_model != "auto":
        return step_model
    criteria = step.get("completion_criteria") or {}
    criteria_type = (criteria.get("type") or "").strip().lower()
    if criteria_type in ("regex", "valid_json"):
        return "kimi-k2-instruct-0905"
    return "kimi-k2p5"


def _run_steps(conn, execution_id: int, workflow_id: int, steps: list, start_index: int, context_from_previous: str) -> None:
    """Run steps from start_index to end. Uses steps from snapshot or DB (each step dict with id, model, prompt, etc.)."""
    for step_index in range(start_index, len(steps)):
        step = steps[step_index]
        step_id = step["id"]
        db_pg.execution_update(
            conn, execution_id, WorkflowExecutionStatus.RUNNING.value,
            current_step_index=step_index, started_at=None, finished_at=None,
        )
        conn.commit()

        prompt_with_context = step["prompt"]
        if context_from_previous:
            prompt_with_context = f"{step['prompt']}\n\n--- Context from previous step ---\n{context_from_previous}"

        # Approval gate: pause and wait for human
        if step.get("requires_approval"):
            attempt_id = db_pg.step_attempt_insert(
                conn, execution_id, step_id, 1,
                status=StepAttemptStatus.PENDING_APPROVAL.value, prompt_sent=prompt_with_context,
                response=None, criteria_passed=None, failure_reason=None, failure_type=None, tokens_used=None,
            )
            conn.commit()
            db_pg.execution_update(
                conn, execution_id, WorkflowExecutionStatus.PAUSED.value,
                current_step_index=step_index, started_at=None, finished_at=None,
            )
            conn.commit()
            logger.info("Execution %s paused at step %s (approval required)", execution_id, step_index)
            send_alert("workflow.paused", execution_id, workflow_id, "paused", {"step_index": step_index})
            return

        criteria_cfg = step.get("completion_criteria") or {}
        max_retries = int(criteria_cfg.get("max_retries") or DEFAULT_MAX_RETRIES)
        attempt_number = 0
        passed = False
        last_response = ""
        last_failure_reason = None
        model = _effective_model(step)

        while attempt_number < max_retries:
            attempt_number += 1
            logger.info("Execution %s step %s attempt %s", execution_id, step_id, attempt_number)

            attempt_id = db_pg.step_attempt_insert(
                conn, execution_id, step_id, attempt_number,
                status=StepAttemptStatus.RUNNING.value, prompt_sent=prompt_with_context,
                response=None, criteria_passed=None, failure_reason=None, failure_type=None, tokens_used=None,
            )
            conn.commit()

            try:
                result = call_llm(prompt_with_context, model)
                last_response = result.content
                passed, last_failure_reason = evaluate_criteria(criteria_cfg, last_response)
                db_pg.step_attempt_update(
                    conn, attempt_id,
                    status=StepAttemptStatus.PASSED.value if passed else StepAttemptStatus.FAILED.value,
                    response=last_response, criteria_passed=passed, failure_reason=last_failure_reason,
                    failure_type=FailureType.CRITERIA_FAILED.value if not passed else None,
                    tokens_used=result.tokens_used,
                )
                conn.commit()
            except Exception as e:
                logger.exception("Execution %s step %s attempt %s LLM error: %s", execution_id, step_id, attempt_number, e)
                db_pg.step_attempt_update(
                    conn, attempt_id,
                    status=StepAttemptStatus.FAILED.value, response=None, criteria_passed=False,
                    failure_reason=str(e), failure_type=FailureType.LLM_ERROR.value, tokens_used=None,
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
            send_alert("workflow.failed", execution_id, workflow_id, "failed", {"step_index": step_index})
            return

        context_from_previous = extract_context(last_response, step.get("context_strategy") or "full")

    db_pg.execution_update(
        conn, execution_id, WorkflowExecutionStatus.COMPLETED.value,
        current_step_index=len(steps) - 1, started_at=None, finished_at=_utc_now(),
    )
    conn.commit()
    send_alert("workflow.completed", execution_id, workflow_id, "completed")


def run_execution(execution_id: int) -> None:
    """
    Run a workflow execution to completion (or failure/paused). Call from a background thread.
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

        _run_steps(conn, execution_id, workflow_id, steps, 0, "")
    except Exception as e:
        logger.exception("Execution %s failed: %s", execution_id, e)
        try:
            db_pg.execution_update(
                conn, execution_id, WorkflowExecutionStatus.FAILED.value,
                current_step_index=None, started_at=None, finished_at=_utc_now(),
            )
            conn.commit()
            send_alert("workflow.failed", execution_id, 0, "failed")
        except Exception:
            conn.rollback()
        raise
    finally:
        return_connection(conn)


def run_execution_resume(execution_id: int, approval_note: str = "Approved by user") -> None:
    """
    Resume a paused execution after human approval. Updates the pending_approval attempt and continues.
    """
    conn = get_connection()
    try:
        ex = db_pg.execution_get(conn, execution_id)
        if not ex:
            logger.error("Execution %s not found", execution_id)
            return
        if ex["status"] != WorkflowExecutionStatus.PAUSED.value:
            logger.warning("Execution %s not paused: %s", execution_id, ex["status"])
            return_connection(conn)
            return

        workflow_id = ex["workflow_id"]
        snapshot = ex.get("workflow_definition_snapshot")
        if isinstance(snapshot, str):
            import json
            try:
                snapshot = json.loads(snapshot) if snapshot else None
            except Exception:
                snapshot = None
        steps = (snapshot or {}).get("steps") or db_pg.step_list_by_workflow(conn, workflow_id)
        steps = sorted(steps, key=lambda s: s.get("order_index", 0))

        attempts = db_pg.execution_get_attempts(conn, execution_id)
        pending = [a for a in attempts if a.get("status") == StepAttemptStatus.PENDING_APPROVAL.value]
        if not pending:
            logger.warning("Execution %s has no pending approval attempt", execution_id)
            return_connection(conn)
            return
        last_pending = pending[-1]
        db_pg.step_attempt_update(
            conn, last_pending["id"],
            status=StepAttemptStatus.PASSED.value, response=approval_note or "Approved",
            criteria_passed=True, failure_reason=None, failure_type=None, tokens_used=None,
        )
        conn.commit()

        step_index = ex["current_step_index"]
        context_from_previous = approval_note or "Approved by user"
        db_pg.execution_update(
            conn, execution_id, WorkflowExecutionStatus.RUNNING.value,
            current_step_index=step_index + 1, started_at=None, finished_at=None,
        )
        conn.commit()

        _run_steps(conn, execution_id, workflow_id, steps, step_index + 1, context_from_previous)
    except Exception as e:
        logger.exception("Resume execution %s failed: %s", execution_id, e)
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
