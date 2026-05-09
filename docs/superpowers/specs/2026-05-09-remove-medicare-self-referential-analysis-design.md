# Design: Remove Medicare — Self-Referential Analysis

**Date:** 2026-05-09  
**Status:** Approved

## Overview

Payscope is pivoting from a Medicare-benchmark audit tool to a pure billing-data auditing platform. All CMS Medicare rate references are removed. The new analysis engine detects inconsistencies within the user's own data: a claim is flagged when it falls below a data-derived "peer expected" amount or below a paid/billed threshold. Uploaded insurance contract PDFs remain a first-class signal.

---

## 1. Backend Pipeline

### 1.1 New: `baselines.py` (replaces `rates.py`)

`compute_baselines(df: pd.DataFrame) -> dict[tuple[str, str], float]`

- Groups the DataFrame by `(ptype.lower(), cpt)`.
- Groups with **≥ 5 claims**: `peer_expected = median(paid)` for that group.
- Groups with **< 5 claims**: fall back to `median(paid)` for that CPT across **all** payers.
- Returns a flat lookup dict `{(payer_lower, cpt): peer_expected_amount}`.
- If a CPT has no data at all (e.g. only one claim in the entire dataset), its `peer_expected` will be `None` — not an error.

### 1.2 Modified: `analyzer.py`

**`enrich_claims(df, baselines_lookup, contract_lookup)`**

- Receives `baselines_lookup` as a parameter (computed by `analyze_claims` before calling this function).
- Row-drop rule simplified: drop only if `charged` or `paid` is missing/zero. **CPT-unknown rows are no longer dropped.**
- New derived columns per row:

| Column | Formula |
|---|---|
| `downcode_pct` | `paid / charged × 100` (unchanged) |
| `peer_expected` | from `baselines_lookup[(payer, cpt)]`, else `None` |
| `peer_pct` | `paid / peer_expected × 100` (only if `peer_expected` is not None) |
| `peer_gap` | `paid − peer_expected` (only if `peer_expected` is not None) |

- Removes: `medicare_expected`, `medicare_pct`, `medicare_gap`, `downcode_gap`.

**Flag rule:**
```
flagged = (downcode_pct < 80) 
        OR (peer_pct is not None AND peer_pct < 80)
        OR (contracted_pct is not None AND contracted_pct < 90)
```

**`compute_biller_score(total_paid, total_billed, flagged_claims, total_claims)`**

`total_billed` = `total_charged` (the sum of all charged amounts in the enriched DataFrame).

```
collection_rate = total_paid / total_billed   # clamped 0–1
flag_rate       = flagged_claims / total_claims
raw             = (collection_rate × 0.5 + (1 − flag_rate) × 0.5) × 100
score           = clamp(round(raw), 0, 100)
```

Returns 0 if `total_billed == 0` or `total_claims == 0`.

`leakage_pct` returns 0.0 if `total_peer_expected == 0` (edge case: dataset with no peer baselines).

**`analyze_claims(df, contract_lookup)` — summary fields:**

| Old field | New field | Notes |
|---|---|---|
| `total_medicare_expected` | `total_peer_expected` | Sum of `peer_expected` for rows where it is not None |
| `leakage_dollars` | `leakage_dollars` | `total_peer_expected − total_paid` (peer-based) |
| `leakage_pct` | `leakage_pct` | `leakage_dollars / total_peer_expected × 100` |

**`payer_breakdown`:** `expected` column becomes sum of `peer_expected` for that payer's claims (rows with `peer_expected` not None).

**`cpt_breakdown`:** `medicare_expected` column becomes `peer_median` (the computed peer baseline for that CPT).

**`underpayment_table`:** Sorts by `peer_gap` (most negative first). Emits `peer_expected`, `peer_pct`, `peer_gap` instead of the three `medicare_*` columns.

### 1.3 Removed: `rates.py`

File deleted. No longer referenced anywhere.

---

## 2. Contracts

**`contracts.py`:**
- Remove `pct_of_medicare` from the LLM extraction schema.
- LLM prompt instructs: extract only **explicit dollar amounts** for `allowed_amount`. Skip rows that express a rate only as a percentage with no dollar value.
- Output schema: `{cpt, description, allowed_amount}` per rate entry.

**`_build_contract_lookup` in `main.py`:** No change — already only uses `allowed_amount`.

**Frontend `ContractsPanel.jsx`:** Remove the `% MCR` column from the editable rate table.

**`contracts/store.js`:** Remove `pct_of_medicare` field from the stored rate shape.

---

## 3. Frontend

All changes are rename/remove operations — no new components, no routing changes, no state shape restructuring.

| Component | Change |
|---|---|
| `ScoreSidebar.jsx` | `total_medicare_expected` → `total_peer_expected`; label stays "Expected" |
| `AuditScoreHero.jsx` | Same field rename |
| `UnderpaymentTable.jsx` | Remove "Medicare" column; rename "Paid / MCR" → "Paid / Peer"; sort default on `peer_gap` |
| `PayerChart.jsx` | Title "Payer Variance vs. Medicare" → "Payer Variance" |
| `ContractsPanel.jsx` | Remove `% MCR` column from rate editor |
| `DashboardPreview.jsx` | Update mock data: replace `medicare_*` field names with `peer_*` |
| `Hero.jsx` | Remove "CMS Medicare benchmarks" copy |
| `LandingContent.jsx` | Replace "CMS Medicare benchmark rates" with "your own billing patterns" |
| `App.jsx` | Remove "CMS Medicare Rates 2024" badge and loading copy |
| `NationalMapModal.jsx` | "Paid vs Medicare" label → "Collection Rate" |

---

## 4. Tests, AI/Chat, and Benchmarks

### Tests (`backend/tests/`)
- Update fixtures: remove dependence on CPT codes being in `RATES`; rows no longer dropped for unknown CPTs.
- Rename `test_enrich_adds_medicare_expected` → `test_enrich_adds_peer_expected`.
- Add unit tests for `compute_baselines()`:
  - Group with ≥ 5 claims uses group median.
  - Group with < 5 claims falls back to CPT-wide median.
  - Group with `peer_expected = None` does not trigger a flag on the peer dimension.
- Replace `test_analyze_claims_leakage_is_medicare_minus_paid` with peer-based equivalent.

### `ai.py`
- Remove "Medicare" from the narrative generation prompt.
- Replace references to Medicare rates with "typical payment for this service".

### `chat.py`
- System prompt example updated: *"currently paying 72% of Medicare"* → *"currently paying 72% of the typical rate for this code"*.

### `benchmarks.py`
- Line 184: `total_medicare_expected` → `total_peer_expected`.
- Line 216: label `"Paid vs Medicare expected"` → `"Collection Rate"`.

---

## 5. Decisions & Non-Decisions

- **Minimum peer group size:** 5 claims. Below this, falls back to CPT-wide median.
- **Flag threshold:** 80% of peer median (same as existing paid/billed threshold for consistency).
- **Biller score:** 50% collection rate + 50% non-flag rate. No external benchmark dependency.
- **`pct_of_medicare` in contracts:** Dropped entirely from schema and UI. Only absolute dollar amounts are stored.
- **`rates.py`:** Deleted. If a future version wants to add external benchmarks back, it would be a new module.
- **Rows with no peer baseline:** Not flagged on the peer dimension. They can still be flagged by paid/billed threshold or contract threshold.
