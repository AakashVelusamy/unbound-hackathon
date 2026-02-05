"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import workflows_router, executions_router
from core.database import init_db
from core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_db()
    yield
    # shutdown


APP_DESCRIPTION = """
**Agentic Workflow Builder** — multi-step AI workflows with the Unbound API.

### Phase 1 — Data & API
- **Workflows & steps**: CRUD for workflow definitions and steps (model, prompt, completion criteria, context strategy). Workflows are immutable once they have runs.
- **Executions**: List, get by id, get attempts. Poll GET /executions/{id} for run status.

### Phase 2 — LLM & criteria (internal)
- **Unbound integration**: Internal service calls the Unbound chat completions API (model, messages, max_tokens, temperature). No public "run step" endpoint.
- **Completion criteria**: Rule-based evaluation of LLM output — `contains_string`, `regex`, `has_code_block`, `valid_json`. Returns pass/fail + reason.

### Phase 3 — Execution engine
- **POST /workflows/{id}/execute**: Start a run (returns execution_id immediately; run continues in background). Guard: 409 if a run is already in progress.
- **Executor**: Sequential steps, context passing (full or truncate_chars), retries per step (max 3), every attempt persisted. GET /executions/{id} and GET /executions/{id}/attempts for polling.
"""

app = FastAPI(
    title="Agentic Workflow Builder",
    description=APP_DESCRIPTION.strip(),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflows_router)
app.include_router(executions_router)


@app.get("/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    from core.config import settings
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
