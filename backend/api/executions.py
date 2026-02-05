"""Execution API — run workflow, poll status. Phase 3 implements execute."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from models import WorkflowExecution
from schemas import WorkflowExecutionRead, ExecutionListItem

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/executions", tags=["executions"])


@router.get("", response_model=list[ExecutionListItem])
def list_executions(
    workflow_id: int | None = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    """List executions, optionally filtered by workflow_id."""
    q = db.query(WorkflowExecution).order_by(WorkflowExecution.started_at.desc())
    if workflow_id is not None:
        q = q.filter(WorkflowExecution.workflow_id == workflow_id)
    rows = q.all()
    return [ExecutionListItem.model_validate(r) for r in rows]


@router.get("/{execution_id}", response_model=WorkflowExecutionRead)
def get_execution(
    execution_id: int,
    db: Annotated[Session, Depends(get_db)] = None,
):
    """Get execution status and step attempts. Used for polling."""
    ex = db.get(WorkflowExecution, execution_id)
    if not ex:
        raise HTTPException(status_code=404, detail="Execution not found")
    return ex
