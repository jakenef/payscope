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
from benchmarks import get_benchmarks

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

    try:
        result = analyze_claims(df)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    result["column_mapping"] = column_mapping
    result["column_mapping_ai_inferred"] = ai_inferred
    result["ai_narrative"] = generate_narrative(result)
    result["benchmarks"] = get_benchmarks(specialty, state, result["summary"])
    return result


@app.get("/api/benchmark-options")
def benchmark_options():
    """Lookup data for the signup specialty/state dropdowns."""
    from benchmarks import SPECIALTIES, STATES
    return {"specialties": SPECIALTIES, "states": STATES}


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
