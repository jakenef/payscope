import io
import os
import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from analyzer import analyze_claims
from ai import generate_narrative

load_dotenv()

app = FastAPI(title="Payscope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    contents = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse CSV file.")

    # Normalize column names
    df.columns = [c.strip() for c in df.columns]
    df = df.rename(columns={"Ptype": "ptype", "Cpt": "cpt", "Description": "description",
                              "Charged": "charged", "Paid": "paid"})

    required = {"cpt", "ptype", "charged", "paid"}
    missing = required - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"CSV is missing required columns: {', '.join(sorted(missing))}. "
                   f"Expected headers: Cpt, Ptype, Charged, Paid."
        )

    try:
        result = analyze_claims(df)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    result["ai_narrative"] = generate_narrative(result)
    return result
