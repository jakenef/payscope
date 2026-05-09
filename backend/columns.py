import json
import pandas as pd
from llm import chat, LLMUnavailable

CANONICAL_COLUMNS = {
    "cpt": "CPT/HCPCS procedure code (e.g., 99213, 90837)",
    "description": "Plain-language description of the procedure",
    "ptype": "Payer or insurance type (e.g., Medicare, Aetna, BCBS)",
    "charged": "Amount the practice billed for the claim (USD)",
    "paid": "Amount the payer actually paid (USD)",
}

INFERENCE_SYSTEM_PROMPT = """You map raw CSV column headers from a medical billing export to a canonical schema.
Return ONLY a JSON object mapping each canonical key to the matching raw column header.
If no reasonable match exists for a key, use null for that key.
Do not invent column names — only use names from the provided list."""


def _direct_match(columns):
    """Case-insensitive exact match against canonical names. Returns mapping or None."""
    lower_to_raw = {c.lower(): c for c in columns}
    mapping = {}
    for canonical in CANONICAL_COLUMNS:
        if canonical in lower_to_raw:
            mapping[canonical] = lower_to_raw[canonical]
        else:
            return None
    return mapping


def _ai_infer(columns, sample_rows):
    schema_lines = [f'  "{k}": {v}' for k, v in CANONICAL_COLUMNS.items()]
    user_msg = (
        "Canonical schema:\n"
        + "\n".join(schema_lines)
        + f"\n\nRaw column headers: {list(columns)}\n"
        + f"Sample rows (first 3):\n{json.dumps(sample_rows, default=str)}\n\n"
        "Return JSON: {\"cpt\": \"...\", \"description\": \"...\", \"ptype\": \"...\", "
        "\"charged\": \"...\", \"paid\": \"...\"}"
    )
    response = chat(
        messages=[
            {"role": "system", "content": INFERENCE_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        max_tokens=300,
        temperature=0.0,
    )
    parsed = json.loads(response)
    cleaned = {}
    for canonical in CANONICAL_COLUMNS:
        raw = parsed.get(canonical)
        if raw is not None and raw in columns:
            cleaned[canonical] = raw
    return cleaned


def normalize_columns(df: pd.DataFrame):
    """Map raw columns to canonical schema. Returns (renamed_df, mapping, used_ai).

    mapping is {canonical: raw_header}. Raises ValueError if any required column unmapped.
    """
    df = df.copy()
    df.columns = [c.strip() for c in df.columns]
    columns = list(df.columns)

    mapping = _direct_match(columns)
    used_ai = False

    if mapping is None:
        try:
            sample_rows = df.head(3).to_dict(orient="records")
            mapping = _ai_infer(columns, sample_rows)
            used_ai = True
        except (LLMUnavailable, json.JSONDecodeError, Exception):
            mapping = {}

    missing = [k for k in CANONICAL_COLUMNS if k not in mapping]
    if missing:
        raise ValueError(
            f"Could not map required columns: {missing}. "
            f"Available headers: {columns}. "
            "Add an OPENAI_API_KEY or OPENROUTER_API_KEY to enable AI inference, "
            "or rename your columns to: cpt, description, ptype, charged, paid."
        )

    rename_map = {raw: canonical for canonical, raw in mapping.items()}
    df = df.rename(columns=rename_map)
    return df, mapping, used_ai
