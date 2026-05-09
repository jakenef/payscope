import io
import json
from datetime import datetime, timezone

import httpx
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Header, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel, Field

from admin_auth import require_admin, verify_cron_secret
from lob_outreach import (
    create_intro_letter,
    lead_id_from_letter_resource,
    letter_resource_from_webhook,
    lob_event_type,
    verify_lob_webhook_signature,
)
from npi_registry import fetch_npi_page
from supabase_admin import (
    fetch_voice_due,
    find_lead_by_lob_letter_id,
    find_lead_by_twilio_call_sid,
    get_lead,
    insert_outreach,
    patch_lead,
)
from supabase_leads import upsert_leads
from voice_outreach import (
    build_twiml_for_lead,
    initiate_outbound_call,
    parse_twilio_voice_form,
    voice_followup_deadline_from_now,
)

from analyzer import analyze_claims
from ai import generate_narrative
from columns import normalize_columns
from chat import chat_about_analysis
from benchmarks import get_benchmarks, SPECIALTY_BASELINES, STATE_ADJUSTMENTS, COHORT_SIZES, _adjust
from contracts import parse_contract

load_dotenv()

app = FastAPI(title="Payscope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_dataframe(filename: str, contents: bytes) -> pd.DataFrame:
    name = (filename or "").lower()
    buf = io.BytesIO(contents)
    if name.endswith(".xlsx") or name.endswith(".xls"):
        return pd.read_excel(buf)
    if name.endswith(".csv"):
        return pd.read_csv(buf)
    # Fallback: try CSV first, then Excel
    try:
        return pd.read_csv(io.BytesIO(contents))
    except Exception:
        return pd.read_excel(io.BytesIO(contents))


@app.post("/api/analyze")
async def analyze(
    file: UploadFile = File(...),
    specialty: str | None = Form(None),
    state: str | None = Form(None),
    contracts: str | None = Form(None),  # JSON-encoded list of {payer_name, rates: [{cpt, allowed_amount}]}
):
    contents = await file.read()
    try:
        df = _read_dataframe(file.filename, contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    try:
        df, column_mapping, ai_inferred = normalize_columns(df)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    contract_lookup = _build_contract_lookup(contracts)

    try:
        result = analyze_claims(df, contract_lookup=contract_lookup)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    result["column_mapping"] = column_mapping
    result["column_mapping_ai_inferred"] = ai_inferred
    result["ai_narrative"] = generate_narrative(result)
    result["benchmarks"] = get_benchmarks(specialty, state, result["summary"])
    return result


def _build_contract_lookup(contracts_json: str | None) -> dict[tuple[str, str], float]:
    """Flatten the user's contracts into {(normalized_payer, cpt): allowed_amount}."""
    if not contracts_json:
        return {}
    try:
        parsed = __import__("json").loads(contracts_json)
    except Exception:
        return {}
    lookup = {}
    for c in parsed or []:
        payer_key = (c.get("payer_name") or "").strip().lower()
        if not payer_key:
            continue
        for r in c.get("rates") or []:
            cpt = str(r.get("cpt") or "").strip()
            allowed = r.get("allowed_amount")
            if cpt and allowed is not None:
                try:
                    lookup[(payer_key, cpt)] = float(allowed)
                except (TypeError, ValueError):
                    continue
    return lookup


@app.post("/api/contracts/parse")
async def contracts_parse(file: UploadFile = File(...)):
    """Extract a participating-provider agreement PDF into structured form. No persistence."""
    name = (file.filename or "").lower()
    if not name.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF uploads supported.")
    contents = await file.read()
    try:
        contract = parse_contract(contents)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Parse failed: {e}")
    contract["raw_filename"] = file.filename
    return contract


@app.get("/api/benchmark-options")
def benchmark_options():
    """Lookup data for the signup specialty/state dropdowns."""
    from benchmarks import SPECIALTIES, STATES
    return {"specialties": SPECIALTIES, "states": STATES}


@app.get("/api/benchmarks/by-state")
def benchmarks_by_state(specialty: str = "Other"):
    """Return per-state benchmark stats for a specialty. One round-trip for the map."""
    if specialty not in SPECIALTY_BASELINES:
        specialty = "Other"
    base = SPECIALTY_BASELINES[specialty]

    states = {}
    for code, adj in STATE_ADJUSTMENTS.items():
        states[code] = {
            "cohort_size": COHORT_SIZES.get(code, 6),
            "biller_score":      _adjust(base["biller_score"],      adj["biller_score"]),
            "leakage_pct":       _adjust(base["leakage_pct"],       adj["leakage_pct"]),
            "payment_ratio_pct": _adjust(base["payment_ratio_pct"], adj["payment_ratio_pct"]),
        }
    return {"specialty": specialty, "states": states}


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization[7:].strip() or None


class NpiImportBody(BaseModel):
    state: str = Field(..., min_length=2, max_length=2)
    taxonomy_code: str = Field(..., min_length=3, max_length=24)
    limit: int = Field(100, ge=1, le=200)
    skip: int = Field(0, ge=0, le=50_000)


@app.post("/api/admin/npi/import")
async def admin_npi_import(
    body: NpiImportBody,
    authorization: str | None = Header(None),
):
    """
    Bulk upsert organizational NPI leads from CMS NPPES into Supabase.

    Requires a valid Supabase user session JWT whose email is listed in ADMIN_EMAILS.
    Backend uses SUPABASE_SERVICE_ROLE_KEY for the upsert.
    """
    admin = await require_admin(_bearer_token(authorization))
    if not admin:
        raise HTTPException(status_code=401, detail="Admin authentication required")
    try:
        rows, total = await fetch_npi_page(
            state=body.state.strip().upper(),
            taxonomy_code=body.taxonomy_code.strip(),
            limit=body.limit,
            skip=body.skip,
        )
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=502,
            detail=f"NPPES Registry error ({e.response.status_code})",
        ) from e
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"NPPES unreachable: {e}") from e
    try:
        await upsert_leads(rows)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    return {"upserted": len(rows), "result_count": total}


