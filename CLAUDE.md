# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Backend** (run from `backend/`, with `.venv` activated):
```bash
uvicorn main:app --reload --port 8000   # dev server
pytest tests/ -v                        # all tests
pytest tests/test_analyzer.py -v       # single test file
```

**Frontend** (run from `frontend/`):
```bash
npm run dev      # dev server at http://localhost:5173
npm run build    # production build
npm run lint     # ESLint
```
`/admin` **preview data**: `VITE_ADMIN_USE_MOCK_DATA=true` enables faux leads (works on Vercel too). Omit or set `false` for real Supabase. Unset in dev still defaults to mock; unset in prod defaults to real.

**Environment**: Copy `backend/.env.example` to `backend/.env` and set `OPENAI_API_KEY`. `OPENROUTER_API_KEY` is the fallback if OpenAI is unavailable. For `/admin` NPI import, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_EMAILS` (comma-separated, same people as `frontend/src/admin/config.js`).

## Architecture

### Backend (`backend/`)

Single FastAPI app: core product plus admin helpers:
- `POST /api/analyze` — accepts CSV or Excel upload, returns full analysis + AI narrative
- `POST /api/chat` — stateless chat turn about a prior analysis result
- `POST /api/admin/npi/import` — bulk upsert NPI-2 orgs from CMS NPPES (Supabase service role; Supabase JWT must be an admin email)
- `POST /api/admin/leads/{id}/letter` — send Lob intro letter (admin JWT)
- `POST /api/admin/leads/{id}/call` — outbound AI voice call via Twilio (admin JWT)
- `POST /api/admin/voice/tick` — process due follow-up calls (admin JWT or `X-Admin-Key: ADMIN_CRON_SECRET`)
- `POST /api/webhooks/lob` — Lob tracking (sign with `LOB_WEBHOOK_SECRET` when set)
- `GET|POST /api/voice/twiml?lead_id=` — TwiML for Twilio → ElevenLabs stream
- `POST /api/webhooks/twilio/voice` — Twilio call status callbacks
- `POST /api/webhooks/elevenlabs` — optional post-conversation webhook

Request flow for `/api/analyze`:
1. `main.py` parses the file into a DataFrame
2. `columns.py` → `normalize_columns()` maps arbitrary headers to the canonical schema (`cpt`, `description`, `ptype`, `charged`, `paid`). Tries exact case-insensitive match first; falls back to `llm.py` AI inference if headers don't match
3. `analyzer.py` → `analyze_claims()` runs the enrichment and aggregation pipeline, producing `summary`, `payer_breakdown`, `underpayment_table`, and `cpt_breakdown`
4. `ai.py` → `generate_narrative()` calls the LLM to produce a plain-English findings summary

**Key business logic in `analyzer.py`:**
- Claims flagged when `medicare_pct < 85%` OR `downcode_pct < 80%`
- `biller_score` = `(payment_ratio × 0.7 + (1 − flag_rate) × 0.3) × 100`, clamped 0–100
- `leakage_dollars` = total Medicare expected − total paid

**LLM abstraction (`llm.py`):**  
`chat()` tries `OPENAI_API_KEY` (gpt-4o) first, falls back to `OPENROUTER_API_KEY` (gpt-4o-mini via OpenRouter). All three LLM-using modules (`ai.py`, `chat.py`, `columns.py`) call this single function.

**Rates table (`rates.py`):** CMS 2024 Medicare Physician Fee Schedule as a `RATES` dict keyed by CPT string. Claims with unrecognized CPT codes are silently dropped during enrichment.

### Frontend (`frontend/src/`)

No router. `App.jsx` holds all state and drives rendering via a `status` string (`idle | loading | done | error`). On file upload it calls `api/analyze.js`, stores the response in `data`, and switches to the dashboard view.

Dashboard layout (status === `done`):
- Left column: `ScoreSidebar` (biller score, summary stats)
- Center column: `NarrativePanel` → `UnderpaymentTable` → `PayerChart`
- Right column: `ChatPanel` (calls `api/chat.js`)
- Optional top pill: `ColumnMappingPill` when AI column inference was used

Styling uses CSS custom properties defined in `index.css` (dark theme: `--bg-*`, `--text-*`, `--primary`, `--green`, `--red`, `--amber`) combined with Tailwind utilities.

### Sample data

`sample_data/claims_sample.csv` — 40-row ENT practice dataset. Use for end-to-end testing. `Charged` is synthetic (`Paid × 1.5`).
