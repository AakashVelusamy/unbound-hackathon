"""Unbound API client — call_llm(step, context) returns response text and optional token count."""
import logging
from dataclasses import dataclass

import httpx

from core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class LLMResult:
    """Result of a single LLM call."""
    content: str
    tokens_used: int | None = None


def call_llm(prompt_with_context: str, model: str) -> LLMResult:
    """
    Call Unbound chat completions API. Used by executor with step.model and built prompt.
    """
    if not settings.unbound_api_key:
        raise ValueError("UNBOUND_API_KEY is not set")

    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt_with_context}],
        "max_tokens": 4096,
        "temperature": 1.0,
        "stream": False,
    }
    headers = {
        "Authorization": f"Bearer {settings.unbound_api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=120.0) as client:
        resp = client.post(
            settings.unbound_api_url,
            json=payload,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()

    choices = data.get("choices") or []
    if not choices:
        raise ValueError("Unbound API returned no choices")

    content = (choices[0].get("message") or {}).get("content") or ""
    usage = data.get("usage") or {}
    tokens_used = usage.get("total_tokens")

    return LLMResult(content=content.strip(), tokens_used=tokens_used)
