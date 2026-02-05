# Deployment (Vercel + Render)

## Overview

- **Backend (FastAPI)** → **Render** (Web Service)
- **Frontend (Vite/React)** → **Vercel** (static + env)

Deploy backend first so you have a URL for the frontend env.

---

## 1. Render (backend)

1. **Connect repo** at [render.com](https://render.com) → New → Web Service.
2. **Repository:** link your GitHub repo.
3. **Settings:**
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Runtime:** Python 3
4. **Environment variables** (Dashboard → Environment):
   - `DATABASE_URL` — Supabase Postgres URI (use pooler, e.g. port 6543)
   - `UNBOUND_API_KEY` — your Unbound API key
   - Optional: `UNBOUND_API_URL`, SMTP/alert vars
5. **Deploy.** Copy the service URL (e.g. `https://agentic-workflow-builder-api.onrender.com`).

---

## 2. Vercel (frontend)

1. **Connect repo** at [vercel.com](https://vercel.com) → Add New → Project.
2. **Settings:**
   - **Root Directory:** `frontend` (Edit → set to `frontend`)
   - Build/output are read from `frontend/vercel.json`.
3. **Environment variable:**
   - `VITE_API_URL` = your Render backend URL (e.g. `https://agentic-workflow-builder-api.onrender.com`) — no trailing slash.
4. **Deploy.** Your app URL is the Vercel project URL.

---

## 3. Post-deploy

- **Database:** Run `backend/db/schema.sql` in Supabase SQL Editor once (fresh DB).
- **CORS:** Backend allows all origins; restrict in production if needed.
- **Render free tier:** Service sleeps after inactivity; first request may be slow.

---

## Quick checklist

| Step | Where | What |
|------|--------|------|
| 1 | Supabase | Create DB, run `schema.sql`, copy connection string |
| 2 | Render | New Web Service, root `backend`, set `DATABASE_URL` + `UNBOUND_API_KEY`, deploy |
| 3 | Vercel | New Project, root `frontend`, set `VITE_API_URL` = Render URL, deploy |
