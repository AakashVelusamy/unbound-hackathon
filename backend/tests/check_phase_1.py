#!/usr/bin/env python3
"""Run from backend/ to verify Phase 1: DB connection and stored functions."""
import sys
from pathlib import Path

# Ensure backend root is on path when run as script
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

print("Phase 1 check: Database connection and schema")
print("-" * 40)

# 1. Config
from core.config import settings

if not settings.database_url:
    print("  FAIL: DATABASE_URL is not set in .env")
    sys.exit(1)
print("  OK   DATABASE_URL is set")

# 2. Connect and ping
try:
    from core.database import cursor, get_connection, return_connection
except Exception as e:
    print(f"  FAIL: Could not load database module: {e}")
    sys.exit(1)

try:
    with cursor() as cur:
        cur.execute("SELECT 1 AS one")
        row = cur.fetchone()
        if row and row["one"] == 1:
            print("  OK   Connection to database works")
        else:
            print("  FAIL: Unexpected ping result")
            sys.exit(1)
except Exception as e:
    print(f"  FAIL: Connection failed: {e}")
    sys.exit(1)

# 3. Stored functions exist (workflow_list)
try:
    with cursor() as cur:
        cur.execute("SELECT * FROM workflow_list()")
        rows = cur.fetchall()
    print(f"  OK   workflow_list() works (returned {len(rows)} rows)")
except Exception as e:
    print(f"  FAIL: workflow_list() failed. Run db/schema.sql in Supabase SQL Editor: {e}")
    sys.exit(1)

# 4. Optional: one round-trip create/get/delete
try:
    from core import db_pg
    conn = get_connection()
    try:
        w_id = db_pg.workflow_create(conn, "check_phase_1_test")
        conn.commit()
        w = db_pg.workflow_get(conn, w_id)
        conn.commit()
        if w and w["name"] == "check_phase_1_test":
            db_pg.workflow_delete(conn, w_id)
            conn.commit()
            print("  OK   workflow create/get/delete round-trip works")
        else:
            print("  WARN create/get/delete returned unexpected data")
    finally:
        return_connection(conn)
except Exception as e:
    print(f"  FAIL: CRUD round-trip: {e}")
    sys.exit(1)

print("-" * 40)
print("Phase 1 check: all good.")
