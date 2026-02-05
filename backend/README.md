# Agentic Workflow Builder — Backend

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
