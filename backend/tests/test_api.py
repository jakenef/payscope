import io
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

MINIMAL_CSV = (
    "Provider,Ptype,Account,Patient,D.O.S,Rdoc,Cpt,Modifier,Description,Charged,Paid\n"
    "BR_TRIVALL,AETNA,123,DOE JOHN,2026-01-01,BR_TRIVALL,99213,,OFFICE VISIT EST,120.00,58.97\n"
    "BR_TRIVALL,BC/BS,124,SMITH JANE,2026-01-02,BR_TRIVALL,30520,,SEPTOPLASTY,600.00,140.61\n"
)

NO_KNOWN_CPT_CSV = (
    "Provider,Ptype,Account,Patient,D.O.S,Rdoc,Cpt,Modifier,Description,Charged,Paid\n"
    "BR_TRIVALL,AETNA,999,TEST PAT,2026-01-01,BR_TRIVALL,00000,,UNKNOWN PROCEDURE,100.00,50.00\n"
)


def test_analyze_returns_200():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(MINIMAL_CSV.encode()), "text/csv")},
    )
    assert response.status_code == 200


def test_analyze_returns_required_keys():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(MINIMAL_CSV.encode()), "text/csv")},
    )
    data = response.json()
    assert "summary" in data
    assert "payer_breakdown" in data
    assert "underpayment_table" in data
    assert "cpt_breakdown" in data
    assert "ai_narrative" in data


def test_analyze_summary_types():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(MINIMAL_CSV.encode()), "text/csv")},
    )
    s = response.json()["summary"]
    assert isinstance(s["biller_score"], int)
    assert isinstance(s["total_paid"], float)
    assert isinstance(s["leakage_pct"], float)


def test_analyze_returns_422_for_unrecognized_cpts():
    response = client.post(
        "/api/analyze",
        files={"file": ("claims.csv", io.BytesIO(NO_KNOWN_CPT_CSV.encode()), "text/csv")},
    )
    assert response.status_code == 422
