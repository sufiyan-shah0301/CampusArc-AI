"""Provider-agnostic LLM client. Any OpenAI-compatible API works (Groq, xAI Grok, OpenAI, ...):
switch provider by changing LLM_BASE_URL / LLM_API_KEY / LLM_MODEL in .env."""
import json
import re
import time
from collections import defaultdict, deque

from fastapi import HTTPException
from openai import AsyncOpenAI, OpenAIError

from ..config import get_settings

_client: AsyncOpenAI | None = None
_calls: dict[str, deque] = defaultdict(deque)


def _get_client() -> AsyncOpenAI:
    global _client
    s = get_settings()
    if not s.llm_api_key:
        raise HTTPException(503, "AI features are not configured on this server (LLM_API_KEY missing).")
    if _client is None:
        _client = AsyncOpenAI(api_key=s.llm_api_key, base_url=s.llm_base_url, timeout=60, max_retries=1)
    return _client


def check_rate_limit(user_id: str) -> None:
    """Per-user sliding window so one account cannot burn the whole API budget."""
    limit, window = get_settings().ai_calls_per_10min, 600
    q, t = _calls[user_id], time.monotonic()
    while q and t - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "You have reached the AI usage limit. Please try again in a few minutes.")
    q.append(t)


REASONING_HEADROOM = 1500   # reasoning models spend completion tokens on hidden thinking before the visible answer


async def complete(messages: list[dict], *, json_mode: bool = False, temperature: float = 0.4, max_tokens: int = 1800) -> str:
    model = get_settings().llm_model
    reasoning = "gpt-oss" in model.lower()
    kwargs = {"model": model, "messages": messages, "temperature": temperature,
              "max_tokens": max_tokens + (REASONING_HEADROOM if reasoning else 0)}
    if reasoning:
        kwargs["extra_body"] = {"reasoning_effort": "low"}
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        res = await _get_client().chat.completions.create(**kwargs)
        text = res.choices[0].message.content or ""
        if not text.strip() and reasoning:          # thinking used the whole budget: retry once with more room
            kwargs["max_tokens"] *= 2
            res = await _get_client().chat.completions.create(**kwargs)
            text = res.choices[0].message.content or ""
    except OpenAIError as e:
        print(f"[LLM] provider error: {type(e).__name__}: {e}")
        raise HTTPException(503, "The AI service is temporarily unavailable. Please try again shortly.")
    return text


async def transcribe(filename: str, data: bytes, content_type: str) -> dict:
    """Speech-to-text through the same OpenAI-compatible provider (Groq serves Whisper). Returns text + timed segments."""
    try:
        resp = await _get_client().audio.transcriptions.create(
            model=get_settings().stt_model, file=(filename, data, content_type), response_format="verbose_json", language="en")
    except OpenAIError as e:
        print(f"[LLM] transcription error: {type(e).__name__}: {e}")
        raise HTTPException(503, "Speech recognition is temporarily unavailable. You can type your answer instead.")
    raw = resp.model_dump() if hasattr(resp, "model_dump") else dict(resp)
    segs = [s if isinstance(s, dict) else s.model_dump() for s in (raw.get("segments") or [])]
    return {"text": (raw.get("text") or "").strip(),
            "segments": [{"start": float(s.get("start", 0)), "end": float(s.get("end", 0)), "avg_logprob": s.get("avg_logprob")} for s in segs]}


def _extract_json(text: str) -> dict:
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            return json.loads(text[start:end + 1])
        raise


async def complete_json(system: str, user: str, *, temperature: float = 0.2, max_tokens: int = 2200) -> dict:
    msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
    for attempt in range(2):
        raw = await complete(msgs, json_mode=True, temperature=temperature, max_tokens=max_tokens)
        try:
            return _extract_json(raw)
        except (json.JSONDecodeError, ValueError):
            print(f"[LLM] invalid JSON (attempt {attempt + 1})")
    raise HTTPException(502, "The AI returned an unreadable answer. Please try again.")
