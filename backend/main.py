"""FastAPI application entry point."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import workflows_router, executions_router
from core.database import init_db
from core.logging import setup_logging
import models  # noqa: F401 — register models before create_all


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    init_db()
    yield
    # shutdown


app = FastAPI(
    title="Agentic Workflow Builder",
    description="Multi-step AI workflows with Unbound API",
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
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
