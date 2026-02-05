"""Execution API — all DB access via PostgreSQL stored functions."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from psycopg2 import extensions

from core.database import get_db
from core import db_pg
from schemas import WorkflowExecutionRead, ExecutionListItem, StepAttemptRead

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/executions", tags=["executions"])


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
    return WorkflowExecutionRead(**ex, step_attempts=[StepAttemptRead(**a) for a in attempts])


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
