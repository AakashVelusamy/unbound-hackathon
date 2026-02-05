# Agentic Workflow Builder — Phases

## Phase 1: Data Layer & Core API ✅

**Goal:** Persistent storage and workflow management.

**Scope:**
- FastAPI + SQLite (SQLAlchemy)
- Models: `Workflow`, `Step`, `WorkflowExecution`, `StepAttempt`
- `step_attempts` = one row per LLM call (retries create new rows)
- Completion criteria = opaque JSON; evaluation in code
- `context_strategy` per step: `full` | `truncate_chars`
- Immutability: block edits if any `workflow_execution` exists

**API:**
- CRUD workflows and steps
- `GET /executions`, `GET /executions/{id}` (polling)

**Status:** Done

---

## Phase 2: Unbound Integration & Completion Criteria

**Goal:** Single-step LLM calls and configurable completion checks.

**Scope:**
- Internal services only (no "run step" API):
  - `call_llm(step, context)` → raw response
  - `evaluate_criteria(step, response)` → pass/fail
- Unbound HTTP client
- Rule-based criteria: `contains_string`, `regex`, `has_code_block`, `valid_json`
- No LLM judge; criteria remain deterministic

**API:** No new endpoints. Phase 3 consumes these services.

**Status:** Pending

---

## Phase 3: Workflow Execution Engine

**Goal:** Run workflows with context passing and retries.

**Scope:**
- `POST /workflows/{id}/execute` → create execution, return id immediately
- Run execution off request thread (structure as if async)
- For each step: `call_llm` → insert `step_attempt` → `evaluate_criteria`
- If fail: retry (new `step_attempt` row) up to retry budget
- If pass: extract context via `context_strategy`, inject into next step
- Persist `prompt_sent` on every attempt

**Context strategy:** `full` and `truncate_chars` only.

**Status:** Pending

---

## Phase 4: Frontend — Workflow Builder UI

**Goal:** Create and configure workflows and steps.

**Scope:**
- List, create, edit, delete workflows
- Add, edit, delete steps (order via number input, no drag-and-drop)
- Per step: model select, prompt textarea, completion criteria type + config

**Status:** Pending

---

## Phase 5: Frontend — Execution & Progress

**Goal:** Run workflows and show progress.

**Scope:**
- Run button
- Poll `GET /executions/{id}` every 1–2 seconds
- Show: current step, last attempt, failure reason, retry count
- Execution history list and detail view

**Status:** Pending

---

## Phase 6: Deploy & Extras

**Goal:** Production deploy and optional features.

**Scope:**
- Deploy backend and frontend
- Retry budget (configurable per step)
- Cost tracking
- Workflow export (JSON/YAML)
- Other bonuses as time allows

**Status:** Pending
