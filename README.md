# Payscope

Revenue Integrity Dashboard for independent physicians. Upload a claims CSV, compare actual payments to CMS Medicare benchmark rates, detect insurance downcoding, and get an AI-generated narrative identifying patterns.

## What it does

- **Two-axis analysis** — compares paid vs. Medicare expected rate (underpayment) and paid vs. charged amount (downcoding)
- **Biller Performance Score** — 0–100 score based on payment ratio and flag rate
- **Underpayment table** — sortable list of flagged claims with severity color coding
- **Payer variance chart** — horizontal bar chart showing which insurers pay the worst
- **AI narrative** — GPT-4o identifies patterns and gives actionable recommendations

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React + Tailwind CSS + Recharts |
| Backend | FastAPI + pandas |
| AI | OpenAI GPT-4o |
| Reference data | CMS 2024 Medicare Physician Fee Schedule |

## CSV format

```
Provider,Ptype,Account,Patient,D.O.S,Rdoc,Cpt,Modifier,Description,Charged,Paid
```

`Charged` is the billed amount, `Paid` is what was actually received. All other columns are passed through for context. CPT codes not in the Medicare rate table are silently ignored.

## Local setup

**Backend**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then add your OPENAI_API_KEY
uvicorn main:app --reload --port 8000
```

**Frontend**

```bash
cd frontend
npm install
npm run dev                   # opens http://localhost:5173
```

## Tests

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v
```

20 tests covering the rates table, per-claim enrichment, biller score formula, aggregations, and the API endpoint.

## Deploy

Backend → [Railway](https://railway.app): `railway up` from `backend/`, set `OPENAI_API_KEY` in Railway dashboard.

Frontend → [Vercel](https://vercel.com): set `VITE_API_URL=https://your-railway-url` in `frontend/.env.production`, then `vercel --prod` from `frontend/`.

## Sample data

`sample_data/claims_sample.csv` contains 40 rows from a real ENT practice with a synthetic `Charged` column (`Charged = Paid × 1.5`). Use it to demo the dashboard end-to-end.
