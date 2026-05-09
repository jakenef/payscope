"""Fetch and normalize CMS NPPES Registry results (organizational providers)."""

import re
from typing import Any

import httpx

NPPES_BASE = "https://npiregistry.cms.hhs.gov/api/"


def _digits_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    d = re.sub(r"\D", "", raw)
    if len(d) == 10:
        return f"+1{d}"
    if len(d) == 11 and d.startswith("1"):
        return f"+{d}"
    if d.startswith("+") and len(raw) > 6:
        return raw.strip()
    return raw.strip() or None


def _pick_address(addresses: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not addresses:
        return None
    for purpose in ("LOCATION", "MAILING", "PRIMARY"):
        for a in addresses:
            if a.get("address_purpose") == purpose:
                return a
    return addresses[0]


def _primary_taxonomy(taxonomies: list[dict[str, Any]]) -> tuple[str | None, str | None]:
    if not taxonomies:
        return None, None
    for t in taxonomies:
        if t.get("primary") is True:
            return t.get("code"), t.get("desc") or t.get("description")
    t0 = taxonomies[0]
    return t0.get("code"), t0.get("desc") or t0.get("description")


def normalize_npi_record(entry: dict[str, Any]) -> dict[str, Any] | None:
    """Map one NPPES result object to a leads row shape (before DB insert)."""
    npi = str(entry.get("number") or "").strip()
    if not npi:
        return None
    basic = entry.get("basic") or {}
    org_name = (basic.get("organization_name") or "").strip()
    if not org_name:
        return None
    addresses = entry.get("addresses") or []
    addr = _pick_address(addresses)
    if not addr:
        return None
    postal = (addr.get("postal_code") or "").strip()
    zip5 = postal[:5] if len(postal) >= 5 else postal
    state = (addr.get("state") or "").strip().upper()[:2]
    tax_code, tax_desc = _primary_taxonomy(entry.get("taxonomies") or [])
    phone = _digits_phone(addr.get("telephone_number"))
    row = {
        "npi": npi,
        "practice_name": org_name[:500],
        "phone": phone,
        "address_line1": (addr.get("address_1") or "")[:255] or None,
        "address_line2": (addr.get("address_2") or "").strip() or None,
        "city": (addr.get("city") or "")[:120] or None,
        "state": state or None,
        "zip": zip5 or None,
        "taxonomy_code": tax_code,
        "specialty": (tax_desc or "")[:255] or None,
        "source": "npi_registry",
        "status": "new",
    }
    return row


async def fetch_npi_page(
    *,
    state: str,
    taxonomy_code: str,
    limit: int = 100,
    skip: int = 0,
) -> tuple[list[dict[str, Any]], int | None]:
    """
    Pull one page of NPI-2 orgs filtered by NUCC taxonomy + state.

    Returns (normalized rows ready for upsert, result_count from API metadata).
    """
    params = {
        "version": "2.1",
        "enumeration_type": "NPI-2",
        "taxonomy_code": taxonomy_code.strip(),
        "state": state.strip().upper()[:2],
        "limit": min(max(limit, 1), 200),
        "skip": max(skip, 0),
    }
    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.get(NPPES_BASE, params=params)
        r.raise_for_status()
        payload = r.json()

    results = payload.get("results") or []
    normalized: list[dict[str, Any]] = []
    for entry in results:
        row = normalize_npi_record(entry)
        if row:
            normalized.append(row)

    meta = payload.get("result_count")
    return normalized, int(meta) if meta is not None else None
