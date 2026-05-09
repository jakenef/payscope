import pandas as pd
import pytest


@pytest.fixture
def sample_df():
    return pd.DataFrame([
        {"ptype": "AETNA",  "cpt": "99213", "description": "OFFICE VISIT EST",   "charged": 120.00, "paid": 58.97},
        {"ptype": "AETNA",  "cpt": "30520", "description": "SEPTOPLASTY",         "charged": 600.00, "paid": 140.61},
        {"ptype": "BC/BS",  "cpt": "99213", "description": "OFFICE VISIT EST",    "charged": 120.00, "paid": 93.91},
        {"ptype": "BC/BS",  "cpt": "69210", "description": "REMOVE IMPACTED EAR", "charged": 80.00,  "paid": 51.23},
        {"ptype": "ALPHA",  "cpt": "99204", "description": "OFFICE VISIT NEW",    "charged": 200.00, "paid": 30.00},
    ])


@pytest.fixture
def fully_paid_df():
    """Claims paid well above the 80% paid/billed threshold."""
    return pd.DataFrame([
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.00, "paid": 100.00},
        {"ptype": "AETNA", "cpt": "69210", "description": "REMOVE EAR WAX",   "charged": 80.00,  "paid": 68.00},
    ])


@pytest.fixture
def baselines_df():
    """6 AETNA/99213 claims (≥5 → group path); 1 BC/BS/99213 (< 5 → fallback path)."""
    rows = [
        {"ptype": "AETNA", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.00, "paid": paid}
        for paid in [70.0, 80.0, 85.0, 90.0, 95.0, 100.0]
    ]
    rows += [
        {"ptype": "BC/BS", "cpt": "99213", "description": "OFFICE VISIT EST", "charged": 120.00, "paid": 93.0},
    ]
    return pd.DataFrame(rows)
