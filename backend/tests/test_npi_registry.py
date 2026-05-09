import pytest

from npi_registry import normalize_npi_record


def test_normalize_maps_org_location():
    entry = {
        "number": "1999999964",
        "enumeration_type": "NPI-2",
        "basic": {"organization_name": "Summit ENT Group"},
        "addresses": [
            {
                "address_purpose": "MAILING",
                "address_1": "456 Mail Rd",
                "city": "Seattle",
                "state": "WA",
                "postal_code": "981019999",
                "telephone_number": "2065550100",
            },
            {
                "address_purpose": "LOCATION",
                "address_1": "123 Clinic Ave",
                "city": "Seattle",
                "state": "WA",
                "postal_code": "981012345",
                "telephone_number": "2065550199",
            },
        ],
        "taxonomies": [
            {"code": "207Y00000X", "desc": "Otolaryngology", "primary": True},
        ],
    }
    row = normalize_npi_record(entry)
    assert row["npi"] == "1999999964"
    assert row["practice_name"] == "Summit ENT Group"
    assert row["specialty"] == "Otolaryngology"
    assert row["taxonomy_code"] == "207Y00000X"
    assert row["city"] == "Seattle"
    assert row["state"] == "WA"
    assert row["zip"] == "98101"
    assert row["address_line1"] == "123 Clinic Ave"
    assert row["phone"] == "+12065550199"


@pytest.mark.parametrize("raw,expected", [("3035559876", "+13035559876"), (None, None)])
def test_phone_digits(raw, expected):
    from npi_registry import _digits_phone

    assert _digits_phone(raw) == expected
