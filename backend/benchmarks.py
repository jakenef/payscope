"""Synthetic peer-practice benchmarks.

Returns peer percentile data for a (specialty, state) cohort given the user's
analysis summary. The numbers below are hand-tuned to feel realistic; replace
with live aggregates once enough analyses are persisted.
"""

from typing import Any

# Per-specialty baseline distributions for the three headline metrics.
# Each metric is (p25, median, p75). Higher is better for biller_score and
# payment_ratio_pct; lower is better for leakage_pct.
SPECIALTY_BASELINES = {
    "ENT": {
        "biller_score":       (62, 73, 84),
        "leakage_pct":        (4.2, 8.5, 14.8),
        "payment_ratio_pct":  (84.1, 91.0, 96.2),
    },
    "Primary Care": {
        "biller_score":       (68, 78, 87),
        "leakage_pct":        (3.0, 6.4, 11.2),
        "payment_ratio_pct":  (88.0, 93.5, 97.0),
    },
    "Cardiology": {
        "biller_score":       (60, 71, 82),
        "leakage_pct":        (5.0, 9.8, 16.5),
        "payment_ratio_pct":  (82.0, 89.5, 95.0),
    },
    "Dermatology": {
        "biller_score":       (66, 76, 85),
        "leakage_pct":        (3.6, 7.2, 12.4),
        "payment_ratio_pct":  (86.5, 92.0, 96.5),
    },
    "Orthopedics": {
        "biller_score":       (58, 70, 80),
        "leakage_pct":        (5.5, 11.0, 18.0),
        "payment_ratio_pct":  (80.0, 88.0, 94.0),
    },
    "OB/GYN": {
        "biller_score":       (64, 74, 84),
        "leakage_pct":        (4.0, 8.0, 13.5),
        "payment_ratio_pct":  (85.0, 91.5, 96.0),
    },
    "Pediatrics": {
        "biller_score":       (70, 79, 88),
        "leakage_pct":        (2.8, 5.8, 10.0),
        "payment_ratio_pct":  (89.0, 94.0, 97.5),
    },
    "Other": {
        "biller_score":       (60, 72, 83),
        "leakage_pct":        (4.5, 9.0, 15.0),
        "payment_ratio_pct":  (84.0, 90.5, 95.5),
    },
}

