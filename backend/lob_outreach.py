"""Lob.com physical mail for intro letters."""

import hashlib
import hmac
import os
from typing import Any

import httpx

LOB_API_KEY = os.getenv("LOB_API_KEY", "")
LOB_FROM_ADDRESS_ID = os.getenv("LOB_FROM_ADDRESS_ID", "")
LOB_LETTER_TEMPLATE_ID = os.getenv("LOB_LETTER_TEMPLATE_ID", "")
LOB_WEBHOOK_SECRET = os.getenv("LOB_WEBHOOK_SECRET", "")
PAYSCOPE_DEMO_BASE = os.getenv("PAYSCOPE_DEMO_URL", "https://payscope-two.vercel.app").rstrip("/")

LOB_API = "https://api.lob.com/v1"


def demo_url_for_lead(lead_id: str) -> str:
    return f"{PAYSCOPE_DEMO_BASE}/?ref={lead_id}"


def _auth() -> tuple[str, str]:
    if not LOB_API_KEY:
        raise RuntimeError("LOB_API_KEY is not set")
    return LOB_API_KEY, ""


def verify_lob_webhook_signature(body: bytes, signature_header: str | None) -> bool:
    if not LOB_WEBHOOK_SECRET:
        return True
    if not signature_header:
        return False
    sig = signature_header.strip()
    if sig.startswith("sha256="):
        sig = sig[7:]
    expected = hmac.new(
        LOB_WEBHOOK_SECRET.encode("utf-8"), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, sig)


def lob_event_type(payload: dict[str, Any]) -> str:
    et = payload.get("event_type")
    if isinstance(et, dict):
        return str(et.get("id") or "")
    return str(et or "")


def letter_resource_from_webhook(payload: dict[str, Any]) -> dict[str, Any] | None:
    body = payload.get("body")
    if isinstance(body, dict) and body.get("object") == "letter":
        return body
    return None


def lead_id_from_letter_resource(letter: dict[str, Any]) -> str | None:
    meta = letter.get("metadata") or {}
    if isinstance(meta, dict):
        lid = meta.get("lead_id")
        if lid:
            return str(lid)
    return None


async def create_intro_letter(lead: dict[str, Any]) -> dict[str, Any]:
    """
    Create a Lob letter from an HTML template + merge variables.
    Requires verified LOB_FROM_ADDRESS_ID and LOB_LETTER_TEMPLATE_ID in Lob dashboard.
    """
    if not LOB_FROM_ADDRESS_ID or not LOB_LETTER_TEMPLATE_ID:
        raise RuntimeError(
            "Set LOB_FROM_ADDRESS_ID and LOB_LETTER_TEMPLATE_ID (Lob dashboard) to send letters."
        )
    line1 = (lead.get("address_line1") or "").strip()
    city = (lead.get("city") or "").strip()
    state = (lead.get("state") or "").strip().upper()[:2]
    z = (lead.get("zip") or "").strip()
    if not line1 or not city or not state or not z:
        raise ValueError("Lead is missing mailing address (line1, city, state, zip).")
    lead_uuid = str(lead["id"])
    payload: dict[str, Any] = {
        "description": f"Payscope intro {lead_uuid[:8]}",
        "to": {
            "name": (lead.get("practice_name") or "Practice")[:40],
            "address_line1": line1[:64],
            "address_city": city[:40],
            "address_state": state,
            "address_zip": z[:10],
            "address_country": "US",
        },
        "from": LOB_FROM_ADDRESS_ID,
        "template_id": LOB_LETTER_TEMPLATE_ID,
        "merge_variables": {
            "practice_name": lead.get("practice_name") or "",
            "demo_url": demo_url_for_lead(lead_uuid),
            "city": city,
            "state": state,
        },
        "metadata": {"lead_id": lead_uuid},
        "use_type": "marketing",
        "color": True,
    }
    line2 = (lead.get("address_line2") or "").strip()
    if line2:
        payload["to"]["address_line2"] = line2[:64]

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{LOB_API}/letters",
            auth=_auth(),
            json=payload,
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Lob API error {r.status_code}: {r.text[:800]}")
    return r.json()
