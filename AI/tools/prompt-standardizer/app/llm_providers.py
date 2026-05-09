"""OpenAI-compatible chat completions for DeepSeek, Qwen (DashScope), and Yuanbao-style bases."""

from __future__ import annotations

import json
from typing import Any, Iterator, Literal

import httpx

from app.config import settings

ProviderName = Literal["deepseek", "qwen", "yuanbao"]


def _resolve_endpoint(provider: ProviderName) -> tuple[str, str, str]:
    if provider == "deepseek":
        key = settings.deepseek_api_key or ""
        base = settings.deepseek_base_url.rstrip("/")
        model = settings.deepseek_model
        return key, f"{base}/chat/completions", model
    if provider == "qwen":
        key = settings.qwen_api_key or ""
        base = settings.qwen_base_url.rstrip("/")
        model = settings.qwen_model
        return key, f"{base}/chat/completions", model
    key = settings.yuanbao_api_key or ""
    base = (settings.yuanbao_base_url or "").strip().rstrip("/")
    model = settings.yuanbao_model
    if not base or not key:
        return "", "", model
    return key, f"{base}/chat/completions", model


def provider_configured(provider: ProviderName) -> bool:
    key, url, _ = _resolve_endpoint(provider)
    return bool(key and url)


def default_model_for(provider: ProviderName) -> str:
    _, _, model = _resolve_endpoint(provider)
    return model


def endpoint_url_for(provider: ProviderName) -> str:
    _, url, _ = _resolve_endpoint(provider)
    return url


def request_preview(
    provider: ProviderName,
    messages: list[dict[str, str]],
    *,
    model_override: str | None,
    stream: bool,
) -> dict[str, Any]:
    """
    Debug-only view of what will be sent to the provider.
    Never includes API keys or headers.
    """
    _, _, default_model = _resolve_endpoint(provider)
    model = model_override or default_model
    return {
        "provider": provider,
        "endpoint": endpoint_url_for(provider),
        "body": {"model": model, "messages": messages, "stream": stream},
    }


def chat_completion(
    provider: ProviderName,
    messages: list[dict[str, str]],
    *,
    model_override: str | None = None,
    timeout_s: float = 120.0,
) -> dict[str, Any]:
    api_key, url, default_model = _resolve_endpoint(provider)
    model = model_override or default_model
    if not api_key or not url:
        raise ValueError(f"Provider {provider} is not configured (missing API key or base URL).")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages}
    with httpx.Client(timeout=timeout_s) as client:
        r = client.post(url, headers=headers, json=body)
        r.raise_for_status()
        data = r.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected LLM response shape: {data!r}") from e
    return {"content": content, "raw": data, "model": model}


def iter_chat_completion_stream(
    provider: ProviderName,
    messages: list[dict[str, str]],
    *,
    model_override: str | None = None,
    timeout_s: float = 120.0,
) -> Iterator[tuple[str, str | None]]:
    """Yield (delta_text, model_id_or_none). Model is emitted once when first chunk includes it."""
    api_key, url, default_model = _resolve_endpoint(provider)
    model = model_override or default_model
    if not api_key or not url:
        raise ValueError(f"Provider {provider} is not configured (missing API key or base URL).")
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    body = {"model": model, "messages": messages, "stream": True}
    seen_model: str | None = None
    with httpx.Client(timeout=timeout_s) as client:
        with client.stream("POST", url, headers=headers, json=body) as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if not line:
                    continue
                if not line.startswith("data:"):
                    continue
                payload = line[5:].lstrip()
                if payload == "[DONE]":
                    break
                try:
                    obj = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                choices = obj.get("choices") or []
                if not choices:
                    continue
                delta = (choices[0] or {}).get("delta") or {}
                if not isinstance(delta, dict):
                    continue
                m = delta.get("model")
                if isinstance(m, str) and m and seen_model is None:
                    seen_model = m
                piece = delta.get("content")
                if isinstance(piece, str) and piece:
                    yield piece, seen_model or model


def list_available_providers() -> list[dict[str, Any]]:
    out = []
    for p in ("deepseek", "qwen", "yuanbao"):
        key, url, model = _resolve_endpoint(p)  # type: ignore[arg-type]
        out.append(
            {
                "id": p,
                "configured": bool(key and url),
                "default_model": model,
                "endpoint_hint": url.split("/v1")[0] + "/v1" if "/v1" in url else url[:60],
            }
        )
    return out