# State multipliers — payer mix and Medicaid expansion vary regionally.
# Multiplier > 1.0 means the state runs hotter on that metric than the national avg.
# All 50 states + DC. Tighter payer markets (CA, NY, NJ, MA) underpay more;
# southern/midwestern states with stronger commercial mix do a bit better.
STATE_ADJUSTMENTS = {
    "AL": {"biller_score": 1.02, "leakage_pct": 0.95, "payment_ratio_pct": 1.01},
    "AK": {"biller_score": 1.05, "leakage_pct": 0.85, "payment_ratio_pct": 1.04},
    "AZ": {"biller_score": 1.00, "leakage_pct": 1.02, "payment_ratio_pct": 1.00},
    "AR": {"biller_score": 1.02, "leakage_pct": 0.93, "payment_ratio_pct": 1.01},
    "CA": {"biller_score": 0.97, "leakage_pct": 1.10, "payment_ratio_pct": 0.98},
    "CO": {"biller_score": 1.01, "leakage_pct": 0.97, "payment_ratio_pct": 1.01},
    "CT": {"biller_score": 0.98, "leakage_pct": 1.08, "payment_ratio_pct": 0.98},
    "DE": {"biller_score": 1.00, "leakage_pct": 1.00, "payment_ratio_pct": 1.00},
    "DC": {"biller_score": 0.96, "leakage_pct": 1.12, "payment_ratio_pct": 0.97},
    "FL": {"biller_score": 0.99, "leakage_pct": 1.05, "payment_ratio_pct": 0.99},
    "GA": {"biller_score": 1.01, "leakage_pct": 0.96, "payment_ratio_pct": 1.01},
    "HI": {"biller_score": 1.00, "leakage_pct": 1.00, "payment_ratio_pct": 1.00},
    "ID": {"biller_score": 1.04, "leakage_pct": 0.88, "payment_ratio_pct": 1.03},
    "IL": {"biller_score": 1.00, "leakage_pct": 1.00, "payment_ratio_pct": 1.00},
    "IN": {"biller_score": 1.02, "leakage_pct": 0.95, "payment_ratio_pct": 1.01},
    "IA": {"biller_score": 1.04, "leakage_pct": 0.90, "payment_ratio_pct": 1.03},
    "KS": {"biller_score": 1.03, "leakage_pct": 0.92, "payment_ratio_pct": 1.02},
    "KY": {"biller_score": 1.01, "leakage_pct": 0.97, "payment_ratio_pct": 1.01},
    "LA": {"biller_score": 0.99, "leakage_pct": 1.04, "payment_ratio_pct": 0.99},
    "ME": {"biller_score": 1.02, "leakage_pct": 0.94, "payment_ratio_pct": 1.01},
    "MD": {"biller_score": 0.98, "leakage_pct": 1.06, "payment_ratio_pct": 0.99},
    "MA": {"biller_score": 0.96, "leakage_pct": 1.12, "payment_ratio_pct": 0.97},
    "MI": {"biller_score": 1.00, "leakage_pct": 0.99, "payment_ratio_pct": 1.00},
    "MN": {"biller_score": 1.02, "leakage_pct": 0.96, "payment_ratio_pct": 1.02},
    "MS": {"biller_score": 1.00, "leakage_pct": 1.00, "payment_ratio_pct": 1.00},
    "MO": {"biller_score": 1.02, "leakage_pct": 0.94, "payment_ratio_pct": 1.02},
    "MT": {"biller_score": 1.05, "leakage_pct": 0.85, "payment_ratio_pct": 1.04},
    "NE": {"biller_score": 1.04, "leakage_pct": 0.89, "payment_ratio_pct": 1.03},
    "NV": {"biller_score": 0.99, "leakage_pct": 1.04, "payment_ratio_pct": 0.99},
    "NH": {"biller_score": 1.01, "leakage_pct": 0.97, "payment_ratio_pct": 1.01},
    "NJ": {"biller_score": 0.96, "leakage_pct": 1.14, "payment_ratio_pct": 0.97},
    "NM": {"biller_score": 1.00, "leakage_pct": 1.02, "payment_ratio_pct": 1.00},
    "NY": {"biller_score": 0.95, "leakage_pct": 1.18, "payment_ratio_pct": 0.96},
    "NC": {"biller_score": 1.02, "leakage_pct": 0.95, "payment_ratio_pct": 1.01},
    "ND": {"biller_score": 1.05, "leakage_pct": 0.84, "payment_ratio_pct": 1.04},
    "OH": {"biller_score": 1.03, "leakage_pct": 0.94, "payment_ratio_pct": 1.02},
    "OK": {"biller_score": 1.02, "leakage_pct": 0.93, "payment_ratio_pct": 1.02},
    "OR": {"biller_score": 0.99, "leakage_pct": 1.04, "payment_ratio_pct": 0.99},
    "PA": {"biller_score": 1.01, "leakage_pct": 0.98, "payment_ratio_pct": 1.01},
    "RI": {"biller_score": 0.98, "leakage_pct": 1.06, "payment_ratio_pct": 0.99},
    "SC": {"biller_score": 1.02, "leakage_pct": 0.95, "payment_ratio_pct": 1.01},
    "SD": {"biller_score": 1.05, "leakage_pct": 0.85, "payment_ratio_pct": 1.04},
    "TN": {"biller_score": 1.02, "leakage_pct": 0.95, "payment_ratio_pct": 1.01},
    "TX": {"biller_score": 1.02, "leakage_pct": 0.92, "payment_ratio_pct": 1.01},
    "UT": {"biller_score": 1.03, "leakage_pct": 0.91, "payment_ratio_pct": 1.02},
    "VT": {"biller_score": 1.02, "leakage_pct": 0.94, "payment_ratio_pct": 1.01},
    "VA": {"biller_score": 1.01, "leakage_pct": 0.98, "payment_ratio_pct": 1.01},
    "WA": {"biller_score": 0.98, "leakage_pct": 1.06, "payment_ratio_pct": 0.99},
    "WV": {"biller_score": 1.01, "leakage_pct": 0.98, "payment_ratio_pct": 1.01},
    "WI": {"biller_score": 1.03, "leakage_pct": 0.93, "payment_ratio_pct": 1.02},
    "WY": {"biller_score": 1.05, "leakage_pct": 0.84, "payment_ratio_pct": 1.04},
}

