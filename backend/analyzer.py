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

    peer_flag = df["peer_pct"].notna() & (df["peer_pct"] < PEER_FLAG_THRESHOLD * 100)
    contracted_flag = df["contracted_pct"].notna() & (
        df["contracted_pct"] < CONTRACTED_FLAG_THRESHOLD * 100
    )
    df["flagged"] = peer_flag | contracted_flag
    return df


def compute_biller_score(
    total_paid: float,
    total_billed: float,
    flagged_claims: int,
    total_claims: int,
) -> int:
    if total_billed == 0 or total_claims == 0:
        return 0
    collection_rate = min(1.0, total_paid / (total_billed * 0.85))
    flag_rate = flagged_claims / total_claims
    raw = (collection_rate * 0.25 + (1 - flag_rate) * 0.75) * 100
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
    peer_by_payer = enriched[has_peer].groupby("ptype")["peer_expected"].sum()
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
