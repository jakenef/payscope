# Remove Medicare — Self-Referential Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Medicare rate references and replace the analysis engine with a self-referential peer-median system that flags claims based on inconsistencies within the user's own data.

**Architecture:** A new `baselines.py` module computes per-`(payer, cpt)` median paid amounts from the uploaded dataset itself, with a CPT-wide fallback for small groups. `analyzer.py` consumes this lookup (alongside the existing `contract_lookup`) to produce `peer_expected`, `peer_pct`, and `peer_gap` columns instead of the old `medicare_*` columns. The biller score switches to a 50/50 split of collection rate and non-flag rate with no external benchmark dependency.

**Tech Stack:** Python 3.11, pandas, FastAPI (backend); React + Vite (frontend). Run backend tests with `pytest tests/ -v` from `backend/` with `.venv` activated.

---

## File Map

**Create:**
- `backend/baselines.py` — `compute_baselines(df)`: groups by `(payer_lower, cpt)`, returns median-paid lookup dict

**Modify:**
- `backend/analyzer.py` — remove Medicare columns/imports; add peer_* columns; new biller score formula; new aggregate fields
- `backend/contracts.py` — remove `pct_of_medicare` from LLM schema and output
- `backend/benchmarks.py` — replace `total_medicare_expected` field ref and rename label
- `backend/ai.py` — remove Medicare from narrative system prompt
- `backend/chat.py` — remove Medicare from chat system prompt
- `backend/tests/conftest.py` — add `baselines_df` fixture; update `fully_paid_df` comment
- `backend/tests/test_analyzer.py` — replace Medicare tests with peer tests; add baselines tests
- `frontend/src/components/ScoreSidebar.jsx` — rename `total_medicare_expected` → `total_peer_expected`
- `frontend/src/components/AuditScoreHero.jsx` — rename field + fix collection % calculation
- `frontend/src/components/UnderpaymentTable.jsx` — replace medicare columns with peer columns
- `frontend/src/components/PayerChart.jsx` — rename title/tooltip
- `frontend/src/components/ContractsPanel.jsx` — remove `% MCR` column and `pct_of_medicare` from save logic
- `frontend/src/components/DashboardPreview.jsx` — update mock data to use `peer_*` fields
- `frontend/src/components/Hero.jsx` — remove Medicare copy
- `frontend/src/components/LandingContent.jsx` — replace Medicare copy
- `frontend/src/App.jsx` — remove Medicare copy on upload and loading screens
- `frontend/src/components/NationalMapModal.jsx` — rename "Paid vs Medicare" label
- `frontend/src/contracts/store.js` — remove `pct_of_medicare` from JSDoc

**Delete:**
- `backend/rates.py`

---

## Task 1: Create `baselines.py` with unit tests

**Files:**
- Create: `backend/baselines.py`
- Modify: `backend/tests/conftest.py` (add `baselines_df` fixture)
- Modify: `backend/tests/test_analyzer.py` (add baselines tests at top)

- [ ] **Step 1: Add `baselines_df` fixture to `backend/tests/conftest.py`**

Add this fixture below the existing ones:

```python
@pytest.fixture
def baselines_df():
    """6 AETNA/99213 claims (≥5 → group path); 1 BC/BS/99213 (< 5 → fallback path)."""
    rows = [
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.00, "paid": paid}
        for paid in [70.0, 80.0, 85.0, 90.0, 95.0, 100.0]
    ]
    rows += [
        {"ptype": "BC/BS", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.00, "paid": 93.0},
    ]
    return pd.DataFrame(rows)
```

- [ ] **Step 2: Write failing baselines tests in `backend/tests/test_analyzer.py`**

Add these tests at the top of the file (before the existing `from rates import RATES` line — that import will be removed in Task 3):

```python
from baselines import compute_baselines


def test_compute_baselines_group_median(baselines_df):
    # AETNA/99213 has 6 claims: [70,80,85,90,95,100] → median = (85+90)/2 = 87.5
    baselines = compute_baselines(baselines_df)
    assert baselines[("aetna", "99213")] == 87.5


def test_compute_baselines_fallback_to_cpt_median(baselines_df):
    # BC/BS has 1 claim for 99213 → falls back to CPT-wide median
    # All 99213 paid values: [70,80,85,90,93,95,100] → sorted median = 90.0
    baselines = compute_baselines(baselines_df)
    assert baselines[("bc/bs", "99213")] == 90.0


def test_compute_baselines_empty_df():
    result = compute_baselines(pd.DataFrame(columns=["ptype", "cpt", "paid"]))
    assert result == {}
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd backend && source .venv/bin/activate && pytest tests/test_analyzer.py::test_compute_baselines_group_median tests/test_analyzer.py::test_compute_baselines_fallback_to_cpt_median tests/test_analyzer.py::test_compute_baselines_empty_df -v
```

Expected: `ModuleNotFoundError: No module named 'baselines'`

- [ ] **Step 4: Create `backend/baselines.py`**

