import io
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

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
