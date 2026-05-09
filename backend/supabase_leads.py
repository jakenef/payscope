"""Service-role Supabase REST helpers for admin bulk lead operations."""

import os
from typing import Any

import httpx

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def _rest_headers() -> dict[str, str]:
    if not SUPABASE_URL or not SERVICE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for admin lead import"
        )
    return {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal,resolution=merge-duplicates",
    }


async def upsert_leads(rows: list[dict[str, Any]]) -> None:
    """
    Batch upsert leads on conflict key `npi` (partial unique index).
    """
    if not rows:
        return
    url = f"{SUPABASE_URL}/rest/v1/leads?on_conflict=npi"
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(url, headers=_rest_headers(), json=rows)
        if r.status_code not in (200, 201, 204):
            detail = r.text
            raise RuntimeError(f"Supabase upsert failed ({r.status_code}): {detail[:600]}")
