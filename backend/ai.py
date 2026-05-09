import json
from llm import chat, LLMUnavailable

SYSTEM_PROMPT = """You are a medical billing analyst reviewing claims data for an independent physician practice.
You will receive structured JSON data from a revenue integrity analysis.
Identify 2–3 specific patterns of underpayment or downcoding, explain each in plain English a physician can understand, and give 1–2 actionable recommendations.
Be specific — name the payers and CPT codes where relevant.
Keep your response under 200 words. Write in paragraph form, no bullet points."""


def generate_narrative(analysis: dict) -> str:
    summary = analysis["summary"]
    top_payers = sorted(analysis["payer_breakdown"], key=lambda x: x["variance_pct"])[:5]
    top_cpts = sorted(analysis["cpt_breakdown"], key=lambda x: x["variance_pct"])[:5]

    payload = {
        "biller_score": summary["biller_score"],
        "total_leakage_dollars": summary["leakage_dollars"],
        "leakage_pct": summary["leakage_pct"],
        "total_claims": summary["total_claims"],
        "flagged_claims": summary["flagged_claims"],
        "payer_breakdown": top_payers,
        "top_underpaid_cpts": top_cpts,
    }

    try:
        return chat(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload)},
            ],
            max_tokens=350,
            temperature=0.3,
        )
    except LLMUnavailable as e:
        return f"AI narrative unavailable: {e}"
    except Exception as e:
        return f"AI narrative unavailable: {e}"
