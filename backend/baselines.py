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