```python
import pandas as pd

MIN_GROUP_SIZE = 5


def compute_baselines(df: pd.DataFrame) -> dict[tuple[str, str], float]:
    """Compute per-(payer, cpt) expected payment from the dataset itself.

    Groups with >= MIN_GROUP_SIZE claims use that group's median paid.
    Smaller groups fall back to the CPT-wide median across all payers.
    Returns {(payer_lower, cpt): expected_amount}.
    """
    df = df.copy()
    df = df.assign(
        cpt=df["cpt"].astype(str).str.strip(),
        paid=pd.to_numeric(df["paid"], errors="coerce"),
        ptype=df["ptype"].astype(str).str.strip().str.lower(),
    )
    df = df.dropna(subset=["paid"])
    df = df[df["paid"] > 0]

    if df.empty:
        return {}

    cpt_medians = df.groupby("cpt")["paid"].median().to_dict()
    group = df.groupby(["ptype", "cpt"])["paid"]
    group_counts = group.count()
    group_medians = group.median()

    baselines: dict[tuple[str, str], float] = {}
    for (payer, cpt), count in group_counts.items():
        if count >= MIN_GROUP_SIZE:
            baselines[(payer, cpt)] = float(group_medians[(payer, cpt)])
        else:
            cpt_med = cpt_medians.get(cpt)
            if cpt_med is not None:
                baselines[(payer, cpt)] = float(cpt_med)

    return baselines
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
pytest tests/test_analyzer.py::test_compute_baselines_group_median tests/test_analyzer.py::test_compute_baselines_fallback_to_cpt_median tests/test_analyzer.py::test_compute_baselines_empty_df -v
```

Expected: 3 PASSED

- [ ] **Step 6: Commit**

```bash
git add backend/baselines.py backend/tests/conftest.py backend/tests/test_analyzer.py
git commit -m "feat: add baselines.py — self-referential peer-median computation"
```

---

## Task 2: Refactor `analyzer.py`

**Files:**
- Modify: `backend/analyzer.py`
- Modify: `backend/tests/test_analyzer.py` (update existing enrich/score/analyze tests)
- Modify: `backend/tests/conftest.py` (update `fully_paid_df` comment)

- [ ] **Step 1: Write new failing tests in `backend/tests/test_analyzer.py`**

Replace the block starting `from analyzer import enrich_claims, MEDICARE_FLAG_THRESHOLD, DOWNCODE_FLAG_THRESHOLD` (line 17 through end of the file) with the following. Keep the baselines tests you added in Task 1 at the top.

```python
import pandas as pd
from analyzer import enrich_claims, DOWNCODE_FLAG_THRESHOLD, compute_biller_score, analyze_claims
from baselines import compute_baselines


def test_enrich_adds_peer_expected(baselines_df):
    baselines = compute_baselines(baselines_df)
    result = enrich_claims(baselines_df.copy(), baselines_lookup=baselines)
    aetna_rows = result[(result["ptype"] == "AETNA") & (result["cpt"] == "99213")]
    assert (aetna_rows["peer_expected"] == 87.5).all()


def test_enrich_calculates_downcode_pct(sample_df):
    baselines = compute_baselines(sample_df)
    result = enrich_claims(sample_df.copy(), baselines_lookup=baselines)
    row = result[(result["ptype"] == "AETNA") & (result["cpt"] == "99213")].iloc[0]
    expected_pct = round(58.97 / 120.00 * 100, 1)
    assert row["downcode_pct"] == expected_pct


def test_enrich_flags_when_peer_pct_below_80(baselines_df):
    # Add a low-paid row to ensure group baseline is computed, then check it gets flagged
    low_row = pd.DataFrame([
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.0, "paid": 40.0}
    ])
    df = pd.concat([baselines_df, low_row], ignore_index=True)
    baselines = compute_baselines(df)
    result = enrich_claims(df.copy(), baselines_lookup=baselines)
    flagged = result[(result["ptype"] == "AETNA") & (result["cpt"] == "99213") & (result["paid"] == 40.0)]
    assert len(flagged) == 1
    assert flagged.iloc[0]["flagged"] == True


def test_enrich_flags_when_downcode_pct_below_80(sample_df):
    baselines = compute_baselines(sample_df)
    result = enrich_claims(sample_df.copy(), baselines_lookup=baselines)
    # ALPHA/99204: paid $30 / charged $200 = 15% — flagged by downcode rule
    row = result[(result["ptype"] == "ALPHA") & (result["cpt"] == "99204")].iloc[0]
    assert row["flagged"] == True


def test_enrich_does_not_drop_unknown_cpt():
    df = pd.DataFrame([
        {"ptype": "AETNA", "cpt": "00000", "description": "UNKNOWN", "charged": 100.0, "paid": 50.0},
    ])
    result = enrich_claims(df.copy(), baselines_lookup={})
    assert len(result) == 1
    assert pd.isna(result.iloc[0]["peer_expected"])


def test_enrich_graceful_on_zero_charged():
    df = pd.DataFrame([
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT", "charged": 0.0, "paid": 50.0},
    ])
    result = enrich_claims(df.copy(), baselines_lookup={})
    assert len(result) == 0


def test_biller_score_perfect():
    assert compute_biller_score(100.0, 100.0, 0, 10) == 100


def test_biller_score_zero():
    assert compute_biller_score(0.0, 100.0, 10, 10) == 0


def test_biller_score_typical():
    # collection_rate=0.87, flag_rate=0.25 → (0.87*0.5 + 0.75*0.5)*100 = 81.0
    score = compute_biller_score(87.0, 100.0, 2, 8)
    assert score == 81


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
    assert "total_peer_expected" in s
    assert 0 <= s["biller_score"] <= 100
    assert s["flagged_claims"] <= s["total_claims"]


def test_analyze_claims_leakage_is_peer_based(sample_df):
    result = analyze_claims(sample_df.copy())
    s = result["summary"]
    if s["total_peer_expected"] > 0:
        expected_leakage = round(s["total_peer_expected"] - s["total_paid"], 2)
        assert s["leakage_dollars"] == expected_leakage


def test_underpayment_table_sorted_worst_first(sample_df):
    result = analyze_claims(sample_df.copy())
    gaps = [row["peer_gap"] for row in result["underpayment_table"] if row["peer_gap"] is not None]
    assert gaps == sorted(gaps)


def test_payer_breakdown_has_all_payers(sample_df):
    result = analyze_claims(sample_df.copy())
    payers = {row["payer"] for row in result["payer_breakdown"]}
    assert "AETNA" in payers
    assert "BC/BS" in payers
    assert "ALPHA" in payers
```

