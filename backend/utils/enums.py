"""Shared enums for status, criteria types, and config."""
import enum


class WorkflowExecutionStatus(str, enum.Enum):
    """Status of a workflow run."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class StepAttemptStatus(str, enum.Enum):
    """Status of a single LLM call (one attempt)."""
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"


class ContextStrategy(str, enum.Enum):
    """How to pass output from previous step to the next."""
    FULL = "full"
    TRUNCATE_CHARS = "truncate_chars"