# Synthetic cohort sizes — roughly scale with state population.
# Small enough to be plausible for "your area", large enough to look meaningful.
COHORT_SIZES = {
    "AL": 21, "AK": 6,  "AZ": 28, "AR": 14, "CA": 47, "CO": 22, "CT": 16,
    "DE": 7,  "DC": 6,  "FL": 41, "GA": 24, "HI": 8,  "ID": 9,  "IL": 29,
    "IN": 22, "IA": 13, "KS": 12, "KY": 17, "LA": 17, "ME": 8,  "MD": 21,
    "MA": 24, "MI": 26, "MN": 19, "MS": 12, "MO": 19, "MT": 7,  "NE": 9,
    "NV": 12, "NH": 8,  "NJ": 26, "NM": 9,  "NY": 38, "NC": 22, "ND": 6,
    "OH": 27, "OK": 15, "OR": 16, "PA": 33, "RI": 7,  "SC": 16, "SD": 6,
    "TN": 21, "TX": 52, "UT": 13, "VT": 6,  "VA": 23, "WA": 22, "WV": 9,
    "WI": 18, "WY": 5,
}


def _adjust(triple, multiplier):
    return tuple(round(v * multiplier, 2) for v in triple)


def _percentile_rank(value: float, p25: float, median: float, p75: float, higher_is_better: bool) -> int:
    """Estimate user's percentile by linear interpolation between p25/median/p75.

    Anchors: p25 → 25th, median → 50th, p75 → 75th. Outside the IQR we
    extrapolate but clamp to [1, 99] so the UI doesn't show 0/100.
    """
    if value is None:
        return 50
    if higher_is_better:
        if value <= p25:
            pct = 25 * (value / p25) if p25 > 0 else 25
        elif value <= median:
            pct = 25 + 25 * (value - p25) / max(median - p25, 1e-9)
        elif value <= p75:
            pct = 50 + 25 * (value - median) / max(p75 - median, 1e-9)
        else:
            pct = 75 + 25 * min((value - p75) / max(p75, 1e-9), 1.0)
    else:
        # lower is better — invert
        if value >= p75:
            pct = 25 - 25 * min((value - p75) / max(p75, 1e-9), 1.0)
        elif value >= median:
            pct = 50 - 25 * (value - median) / max(p75 - median, 1e-9)
        elif value >= p25:
            pct = 75 - 25 * (value - p25) / max(median - p25, 1e-9)
        else:
            pct = 75 + 25 * (1 - value / p25) if p25 > 0 else 99
    return max(1, min(99, int(round(pct))))


def get_benchmarks(specialty: str | None, state: str | None, summary: dict[str, Any]) -> dict | None:
    """Return peer comparison block, or None if no profile data provided."""
    if not specialty and not state:
        return None

    specialty = specialty or "Other"
    if specialty not in SPECIALTY_BASELINES:
        specialty = "Other"

    state = (state or "").upper()
    cohort_n = COHORT_SIZES.get(state, 18)
    state_adj = STATE_ADJUSTMENTS.get(state, {"biller_score": 1.0, "leakage_pct": 1.0, "payment_ratio_pct": 1.0})

    base = SPECIALTY_BASELINES[specialty]

    biller = _adjust(base["biller_score"], state_adj["biller_score"])
    leakage = _adjust(base["leakage_pct"], state_adj["leakage_pct"])
    pay_ratio = _adjust(base["payment_ratio_pct"], state_adj["payment_ratio_pct"])

    user_score = summary.get("biller_score")
    user_leakage = summary.get("leakage_pct")
    total_paid = summary.get("total_paid", 0) or 0
    expected = summary.get("total_medicare_expected", 0) or 0
    user_pay_ratio = round((total_paid / expected * 100), 2) if expected > 0 else None

    return {
        "specialty": specialty,
        "state": state or None,
        "cohort_size": cohort_n,
        "metrics": [
            {
                "key": "biller_score",
                "label": "Biller score",
                "user": user_score,
                "p25": biller[0],
                "median": biller[1],
                "p75": biller[2],
                "higher_is_better": True,
                "unit": "",
                "percentile": _percentile_rank(user_score, biller[0], biller[1], biller[2], True),
            },
            {
                "key": "leakage_pct",
                "label": "Revenue leakage",
                "user": user_leakage,
                "p25": leakage[0],
                "median": leakage[1],
                "p75": leakage[2],
                "higher_is_better": False,
                "unit": "%",
                "percentile": _percentile_rank(user_leakage, leakage[0], leakage[1], leakage[2], False),
            },
            {
                "key": "payment_ratio_pct",
                "label": "Paid vs Medicare expected",
                "user": user_pay_ratio,
                "p25": pay_ratio[0],
                "median": pay_ratio[1],
                "p75": pay_ratio[2],
                "higher_is_better": True,
                "unit": "%",
                "percentile": _percentile_rank(user_pay_ratio, pay_ratio[0], pay_ratio[1], pay_ratio[2], True),
            },
        ],
    }


SPECIALTIES = list(SPECIALTY_BASELINES.keys())
STATES = sorted(STATE_ADJUSTMENTS.keys())
