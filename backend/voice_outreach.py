"""Twilio outbound + ElevenLabs Conversational AI (media stream)."""

import os
from datetime import datetime, timedelta, timezone
from typing import Any
from xml.sax.saxutils import escape

from twilio.rest import Client

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")
PUBLIC_API_BASE = (os.getenv("PUBLIC_API_BASE") or "").rstrip("/")
ELEVENLABS_TWILIO_STREAM_URL = os.getenv("ELEVENLABS_TWILIO_STREAM_URL", "")
VOICE_FOLLOWUP_DELAY_DAYS = int(os.getenv("VOICE_FOLLOWUP_DELAY_DAYS", "8"))


def voice_followup_deadline_from_now() -> str:
    dt = datetime.now(timezone.utc) + timedelta(days=VOICE_FOLLOWUP_DELAY_DAYS)
    return dt.isoformat().replace("+00:00", "Z")


def _twilio_client() -> Client:
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        raise RuntimeError("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set")
    return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


def build_twiml_for_lead(lead_id: str) -> str:
    """
    Return TwiML that connects the call to ElevenLabs.
    Set ELEVENLABS_TWILIO_STREAM_URL to the wss URL from the ElevenLabs Twilio integration.
    """
    if not ELEVENLABS_TWILIO_STREAM_URL:
        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<Response>"
            '<Say voice="alice">This call cannot connect to the voice agent yet. '
            "Configure ELEVENLABS TWILIO STREAM URL on the server.</Say>"
            "</Response>"
        )
    safe_url = escape(ELEVENLABS_TWILIO_STREAM_URL, {'"': "&quot;"})
    safe_id = escape(lead_id, {'"': "&quot;"})
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="{safe_url}">
      <Parameter name="lead_id" value="{safe_id}" />
    </Stream>
  </Connect>
</Response>"""


def initiate_outbound_call(lead_id: str, to_e164: str) -> str:
    if not TWILIO_FROM_NUMBER:
        raise RuntimeError("TWILIO_FROM_NUMBER is not set")
    if not PUBLIC_API_BASE:
        raise RuntimeError("PUBLIC_API_BASE must be set for Twilio callbacks (your Render API URL)")
    to_e164 = to_e164.strip()
    if not to_e164.startswith("+"):
        raise ValueError("Phone must be in E.164 format (e.g. +15551234567)")
    twiml_url = f"{PUBLIC_API_BASE}/api/voice/twiml?lead_id={lead_id}"
    client = _twilio_client()
    call = client.calls.create(
        to=to_e164,
        from_=TWILIO_FROM_NUMBER,
        url=twiml_url,
        status_callback=f"{PUBLIC_API_BASE}/api/webhooks/twilio/voice",
        status_callback_event=["initiated", "ringing", "answered", "completed"],
        status_callback_method="POST",
    )
    return str(call.sid)


def parse_twilio_voice_form(form: dict[str, Any]) -> dict[str, Any]:
    return {
        "call_sid": form.get("CallSid"),
        "status": form.get("CallStatus"),
        "duration": form.get("CallDuration"),
        "to": form.get("To"),
        "from": form.get("From"),
    }
