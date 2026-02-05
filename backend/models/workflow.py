"""Workflow and Step definition models."""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.sqlite import JSON
from sqlalchemy.orm import relationship

from core.database import Base
from utils.enums import ContextStrategy
from utils.time import utc_now


class Workflow(Base):
    """Workflow definition — immutable once executions exist."""

    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    steps = relationship("Step", back_populates="workflow", order_by="Step.order_index")


class Step(Base):
    """Step definition within a workflow."""

    __tablename__ = "steps"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, nullable=False)

    model = Column(String(64), nullable=False)
    prompt = Column(Text, nullable=False)
    completion_criteria = Column(JSON, nullable=False)  # opaque blob, eval in code
    context_strategy = Column(String(32), nullable=False, default=ContextStrategy.FULL.value)

    workflow = relationship("Workflow", back_populates="steps")
