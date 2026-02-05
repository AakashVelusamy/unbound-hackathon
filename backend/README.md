# Agentic Workflow Builder — Backend

## Database: Supabase (PostgreSQL)

All data access uses **stored functions** (no inline SQL in Python). Supabase is hosted PostgreSQL — no local install needed.

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is enough).

2. **Run the schema** (tables + functions):
   - In Supabase: **SQL Editor** → **New query**
   - Paste the full contents of `backend/db/schema.sql`
   - Click **Run** (or Ctrl+Enter)

3. **Get the connection string** and put it in `.env`:
   - Open your **Supabase project** in the dashboard
   - Click the **Connect** button (top of the page, near the project name)
   - In the modal, pick **URI** and choose **Transaction** (port 6543) or **Session** (5432)
   - Copy the URI and replace `[YOUR-PASSWORD]` with your **database password** (set when you created the project; you can reset it under **Project Settings** → **Database** if needed)
   - Paste into `backend/.env` as `DATABASE_URL=...`

**Verify connection:** From `backend/` run `python -m tests.check_phase_1` or `python tests/check_phase_1.py` to confirm DB connection and schema. Run `python -m tests.check_phase_2` for Phase 2 (criteria + Unbound).

## Run

From project root:

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Or with uvicorn directly (from `backend/`):

```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API: http://localhost:8000  
Docs: http://localhost:8000/docs

## Phases

- **Phase 1**: Workflow & step CRUD, execution list/get, immutability when runs exist.
- **Phase 2**: Unbound LLM client and completion-criteria evaluation (internal services; no new endpoints). Criteria: `contains_string`, `regex`, `has_code_block`, `valid_json`.
- **Phase 3**: Workflow execution engine (POST execute, background run, retries, context passing).
