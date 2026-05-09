import os
from openai import OpenAI

OPENAI_DEFAULT_MODEL = "gpt-4o"
OPENROUTER_DEFAULT_MODEL = "openai/gpt-4o-mini"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"


class LLMUnavailable(Exception):
    pass


def _openai_client():
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    return OpenAI(api_key=key)


def _openrouter_client():
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        return None
    return OpenAI(api_key=key, base_url=OPENROUTER_BASE_URL)


def chat(messages, *, response_format=None, max_tokens=500, temperature=0.3):
    """Call OpenAI; fall back to OpenRouter on missing key or failure.

    Returns the message content string. Raises LLMUnavailable if neither provider works.
    """
    last_error = None

    primary = _openai_client()
    if primary is not None:
        try:
            kwargs = {
                "model": OPENAI_DEFAULT_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            if response_format is not None:
                kwargs["response_format"] = response_format
            resp = primary.chat.completions.create(**kwargs)
            return resp.choices[0].message.content.strip()
        except Exception as e:
            last_error = e

    fallback = _openrouter_client()
    if fallback is not None:
        try:
            kwargs = {
                "model": OPENROUTER_DEFAULT_MODEL,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            }
            if response_format is not None:
                kwargs["response_format"] = response_format
            resp = fallback.chat.completions.create(**kwargs)
            return resp.choices[0].message.content.strip()
        except Exception as e:
            last_error = e

    if last_error is not None:
        raise LLMUnavailable(f"All providers failed: {last_error}")
    raise LLMUnavailable("No API key set (OPENAI_API_KEY or OPENROUTER_API_KEY).")