async def _admin_or_cron(authorization: str | None, x_admin_key: str | None) -> bool:
    if verify_cron_secret(x_admin_key):
        return True
    email = await require_admin(_bearer_token(authorization))
    return bool(email)


@app.post("/api/admin/leads/{lead_id}/letter")
async def admin_send_lob_letter(
    lead_id: str,
    authorization: str | None = Header(None),
):
    if not await require_admin(_bearer_token(authorization)):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    lead = await get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    try:
        lob = await create_intro_letter(lead)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    letter_id = lob.get("id")
    status = lob.get("status") or "submitted"
    now = datetime.now(timezone.utc).isoformat()
    patch: dict = {
        "lob_letter_id": letter_id,
        "letter_status": status,
        "letter_requested_at": now,
    }
    if lead.get("status") == "new":
        patch["status"] = "contacted"
    await patch_lead(lead_id, patch)
    await insert_outreach(
        lead_id,
        "mail",
        "outbound",
        subject="Intro letter (Lob)",
        body=f"Lob letter id {letter_id}",
        outcome=status,
        meta={"lob_letter_id": letter_id},
    )
    return {"lob": lob, "lead_id": lead_id}


@app.post("/api/admin/leads/{lead_id}/call")
async def admin_trigger_voice_call(
    lead_id: str,
    authorization: str | None = Header(None),
):
    if not await require_admin(_bearer_token(authorization)):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    lead = await get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.get("do_not_call"):
        raise HTTPException(status_code=400, detail="Lead is marked do not call")
    phone = (lead.get("phone") or "").strip()
    if not phone.startswith("+"):
        raise HTTPException(
            status_code=422,
            detail="Phone must be E.164 (e.g. +15551234567)",
        )
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    await patch_lead(
        lead_id,
        {"last_voice_call_at": now, "voice_call_outcome": "dialing"},
    )
    try:
        sid = initiate_outbound_call(lead_id, phone)
    except Exception as e:
        await patch_lead(
            lead_id,
            {"last_voice_call_at": None, "voice_call_outcome": f"dial_error: {e}"[:240]},
        )
        raise HTTPException(status_code=503, detail=str(e)) from e
    await patch_lead(lead_id, {"twilio_call_sid": sid})
    await insert_outreach(
        lead_id,
        "call",
        "outbound",
        outcome="dialing",
        body=sid,
        meta={"twilio_call_sid": sid},
    )
    return {"call_sid": sid, "lead_id": lead_id}


@app.post("/api/admin/voice/tick")
async def admin_voice_tick(
    authorization: str | None = Header(None),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    limit: int = Query(5, ge=1, le=20),
):
    if not await _admin_or_cron(authorization, x_admin_key):
        raise HTTPException(status_code=401, detail="Admin or cron authentication required")
    due = await fetch_voice_due(limit=min(limit, 20))
    results: list[dict] = []
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    for lead in due:
        lid = str(lead["id"])
        phone = (lead.get("phone") or "").strip()
        if not phone.startswith("+"):
            results.append({"lead_id": lid, "skipped": "phone_not_e164"})
            continue
        await patch_lead(
            lid,
            {"last_voice_call_at": now, "voice_call_outcome": "dialing"},
        )
        try:
            sid = initiate_outbound_call(lid, phone)
        except Exception as e:
            await patch_lead(
                lid,
                {
                    "last_voice_call_at": None,
                    "voice_call_outcome": f"dial_error: {e}"[:240],
                },
            )
            results.append({"lead_id": lid, "error": str(e)[:200]})
            continue
        await patch_lead(lid, {"twilio_call_sid": sid})
        await insert_outreach(
            lid,
            "call",
            "outbound",
            outcome="dialing",
            body=sid,
            meta={"twilio_call_sid": sid, "source": "cron_tick"},
        )
        results.append({"lead_id": lid, "call_sid": sid})
    return {"due_count": len(due), "results": results}


