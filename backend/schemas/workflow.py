"""Pydantic schemas for workflow and step API I/O."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from utils.enums import ContextStrategy


# --- Step ---
class StepBase(BaseModel):
    """Shared step fields."""
    order_index: int = Field(..., ge=0)
    model: str = Field(..., min_length=1, max_length=64)
    prompt: str = Field(..., min_length=1)
    completion_criteria: dict[str, Any] = Field(...)  # opaque JSON
    context_strategy: ContextStrategy = ContextStrategy.FULL
    requires_approval: bool = False


class StepCreate(StepBase):
    """Create step request."""
    pass


class StepRead(StepBase):
    """Step response."""
    id: int
    workflow_id: int

    class Config:
        from_attributes = True


class StepUpdate(BaseModel):
    """Partial step update."""
    order_index: int | None = None
    model: str | None = None
    prompt: str | None = None
    completion_criteria: dict[str, Any] | None = None
    context_strategy: ContextStrategy | None = None
    requires_approval: bool | None = None


# --- Workflow ---
class WorkflowBase(BaseModel):
    """Shared workflow fields."""
    name: str = Field(..., min_length=1, max_length=255)


class WorkflowCreate(WorkflowBase):
    """Create workflow request."""
    pass


class WorkflowRead(WorkflowBase):
    """Workflow response with steps."""
    id: int
    created_at: datetime
    updated_at: datetime
    workflow_version: int | None = None
    steps: list[StepRead] = []

    class Config:
        from_attributes = True


class WorkflowList(BaseModel):
    """Workflow list item (no steps)."""
    id: int
    name: str
    created_at: datetime
    updated_at: datetime
    step_count: int = 0

    class Config:
        from_attributes = True


class WorkflowUpdate(BaseModel):
    """Partial workflow update."""
    name: str | None = None
