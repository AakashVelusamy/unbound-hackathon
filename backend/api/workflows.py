"""CRUD API for workflows and steps. All DB access via PostgreSQL stored functions."""
import logging
import threading
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg2 import extensions

from core.database import get_db
from core import db_pg
from schemas import (
    WorkflowCreate,
    WorkflowRead,
    WorkflowList,
    WorkflowUpdate,
    StepCreate,
    StepRead,
    StepUpdate,
    ExecuteResponse,
)
from services.executor import run_execution
from utils.enums import WorkflowExecutionStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workflows", tags=["workflows"])


def _workflow_or_404(conn: extensions.connection, workflow_id: int) -> dict:
    w = db_pg.workflow_get(conn, workflow_id)
    if not w:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return w


# --- Workflows ---
@router.get("", response_model=list[WorkflowList], summary="List workflows")
def list_workflows(conn: Annotated[extensions.connection, Depends(get_db)]):
    rows = db_pg.workflow_list(conn)
    return [WorkflowList(**r) for r in rows]


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED, summary="Create workflow")
def create_workflow(
    payload: WorkflowCreate,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    workflow_id = db_pg.workflow_create(conn, payload.name)
    w = db_pg.workflow_get(conn, workflow_id)
    steps = db_pg.step_list_by_workflow(conn, workflow_id)
    return WorkflowRead(**w, steps=[StepRead(**s) for s in steps])


@router.post(
    "/{workflow_id}/execute",
    response_model=ExecuteResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Execute workflow",
    description="Start a workflow run. Returns **execution_id** immediately; run continues in background. Poll **GET /executions/{id}** for status. Returns **409** if this workflow already has a run in progress.",
    responses={
        202: {"description": "Execution started"},
        404: {"description": "Workflow not found"},
        409: {"description": "A run is already in progress for this workflow"},
    },
)
def execute_workflow(
    workflow_id: int,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    """Start a workflow run. Returns execution_id immediately; run continues in background. Poll GET /executions/{id} for status."""
    _workflow_or_404(conn, workflow_id)
    rows = db_pg.execution_list(conn, workflow_id)
    if any(r["status"] == WorkflowExecutionStatus.RUNNING.value for r in rows):
        raise HTTPException(
            status_code=409,
            detail="This workflow already has a run in progress. Wait for it to finish or poll GET /executions.",
        )
    execution_id = db_pg.execution_create(conn, workflow_id)
    thread = threading.Thread(target=run_execution, args=(execution_id,), daemon=True)
    thread.start()
    return ExecuteResponse(execution_id=execution_id)


@router.get("/{workflow_id}", response_model=WorkflowRead, summary="Get workflow")
def get_workflow(
    workflow_id: int,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    w = _workflow_or_404(conn, workflow_id)
    steps = db_pg.step_list_by_workflow(conn, workflow_id)
    return WorkflowRead(**w, steps=[StepRead(**s) for s in steps])


@router.put("/{workflow_id}", response_model=WorkflowRead, summary="Update workflow")
def update_workflow(
    workflow_id: int,
    payload: WorkflowUpdate,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    _workflow_or_404(conn, workflow_id)
    if db_pg.workflow_has_executions(conn, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist. Create a new workflow to modify.",
        )
    if payload.name is not None:
        db_pg.workflow_update(conn, workflow_id, payload.name)
    w = db_pg.workflow_get(conn, workflow_id)
    steps = db_pg.step_list_by_workflow(conn, workflow_id)
    return WorkflowRead(**w, steps=[StepRead(**s) for s in steps])


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete workflow")
def delete_workflow(
    workflow_id: int,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    _workflow_or_404(conn, workflow_id)
    if db_pg.workflow_has_executions(conn, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow cannot be deleted: executions exist.",
        )
    db_pg.workflow_delete(conn, workflow_id)


# --- Steps ---
@router.post("/{workflow_id}/steps", response_model=StepRead, status_code=status.HTTP_201_CREATED, summary="Add step")
def create_step(
    workflow_id: int,
    payload: StepCreate,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    _workflow_or_404(conn, workflow_id)
    if db_pg.workflow_has_executions(conn, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist.",
        )
    step_id = db_pg.step_create(
        conn,
        workflow_id,
        payload.order_index,
        payload.model,
        payload.prompt,
        payload.completion_criteria,
        payload.context_strategy.value,
    )
    s = db_pg.step_get(conn, step_id)
    return StepRead(**s)


@router.put("/{workflow_id}/steps/{step_id}", response_model=StepRead, summary="Update step")
def update_step(
    workflow_id: int,
    step_id: int,
    payload: StepUpdate,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    _workflow_or_404(conn, workflow_id)
    if db_pg.workflow_has_executions(conn, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist.",
        )
    s = db_pg.step_get(conn, step_id)
    if not s or s["workflow_id"] != workflow_id:
        raise HTTPException(status_code=404, detail="Step not found")
    order_index = payload.order_index if payload.order_index is not None else s["order_index"]
    model = payload.model if payload.model is not None else s["model"]
    prompt = payload.prompt if payload.prompt is not None else s["prompt"]
    completion_criteria = payload.completion_criteria if payload.completion_criteria is not None else s["completion_criteria"]
    context_strategy = (payload.context_strategy.value if payload.context_strategy is not None else s["context_strategy"])
    db_pg.step_update(conn, step_id, workflow_id, order_index, model, prompt, completion_criteria, context_strategy)
    s = db_pg.step_get(conn, step_id)
    return StepRead(**s)


@router.delete("/{workflow_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete step")
def delete_step(
    workflow_id: int,
    step_id: int,
    conn: Annotated[extensions.connection, Depends(get_db)],
):
    _workflow_or_404(conn, workflow_id)
    if db_pg.workflow_has_executions(conn, workflow_id):
        raise HTTPException(
            status_code=400,
            detail="Workflow is immutable: executions exist.",
        )
    s = db_pg.step_get(conn, step_id)
    if not s or s["workflow_id"] != workflow_id:
        raise HTTPException(status_code=404, detail="Step not found")
    db_pg.step_delete(conn, workflow_id, step_id)