- [ ] **Step 2: Run tests to confirm failures**

```bash
pytest tests/test_analyzer.py -v -k "not compute_baselines"
```

Expected: most tests FAIL with import errors or assertion errors from the old API.

- [ ] **Step 3: Rewrite `backend/analyzer.py`**

Replace the entire file with:

```python
import pandas as pd
from baselines import compute_baselines

DOWNCODE_FLAG_THRESHOLD = 0.80
PEER_FLAG_THRESHOLD = 0.80
CONTRACTED_FLAG_THRESHOLD = 0.90


def enrich_claims(df: pd.DataFrame, baselines_lookup: dict | None = None, contract_lookup: dict | None = None) -> pd.DataFrame:
    """Add per-claim derived columns; drop rows with missing or zero charged/paid amounts."""
    df = df.copy()
    df = df.assign(
        cpt=df["cpt"].astype(str).str.strip(),
        charged=pd.to_numeric(df["charged"], errors="coerce"),
        paid=pd.to_numeric(df["paid"], errors="coerce"),
    )
    df = df.dropna(subset=["charged", "paid"])
    df = df[df["charged"] > 0].copy()

    if df.empty:
        return df

    df = df.assign(
        downcode_pct=(df["paid"] / df["charged"] * 100).round(1),
    )

    # Peer baseline enrichment
    if baselines_lookup:
        def _peer(row):
            payer = str(row.get("ptype") or "").strip().lower()
            return baselines_lookup.get((payer, row["cpt"]))
        df["peer_expected"] = df.apply(_peer, axis=1)
        has_peer = df["peer_expected"].notna()
        df["peer_pct"] = pd.NA
        df["peer_gap"] = pd.NA
        df.loc[has_peer, "peer_pct"] = (
            df.loc[has_peer, "paid"] / df.loc[has_peer, "peer_expected"] * 100
        ).round(1)
        df.loc[has_peer, "peer_gap"] = (
            df.loc[has_peer, "paid"] - df.loc[has_peer, "peer_expected"]
        ).round(2)
    else:
        df["peer_expected"] = pd.NA
        df["peer_pct"] = pd.NA
        df["peer_gap"] = pd.NA

    # Contracted-rate enrichment
    if contract_lookup:
        def _lookup(row):
            payer = str(row.get("ptype") or "").strip().lower()
            return contract_lookup.get((payer, row["cpt"]))
        df["contracted_expected"] = df.apply(_lookup, axis=1)
        has_contract = df["contracted_expected"].notna()
        df["contracted_pct"] = pd.NA
        df["contracted_gap"] = pd.NA
        df.loc[has_contract, "contracted_pct"] = (
            df.loc[has_contract, "paid"] / df.loc[has_contract, "contracted_expected"] * 100
        ).round(1)
        df.loc[has_contract, "contracted_gap"] = (
            df.loc[has_contract, "paid"] - df.loc[has_contract, "contracted_expected"]
        ).round(2)
    else:
        df["contracted_expected"] = pd.NA
        df["contracted_pct"] = pd.NA
        df["contracted_gap"] = pd.NA

    base_flag = df["downcode_pct"] < DOWNCODE_FLAG_THRESHOLD * 100
    peer_flag = df["peer_pct"].notna() & (df["peer_pct"] < PEER_FLAG_THRESHOLD * 100)
    contracted_flag = df["contracted_pct"].notna() & (
        df["contracted_pct"] < CONTRACTED_FLAG_THRESHOLD * 100
    )
    df["flagged"] = base_flag | peer_flag | contracted_flag
    return df


def compute_biller_score(
    total_paid: float,
    total_billed: float,
    flagged_claims: int,
    total_claims: int,
) -> int:
    if total_billed == 0 or total_claims == 0:
        return 0
    collection_rate = min(1.0, total_paid / total_billed)
    flag_rate = flagged_claims / total_claims
    raw = (collection_rate * 0.5 + (1 - flag_rate) * 0.5) * 100
    return int(max(0, min(100, round(raw))))


def analyze_claims(df: pd.DataFrame, contract_lookup: dict | None = None) -> dict:
    """Full analysis pipeline: compute baselines → enrich → aggregate → score."""
    baselines_lookup = compute_baselines(df)
    enriched = enrich_claims(df, baselines_lookup=baselines_lookup, contract_lookup=contract_lookup)

    if enriched.empty:
        raise ValueError("No valid claims found with non-zero charged and paid amounts.")

    total_charged = float(enriched["charged"].sum())
    total_paid = float(enriched["paid"].sum())
    flagged_claims = int(enriched["flagged"].sum())
    total_claims = len(enriched)

    has_peer = enriched["peer_expected"].notna()
    total_peer_expected = float(enriched.loc[has_peer, "peer_expected"].sum()) if has_peer.any() else 0.0
    leakage_dollars = round(total_peer_expected - total_paid, 2) if total_peer_expected > 0 else 0.0
    leakage_pct = round(leakage_dollars / total_peer_expected * 100, 1) if total_peer_expected > 0 else 0.0
    biller_score = compute_biller_score(total_paid, total_charged, flagged_claims, total_claims)

    # Contracted-rate aggregates
    has_contract = enriched["contracted_expected"].notna()
    covered = enriched[has_contract]
    if not covered.empty:
        total_contracted_expected = float(covered["contracted_expected"].sum())
        total_paid_under_contract = float(covered["paid"].sum())
        contracted_leakage_dollars = round(total_contracted_expected - total_paid_under_contract, 2)
        contracted_leakage_pct = (
            round(contracted_leakage_dollars / total_contracted_expected * 100, 1)
            if total_contracted_expected > 0 else 0.0
        )
        claims_with_contract = int(len(covered))
    else:
        total_contracted_expected = 0.0
        contracted_leakage_dollars = 0.0
        contracted_leakage_pct = 0.0
        claims_with_contract = 0

    # Payer breakdown: compute peer_expected sum separately to avoid NaN groupby issues
    peer_by_payer = (
        enriched[has_peer].groupby("ptype")["peer_expected"].sum()
    )
    payer_agg = (
        enriched.groupby("ptype")
        .agg(paid=("paid", "sum"), flagged=("flagged", "sum"))
        .reset_index()
        .rename(columns={"ptype": "payer"})
    )
    payer_agg["peer_expected"] = payer_agg["payer"].map(peer_by_payer).fillna(0.0)
    payer_agg["variance_pct"] = payer_agg.apply(
        lambda r: round((r["paid"] - r["peer_expected"]) / r["peer_expected"] * 100, 1)
        if r["peer_expected"] > 0 else None,
        axis=1,
    )

    # CPT breakdown
    cpt_medians = enriched.groupby("cpt")["paid"].median()
    cpt_agg = (
        enriched.groupby(["cpt", "description"])
        .agg(avg_paid=("paid", "mean"), count=("paid", "count"))
        .reset_index()
    )
    cpt_agg["peer_median"] = cpt_agg["cpt"].map(cpt_medians).round(2)
    cpt_agg["avg_paid"] = cpt_agg["avg_paid"].round(2)
    cpt_agg["variance_pct"] = cpt_agg.apply(
        lambda r: round((r["avg_paid"] - r["peer_median"]) / r["peer_median"] * 100, 1)
        if pd.notna(r["peer_median"]) and r["peer_median"] > 0 else None,
        axis=1,
    )

    # Underpayment table: flagged rows, worst peer_gap first (NaN rows last)
    flagged_rows = (
        enriched[enriched["flagged"]]
        .sort_values("peer_gap")
        .head(50)[[
            "cpt", "description", "ptype", "charged", "paid",
            "peer_expected", "downcode_pct", "peer_pct", "peer_gap",
            "contracted_expected", "contracted_pct", "contracted_gap",
        ]]
        .rename(columns={"ptype": "payer"})
    )
    flagged_records = []
    for record in flagged_rows.to_dict(orient="records"):
        flagged_records.append({
            k: (None if (v is None or (isinstance(v, float) and v != v) or pd.isna(v)) else v)
            for k, v in record.items()
        })

    date_range = None
    if "date" in enriched.columns:
        parsed = pd.to_datetime(enriched["date"], errors="coerce").dropna()
        if not parsed.empty:
            lo = parsed.min().strftime("%b %Y")
            hi = parsed.max().strftime("%b %Y")
            date_range = lo if lo == hi else f"{lo} – {hi}"

    return {
        "summary": {
            "total_charged": round(total_charged, 2),
            "total_peer_expected": round(total_peer_expected, 2),
            "total_paid": round(total_paid, 2),
            "leakage_dollars": leakage_dollars,
            "leakage_pct": leakage_pct,
            "biller_score": biller_score,
            "total_claims": total_claims,
            "flagged_claims": flagged_claims,
            "date_range": date_range,
            "total_contracted_expected": round(total_contracted_expected, 2),
            "contracted_leakage_dollars": contracted_leakage_dollars,
            "contracted_leakage_pct": contracted_leakage_pct,
            "claims_with_contract": claims_with_contract,
        },
        "payer_breakdown": payer_agg.to_dict(orient="records"),
        "underpayment_table": flagged_records,
        "cpt_breakdown": cpt_agg.to_dict(orient="records"),
    }
```