@app.post("/api/webhooks/lob")
async def lob_webhook(request: Request):
    body = await request.body()
    sig = (
        request.headers.get("lob-signature")
        or request.headers.get("Lob-Signature")
        or request.headers.get("X-Lob-Signature")
    )
    if not verify_lob_webhook_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid Lob signature")
    try:
        payload = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON") from None

    et = lob_event_type(payload)
    letter = letter_resource_from_webhook(payload)
    if not letter:
        return {"ok": True, "ignored": "not_letter"}

    letter_id = letter.get("id")
    lead_id = lead_id_from_letter_resource(letter)
    if not lead_id and letter_id:
        row = await find_lead_by_lob_letter_id(str(letter_id))
        if row:
            lead_id = str(row["id"])
    if not lead_id:
        return {"ok": True, "ignored": "lead_not_found"}

    letter_status = letter.get("status") or et
    patch: dict = {"letter_status": str(letter_status)[:120]}
    if letter_id:
        patch["lob_letter_id"] = str(letter_id)
    if any(
        key in et
        for key in (
            "mailed",
            "in_transit",
            "in_local_area",
            "processed_for_delivery",
            "delivered",
        )
    ):
        patch["letter_sent_at"] = datetime.now(timezone.utc).isoformat()
        patch["voice_followup_after"] = voice_followup_deadline_from_now()

    await patch_lead(lead_id, patch)
    await insert_outreach(
        lead_id,
        "mail",
        "inbound",
        subject=f"Lob webhook: {et}",
        body=json.dumps({"event_type": et, "letter_id": letter_id})[:8000],
        outcome=et,
        meta={"event_type": et, "letter_id": letter_id},
    )
    return {"ok": True, "lead_id": lead_id}


@app.api_route("/api/voice/twiml", methods=["GET", "POST"])
async def voice_twiml(lead_id: str = Query(..., min_length=10)):
    xml = build_twiml_for_lead(lead_id)
    return Response(content=xml, media_type="application/xml")


@app.post("/api/webhooks/twilio/voice")
async def twilio_voice_status(request: Request):
    form = dict(await request.form())
    info = parse_twilio_voice_form(form)
    sid = info.get("call_sid")
    if not sid:
        return {"ok": False}
    lead = await find_lead_by_twilio_call_sid(str(sid))
    if not lead:
        return {"ok": True, "ignored": "unknown_call"}
    lid = str(lead["id"])
    status = (info.get("status") or "").lower()
    duration = info.get("duration")
    outcome = status
    if status == "completed" and duration is not None:
        outcome = f"completed_{duration}s"
    await patch_lead(lid, {"voice_call_outcome": outcome[:240]})
    await insert_outreach(
        lid,
        "call",
        "outbound",
        subject="Twilio status",
        body=json.dumps(info)[:8000],
        outcome=status or None,
        meta=info,
    )
    return {"ok": True, "lead_id": lid}


@app.post("/api/webhooks/elevenlabs")
async def elevenlabs_webhook(request: Request):
    """Optional: configure ElevenLabs post-call webhook to this URL."""
    try:
        payload = await request.json()
    except Exception:
        return {"ok": False, "detail": "invalid_json"}
    lead_id = None
    if isinstance(payload, dict):
        dv = payload.get("dynamic_variables") or payload.get("dynamicVariables")
        if isinstance(dv, dict) and dv.get("lead_id"):
            lead_id = str(dv["lead_id"])
        conv = payload.get("conversation_id") or payload.get("conversationId")
        if not lead_id:
            lead_id = payload.get("lead_id")
    if lead_id:
        summary = ""
        if isinstance(payload, dict):
            summary = str(
                payload.get("transcript_summary")
                or payload.get("summary")
                or payload.get("analysis")
                or ""
            )[:2000]
        el_patch: dict = {"voice_call_outcome": "elevenlabs_done"}
        if isinstance(payload, dict):
            cid = payload.get("conversation_id") or payload.get("conversationId")
            if cid:
                el_patch["elevenlabs_conversation_id"] = str(cid)
        await patch_lead(lead_id, el_patch)
        await insert_outreach(
            lead_id,
            "call",
            "inbound",
            subject="ElevenLabs",
            body=summary or json.dumps(payload)[:4000],
            outcome="agent_completed",
            meta=payload if isinstance(payload, dict) else {},
        )
    return {"ok": True}


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    analysis: dict


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    try:
        reply = chat_about_analysis(
            messages=[m.model_dump() for m in req.messages],
            analysis=req.analysis,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Chat unavailable: {e}")
    return {"role": "assistant", "content": reply}
