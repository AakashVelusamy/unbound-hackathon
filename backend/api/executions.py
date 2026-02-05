"""Execution API — all DB access via PostgreSQL stored functions."""
import logging
import threading
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from psycopg2 import extensions

from core.database import get_db
from core import db_pg
from schemas import WorkflowExecutionRead, ExecutionListItem, StepAttemptRead
from services.executor import run_execution_resume
from utils.enums import WorkflowExecutionStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/executions", tags=["executions"])


def _build_narrative(ex: dict, attempts: list[dict]) -> str:
    """Human-readable explanation of the run."""
    lines = []
    snapshot = ex.get("workflow_definition_snapshot") or {}
    steps = snapshot.get("steps") or []
    steps_sorted = sorted(steps, key=lambda s: s.get("order_index", 0))
    attempts_by_step = {}
    for a in attempts:
        sid = a["step_id"]
        if sid not in attempts_by_step:
            attempts_by_step[sid] = []
        attempts_by_step[sid].append(a)

    for i, step in enumerate(steps_sorted):
        step_id = step.get("id")
        step_num = i + 1
        step_attempts = attempts_by_step.get(step_id) or []
        if not step_attempts:
            if ex.get("status") == WorkflowExecutionStatus.RUNNING.value and ex.get("current_step_index") == i:
                lines.append(f"Step {step_num}: running…")
            continue
        passed = any(a.get("criteria_passed") for a in step_attempts)
        if passed:
            lines.append(f"Step {step_num}: passed.")
        else:
            last = step_attempts[-1]
            failure_type = last.get("failure_type") or "unknown"
            reason = last.get("failure_reason") or "no reason"
            lines.append(f"Step {step_num}: failed after {len(step_attempts)} retries ({failure_type}: {reason}).")

    status = ex.get("status")
    if status == WorkflowExecutionStatus.COMPLETED.value:
        lines.append("Workflow completed successfully.")
    elif status == WorkflowExecutionStatus.FAILED.value:
        lines.append("Workflow stopped (step failed).")
    elif status == WorkflowExecutionStatus.PAUSED.value:
        lines.append("Workflow paused (approval required).")
    return " ".join(lines) if lines else ""


@router.get(
    "",
    response_model=list[ExecutionListItem],
    summary="List executions",
    description="List all executions, optionally filtered by **workflow_id** query param.",
)
def list_executions(
    workflow_id: int | None = None,
    conn: Annotated[extensions.connection, Depends(get_db)] = None,
):
    rows = db_pg.execution_list(conn, workflow_id)
    return [ExecutionListItem(**r) for r in rows]


@router.get(
    "/{execution_id}",
    response_model=WorkflowExecutionRead,
    summary="Get execution (poll for status)",
    description="Get execution status and all step attempts. Use for polling after **POST /workflows/{id}/execute**.",
)
def get_execution(
    execution_id: int,
    conn: Annotated[extensions.connection, Depends(get_db)] = None,
):
    """Get execution status and all step attempts. Use for polling."""
    ex = db_pg.execution_get(conn, execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    attempts = db_pg.execution_get_attempts(conn, execution_id)
    snapshot = ex.get("workflow_definition_snapshot")
    if isinstance(snapshot, str):
        import json
        try:
            snapshot = json.loads(snapshot) if snapshot else None
        except Exception:
            snapshot = None
    narrative = _build_narrative(ex, attempts)
    return WorkflowExecutionRead(
        **ex,
        workflow_definition_snapshot=snapshot,
        narrative=narrative,
        step_attempts=[StepAttemptRead(**a) for a in attempts],
    )


@router.get(
    "/{execution_id}/attempts",
    response_model=list[StepAttemptRead],
    summary="Get execution attempts",
    description="Get only the step attempts (LLM calls) for an execution.",
)
def get_execution_attempts(
    execution_id: int,
    conn: Annotated[extensions.connection, Depends(get_db)] = None,
):
    """Get only the step attempts for an execution."""
    ex = db_pg.execution_get(conn, execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    attempts = db_pg.execution_get_attempts(conn, execution_id)
    return [StepAttemptRead(**a) for a in attempts]


class ApproveBody(BaseModel):
    note: str | None = None


@router.post(
    "/{execution_id}/approve",
    status_code=status.HTTP_202_ACCEPTED,
    summary="Approve (resume) paused execution",
    description="When execution is paused at an approval gate, call this to continue. Returns immediately; execution resumes in background.",
)
def approve_execution(
    execution_id: int,
    body: ApproveBody | None = None,
    conn: Annotated[extensions.connection, Depends(get_db)] = None,
):
    ex = db_pg.execution_get(conn, execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    if ex["status"] != WorkflowExecutionStatus.PAUSED.value:
        raise HTTPException(
            status_code=400,
            detail="Execution is not paused. Only paused executions (approval gate) can be approved.",
        )
    note = (body and body.note) or "Approved by user"
    thread = threading.Thread(target=run_execution_resume, args=(execution_id, note), daemon=True)
    thread.start()
    return {"status": "resuming", "execution_id": execution_id}
