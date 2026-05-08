# Payscope MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Revenue Integrity Dashboard that ingests a physician's claims CSV, compares payments to CMS Medicare rates across two axes (downcoding + underpayment), scores the biller 0–100, and generates an OpenAI GPT-4o narrative identifying patterns.

**Architecture:** FastAPI backend receives CSV upload, processes with pandas (per-claim calculations → aggregations → biller score → OpenAI call), returns structured JSON. Vite + React frontend renders score-first sidebar layout: biller score ring + KPIs left, underpayment table + payer chart right, AI narrative below.

**Tech Stack:** Python 3.11+, FastAPI, pandas, openai SDK · Vite, React 18, Tailwind CSS v3, Recharts

---

## File Map

```
payscope/
  backend/
    rates.py              ← Medicare rate dict {cpt: float}
    analyzer.py           ← pandas analysis + biller score
    ai.py                 ← OpenAI GPT-4o call
    main.py               ← FastAPI app + /api/analyze endpoint
    requirements.txt
    .env                  ← OPENAI_API_KEY (not committed)
    tests/
      conftest.py         ← shared test fixtures
      test_analyzer.py    ← unit tests for analysis logic
      test_api.py         ← integration tests for FastAPI endpoint
  frontend/
    index.html
    vite.config.js
    tailwind.config.js
    postcss.config.js
    package.json
    src/
      main.jsx
      App.jsx
      api/
        analyze.js        ← fetch wrapper for POST /api/analyze
      components/
        UploadZone.jsx
        ScoreSidebar.jsx
        UnderpaymentTable.jsx
        PayerChart.jsx
        NarrativePanel.jsx
  sample_data/
    claims_sample.csv     ← SR4BYU2.csv with Charged column added
```

---

## Task 1: Project Scaffold + Dependencies

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env` (template)
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Create backend directory and requirements.txt**

```
backend/requirements.txt
```
```
fastapi==0.115.0
uvicorn==0.31.0
pandas==2.2.3
python-multipart==0.0.12
openai==1.51.0
pytest==8.3.3
httpx==0.27.2
python-dotenv==1.0.1
```

- [ ] **Step 2: Create Python virtual environment and install dependencies**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Expected: all packages install without errors.

- [ ] **Step 3: Create .env template**

```
backend/.env
```
```
OPENAI_API_KEY=sk-...your-key-here...
```

- [ ] **Step 4: Create tests package init**

```
backend/tests/__init__.py
```
```python
```
(empty file)

- [ ] **Step 5: Create conftest.py with shared test data**

```
backend/tests/conftest.py
```
```python
import pandas as pd
import pytest


@pytest.fixture
def sample_df():
    return pd.DataFrame([
        {"ptype": "AETNA",  "cpt": "99213", "description": "OFFICE VISIT EST",   "charged": 120.00, "paid": 58.97},
        {"ptype": "AETNA",  "cpt": "30520", "description": "SEPTOPLASTY",         "charged": 600.00, "paid": 140.61},
        {"ptype": "BC/BS",  "cpt": "99213", "description": "OFFICE VISIT EST",    "charged": 120.00, "paid": 93.91},
        {"ptype": "BC/BS",  "cpt": "69210", "description": "REMOVE IMPACTED EAR", "charged": 80.00,  "paid": 51.23},
        {"ptype": "ALPHA",  "cpt": "99204", "description": "OFFICE VISIT NEW",    "charged": 200.00, "paid": 30.00},
    ])


@pytest.fixture
def fully_paid_df():
    """All claims paid at or above Medicare rates — expect high score."""
    return pd.DataFrame([
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.00, "paid": 100.00},
        {"ptype": "AETNA", "cpt": "69210", "description": "REMOVE EAR WAX",   "charged": 80.00,  "paid": 60.00},
    ])
