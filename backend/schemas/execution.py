"""Pydantic schemas for execution API I/O."""
from datetime import datetime

from pydantic import BaseModel


class StepAttemptRead(BaseModel):
    """Single LLM call (one attempt)."""
    id: int
    step_id: int
    attempt_number: int
    status: str
    prompt_sent: str | None
    response: str | None
    criteria_passed: bool | None
    failure_reason: str | None
    tokens_used: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class WorkflowExecutionRead(BaseModel):
    """Execution status and attempts."""
    id: int
    workflow_id: int
    status: str
    current_step_index: int | None
    started_at: datetime | None
    finished_at: datetime | None
    step_attempts: list[StepAttemptRead] = []

    class Config:
        from_attributes = True


class ExecutionListItem(BaseModel):
    """Execution list item."""
    id: int
    workflow_id: int
    status: str
    started_at: datetime | None
    finished_at: datetime | None

    class Config:
        from_attributes = True
