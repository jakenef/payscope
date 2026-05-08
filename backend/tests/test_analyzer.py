from rates import RATES


def test_rates_contains_common_ent_codes():
    required = ["99213", "99214", "30520", "69210", "92511", "31231"]
    for code in required:
        assert code in RATES, f"Missing CPT {code} in RATES"


def test_rates_values_are_positive_floats():
    for code, rate in RATES.items():
        assert isinstance(rate, float), f"Rate for {code} is not a float"
        assert rate > 0, f"Rate for {code} is not positive"
