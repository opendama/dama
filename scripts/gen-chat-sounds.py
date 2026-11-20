#!/usr/bin/env python3
"""Generate soft invite loop + ClickUp-like message delivery chime (original Dama assets)."""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web" / "public" / "sounds"
MOBILE = ROOT / "apps" / "mobile" / "assets" / "sounds"


def write_wav(path: Path, samples: list[float], rate: int = 44100) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 32767)))) for s in samples
        )
        w.writeframes(frames)


def env_adsr(i: int, n: int, a: float, d: float, s: float, r: float) -> float:
    t = i / max(n - 1, 1)
    if t < a:
        return t / a if a > 0 else 1.0
    if t < a + d:
        return 1.0 - (1.0 - s) * ((t - a) / d)
    if t < 1.0 - r:
        return s
    if r <= 0:
        return s
    return s * max(0.0, (1.0 - t) / r)


def soft_message_chime(rate: int = 44100) -> list[float]:
    """Short two-tone pluck - soft workspace ping (ClickUp-like character, original)."""
    dur = 0.28
    n = int(rate * dur)
    out = [0.0] * n
    # Warm fifth: G5 -> D6, gentle triangle-ish mix.
    notes = [(784.0, 0.0, 0.16, 0.42), (1175.0, 0.055, 0.18, 0.28)]
    for freq, start, length, peak in notes:
        sn = int(rate * length)
        s0 = int(rate * start)
        for i in range(sn):
            j = s0 + i
            if j >= n:
                break
            e = env_adsr(i, sn, 0.04, 0.18, 0.35, 0.45)
            t = i / rate
            # Soft sine + quiet second harmonic (no harsh square).
            sig = math.sin(2 * math.pi * freq * t) + 0.18 * math.sin(
                2 * math.pi * freq * 2 * t
            )
            out[j] += peak * e * sig
    # Tiny high sparkle
    for i in range(int(rate * 0.08)):
        t = i / rate
        e = env_adsr(i, int(rate * 0.08), 0.02, 0.2, 0.2, 0.5)
        out[i] += 0.08 * e * math.sin(2 * math.pi * 1568 * t)
    peak = max(abs(x) for x in out) or 1.0
    return [0.72 * x / peak for x in out]


def soft_invite_loop(rate: int = 44100) -> list[float]:
    """Warm looping pulse - lovable, not urgent alarm."""
    dur = 2.4
    n = int(rate * dur)
    out = [0.0] * n
    # Soft chord swell every ~1.2s
    pulses = [0.0, 1.2]
    chord = [261.63, 329.63, 392.0]  # C major soft
    for start in pulses:
        for freq in chord:
            sn = int(rate * 0.95)
            s0 = int(rate * start)
            for i in range(sn):
                j = s0 + i
                if j >= n:
                    break
                e = env_adsr(i, sn, 0.12, 0.25, 0.45, 0.35)
                t = i / rate
                # Detuned sine pair for warmth
                sig = 0.55 * math.sin(2 * math.pi * freq * t) + 0.35 * math.sin(
                    2 * math.pi * (freq * 1.003) * t
                )
                out[j] += 0.22 * e * sig
        # Soft wood-block tap (friendly, not harsh)
        tap_n = int(rate * 0.05)
        tap0 = int(rate * (start + 0.02))
        for i in range(tap_n):
            j = tap0 + i
            if j >= n:
                break
            e = env_adsr(i, tap_n, 0.01, 0.2, 0.15, 0.6)
            t = i / rate
            out[j] += 0.18 * e * math.sin(2 * math.pi * 660 * t) * math.exp(-18 * t)
    peak = max(abs(x) for x in out) or 1.0
    return [0.55 * x / peak for x in out]


def main() -> None:
    msg = soft_message_chime()
    invite = soft_invite_loop()
    for dest in (WEB, MOBILE):
        write_wav(dest / "message.wav", msg)
        write_wav(dest / "invite-ring.wav", invite)
    print("wrote message.wav + invite-ring.wav to web + mobile")


if __name__ == "__main__":
    main()
