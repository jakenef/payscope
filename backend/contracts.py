"""Parse uploaded provider-payer agreement PDFs into structured fee schedules.

Uses pdfplumber for text extraction, then an LLM to convert the free-form text
into a strict JSON schema. The frontend lets the user verify before saving.
"""

import io
import json
from typing import Any

import pdfplumber

from llm import chat, LLMUnavailable


PARSER_SYSTEM_PROMPT = """You extract participating-provider agreement details from medical insurance contracts.
Return ONLY a JSON object matching the requested schema. Do not invent data — if a field
is not present in the contract, use null. Pull rates from any fee schedule table you find.
Express allowed_amount as a number (USD), pct_of_medicare as a number (e.g. 130 for 130%).
"""


def extract_pdf_text(pdf_bytes: bytes, max_chars: int = 60_000) -> str:
    """Extract concatenated text from all PDF pages, truncated to keep LLM cost down."""
    chunks = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            txt = page.extract_text() or ""
            chunks.append(txt)
    text = "\n\n".join(chunks)
    return text[:max_chars]


def parse_contract(pdf_bytes: bytes) -> dict[str, Any]:
    """Run the PDF through the LLM and return a structured contract dict."""
    text = extract_pdf_text(pdf_bytes)
    if not text.strip():
        raise ValueError("PDF contains no extractable text (scanned image?). OCR not supported yet.")

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
        '      "pct_of_medicare": number|null,      // 130 means 130%\n'
        '      "allowed_amount": number|null        // dollar amount\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Skip rows where the CPT is non-numeric, marked 'pass-through', or has 'N/A' rates.\n"
        "Only include codes with a real allowed amount or a real % of Medicare.\n\n"
        "Contract text:\n---\n"
        f"{text}\n---"
    )

    response = chat(
        messages=[
            {"role": "system", "content": PARSER_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
        max_tokens=2000,
        temperature=0.0,
    )
    parsed = json.loads(response)

    # Normalize / validate shape
    rates = parsed.get("rates") or []
    cleaned_rates = []
    for r in rates:
        cpt = (r.get("cpt") or "").strip()
        if not cpt:
            continue
        allowed = r.get("allowed_amount")
        pct = r.get("pct_of_medicare")
        if allowed is None and pct is None:
            continue
        cleaned_rates.append({
            "cpt": cpt,
            "description": r.get("description") or None,
            "pct_of_medicare": float(pct) if pct is not None else None,
            "allowed_amount": float(allowed) if allowed is not None else None,
        })

    return {
        "payer_name": parsed.get("payer_name") or "Unknown payer",
        "effective_date": parsed.get("effective_date"),
        "expiration_date": parsed.get("expiration_date"),
        "contract_number": parsed.get("contract_number"),
        "rates": cleaned_rates,
    }
