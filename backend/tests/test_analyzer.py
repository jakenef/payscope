from rates import RATES


def test_rates_contains_common_ent_codes():
    required = ["99213", "99214", "30520", "69210", "92511", "31231"]
    for code in required:
        assert code in RATES, f"Missing CPT {code} in RATES"


def test_rates_values_are_positive_floats():
    for code, rate in RATES.items():
        assert isinstance(rate, float), f"Rate for {code} is not a float"
        assert rate > 0, f"Rate for {code} is not positive"


import pandas as pd
from analyzer import enrich_claims, MEDICARE_FLAG_THRESHOLD, DOWNCODE_FLAG_THRESHOLD


def test_enrich_adds_medicare_expected(sample_df):
    result = enrich_claims(sample_df.copy())
    assert "medicare_expected" in result.columns
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
    assert row["flagged"] == True


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
    assert len(result) == 0


from analyzer import compute_biller_score, analyze_claims


def test_biller_score_perfect():
    assert compute_biller_score(100.0, 100.0, 0, 10) == 100


def test_biller_score_zero():
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
