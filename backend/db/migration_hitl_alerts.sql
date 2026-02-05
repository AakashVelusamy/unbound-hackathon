-- Approval gates (HITL) + Alerts support
-- Run in Supabase SQL Editor after schema.sql and migration_extras.sql.

ALTER TABLE steps
  ADD COLUMN IF NOT EXISTS requires_approval BOOLEAN NOT NULL DEFAULT false;

-- Allow 'paused' status for workflow_executions (no enum change in DB, just value)
-- No schema change needed; application will use status = 'paused'.

-- step_attempt_insert/update already accept any status; 'pending_approval' is valid.
-- No function changes required unless step_list returns requires_approval.

-- Ensure step_list_by_workflow returns requires_approval
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
