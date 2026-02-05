"""Call PostgreSQL stored functions only. No inline SQL."""
import json
from typing import Any

from psycopg2.extras import RealDictCursor


def _fetch_all(conn, sql: str, params: tuple = ()) -> list[dict]:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def _fetch_one(conn, sql: str, params: tuple = ()) -> dict | None:
    rows = _fetch_all(conn, sql, params)
    return rows[0] if rows else None


def _execute(conn, sql: str, params: tuple = ()) -> None:
    with conn.cursor() as cur:
        cur.execute(sql, params)


def _execute_returning_int(conn, sql: str, params: tuple = ()) -> int:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return row[0] if row else None


# --- Workflows ---

def workflow_list(conn) -> list[dict]:
    return _fetch_all(conn, "SELECT * FROM workflow_list()")


def workflow_get(conn, workflow_id: int) -> dict | None:
    return _fetch_one(conn, "SELECT * FROM workflow_get(%s)", (workflow_id,))


def workflow_has_executions(conn, workflow_id: int) -> bool:
    row = _fetch_one(conn, "SELECT workflow_has_executions(%s) AS ok", (workflow_id,))
    return row and row["ok"] is True


def workflow_create(conn, name: str) -> int:
    return _execute_returning_int(conn, "SELECT workflow_create(%s)", (name,))


def workflow_update(conn, workflow_id: int, name: str) -> None:
    _execute(conn, "SELECT workflow_update(%s, %s)", (workflow_id, name))


def workflow_delete(conn, workflow_id: int) -> None:
    _execute(conn, "SELECT workflow_delete(%s)", (workflow_id,))


# --- Steps ---

def step_list_by_workflow(conn, workflow_id: int) -> list[dict]:
    return _fetch_all(conn, "SELECT * FROM step_list_by_workflow(%s)", (workflow_id,))


def step_get(conn, step_id: int) -> dict | None:
    return _fetch_one(conn, "SELECT * FROM step_get(%s)", (step_id,))


def step_create(
    conn,
    workflow_id: int,
    order_index: int,
    model: str,
    prompt: str,
    completion_criteria: dict[str, Any],
    context_strategy: str,
) -> int:
    return _execute_returning_int(
        conn,
        "SELECT step_create(%s, %s, %s, %s, %s::jsonb, %s)",
        (workflow_id, order_index, model, prompt, json.dumps(completion_criteria), context_strategy),
    )


def step_update(
    conn,
    step_id: int,
    workflow_id: int,
    order_index: int,
    model: str,
    prompt: str,
    completion_criteria: dict[str, Any],
    context_strategy: str,
) -> None:
    _execute(
        conn,
        "SELECT step_update(%s, %s, %s, %s, %s, %s::jsonb, %s)",
        (step_id, workflow_id, order_index, model, prompt, json.dumps(completion_criteria), context_strategy),
    )


def step_delete(conn, workflow_id: int, step_id: int) -> None:
    _execute(conn, "SELECT step_delete(%s, %s)", (workflow_id, step_id))


# --- Executions ---

def execution_list(conn, workflow_id: int | None = None) -> list[dict]:
    if workflow_id is None:
        return _fetch_all(conn, "SELECT * FROM execution_list(NULL)")
    return _fetch_all(conn, "SELECT * FROM execution_list(%s)", (workflow_id,))


def execution_get(conn, execution_id: int) -> dict | None:
    return _fetch_one(conn, "SELECT * FROM execution_get(%s)", (execution_id,))


def execution_get_attempts(conn, execution_id: int) -> list[dict]:
    return _fetch_all(conn, "SELECT * FROM execution_get_attempts(%s)", (execution_id,))


# Phase 3
def execution_create(conn, workflow_id: int) -> int:
    return _execute_returning_int(conn, "SELECT execution_create(%s)", (workflow_id,))


def execution_update(
    conn,
    execution_id: int,
    status: str,
    current_step_index: int | None = None,
    started_at: Any = None,
    finished_at: Any = None,
) -> None:
    _execute(
        conn,
        "SELECT execution_update(%s, %s, %s, %s, %s)",
        (execution_id, status, current_step_index, started_at, finished_at),
    )


def step_attempt_insert(
    conn,
    execution_id: int,
    step_id: int,
    attempt_number: int,
    status: str = "pending",
    prompt_sent: str | None = None,
    response: str | None = None,
    criteria_passed: bool | None = None,
    failure_reason: str | None = None,
    tokens_used: int | None = None,
) -> int:
    return _execute_returning_int(
        conn,
        "SELECT step_attempt_insert(%s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (
            execution_id, step_id, attempt_number, status,
            prompt_sent, response, criteria_passed, failure_reason, tokens_used,
        ),
    )


def step_attempt_update(
    conn,
    attempt_id: int,
    status: str | None = None,
    response: str | None = None,
    criteria_passed: bool | None = None,
    failure_reason: str | None = None,
    tokens_used: int | None = None,
) -> None:
    _execute(
        conn,
        "SELECT step_attempt_update(%s, %s, %s, %s, %s, %s)",
        (attempt_id, status, response, criteria_passed, failure_reason, tokens_used),
    )
