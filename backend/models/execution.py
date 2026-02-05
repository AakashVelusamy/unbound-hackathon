"""WorkflowExecution and StepAttempt models — one row per LLM call."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from core.database import Base
from utils.time import utc_now


class WorkflowExecution(Base):
    """A single run of a workflow."""

    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(32), nullable=False, default="pending")
    current_step_index = Column(Integer, nullable=True)  # which step is running
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)

    workflow = relationship("Workflow", backref="executions")
    step_attempts = relationship("StepAttempt", back_populates="execution", order_by="StepAttempt.created_at")


class StepAttempt(Base):
    """One LLM call — retries create new rows."""

    __tablename__ = "step_attempts"

    id = Column(Integer, primary_key=True, index=True)
    workflow_execution_id = Column(
        Integer, ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False
    )
    step_id = Column(Integer, ForeignKey("steps.id", ondelete="CASCADE"), nullable=False)
    attempt_number = Column(Integer, nullable=False)

    status = Column(String(32), nullable=False, default="pending")
    prompt_sent = Column(Text, nullable=True)  # what was actually sent
    response = Column(Text, nullable=True)
    criteria_passed = Column(Boolean, nullable=True)
    failure_reason = Column(Text, nullable=True)
    tokens_used = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    execution = relationship("WorkflowExecution", back_populates="step_attempts")
    step = relationship("Step", backref="attempts")
