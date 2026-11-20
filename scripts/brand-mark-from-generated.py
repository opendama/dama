#!/usr/bin/env python3
"""Build transparent burgundy + white dama mark PNGs from a generated source."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

BURGUNDY = (0xA3, 0x1D, 0x38, 255)
SRC = Path(
    r"C:\Users\berek\.cursor\projects\c-Users-berek-Downloads-C-Projects-addismender-project-dama\assets\dama-mark-burgundy.jpg"
)
OUTS = [
    Path(r"C:\Users\berek\Downloads\C-Projects\addismender-project\dama\apps\api\assets\brand"),
    Path(r"C:\Users\berek\Downloads\C-Projects\addismender-project\dama\apps\web\public\brand"),
]


def to_transparent_mark(src: Image.Image) -> Image.Image:
    rgba = src.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            # Drop light / near-white / checkerboard pads.
            if r >= 200 and g >= 200 and b >= 200:
                px[x, y] = (0, 0, 0, 0)
                continue
            # Keep dark burgundy-ish ink; normalize to brand burgundy.
            if r > 40 and b < r and g < r:
                px[x, y] = BURGUNDY
            elif r < 40 and g < 40 and b < 40:
                # Soft anti-alias dark edges → burgundy with alpha.
                px[x, y] = (BURGUNDY[0], BURGUNDY[1], BURGUNDY[2], max(a, 180))
            else:
                # Mid tones: keep if reddish, else clear.
                if r > g + 20 and r > b + 20:
                    alpha = min(255, max(80, a))
                    px[x, y] = (BURGUNDY[0], BURGUNDY[1], BURGUNDY[2], alpha)
                else:
                    px[x, y] = (0, 0, 0, 0)
    return rgba


def recolor_white(src: Image.Image) -> Image.Image:
    out = src.copy()
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            px[x, y] = (255, 255, 255, a)
    return out


def main() -> int:
    if not SRC.is_file():
        print(f"missing source: {SRC}", file=sys.stderr)
        return 1
    img = Image.open(SRC)
    burgundy = to_transparent_mark(img)
    white = recolor_white(burgundy)
    for out_dir in OUTS:
        out_dir.mkdir(parents=True, exist_ok=True)
        b_path = out_dir / "dama-mark.png"
        w_path = out_dir / "dama-mark-white.png"
        burgundy.save(b_path, "PNG")
        white.save(w_path, "PNG")
        # Keep burgundy as the default mark; also store named burgundy alias.
        burgundy.save(out_dir / "dama-mark-burgundy.png", "PNG")
        print(f"wrote {b_path}")
        print(f"wrote {w_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
