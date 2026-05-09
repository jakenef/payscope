import hashlib
import hmac

from lob_outreach import lob_event_type, verify_lob_webhook_signature


def test_lob_event_type_nested():
    payload = {"event_type": {"id": "letter.mailed", "object": "event_type"}}
    assert lob_event_type(payload) == "letter.mailed"


def test_lob_event_type_string():
    assert lob_event_type({"event_type": "letter.created"}) == "letter.created"


def test_verify_lob_signature_skips_without_secret(monkeypatch):
    import lob_outreach

    monkeypatch.setattr(lob_outreach, "LOB_WEBHOOK_SECRET", "")
    assert verify_lob_webhook_signature(b"{}", None) is True


def test_verify_lob_signature_hex(monkeypatch):
    import lob_outreach

    secret = "testsecret"
    monkeypatch.setattr(lob_outreach, "LOB_WEBHOOK_SECRET", secret)
    body = b'{"hello":"world"}'
    sig = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert verify_lob_webhook_signature(body, sig) is True
    assert verify_lob_webhook_signature(body, "deadbeef") is False
