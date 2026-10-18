"""Delivery analysis of a transcribed spoken answer: pace, filler words, pauses and clarity.
Pure functions over Whisper's segment timestamps, so they are fast and unit-testable."""
import re

FILLERS = re.compile(r"\b(um+|uh+|uhm+|erm+|er|ah+|hmm+|you know|i mean|sort of|kind of|basically|actually|literally)\b", re.I)
WORD = re.compile(r"[A-Za-z0-9']+")


def analyse(text: str, segments: list[dict], duration_s: float) -> dict:
    words = len(WORD.findall(text))
    spoken = max(sum(max(0.0, s["end"] - s["start"]) for s in segments), 0.1) if segments else max(duration_s, 0.1)
    wpm = round(words / (spoken / 60))
    fillers = [m.group(0).lower() for m in FILLERS.finditer(text)]
    gaps = [b["start"] - a["end"] for a, b in zip(segments, segments[1:])]
    long_pauses = [g for g in gaps if g >= 1.5]
    logprobs = [s["avg_logprob"] for s in segments if s.get("avg_logprob") is not None]
    clarity = round(max(0, min(100, 100 * (1 + (sum(logprobs) / len(logprobs)) / 1.5)))) if logprobs else None

    tips = []
    if wpm > 170:
        tips.append("You speak quickly. Slow down a little so each point lands.")
    elif wpm < 100 and words > 20:
        tips.append("Your pace is slow. Aim for 110-160 words per minute.")
    rate = len(fillers) / max(words, 1) * 100
    if rate > 4:
        tips.append(f"Many filler words ({len(fillers)}). Pause silently instead of saying 'um'.")
    if long_pauses:
        tips.append(f"{len(long_pauses)} long pause(s), the longest {max(long_pauses):.1f}s. Structure your answer (point, example, result) to avoid them.")
    if not tips:
        tips.append("Good delivery: clear pace and few fillers.")
    return {"words": words, "durationSeconds": round(duration_s, 1), "wordsPerMinute": wpm,
            "pace": "fast" if wpm > 170 else "slow" if wpm < 100 and words > 20 else "good",
            "fillerCount": len(fillers), "fillerRate": round(rate, 1), "fillers": sorted(set(fillers)),
            "longPauses": len(long_pauses), "longestPause": round(max(gaps), 1) if gaps and max(gaps) > 0 else 0, "clarity": clarity, "tips": tips}
