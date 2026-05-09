from baselines import compute_baselines
import pandas as pd


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


from analyzer import enrich_claims, compute_biller_score, analyze_claims


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
    low_row = pd.DataFrame([
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.0, "paid": 40.0}
    ])
    df = pd.concat([baselines_df, low_row], ignore_index=True)
    baselines = compute_baselines(df)
    result = enrich_claims(df.copy(), baselines_lookup=baselines)
    flagged = result[(result["ptype"] == "AETNA") & (result["cpt"] == "99213") & (result["paid"] == 40.0)]
    assert len(flagged) == 1
    assert flagged.iloc[0]["flagged"] == True


def test_enrich_unflagged_when_only_downcode_low(sample_df):
    baselines = compute_baselines(sample_df)
    result = enrich_claims(sample_df.copy(), baselines_lookup=baselines)
    # ALPHA/99204: paid $30 / charged $200 = 15% — low downcode_pct but NOT flagged
    # (downcode_pct is no longer a flag trigger; only peer_pct and contracted_pct are)
    row = result[(result["ptype"] == "ALPHA") & (result["cpt"] == "99204")].iloc[0]
    assert row["flagged"] == False


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
    # collection_rate capped at 1.0 (87% > 85% target), flag_rate=0.25 → (1.0*0.25 + 0.75*0.75)*100 = 81.25
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
