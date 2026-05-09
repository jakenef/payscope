"""Service-role Supabase REST for admin outreach (reads, patches, outreach_log)."""

import os
from datetime import datetime, timezone
from typing import Any

import httpx

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _headers(prefer: str | None = None) -> dict[str, str]:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    h = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    if prefer:
        h["Prefer"] = prefer
    return h


async def get_lead(lead_id: str) -> dict[str, Any] | None:
    url = f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}&select=*"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=_headers())
    if r.status_code != 200:
        return None
    rows = r.json()
    return rows[0] if rows else None


async def patch_lead(lead_id: str, patch: dict[str, Any]) -> None:
    if not patch:
        return
    url = f"{SUPABASE_URL}/rest/v1/leads?id=eq.{lead_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.patch(url, headers=_headers("return=minimal"), json=patch)
    if r.status_code not in (200, 204):
        raise RuntimeError(f"patch_lead failed {r.status_code}: {r.text[:400]}")


async def find_lead_by_lob_letter_id(letter_id: str) -> dict[str, Any] | None:
    url = f"{SUPABASE_URL}/rest/v1/leads?lob_letter_id=eq.{letter_id}&select=*"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=_headers())
    if r.status_code != 200:
        return None
    rows = r.json()
    return rows[0] if rows else None


async def find_lead_by_twilio_call_sid(call_sid: str) -> dict[str, Any] | None:
    url = f"{SUPABASE_URL}/rest/v1/leads?twilio_call_sid=eq.{call_sid}&select=*"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=_headers())
    if r.status_code != 200:
        return None
    rows = r.json()
    return rows[0] if rows else None


async def insert_outreach(
    lead_id: str,
    channel: str,
    direction: str,
    *,
    subject: str | None = None,
    body: str | None = None,
    outcome: str | None = None,
    meta: dict | None = None,
) -> None:
    row = {
        "lead_id": lead_id,
        "channel": channel,
        "direction": direction,
        "subject": subject,
        "body": body,
        "outcome": outcome,
        "meta": meta,
    }
    url = f"{SUPABASE_URL}/rest/v1/outreach_log"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(url, headers=_headers("return=minimal"), json=row)
    if r.status_code not in (200, 201, 204):
        raise RuntimeError(f"insert_outreach failed {r.status_code}: {r.text[:400]}")


async def fetch_voice_due(*, limit: int = 5) -> list[dict[str, Any]]:
    """
    Leads ready for first auto voice attempt: follow-up time passed, has phone,
    not DNC, voice window set from Lob mail webhook, no completed call logged.
    """
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    filters = (
        f"voice_followup_after=lte.{now}"
        "&voice_followup_after=not.is.null"
        "&last_voice_call_at=is.null"
        "&do_not_call=eq.false"
        "&phone=not.is.null"
        f"&limit={limit}"
        "&order=voice_followup_after.asc"
    )
    url = f"{SUPABASE_URL}/rest/v1/leads?{filters}&select=*"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(url, headers=_headers())
    if r.status_code != 200:
        return []
    return r.json()