```

- [ ] **Step 6: Verify pytest discovers the tests directory**

```bash
cd backend
source .venv/bin/activate
pytest tests/ --collect-only
```

Expected: `no tests ran` (no test files yet, but no errors either).

- [ ] **Step 7: Commit scaffold**

```bash
cd ..
git add backend/
git commit -m "feat: scaffold backend with dependencies and test fixtures"
```

---

## Task 2: Medicare Rates Table

**Files:**
- Create: `backend/rates.py`
- Create: `backend/tests/test_analyzer.py` (first test only)

Medicare rates below are CMS 2024 Physician Fee Schedule **national non-facility** rates. Verify at [https://www.cms.gov/medicare/payment/fee-schedules/physician](https://www.cms.gov/medicare/payment/fee-schedules/physician) if precision matters for your demo.

- [ ] **Step 1: Create rates.py**

```
backend/rates.py
```
```python
# CMS 2024 Physician Fee Schedule — national non-facility rates
RATES: dict[str, float] = {
    "99203": 111.97,   # Office visit, new, low complexity
    "99204": 167.55,   # Office visit, new, moderate complexity
    "99205": 225.51,   # Office visit, new, high complexity
    "99213": 93.91,    # Office visit, established, low complexity
    "99214": 135.10,   # Office visit, established, moderate complexity
    "99215": 176.52,   # Office visit, established, high complexity
    "30520": 563.26,   # Septoplasty
    "30140": 394.93,   # Submucous resection inferior turbinate
    "30802": 127.23,   # Cautery ablation, soft tissue of inferior turbinate
    "31231": 145.68,   # Nasal endoscopy, diagnostic
    "69210": 52.33,    # Removal of impacted cerumen (ear wax)
    "92511": 117.96,   # Nasopharyngoscopy with endoscope
    "92504": 58.21,    # Binocular microscopy
    "10060": 113.47,   # Incision and drainage of abscess, simple
    "11000": 73.14,    # Debridement of skin
    "40808": 113.47,   # Biopsy of mouth lesion
    "60220": 714.47,   # Total thyroid lobectomy, unilateral
}
```

- [ ] **Step 2: Write failing test for rates lookup**

```
backend/tests/test_analyzer.py
```
```python
from rates import RATES


def test_rates_contains_common_ent_codes():
    required = ["99213", "99214", "30520", "69210", "92511", "31231"]
    for code in required:
        assert code in RATES, f"Missing CPT {code} in RATES"


def test_rates_values_are_positive_floats():
    for code, rate in RATES.items():
        assert isinstance(rate, float), f"Rate for {code} is not a float"
        assert rate > 0, f"Rate for {code} is not positive"
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd backend
source .venv/bin/activate
pytest tests/test_analyzer.py::test_rates_contains_common_ent_codes tests/test_analyzer.py::test_rates_values_are_positive_floats -v
```

Expected:
```
PASSED tests/test_analyzer.py::test_rates_contains_common_ent_codes
PASSED tests/test_analyzer.py::test_rates_values_are_positive_floats
```

- [ ] **Step 4: Commit**

```bash
git add backend/rates.py backend/tests/test_analyzer.py
git commit -m "feat: add CMS 2024 Medicare reference rates for ENT CPT codes"
```

---

## Task 3: Per-Claim Analysis Logic

**Files:**
- Create: `backend/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing tests for per-claim calculations**

Append to `backend/tests/test_analyzer.py`:

```python
import pandas as pd
from analyzer import enrich_claims, MEDICARE_FLAG_THRESHOLD, DOWNCODE_FLAG_THRESHOLD


def test_enrich_adds_medicare_expected(sample_df):
    result = enrich_claims(sample_df.copy())
    assert "medicare_expected" in result.columns
    # 99213 should map to RATES["99213"]
    aetna_99213 = result[(result["ptype"] == "AETNA") & (result["cpt"] == "99213")].iloc[0]
    from rates import RATES
    assert aetna_99213["medicare_expected"] == RATES["99213"]


def test_enrich_calculates_downcode_pct(sample_df):
    result = enrich_claims(sample_df.copy())
    row = result[(result["ptype"] == "AETNA") & (result["cpt"] == "99213")].iloc[0]
    expected_pct = round(58.97 / 120.00 * 100, 1)
    assert row["downcode_pct"] == expected_pct


def test_enrich_calculates_medicare_pct(sample_df):
    result = enrich_claims(sample_df.copy())
    row = result[(result["ptype"] == "AETNA") & (result["cpt"] == "99213")].iloc[0]
    from rates import RATES
    expected_pct = round(58.97 / RATES["99213"] * 100, 1)
    assert row["medicare_pct"] == expected_pct


def test_enrich_flags_severe_underpayment(sample_df):
    result = enrich_claims(sample_df.copy())
    # AETNA/30520: paid $140.61 vs Medicare $563.26 = 24.9% — should be flagged
    row = result[(result["ptype"] == "AETNA") & (result["cpt"] == "30520")].iloc[0]
    assert row["flagged"] is True


def test_enrich_drops_unknown_cpt_codes():
    df = pd.DataFrame([
        {"ptype": "AETNA", "cpt": "00000", "description": "UNKNOWN", "charged": 100.0, "paid": 50.0},
    ])
    result = enrich_claims(df.copy())
    assert len(result) == 0


def test_enrich_graceful_on_zero_charged():
    df = pd.DataFrame([
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT", "charged": 0.0, "paid": 50.0},
    ])
    result = enrich_claims(df.copy())
    # Row with zero charged should be dropped (division by zero risk)
    assert len(result) == 0
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_analyzer.py -k "enrich" -v
```

