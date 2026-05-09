"""Verify Supabase access tokens against the Payscope admin email allowlist."""

import os

import httpx

SUPABASE_URL = (os.getenv("SUPABASE_URL") or "").rstrip("/")
ADMIN_EMAILS_RAW = os.getenv("ADMIN_EMAILS", "")
ADMIN_CRON_SECRET = os.getenv("ADMIN_CRON_SECRET", "")


def _admin_email_set() -> set[str]:
    parts = [e.strip().lower() for e in ADMIN_EMAILS_RAW.split(",") if e.strip()]
    if not parts:
        single = os.getenv("ADMIN_EMAIL", "").strip().lower()
        if single:
            parts = [single]
    return set(parts)


async def admin_email_from_bearer(access_token: str | None) -> str | None:
    """
    Resolve the user's email from a Supabase session JWT via Auth API.
    Returns None if invalid or Supabase misconfigured.
    """
    if not access_token or not SUPABASE_URL:
        return None
    anon = os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")
    if not anon:
        return None
    url = f"{SUPABASE_URL}/auth/v1/user"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "apikey": anon,
                },
            )
    except httpx.HTTPError:
        return None
    if r.status_code != 200:
        return None
    data = r.json()
    email = (data.get("email") or "").strip().lower()
    return email or None


def is_admin_email(email: str | None) -> bool:
    if not email:
        return False
    allowed = _admin_email_set()
    if not allowed:
        return False
    return email.lower() in allowed


async def require_admin(access_token: str | None) -> str:
    email = await admin_email_from_bearer(access_token)
    if not email or not is_admin_email(email):
        return ""
    return email


def verify_cron_secret(x_admin_key: str | None) -> bool:
    if not ADMIN_CRON_SECRET or not x_admin_key:
        return False
    return x_admin_key == ADMIN_CRON_SECRET