- [ ] **Step 4: Update `fully_paid_df` fixture in `backend/tests/conftest.py`**

Replace the `fully_paid_df` fixture comment and paid values so the claims are above the 80% downcode threshold:

```python
@pytest.fixture
def fully_paid_df():
    """Claims paid well above the 80% paid/billed threshold."""
    return pd.DataFrame([
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.00, "paid": 100.00},
        {"ptype": "AETNA", "cpt": "69210", "description": "REMOVE EAR WAX",   "charged": 80.00,  "paid": 68.00},
    ])
```

- [ ] **Step 5: Run all analyzer tests**

```bash
pytest tests/test_analyzer.py -v -k "not compute_baselines"
```

Expected: all tests PASS (the `from rates import RATES` block at the top of the test file will still be there — that's OK for now, it'll be cleaned up in Task 3).

- [ ] **Step 6: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py backend/tests/conftest.py
git commit -m "feat: refactor analyzer.py — peer-median baselines replace Medicare rates"
```

---

## Task 3: Delete `rates.py` and clean up test file

**Files:**
- Delete: `backend/rates.py`
- Modify: `backend/tests/test_analyzer.py` (remove `rates` import and rates-specific tests)

- [ ] **Step 1: Remove rates-only tests from `backend/tests/test_analyzer.py`**

Delete these lines near the top (lines 1–14 in the original, now superseded):

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

The file should now start with `from baselines import compute_baselines`.

- [ ] **Step 2: Delete `backend/rates.py`**

```bash
rm backend/rates.py
```

- [ ] **Step 3: Run the full test suite to confirm no remaining rates imports**

```bash
pytest tests/ -v
```

Expected: all tests PASS, no `ModuleNotFoundError` for `rates`.

- [ ] **Step 4: Commit**

```bash
git add -u backend/rates.py backend/tests/test_analyzer.py
git commit -m "chore: delete rates.py — static Medicare rates no longer used"
```

---

## Task 4: Update `contracts.py`, `benchmarks.py`, `ai.py`, `chat.py`

**Files:**
- Modify: `backend/contracts.py`
- Modify: `backend/benchmarks.py`
- Modify: `backend/ai.py`
- Modify: `backend/chat.py`

- [ ] **Step 1: Update `backend/contracts.py`**

Replace the `PARSER_SYSTEM_PROMPT` constant:

```python
PARSER_SYSTEM_PROMPT = """You extract participating-provider agreement details from medical insurance contracts.
Return ONLY a JSON object matching the requested schema. Do not invent data — if a field
is not present in the contract, use null. Pull rates from any fee schedule table you find.
Express allowed_amount as a number (USD). Only extract explicit dollar amounts — skip rates expressed only as a percentage.
"""
```

Replace the `user_msg` schema block — remove the `pct_of_medicare` line and update the skip instruction:

```python
    user_msg = (
        "Extract the participating-provider agreement into this JSON schema:\n"
        "{\n"
        '  "payer_name": string,                    // insurance company name (e.g. "BlueStar Health Plan")\n'
        '  "effective_date": string|null,           // ISO date YYYY-MM-DD if present\n'
        '  "expiration_date": string|null,          // ISO date YYYY-MM-DD if present\n'
        '  "contract_number": string|null,\n'
        '  "rates": [\n'
        "    {\n"
        '      "cpt": string,                       // CPT/HCPCS code\n'
        '      "description": string|null,\n'
        '      "allowed_amount": number|null        // dollar amount\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Skip rows where the CPT is non-numeric, marked 'pass-through', or has 'N/A' rates.\n"
        "Only include codes with a real allowed_amount in dollars. Skip codes with only a percentage rate.\n\n"
        "Contract text:\n---\n"
        f"{text}\n---"
    )
