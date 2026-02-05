-- Agentic Workflow Builder — Unified PostgreSQL schema (safe for existing data)
-- Run once in Supabase: SQL Editor → New query → paste this file → Run.
-- Safe to run on existing DBs: uses ADD COLUMN IF NOT EXISTS and CREATE OR REPLACE.

-- =============================================================================
-- TABLES (CREATE IF NOT EXISTS — no-op if already exist)
-- =============================================================================

CREATE TABLE IF NOT EXISTS workflows (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    workflow_version INTEGER NOT NULL DEFAULT 1,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS steps (
    id                  SERIAL PRIMARY KEY,
    workflow_id         INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    order_index         INTEGER NOT NULL,
    model               VARCHAR(64) NOT NULL,
    prompt              TEXT NOT NULL,
    completion_criteria  JSONB NOT NULL,
    context_strategy    VARCHAR(32) NOT NULL DEFAULT 'full',
    requires_approval   BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id                          SERIAL PRIMARY KEY,
    workflow_id                 INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status                      VARCHAR(32) NOT NULL DEFAULT 'pending',
    current_step_index          INTEGER,
    started_at                  TIMESTAMPTZ,
    finished_at                 TIMESTAMPTZ,
    workflow_definition_snapshot JSONB
);

CREATE TABLE IF NOT EXISTS step_attempts (
    id                      SERIAL PRIMARY KEY,
    workflow_execution_id   INTEGER NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_id                 INTEGER NOT NULL REFERENCES steps(id) ON DELETE CASCADE,
    attempt_number          INTEGER NOT NULL,
    status                  VARCHAR(32) NOT NULL DEFAULT 'pending',
    prompt_sent             TEXT,
    response                TEXT,
    criteria_passed         BOOLEAN,
    failure_reason          TEXT,
    failure_type            VARCHAR(32),
    tokens_used             INTEGER,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- =============================================================================
-- ADD COLUMNS (for existing DBs created from older schema — safe, no-op if present)
-- =============================================================================

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS workflow_version INTEGER DEFAULT 1;
UPDATE workflows SET workflow_version = COALESCE(workflow_version, 1) WHERE workflow_version IS NULL;

ALTER TABLE steps
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN DEFAULT false;
UPDATE steps SET requires_approval = COALESCE(requires_approval, false) WHERE requires_approval IS NULL;

ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS workflow_definition_snapshot JSONB;

ALTER TABLE step_attempts
  ADD COLUMN IF NOT EXISTS failure_type VARCHAR(32);

-- =============================================================================
-- DROP FUNCTIONS WHOSE RETURN TYPE CHANGED (so CREATE OR REPLACE can succeed)
-- =============================================================================
DROP FUNCTION IF EXISTS workflow_get(integer);
DROP FUNCTION IF EXISTS execution_get(integer);
DROP FUNCTION IF EXISTS execution_get_attempts(integer);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_steps_workflow_id ON steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_step_attempts_execution_id ON step_attempts(workflow_execution_id);

-- =============================================================================
-- WORKFLOW FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION workflow_list()
RETURNS TABLE(
    id INTEGER,
    name VARCHAR(255),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    step_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT w.id, w.name, w.created_at, w.updated_at, COUNT(s.id)::BIGINT
    FROM workflows w
    LEFT JOIN steps s ON s.workflow_id = w.id
    GROUP BY w.id
    ORDER BY w.updated_at DESC;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION workflow_get(p_workflow_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    name VARCHAR(255),
    workflow_version INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY SELECT w.id, w.name, COALESCE(w.workflow_version, 1), w.created_at, w.updated_at
    FROM workflows w WHERE w.id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION workflow_create(p_name VARCHAR(255))
RETURNS INTEGER AS $$
DECLARE
    new_id INTEGER;
BEGIN
    INSERT INTO workflows (name, updated_at)
    VALUES (p_name, clock_timestamp())
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION workflow_update(p_id INTEGER, p_name VARCHAR(255))
RETURNS VOID AS $$
BEGIN
    UPDATE workflows
    SET name = p_name, updated_at = clock_timestamp(),
        workflow_version = COALESCE(workflow_version, 1) + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION workflow_delete(p_id INTEGER)
RETURNS VOID AS $$
BEGIN
    DELETE FROM workflows WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION workflow_has_executions(p_workflow_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM workflow_executions WHERE workflow_id = p_workflow_id);
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- STEP FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION step_list_by_workflow(p_workflow_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    workflow_id INTEGER,
    order_index INTEGER,
    model VARCHAR(64),
    prompt TEXT,
    completion_criteria JSONB,
    context_strategy VARCHAR(32),
    requires_approval BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.workflow_id, s.order_index, s.model, s.prompt, s.completion_criteria, s.context_strategy,
           COALESCE(s.requires_approval, false)
    FROM steps s
    WHERE s.workflow_id = p_workflow_id
    ORDER BY s.order_index;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION step_get(p_step_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    workflow_id INTEGER,
    order_index INTEGER,
    model VARCHAR(64),
    prompt TEXT,
    completion_criteria JSONB,
    context_strategy VARCHAR(32),
    requires_approval BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.workflow_id, s.order_index, s.model, s.prompt, s.completion_criteria, s.context_strategy,
           COALESCE(s.requires_approval, false)
    FROM steps s WHERE s.id = p_step_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION step_create(
    p_workflow_id INTEGER,
    p_order_index INTEGER,
    p_model VARCHAR(64),
    p_prompt TEXT,
    p_completion_criteria JSONB,
    p_context_strategy VARCHAR(32),
    p_requires_approval BOOLEAN DEFAULT false
)
RETURNS INTEGER AS $$
DECLARE
    new_id INTEGER;
BEGIN
    INSERT INTO steps (workflow_id, order_index, model, prompt, completion_criteria, context_strategy, requires_approval)
    VALUES (p_workflow_id, p_order_index, p_model, p_prompt, p_completion_criteria, p_context_strategy, COALESCE(p_requires_approval, false))
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION step_update(
    p_step_id INTEGER,
    p_workflow_id INTEGER,
    p_order_index INTEGER,
    p_model VARCHAR(64),
    p_prompt TEXT,
    p_completion_criteria JSONB,
    p_context_strategy VARCHAR(32),
    p_requires_approval BOOLEAN DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE steps
    SET order_index = p_order_index, model = p_model, prompt = p_prompt,
        completion_criteria = p_completion_criteria, context_strategy = p_context_strategy,
        requires_approval = COALESCE(p_requires_approval, requires_approval)
    WHERE id = p_step_id AND workflow_id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION step_delete(p_workflow_id INTEGER, p_step_id INTEGER)
RETURNS VOID AS $$
BEGIN
    DELETE FROM steps WHERE id = p_step_id AND workflow_id = p_workflow_id;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- EXECUTION FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION execution_list(p_workflow_id INTEGER DEFAULT NULL)
RETURNS TABLE(
    id INTEGER,
    workflow_id INTEGER,
    status VARCHAR(32),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.workflow_id, e.status, e.started_at, e.finished_at
    FROM workflow_executions e
    WHERE (p_workflow_id IS NULL OR e.workflow_id = p_workflow_id)
    ORDER BY e.started_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION execution_get(p_execution_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    workflow_id INTEGER,
    status VARCHAR(32),
    current_step_index INTEGER,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    workflow_definition_snapshot JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.workflow_id, e.status, e.current_step_index, e.started_at, e.finished_at,
           e.workflow_definition_snapshot
    FROM workflow_executions e WHERE e.id = p_execution_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION execution_get_attempts(p_execution_id INTEGER)
RETURNS TABLE(
    id INTEGER,
    step_id INTEGER,
    attempt_number INTEGER,
    status VARCHAR(32),
    prompt_sent TEXT,
    response TEXT,
    criteria_passed BOOLEAN,
    failure_reason TEXT,
    failure_type VARCHAR(32),
    tokens_used INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.step_id, a.attempt_number, a.status, a.prompt_sent, a.response,
           a.criteria_passed, a.failure_reason, a.failure_type, a.tokens_used, a.created_at
    FROM step_attempts a
    WHERE a.workflow_execution_id = p_execution_id
    ORDER BY a.created_at;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION execution_create(p_workflow_id INTEGER, p_snapshot JSONB DEFAULT NULL)
RETURNS INTEGER AS $$
DECLARE
    new_id INTEGER;
BEGIN
    INSERT INTO workflow_executions (workflow_id, status, workflow_definition_snapshot)
    VALUES (p_workflow_id, 'pending', p_snapshot)
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION execution_update(
    p_execution_id INTEGER,
    p_status VARCHAR(32),
    p_current_step_index INTEGER DEFAULT NULL,
    p_started_at TIMESTAMPTZ DEFAULT NULL,
    p_finished_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE workflow_executions
    SET status = p_status,
        current_step_index = COALESCE(p_current_step_index, current_step_index),
        started_at = COALESCE(p_started_at, started_at),
        finished_at = COALESCE(p_finished_at, finished_at)
    WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION step_attempt_insert(
    p_execution_id INTEGER,
    p_step_id INTEGER,
    p_attempt_number INTEGER,
    p_status VARCHAR(32) DEFAULT 'pending',
    p_prompt_sent TEXT DEFAULT NULL,
    p_response TEXT DEFAULT NULL,
    p_criteria_passed BOOLEAN DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL,
    p_failure_type VARCHAR(32) DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    new_id INTEGER;
BEGIN
    INSERT INTO step_attempts (
        workflow_execution_id, step_id, attempt_number, status,
        prompt_sent, response, criteria_passed, failure_reason, failure_type, tokens_used
    )
    VALUES (
        p_execution_id, p_step_id, p_attempt_number, p_status,
        p_prompt_sent, p_response, p_criteria_passed, p_failure_reason, p_failure_type, p_tokens_used
    )
    RETURNING id INTO new_id;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION step_attempt_update(
    p_attempt_id INTEGER,
    p_status VARCHAR(32) DEFAULT NULL,
    p_response TEXT DEFAULT NULL,
    p_criteria_passed BOOLEAN DEFAULT NULL,
    p_failure_reason TEXT DEFAULT NULL,
    p_failure_type VARCHAR(32) DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE step_attempts
    SET status = COALESCE(p_status, status),
        response = COALESCE(p_response, response),
        criteria_passed = COALESCE(p_criteria_passed, criteria_passed),
        failure_reason = COALESCE(p_failure_reason, failure_reason),
        failure_type = COALESCE(p_failure_type, failure_type),
        tokens_used = COALESCE(p_tokens_used, tokens_used)
    WHERE id = p_attempt_id;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- TRIGGER (workflow updated_at on step change)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE workflows SET updated_at = clock_timestamp() WHERE id = COALESCE(NEW.workflow_id, OLD.workflow_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_steps_updated ON steps;
CREATE TRIGGER tr_steps_updated
    AFTER INSERT OR UPDATE OR DELETE ON steps
    FOR EACH ROW EXECUTE PROCEDURE set_workflow_updated_at();
