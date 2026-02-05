"""CRUD API for workflows and steps. Immutable once executions exist."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.database import get_db
from models import Workflow, Step, WorkflowExecution
from schemas import (
    WorkflowCreate,
    WorkflowRead,
    WorkflowList,
    WorkflowUpdate,
    StepCreate,
    StepRead,
    StepUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workflows", tags=["workflows"])


def _has_executions(db: Session, workflow_id: int) -> bool:
    """True if workflow has any executions."""
    return db.query(WorkflowExecution).filter(WorkflowExecution.workflow_id == workflow_id).first() is not None


def _workflow_or_404(db: Session, workflow_id: int) -> Workflow:
    w = db.get(Workflow, workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return w


# --- Workflows ---
@router.get("", response_model=list[WorkflowList])
def list_workflows(db: Annotated[Session, Depends(get_db)]):
    """List all workflows with step count."""
    rows = (
        db.query(Workflow, func.count(Step.id).label("step_count"))
        .outerjoin(Step, Workflow.id == Step.workflow_id)
        .group_by(Workflow.id)
        .order_by(Workflow.updated_at.desc())
        .all()
    )
    return [
        WorkflowList(
            id=w.id,
            name=w.name,
            created_at=w.created_at,
            updated_at=w.updated_at,
            step_count=sc or 0,
        )
        for w, sc in rows
    ]


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
def create_workflow(
    payload: WorkflowCreate,
    db: Annotated[Session, Depends(get_db)],
):
    """Create a new workflow."""
    w = Workflow(name=payload.name)
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


@router.get("/{workflow_id}", response_model=WorkflowRead)
def get_workflow(
    workflow_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Get workflow by id with steps."""
    w = _workflow_or_404(db, workflow_id)
    return w


@router.put("/{workflow_id}", response_model=WorkflowRead)
def update_workflow(
    workflow_id: int,
    payload: WorkflowUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    """Update workflow. Blocked if any executions exist."""
    w = _workflow_or_404(db, workflow_id)
    if _has_executions(db, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist. Create a new workflow to modify.",
        )
    if payload.name is not None:
        w.name = payload.name
    db.commit()
    db.refresh(w)
    return w


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Delete workflow. Blocked if any executions exist."""
    w = _workflow_or_404(db, workflow_id)
    if _has_executions(db, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow cannot be deleted: executions exist.",
        )
    db.delete(w)
    db.commit()


# --- Steps ---
@router.post("/{workflow_id}/steps", response_model=StepRead, status_code=status.HTTP_201_CREATED)
def create_step(
    workflow_id: int,
    payload: StepCreate,
    db: Annotated[Session, Depends(get_db)],
):
    """Add step to workflow. Blocked if executions exist."""
    w = _workflow_or_404(db, workflow_id)
    if _has_executions(db, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist.",
        )
    s = Step(
        workflow_id=workflow_id,
        order_index=payload.order_index,
        model=payload.model,
        prompt=payload.prompt,
        completion_criteria=payload.completion_criteria,
        context_strategy=payload.context_strategy.value,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.put("/{workflow_id}/steps/{step_id}", response_model=StepRead)
def update_step(
    workflow_id: int,
    step_id: int,
    payload: StepUpdate,
    db: Annotated[Session, Depends(get_db)],
):
    """Update step. Blocked if executions exist."""
    _workflow_or_404(db, workflow_id)
    if _has_executions(db, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist.",
        )
    s = db.get(Step, step_id)
    if not s or s.workflow_id != workflow_id:
        raise HTTPException(status_code=404, detail="Step not found")
    if payload.order_index is not None:
        s.order_index = payload.order_index
    if payload.model is not None:
        s.model = payload.model
    if payload.prompt is not None:
        s.prompt = payload.prompt
    if payload.completion_criteria is not None:
        s.completion_criteria = payload.completion_criteria
    if payload.context_strategy is not None:
        s.context_strategy = payload.context_strategy.value
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{workflow_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(
    workflow_id: int,
    step_id: int,
    db: Annotated[Session, Depends(get_db)],
):
    """Delete step. Blocked if executions exist."""
    _workflow_or_404(db, workflow_id)
    if _has_executions(db, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist.",
        )
    s = db.get(Step, step_id)
    if not s or s.workflow_id != workflow_id:
        raise HTTPException(status_code=404, detail="Step not found")
    db.delete(s)
    db.commit()
