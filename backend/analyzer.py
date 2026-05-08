import pandas as pd
from rates import RATES

MEDICARE_FLAG_THRESHOLD = 0.85
DOWNCODE_FLAG_THRESHOLD = 0.80


def enrich_claims(df: pd.DataFrame) -> pd.DataFrame:
    """Add per-claim derived columns; drop rows with unknown CPT or invalid amounts."""
    df = df.copy()
    df = df.assign(
        cpt=df["cpt"].astype(str).str.strip(),
        charged=pd.to_numeric(df["charged"], errors="coerce"),
        paid=pd.to_numeric(df["paid"], errors="coerce"),
    )
    df = df.assign(medicare_expected=df["cpt"].map(RATES))

    # Drop rows missing required data or with zero/negative charged amount
    df = df.dropna(subset=["charged", "paid", "medicare_expected"])
    df = df[df["charged"] > 0].copy()

    if df.empty:
        return df

    df = df.assign(
        downcode_pct=(df["paid"] / df["charged"] * 100).round(1),
        medicare_pct=(df["paid"] / df["medicare_expected"] * 100).round(1),
        downcode_gap=(df["charged"] - df["paid"]).round(2),
        medicare_gap=(df["paid"] - df["medicare_expected"]).round(2),
    )
    df = df.assign(
        flagged=(
            (df["medicare_pct"] < MEDICARE_FLAG_THRESHOLD * 100)
            | (df["downcode_pct"] < DOWNCODE_FLAG_THRESHOLD * 100)
        )
    )
    return df


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
    payer_agg = payer_agg.assign(
        variance_pct=((payer_agg["paid"] - payer_agg["expected"]) / payer_agg["expected"] * 100).round(1)
    )

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
    cpt_agg = cpt_agg.assign(
        variance_pct=((cpt_agg["avg_paid"] - cpt_agg["medicare_expected"]) / cpt_agg["medicare_expected"] * 100).round(1),
        avg_paid=cpt_agg["avg_paid"].round(2),
    )

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