Expected: `ImportError: cannot import name 'enrich_claims' from 'analyzer'` (file doesn't exist yet).

- [ ] **Step 3: Create analyzer.py with enrich_claims**

```
backend/analyzer.py
```
```python
import pandas as pd
from rates import RATES

MEDICARE_FLAG_THRESHOLD = 0.85
DOWNCODE_FLAG_THRESHOLD = 0.80


def enrich_claims(df: pd.DataFrame) -> pd.DataFrame:
    """Add per-claim derived columns; drop rows with unknown CPT or invalid amounts."""
    df = df.copy()
    df["cpt"] = df["cpt"].astype(str).str.strip()
    df["charged"] = pd.to_numeric(df["charged"], errors="coerce")
    df["paid"] = pd.to_numeric(df["paid"], errors="coerce")

    df["medicare_expected"] = df["cpt"].map(RATES)

    # Drop rows missing required data or with zero/negative charged amount
    df = df.dropna(subset=["charged", "paid", "medicare_expected"])
    df = df[df["charged"] > 0]

    if df.empty:
        return df

    df["downcode_pct"] = (df["paid"] / df["charged"] * 100).round(1)
    df["medicare_pct"] = (df["paid"] / df["medicare_expected"] * 100).round(1)
    df["downcode_gap"] = (df["charged"] - df["paid"]).round(2)
    df["medicare_gap"] = (df["paid"] - df["medicare_expected"]).round(2)
    df["flagged"] = (
        (df["medicare_pct"] < MEDICARE_FLAG_THRESHOLD * 100)
        | (df["downcode_pct"] < DOWNCODE_FLAG_THRESHOLD * 100)
    )
    return df
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pytest tests/test_analyzer.py -k "enrich" -v
```

Expected: all 6 `enrich_*` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: per-claim enrichment — Medicare lookup, downcode/underpayment flags"
```

---

## Task 4: Aggregations + Biller Score

**Files:**
- Modify: `backend/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing tests for aggregations and score**

Append to `backend/tests/test_analyzer.py`:

```python
from analyzer import compute_biller_score, analyze_claims


def test_biller_score_perfect():
    # 100% payment ratio, 0% flag rate → score = 100
    assert compute_biller_score(100.0, 100.0, 0, 10) == 100


def test_biller_score_zero():
    # 0% payment ratio, 100% flag rate → score = 0
    assert compute_biller_score(0.0, 100.0, 10, 10) == 0


def test_biller_score_typical():
    # payment_ratio=0.87, flag_rate=0.25 → (0.87*0.7 + 0.75*0.3)*100 = 83.4
    score = compute_biller_score(87.0, 100.0, 2, 8)
    assert score == 83


def test_analyze_claims_returns_required_keys(sample_df):
    result = analyze_claims(sample_df.copy())
    assert "summary" in result
    assert "payer_breakdown" in result
    assert "underpayment_table" in result
    assert "cpt_breakdown" in result


def test_analyze_claims_summary_totals(sample_df):
    result = analyze_claims(sample_df.copy())
    s = result["summary"]
    assert s["total_paid"] > 0
    assert s["total_medicare_expected"] > 0
    assert 0 <= s["biller_score"] <= 100
    assert s["flagged_claims"] <= s["total_claims"]


def test_analyze_claims_leakage_is_medicare_minus_paid(sample_df):
    result = analyze_claims(sample_df.copy())
    s = result["summary"]
    expected_leakage = round(s["total_medicare_expected"] - s["total_paid"], 2)
    assert s["leakage_dollars"] == expected_leakage


def test_underpayment_table_sorted_worst_first(sample_df):
    result = analyze_claims(sample_df.copy())
    gaps = [row["medicare_gap"] for row in result["underpayment_table"]]
    assert gaps == sorted(gaps)  # ascending = most negative (worst) first


def test_payer_breakdown_has_all_payers(sample_df):
    result = analyze_claims(sample_df.copy())
    payers = {row["payer"] for row in result["payer_breakdown"]}
    assert "AETNA" in payers
    assert "BC/BS" in payers
    assert "ALPHA" in payers
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_analyzer.py -k "score or analyze" -v
```

Expected: `ImportError: cannot import name 'compute_biller_score'`

- [ ] **Step 3: Add compute_biller_score and analyze_claims to analyzer.py**

Append to `backend/analyzer.py`:

```python
def compute_biller_score(
    total_paid: float,
    total_medicare_expected: float,
    flagged_claims: int,
    total_claims: int,
) -> int:
    if total_medicare_expected == 0 or total_claims == 0:
        return 0
    payment_ratio = total_paid / total_medicare_expected
    flag_rate = flagged_claims / total_claims
    raw = (payment_ratio * 0.7 + (1 - flag_rate) * 0.3) * 100
    return int(max(0, min(100, round(raw))))


def analyze_claims(df: pd.DataFrame) -> dict:
    """Full analysis pipeline: enrich → aggregate → score. Returns JSON-serializable dict."""
    enriched = enrich_claims(df)

    if enriched.empty:
        raise ValueError("No valid claims found with recognized CPT codes and non-zero amounts.")

    total_charged = float(enriched["charged"].sum())
    total_medicare_expected = float(enriched["medicare_expected"].sum())
    total_paid = float(enriched["paid"].sum())
    flagged_claims = int(enriched["flagged"].sum())
    total_claims = len(enriched)
    leakage_dollars = round(total_medicare_expected - total_paid, 2)
    leakage_pct = round(leakage_dollars / total_medicare_expected * 100, 1) if total_medicare_expected > 0 else 0.0
    biller_score = compute_biller_score(total_paid, total_medicare_expected, flagged_claims, total_claims)

    # Payer breakdown
    payer_agg = (
        enriched.groupby("ptype")
        .agg(paid=("paid", "sum"), expected=("medicare_expected", "sum"), flagged=("flagged", "sum"))
        .reset_index()
        .rename(columns={"ptype": "payer"})
    )
    payer_agg["variance_pct"] = (
        (payer_agg["paid"] - payer_agg["expected"]) / payer_agg["expected"] * 100
    ).round(1)

    # CPT breakdown
    cpt_agg = (
        enriched.groupby(["cpt", "description"])
        .agg(
            avg_paid=("paid", "mean"),
            medicare_expected=("medicare_expected", "first"),
            count=("paid", "count"),
        )
        .reset_index()
    )
    cpt_agg["variance_pct"] = (
        (cpt_agg["avg_paid"] - cpt_agg["medicare_expected"]) / cpt_agg["medicare_expected"] * 100
    ).round(1)
    cpt_agg["avg_paid"] = cpt_agg["avg_paid"].round(2)

    # Underpayment table: flagged rows sorted worst first (most negative medicare_gap)
    flagged_rows = (
        enriched[enriched["flagged"]]
        .sort_values("medicare_gap")
        .head(50)[["cpt", "description", "ptype", "charged", "paid", "medicare_expected", "downcode_pct", "medicare_pct", "medicare_gap"]]
        .rename(columns={"ptype": "payer"})
    )

    return {
        "summary": {
            "total_charged": round(total_charged, 2),
            "total_medicare_expected": round(total_medicare_expected, 2),
            "total_paid": round(total_paid, 2),
            "leakage_dollars": leakage_dollars,
            "leakage_pct": leakage_pct,
            "biller_score": biller_score,
            "total_claims": total_claims,
            "flagged_claims": flagged_claims,
        },
        "payer_breakdown": payer_agg.to_dict(orient="records"),
        "underpayment_table": flagged_rows.to_dict(orient="records"),
        "cpt_breakdown": cpt_agg.to_dict(orient="records"),
    }
```

- [ ] **Step 4: Run all analyzer tests — expect PASS**

```bash
pytest tests/test_analyzer.py -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: aggregations and biller score formula"
```

---

## Task 5: FastAPI Endpoint

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing API tests**

```
backend/tests/test_api.py
```
```python
import io
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

MINIMAL_CSV = (
    "Provider,Ptype,Account,Patient,D.O.S,Rdoc,Cpt,Modifier,Description,Charged,Paid\n"
    "BR_TRIVALL,AETNA,123,DOE JOHN,2026-01-01,BR_TRIVALL,99213,,OFFICE VISIT EST,120.00,58.97\n"
    "BR_TRIVALL,BC/BS,124,SMITH JANE,2026-01-02,BR_TRIVALL,30520,,SEPTOPLASTY,600.00,140.61\n"
)

NO_KNOWN_CPT_CSV = (
    "Provider,Ptype,Account,Patient,D.O.S,Rdoc,Cpt,Modifier,Description,Charged,Paid\n"
    "BR_TRIVALL,AETNA,999,TEST PAT,2026-01-01,BR_TRIVALL,00000,,UNKNOWN PROCEDURE,100.00,50.00\n"
)


def test_analyze_returns_200():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(MINIMAL_CSV.encode()), "text/csv")},
    )
    assert response.status_code == 200


def test_analyze_returns_required_keys():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(MINIMAL_CSV.encode()), "text/csv")},
    )
    data = response.json()
    assert "summary" in data
    assert "payer_breakdown" in data
    assert "underpayment_table" in data
    assert "cpt_breakdown" in data
    assert "ai_narrative" in data


def test_analyze_summary_types():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(MINIMAL_CSV.encode()), "text/csv")},
    )
    s = response.json()["summary"]
    assert isinstance(s["biller_score"], int)
    assert isinstance(s["total_paid"], float)
    assert isinstance(s["leakage_pct"], float)


def test_analyze_returns_422_for_unrecognized_cpts():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(NO_KNOWN_CPT_CSV.encode()), "text/csv")},
    )
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pytest tests/test_api.py -v
```

Expected: `ImportError: cannot import name 'app' from 'main'`

- [ ] **Step 3: Create main.py**

```
backend/main.py
```
```python
import io
import os
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from analyzer import analyze_claims
from ai import generate_narrative

load_dotenv()

app = FastAPI(title="Payscope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV file.")

    # Normalize column names
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={"Ptype": "ptype", "Cpt": "cpt", "Description": "description",
                              "Charged": "charged", "Paid": "paid"})

    try:
        result = analyze_claims(df)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    result["ai_narrative"] = generate_narrative(result)
    return result
```

- [ ] **Step 4: Create a stub ai.py so the import resolves**

```
backend/ai.py
```
```python
def generate_narrative(analysis: dict) -> str:
    return ""
```

- [ ] **Step 5: Run API tests — expect PASS**

```bash
pytest tests/test_api.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Verify server starts**

```bash
uvicorn main:app --reload --port 8000
```

Expected: `Application startup complete.` Visit http://localhost:8000/docs to confirm the endpoint appears in Swagger UI.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py backend/ai.py backend/tests/test_api.py
git commit -m "feat: FastAPI /api/analyze endpoint with CORS"
```

---

## Task 6: OpenAI Narrative Integration

**Files:**
- Modify: `backend/ai.py`

- [ ] **Step 1: Replace stub with real OpenAI call in ai.py**

```
backend/ai.py
```
```python
import json
import os
from openai import OpenAI

SYSTEM_PROMPT = """You are a medical billing analyst reviewing claims data for an independent physician practice.
You will receive structured JSON data from a revenue integrity analysis.
Identify 2–3 specific patterns of underpayment or downcoding, explain each in plain English a physician can understand, and give 1–2 actionable recommendations.
Be specific — name the payers and CPT codes where relevant.
Keep your response under 200 words. Write in paragraph form, no bullet points."""


def generate_narrative(analysis: dict) -> str:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "AI narrative unavailable — OPENAI_API_KEY not set."

    summary = analysis["summary"]
    top_payers = sorted(analysis["payer_breakdown"], key=lambda x: x["variance_pct"])[:5]
    top_cpts = sorted(analysis["cpt_breakdown"], key=lambda x: x["variance_pct"])[:5]

    payload = {
        "biller_score": summary["biller_score"],
        "total_leakage_dollars": summary["leakage_dollars"],
        "leakage_pct": summary["leakage_pct"],
        "total_claims": summary["total_claims"],
        "flagged_claims": summary["flagged_claims"],
        "payer_breakdown": top_payers,
        "top_underpaid_cpts": top_cpts,
    }

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload)},
            ],
            max_tokens=350,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"AI narrative unavailable: {str(e)}"
```

- [ ] **Step 2: Smoke test with your OPENAI_API_KEY set**

```bash
cd backend
source .venv/bin/activate
python -c "
from ai import generate_narrative
mock = {
    'summary': {'biller_score': 67, 'leakage_dollars': 8460.0, 'leakage_pct': 10.6, 'total_claims': 10, 'flagged_claims': 4},
    'payer_breakdown': [{'payer': 'AETNA', 'variance_pct': -35.2}, {'payer': 'BC/BS', 'variance_pct': -28.1}],
    'cpt_breakdown': [{'cpt': '99213', 'description': 'Office visit est', 'variance_pct': -38.6}, {'cpt': '30520', 'description': 'Septoplasty', 'variance_pct': -70.1}],
}
print(generate_narrative(mock))
"
```

Expected: 2–3 paragraph narrative mentioning AETNA, BC/BS, and specific CPT codes.

- [ ] **Step 3: Commit**

```bash
git add backend/ai.py
git commit -m "feat: OpenAI GPT-4o narrative generation for claims analysis"
```

---

## Task 7: Sample CSV + Backend End-to-End Test

**Files:**
- Create: `sample_data/claims_sample.csv`

- [ ] **Step 1: Add Charged column to sample CSV**

Take `SR4BYU2.csv` and add a `Charged` column. Use this rule for demo data: `Charged = Paid * 1.5` for a realistic charged-vs-paid gap. Copy the first 30–40 rows and save as:

```
sample_data/claims_sample.csv
```

The header line should be:
```
Provider,Ptype,Account,Patient,D.O.S,Rdoc,Cpt,Modifier,Description,Charged,Paid
```

Add the Charged column (numeric, two decimal places) between Description and Paid.

- [ ] **Step 2: Start the backend and run a real upload**

In one terminal:
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

In another terminal:
```bash
curl -s -X POST http://localhost:8000/api/analyze \
  -F "file=@sample_data/claims_sample.csv" | python3 -m json.tool | head -60
```

Expected: JSON with `summary`, `payer_breakdown`, `underpayment_table`, `cpt_breakdown`, and a non-empty `ai_narrative`.

- [ ] **Step 3: Verify biller score is in range**

```bash
curl -s -X POST http://localhost:8000/api/analyze \
  -F "file=@sample_data/claims_sample.csv" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Score:', d['summary']['biller_score'])"
```

Expected: integer between 0 and 100.

- [ ] **Step 4: Commit**

```bash
git add sample_data/
git commit -m "feat: add sample claims CSV with Charged column for demo"
```

---

## Task 8: Frontend Scaffold

**Files:**
- Create: `frontend/` (Vite + React scaffold)
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/index.css`

- [ ] **Step 1: Scaffold Vite React project**

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

- [ ] **Step 2: Install Tailwind CSS and Recharts**

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npm install recharts
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

```
frontend/tailwind.config.js
```
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          900: "#0f172a",
          800: "#1e293b",
          700: "#334155",
        },
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Set up global CSS**

Replace `frontend/src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f172a;
  color: #f1f5f9;
  font-family: 'Inter', system-ui, sans-serif;
}
```

- [ ] **Step 5: Update main.jsx**

```
frontend/src/main.jsx
```
```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Verify dev server starts**

