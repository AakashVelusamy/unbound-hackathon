-- Run after schema.sql. Adds: workflow definition snapshot, failure_type, workflow_version, narrative support.
-- In Supabase: SQL Editor → New query → paste this entire file → Run.
-- Safe to run on existing DBs (uses IF NOT EXISTS / COALESCE where needed).

ALTER TABLE workflow_executions
  ADD COLUMN IF NOT EXISTS workflow_definition_snapshot JSONB;

ALTER TABLE step_attempts
  ADD COLUMN IF NOT EXISTS failure_type VARCHAR(32);

ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS workflow_version INTEGER DEFAULT 1;

-- workflow_update: bump version on edit
CREATE OR REPLACE FUNCTION workflow_update(p_id INTEGER, p_name VARCHAR(255))
RETURNS VOID AS $$
BEGIN
    UPDATE workflows
    SET name = p_name, updated_at = clock_timestamp(),
        workflow_version = COALESCE(workflow_version, 1) + 1
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- workflow_get with version
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

-- execution_create with snapshot
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

-- execution_get returns snapshot
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

-- step_attempt_insert with failure_type
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

-- step_attempt_update with failure_type
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

-- execution_get_attempts return failure_type
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
