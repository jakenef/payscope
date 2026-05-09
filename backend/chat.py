import json
from llm import chat

CHAT_SYSTEM_PROMPT = """You are a revenue integrity analyst assistant for an independent physician practice.
You help the user understand their claims data — payer behavior, downcoding patterns, underpayment trends, and CPT-level issues.

You always have access to a structured ANALYSIS_CONTEXT JSON block describing the user's most recent upload.
Ground every answer in that context. Cite specific payers, CPT codes, and dollar amounts from the data.
If the user asks something the data cannot answer, say so plainly rather than guessing.

Be concise. Use short paragraphs and the occasional bullet list. Avoid medical-billing jargon unless the user uses it first.
When recommending action, be specific (e.g., "renegotiate with Aetna for CPT 99214 — currently paying 72% of Medicare")."""


def _summarize_context(analysis: dict) -> str:
    summary = analysis.get("summary", {})
    payers = sorted(
        analysis.get("payer_breakdown", []),
        key=lambda x: x.get("variance_pct", 0),
    )[:8]
    cpts = sorted(
        analysis.get("cpt_breakdown", []),
        key=lambda x: x.get("variance_pct", 0),
    )[:10]
    flagged = analysis.get("underpayment_table", [])[:15]

    return json.dumps(
        {
            "summary": summary,
            "worst_payers": payers,
            "worst_cpts": cpts,
            "top_flagged_claims": flagged,
        },
        default=str,
    )


def chat_about_analysis(messages: list[dict], analysis: dict) -> str:
    context_block = _summarize_context(analysis)
    full_messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {"role": "system", "content": f"ANALYSIS_CONTEXT:\n{context_block}"},
        *messages,
    ]
    return chat(messages=full_messages, max_tokens=600, temperature=0.4)