```bash
cd frontend
npm run dev
```

Expected: `Local: http://localhost:5173/` — opens in browser showing default Vite page.

- [ ] **Step 7: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: Vite React frontend scaffold with Tailwind CSS and Recharts"
```

---

## Task 9: API Client

**Files:**
- Create: `frontend/src/api/analyze.js`

- [ ] **Step 1: Create the API client module**

```
frontend/src/api/analyze.js
```
```js
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

/**
 * @param {File} file
 * @returns {Promise<object>} analysis result from /api/analyze
 */
export async function analyzeCSV(file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail ?? `HTTP ${response.status}`)
  }

  return response.json()
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/
git commit -m "feat: API client for POST /api/analyze"
```

---

## Task 10: UploadZone Component

**Files:**
- Create: `frontend/src/components/UploadZone.jsx`

- [ ] **Step 1: Create UploadZone**

```
frontend/src/components/UploadZone.jsx
```
```jsx
import { useState, useRef } from 'react'

export default function UploadZone({ onUpload, loading }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.name.endsWith('.csv')) return
    onUpload(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      className={`
        w-full rounded-xl border-2 border-dashed p-8 text-center cursor-pointer
        transition-colors duration-200
        ${dragging ? 'border-blue-400 bg-blue-900/20' : 'border-slate-600 hover:border-slate-400'}
        ${loading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {loading ? (
        <p className="text-slate-400 text-sm">Analyzing claims...</p>
      ) : (
        <>
          <p className="text-slate-300 font-medium">Drop your claims CSV here</p>
          <p className="text-slate-500 text-sm mt-1">or click to browse</p>
          <p className="text-slate-600 text-xs mt-2">
            Columns: Provider, Ptype, Cpt, Description, Charged, Paid
          </p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UploadZone.jsx
git commit -m "feat: UploadZone with drag-and-drop CSV upload"
```

---

## Task 11: ScoreSidebar Component

**Files:**
- Create: `frontend/src/components/ScoreSidebar.jsx`

- [ ] **Step 1: Create ScoreSidebar with SVG score ring**

```
frontend/src/components/ScoreSidebar.jsx
```
```jsx
function ScoreRing({ score }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const filled = (score / 100) * circumference
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'Good' : score >= 60 ? 'Warning' : 'Critical'

  return (
    <div className="flex flex-col items-center">
      <svg width="136" height="136" className="-rotate-90">
        <circle cx="68" cy="68" r={radius} fill="none" stroke="#1e293b" strokeWidth="12" />
        <circle
          cx="68" cy="68" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="flex flex-col items-center -mt-20">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-slate-400 text-xs uppercase tracking-wide">/ 100</span>
      </div>
      <span
        className="mt-3 text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ color, background: `${color}22` }}
      >
        {label}
      </span>
    </div>
  )
}

function KpiRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-baseline py-2 border-b border-slate-700/50">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  )
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

export default function ScoreSidebar({ summary }) {
  const { biller_score, total_medicare_expected, total_paid, leakage_dollars, leakage_pct, total_claims, flagged_claims } = summary

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 flex flex-col gap-4 min-w-[220px]">
      <h2 className="text-slate-300 text-sm font-semibold uppercase tracking-widest text-center">
        Biller Score
      </h2>
      <ScoreRing score={biller_score} />
      <div className="mt-2">
        <KpiRow label="Expected"  value={fmt(total_medicare_expected)} color="text-blue-400" />
        <KpiRow label="Collected" value={fmt(total_paid)}              color="text-emerald-400" />
        <KpiRow label="Leakage"   value={fmt(leakage_dollars)}         color="text-red-400" />
        <KpiRow label="Leak rate" value={`${leakage_pct}%`}           color="text-red-400" />
        <KpiRow label="Claims"    value={total_claims}                  color="text-slate-300" />
        <KpiRow label="Flagged"   value={flagged_claims}                color="text-amber-400" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ScoreSidebar.jsx
git commit -m "feat: ScoreSidebar with animated SVG score ring and KPI stack"
```

---

## Task 12: UnderpaymentTable Component

**Files:**
- Create: `frontend/src/components/UnderpaymentTable.jsx`

- [ ] **Step 1: Create UnderpaymentTable**

```
frontend/src/components/UnderpaymentTable.jsx
```
```jsx
import { useState } from 'react'

function pctColor(pct) {
  if (pct < 65) return 'text-red-400 font-semibold'
  if (pct < 85) return 'text-amber-400'
  return 'text-emerald-400'
}

export default function UnderpaymentTable({ rows }) {
  const [sortKey, setSortKey] = useState('medicare_gap')
  const [sortDir, setSortDir] = useState(1)

  const toggle = (key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }

  const sorted = [...rows].sort((a, b) => (a[sortKey] - b[sortKey]) * sortDir)

  const headers = [
    { key: 'cpt',          label: 'CPT' },
    { key: 'payer',        label: 'Payer' },
    { key: 'charged',      label: 'Charged' },
    { key: 'paid',         label: 'Paid' },
    { key: 'medicare_expected', label: 'Medicare' },
    { key: 'downcode_pct', label: 'Paid/Billed' },
    { key: 'medicare_pct', label: 'Paid/Medicare' },
    { key: 'medicare_gap', label: 'Gap $' },
  ]

  const fmt = (n) => `$${Number(n).toFixed(2)}`

  return (
    <div className="bg-slate-800/50 rounded-2xl p-4 overflow-x-auto">
      <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-widest mb-3">
        Flagged Claims — {rows.length} rows
      </h3>
      <table className="w-full text-sm text-left">
        <thead>
          <tr>
            {headers.map(h => (
              <th
                key={h.key}
                onClick={() => toggle(h.key)}
                className="pb-2 pr-4 text-slate-400 text-xs font-medium cursor-pointer hover:text-slate-200 whitespace-nowrap"
              >
                {h.label} {sortKey === h.key ? (sortDir === 1 ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="border-t border-slate-700/40 hover:bg-slate-700/20">
              <td className="py-2 pr-4 text-blue-300 font-mono">{row.cpt}</td>
              <td className="py-2 pr-4 text-slate-300">{row.payer}</td>
              <td className="py-2 pr-4 text-slate-400">{fmt(row.charged)}</td>
              <td className="py-2 pr-4 text-slate-300">{fmt(row.paid)}</td>
              <td className="py-2 pr-4 text-slate-400">{fmt(row.medicare_expected)}</td>
              <td className={`py-2 pr-4 ${pctColor(row.downcode_pct)}`}>{row.downcode_pct}%</td>
              <td className={`py-2 pr-4 ${pctColor(row.medicare_pct)}`}>{row.medicare_pct}%</td>
              <td className="py-2 text-red-400 font-semibold">{fmt(row.medicare_gap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UnderpaymentTable.jsx
git commit -m "feat: UnderpaymentTable with sortable columns and color-coded severity"
```

---

## Task 13: PayerChart Component

**Files:**
- Create: `frontend/src/components/PayerChart.jsx`

- [ ] **Step 1: Create PayerChart using Recharts**

```
frontend/src/components/PayerChart.jsx
```
```jsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer
} from 'recharts'

function barColor(pct) {
  if (pct < -25) return '#ef4444'
  if (pct < -10) return '#f59e0b'
  return '#22c55e'
}

export default function PayerChart({ payers }) {
  const data = [...payers].sort((a, b) => a.variance_pct - b.variance_pct)

  return (
    <div className="bg-slate-800/50 rounded-2xl p-4">
      <h3 className="text-slate-300 text-sm font-semibold uppercase tracking-widest mb-3">
        Payer Variance vs Medicare
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 40)}>
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={v => `${v}%`}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
          />
          <YAxis
            dataKey="payer"
            type="category"
            tick={{ fill: '#cbd5e1', fontSize: 12 }}
            width={72}
            axisLine={false}
          />
          <Tooltip
            formatter={(v) => [`${v}%`, 'Variance vs Medicare']}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
            labelStyle={{ color: '#f1f5f9' }}
          />
          <Bar dataKey="variance_pct" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.variance_pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/PayerChart.jsx
git commit -m "feat: PayerChart horizontal bar chart with color-coded variance"
```

---

## Task 14: NarrativePanel Component

**Files:**
- Create: `frontend/src/components/NarrativePanel.jsx`

- [ ] **Step 1: Create NarrativePanel**

```
frontend/src/components/NarrativePanel.jsx
```
```jsx
export default function NarrativePanel({ narrative }) {
  if (!narrative) return null

  return (
    <div className="bg-indigo-950/60 border border-indigo-700/40 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-indigo-400 text-xs font-semibold uppercase tracking-widest">
          AI Analysis
        </span>
        <span className="text-slate-600 text-xs">· GPT-4o</span>
      </div>
      <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{narrative}</p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/NarrativePanel.jsx
git commit -m "feat: NarrativePanel for AI-generated billing analysis"
```

---

## Task 15: App.jsx — Wire Everything Together

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Replace App.jsx with the full dashboard**

```
frontend/src/App.jsx
```
```jsx
import { useState } from 'react'
import { analyzeCSV } from './api/analyze'
import UploadZone from './components/UploadZone'
import ScoreSidebar from './components/ScoreSidebar'
import UnderpaymentTable from './components/UnderpaymentTable'
import PayerChart from './components/PayerChart'
import NarrativePanel from './components/NarrativePanel'

export default function App() {
  const [status, setStatus] = useState('idle')  // 'idle' | 'loading' | 'done' | 'error'
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const handleUpload = async (file) => {
    setStatus('loading')
    setError(null)
    try {
      const result = await analyzeCSV(file)
      setData(result)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Payscope</h1>
        <p className="text-slate-400 text-sm mt-1">Revenue Integrity Dashboard for Independent Physicians</p>
      </div>

      {/* Upload */}
      <div className="mb-6">
        <UploadZone onUpload={handleUpload} loading={status === 'loading'} />
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4 mb-6 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Dashboard */}
      {status === 'done' && data && (
        <div className="flex flex-col gap-6">
          {/* Row 1: Score sidebar + Table + Chart */}
          <div className="flex gap-6 items-start">
            {/* Left: Score sidebar */}
            <ScoreSidebar summary={data.summary} />

            {/* Right: Table + Chart stacked */}
            <div className="flex flex-col gap-6 flex-1 min-w-0">
              {data.underpayment_table.length > 0 ? (
                <UnderpaymentTable rows={data.underpayment_table} />
              ) : (
                <div className="bg-emerald-900/30 border border-emerald-700/40 rounded-2xl p-6 text-emerald-300 text-sm">
                  No flagged claims — payments are at or above thresholds.
                </div>
              )}
              {data.payer_breakdown.length > 0 && (
                <PayerChart payers={data.payer_breakdown} />
              )}
            </div>
          </div>

          {/* Row 2: AI Narrative */}
          {data.ai_narrative && (
            <NarrativePanel narrative={data.ai_narrative} />
          )}
        </div>
      )}

      {/* Idle state */}
      {status === 'idle' && (
        <div className="text-center py-16 text-slate-600">
          <p className="text-lg">Upload a claims CSV to generate your revenue integrity report</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Start backend and frontend together, upload sample CSV**

Terminal 1 (backend):
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```

Open http://localhost:5173, drag `sample_data/claims_sample.csv` onto the upload zone.

Expected: score ring populates, underpayment table renders with red/amber rows, payer chart shows bars, AI narrative text appears.

- [ ] **Step 3: Verify all 5 components render without console errors**

Open browser DevTools → Console. Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wire all dashboard components into App.jsx — end-to-end working"
```

---

## Task 16: Deploy

**Files:**
- Create: `frontend/.env.production` (set backend URL)
- Create: `backend/Procfile` (for Railway/Render)

- [ ] **Step 1: Create Procfile for backend deploy**

```
backend/Procfile
```
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

- [ ] **Step 2: Deploy backend to Railway**

```bash
cd backend
# Install Railway CLI if needed: npm install -g @railway/cli
railway login
railway init
railway up
```

Note the deployed URL, e.g. `https://payscope-backend.up.railway.app`

- [ ] **Step 3: Set OPENAI_API_KEY in Railway dashboard**

In Railway project settings → Variables → add `OPENAI_API_KEY=sk-...`

- [ ] **Step 4: Set frontend API URL for production**

```
frontend/.env.production
```
```
VITE_API_URL=https://payscope-backend.up.railway.app
```

- [ ] **Step 5: Deploy frontend to Vercel**

```bash
cd frontend
npm run build
# Install Vercel CLI if needed: npm install -g vercel
vercel --prod
```

- [ ] **Step 6: Smoke test the live deploy**

Open the Vercel URL, upload `sample_data/claims_sample.csv`. Verify the full dashboard renders with a live AI narrative.

- [ ] **Step 7: Final commit**

```bash
git add backend/Procfile frontend/.env.production
git commit -m "feat: deploy config for Railway (backend) and Vercel (frontend)"
```

---

## Verification Checklist

- [ ] Upload `claims_sample.csv` → API returns valid JSON within 10 seconds
- [ ] Biller score is an integer 0–100 matching the data
- [ ] Underpayment table shows flagged rows sorted by worst medicare_gap first
- [ ] Payer chart renders all payers from the CSV with correct colors (red/amber/green)
- [ ] AI narrative references specific payers and CPT codes
- [ ] Score sidebar KPIs match the API summary totals exactly
- [ ] CPT codes not in the rates dict do not crash the backend (graceful null handling)
- [ ] Zero-charged rows do not crash the backend
- [ ] CORS: frontend on Vercel can reach backend on Railway
- [ ] No browser console errors on the live URL