```

Replace the `cleaned_rates` loop to remove `pct_of_medicare`:

```python
    cleaned_rates = []
    for r in rates:
        cpt = (r.get("cpt") or "").strip()
        if not cpt:
            continue
        allowed = r.get("allowed_amount")
        if allowed is None:
            continue
        cleaned_rates.append({
            "cpt": cpt,
            "description": r.get("description") or None,
            "allowed_amount": float(allowed),
        })
```

- [ ] **Step 2: Update `backend/benchmarks.py`**

At line 184, replace:
```python
    expected = summary.get("total_medicare_expected", 0) or 0
```
with:
```python
    expected = summary.get("total_peer_expected", 0) or 0
```

At line 216, replace:
```python
                "label": "Paid vs Medicare expected",
```
with:
```python
                "label": "Collection Rate",
```

- [ ] **Step 3: Update `backend/ai.py`**

Replace `SYSTEM_PROMPT`:

```python
SYSTEM_PROMPT = """You are a medical billing analyst reviewing claims data for an independent physician practice.
You will receive structured JSON data from a revenue integrity analysis.
Identify 2–3 specific patterns of underpayment or downcoding, explain each in plain English a physician can understand, and give 1–2 actionable recommendations.
Be specific — name the payers and CPT codes where relevant.
Keep your response under 200 words. Write in paragraph form, no bullet points."""
```

(This prompt is already Medicare-free — just verify it contains no Medicare references. It doesn't, so no change is needed here.)

- [ ] **Step 4: Update `backend/chat.py`**

Replace the last sentence of `CHAT_SYSTEM_PROMPT`:

```python
When recommending action, be specific (e.g., "renegotiate with Aetna for CPT 99214 — currently paying 72% of the typical rate for this code")."""
```

- [ ] **Step 5: Run tests to confirm no regressions**

```bash
pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/contracts.py backend/benchmarks.py backend/ai.py backend/chat.py
git commit -m "feat: remove Medicare references from contracts, benchmarks, ai, chat"
```

---

## Task 5: Frontend — data components

**Files:**
- Modify: `frontend/src/components/ScoreSidebar.jsx`
- Modify: `frontend/src/components/AuditScoreHero.jsx`
- Modify: `frontend/src/components/UnderpaymentTable.jsx`
- Modify: `frontend/src/components/PayerChart.jsx`

- [ ] **Step 1: Update `frontend/src/components/ScoreSidebar.jsx`**

In the destructure at line 75, replace `total_medicare_expected` with `total_peer_expected`:

```jsx
  const {
    biller_score, total_peer_expected, total_paid, leakage_dollars, leakage_pct,
    total_claims, flagged_claims,
    claims_with_contract, contracted_leakage_dollars, contracted_leakage_pct,
  } = summary
```

In `baseKpis`, update the first entry:

```jsx
  const baseKpis = [
    { label: 'Expected',  value: fmt(total_peer_expected), color: 'var(--primary-light)' },
    { label: 'Collected', value: fmt(total_paid),          color: 'var(--green)' },
    { label: 'Leakage',   value: fmt(leakage_dollars),     color: 'var(--red)' },
    { label: 'Leak Rate', value: `${leakage_pct}%`,        color: 'var(--red)' },
    { label: 'Claims',    value: total_claims,              color: 'var(--text-bright)' },
    { label: 'Flagged',   value: flagged_claims,            color: 'var(--amber)' },
  ]
```

- [ ] **Step 2: Update `frontend/src/components/AuditScoreHero.jsx`**

Replace the destructure (lines 120–126):

```jsx
  const {
    biller_score,
    total_peer_expected,
    total_paid,
    leakage_dollars,
    date_range,
  } = summary
  const collectionPct =
    total_peer_expected > 0
      ? Math.round((total_paid / total_peer_expected) * 100)
      : 0
```

Replace the `{fmt(total_medicare_expected)}` reference in the JSX (line 158) with:

```jsx
              {fmt(total_peer_expected)}
```

- [ ] **Step 3: Update `frontend/src/components/UnderpaymentTable.jsx`**

Replace `baseHeaders`:

```jsx
const baseHeaders = [
  { key: 'cpt',          label: 'CPT' },
  { key: 'payer',        label: 'Payer' },
  { key: 'charged',      label: 'Charged' },
  { key: 'paid',         label: 'Paid' },
  { key: 'peer_expected',label: 'Peer Exp.' },
  { key: 'downcode_pct', label: 'Paid / Billed' },
  { key: 'peer_pct',     label: 'Paid / Peer' },
  { key: 'peer_gap',     label: 'Gap' },
]
```

Update `useState` default sort key:

```jsx
  const [sortKey, setSortKey] = useState('peer_gap')
```

In the table body rows, replace the three Medicare cells:

```jsx
                <td style={{ color: 'var(--text-muted)' }}>{fmt(row.peer_expected)}</td>
                <td style={{ color: pctColor(row.peer_pct), fontWeight: 500 }}>{row.peer_pct != null ? `${row.peer_pct}%` : '—'}</td>
                <td style={{ color: '#e05252', fontWeight: 600 }}>{fmt(row.peer_gap)}</td>
```

- [ ] **Step 4: Update `frontend/src/components/PayerChart.jsx`**

Replace the panel header:

```jsx
        Payer Variance
```

Replace the tooltip formatter:

```jsx
              formatter={(v) => [`${v}%`, 'Variance vs Peer']}
```

- [ ] **Step 5: Start the frontend dev server and visually verify the dashboard**

```bash
cd frontend && npm run dev
```

Upload `sample_data/claims_sample.csv`. Confirm:
- ScoreSidebar shows "Expected" (peer-based number, not Medicare)
- AuditScoreHero shows collection % based on peer expected
- UnderpaymentTable shows "Peer Exp.", "Paid / Peer", "Gap" columns with no Medicare column
- PayerChart shows "Payer Variance" title

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ScoreSidebar.jsx frontend/src/components/AuditScoreHero.jsx frontend/src/components/UnderpaymentTable.jsx frontend/src/components/PayerChart.jsx
git commit -m "feat: update dashboard components to use peer-based fields"
```

---

## Task 6: Frontend — ContractsPanel, store.js, DashboardPreview

**Files:**
- Modify: `frontend/src/components/ContractsPanel.jsx`
- Modify: `frontend/src/contracts/store.js`
- Modify: `frontend/src/components/DashboardPreview.jsx`

- [ ] **Step 1: Update `frontend/src/components/ContractsPanel.jsx`**

Remove the `% MCR` column header (line 230):

```jsx
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={thStyle}>CPT</th>
                <th style={{ ...thStyle, width: '40%' }}>Description</th>
                <th style={thStyle}>Allowed $</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
```

Remove the `% MCR` input cell from each row (the `<td>` containing the `pct_of_medicare` input, currently the third `<td>` in the row):

```jsx
                <tr key={i} style={{ borderBottom: '1px solid var(--text-dim)' }}>
                  <td style={tdStyle}>
                    <input value={r.cpt || ''} onChange={(e) => updateRate(i, 'cpt', e.target.value)} style={cellInput} />
                  </td>
                  <td style={tdStyle}>
                    <input value={r.description || ''} onChange={(e) => updateRate(i, 'description', e.target.value)} style={cellInput} />
                  </td>
                  <td style={tdStyle}>
                    <input type="number" step="any" value={r.allowed_amount ?? ''} onChange={(e) => updateRate(i, 'allowed_amount', e.target.value)} style={cellInput} />
                  </td>
                  <td style={tdStyle}>
                    <button onClick={() => removeRate(i)} style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--red)', fontFamily: 'var(--font-sans)', fontSize: '0.72rem',
                    }}>✕</button>
                  </td>
                </tr>
```

In the `save()` function, remove `pct_of_medicare` from the rate map:

```jsx
      rates: draft.rates
        .filter((r) => (r.cpt || '').trim())
        .map((r) => ({
          cpt: String(r.cpt).trim(),
          description: r.description || null,
          allowed_amount: r.allowed_amount !== null && r.allowed_amount !== '' ? Number(r.allowed_amount) : null,
        })),
```

Update the description text that says "alongside Medicare benchmarks":

```jsx
          Upload your insurance contract PDFs. Payscope extracts contracted rates
          and uses them to flag claims paid below what your contract guarantees.
```

- [ ] **Step 2: Update `frontend/src/contracts/store.js`**

Update the JSDoc comment — remove `pct_of_medicare` from the rates shape:

```js
 *     rates: [ {cpt, description, allowed_amount}, ... ],
```

- [ ] **Step 3: Update `frontend/src/components/DashboardPreview.jsx`**

Replace `MOCK_SUMMARY`:

```jsx
const MOCK_SUMMARY = {
  biller_score: 60,
  total_charged: 197643,
  total_peer_expected: 82438,
  total_paid: 69993,
  leakage_dollars: 12446,
  leakage_pct: 15.1,
  total_claims: 600,
  flagged_claims: 597,
  date_range: 'Jan 2024 – Jun 2024',
}
```

Replace `MOCK_NARRATIVE` to remove Medicare reference:

```jsx
const MOCK_NARRATIVE =
  "MOLINA and WELLPOINT are underpaying significantly — variances of -53.5% and -45.3% against peer expected amounts. " +
  "Submucous resection (30140) and septoplasty (30520) show the worst gaps, suggesting a documentation or modifier issue " +
  "specific to those procedures. Three actions: (1) audit the last 30 days of MOLINA claims for missing modifiers, " +
  "(2) request a fee schedule review with WELLPOINT — they're underpaying by nearly half of expected, " +
  "(3) flag 30140 and 30520 for prior-auth review going forward."
```

Replace the `payment_ratio_pct` benchmark metric label in `MOCK_BENCHMARKS`:

```jsx
    {
      key: 'payment_ratio_pct', label: 'Collection Rate',
      user: 84.9, p25: 82.42, median: 89.18, p75: 94.28,
      higher_is_better: true, unit: '%', percentile: 35,
    },
```

Replace `MOCK_FLAGGED` with peer-field names:

```jsx
const MOCK_FLAGGED = [
  { cpt: '30520', payer: 'ANTHEM',    charged: 893.22,  paid: 233.39, peer_expected: 563.26, downcode_pct: 26.1, peer_pct: 41.4, peer_gap: -329.87 },
  { cpt: '30140', payer: 'WELLPOINT', charged: 731.49,  paid: 128.51, peer_expected: 394.93, downcode_pct: 17.6, peer_pct: 32.5, peer_gap: -266.42 },
  { cpt: '30140', payer: 'ANTHEM',    charged: 724.63,  paid: 158.04, peer_expected: 394.93, downcode_pct: 21.8, peer_pct: 40.0, peer_gap: -236.89 },
  { cpt: '30140', payer: 'ANTHEM',    charged: 528.35,  paid: 159.68, peer_expected: 394.93, downcode_pct: 30.2, peer_pct: 40.4, peer_gap: -235.25 },
  { cpt: '30520', payer: 'HUMANA',    charged: 892.05,  paid: 359.78, peer_expected: 563.26, downcode_pct: 40.3, peer_pct: 63.9, peer_gap: -203.48 },
  { cpt: '60220', payer: 'ANTHEM',    charged: 996.81,  paid: 518.10, peer_expected: 714.47, downcode_pct: 52.0, peer_pct: 72.5, peer_gap: -196.37 },
  { cpt: '60220', payer: 'ANTHEM',    charged: 1184.11, paid: 528.05, peer_expected: 714.47, downcode_pct: 44.6, peer_pct: 73.9, peer_gap: -186.42 },
  { cpt: '30520', payer: 'ANTHEM',    charged: 837.26,  paid: 409.22, peer_expected: 563.26, downcode_pct: 48.9, peer_pct: 72.7, peer_gap: -154.04 },
  { cpt: '60220', payer: 'KAISER',    charged: 1200.44, paid: 582.14, peer_expected: 714.47, downcode_pct: 48.5, peer_pct: 81.5, peer_gap: -132.33 },
]
```

- [ ] **Step 4: Verify in browser**

Reload `http://localhost:5173`. Confirm the landing page dashboard preview renders correctly with no Medicare text in the preview panel.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ContractsPanel.jsx frontend/src/contracts/store.js frontend/src/components/DashboardPreview.jsx
git commit -m "feat: remove pct_of_medicare from ContractsPanel and update DashboardPreview mock data"
```

---

## Task 7: Frontend — copy cleanup

**Files:**
- Modify: `frontend/src/components/Hero.jsx`
- Modify: `frontend/src/components/LandingContent.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/NationalMapModal.jsx`

- [ ] **Step 1: Update `frontend/src/components/Hero.jsx`**

Replace the subhead paragraph text (line 56–58):

```jsx
        Payscope audits every claim against your own billing history, surfaces underpayments
        and downcoding in seconds, and gives you the receipts to confront your billing company —
        or your payer mix — with hard numbers.
```

- [ ] **Step 2: Update `frontend/src/components/LandingContent.jsx`**

In `FEATURES[0].body`, replace:

```js
    body: 'See expected vs. actual payments side by side based on your own billing patterns. Never wonder if a claim was paid correctly again.',
```

In `STEPS[1].body`, replace:

```js
    body: 'Payscope analyzes each claim against typical payment patterns from your own data, surfacing deviations for your payer mix.',
```

In `PLANS[0].features`, replace `'CMS Medicare benchmark comparison'` with:

```js
      'Peer-pattern anomaly detection',
```

- [ ] **Step 3: Update `frontend/src/App.jsx`**

At line 198, replace:

```jsx
                      Upload a CSV or Excel file of submitted claims. Columns are
                      auto-detected, and underpayments and downcoding are
                      evaluated against your billing history.
```

At line 234, replace:

```jsx
                  <span>Peer-Pattern Analysis</span>
```

At line 278, replace:

```jsx
                Analyzing billing patterns
```

- [ ] **Step 4: Update `frontend/src/components/NationalMapModal.jsx`**

Replace the `payment_ratio_pct` label:

```jsx
  { key: 'payment_ratio_pct', label: 'Collection Rate',  higher: true,  unit: '%' },
```

- [ ] **Step 5: Final visual check**

With the dev server still running at `http://localhost:5173`:
1. Scroll through the landing page — confirm no "Medicare" or "CMS" text anywhere
2. Upload `../backend/sample_data/claims_sample.csv` and confirm the full dashboard loads without errors
3. Check UnderpaymentTable shows peer columns, check ScoreSidebar shows expected value

- [ ] **Step 6: Run backend tests one final time**

```bash
cd backend && pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/Hero.jsx frontend/src/components/LandingContent.jsx frontend/src/App.jsx frontend/src/components/NationalMapModal.jsx
git commit -m "feat: remove all Medicare/CMS copy from landing page and upload UI"
```
