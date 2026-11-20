#!/usr/bin/env python3
"""Regenerate HQ transparent burgundy + white dama marks (1024px) from source JPG + SVG path polish."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageFilter

BURGUNDY = (0xA3, 0x1D, 0x38, 255)
SRC = Path(
    r"C:\Users\berek\.cursor\projects\c-Users-berek-Downloads-C-Projects-addismender-project-dama\assets\dama-mark-burgundy.jpg"
)
OUT_DIRS = [
    Path(r"C:\Users\berek\Downloads\C-Projects\addismender-project\dama\apps\api\assets\brand"),
    Path(r"C:\Users\berek\Downloads\C-Projects\addismender-project\dama\apps\web\public\brand"),
    Path(r"C:\Users\berek\Downloads\C-Projects\addismender-project\dama\apps\admin\public\brand"),
]
TARGET = 1024


def to_transparent_mark(src: Image.Image) -> Image.Image:
    rgba = src.convert("RGBA")
    # Upscale first for crisp edges when source is small / soft.
    if max(rgba.size) < TARGET:
        rgba = rgba.resize((TARGET, TARGET), Image.Resampling.LANCZOS)
    else:
        rgba = rgba.resize((TARGET, TARGET), Image.Resampling.LANCZOS)
    # Light denoise before keying.
    rgba = rgba.filter(ImageFilter.SMOOTH_MORE)
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= 200 and g >= 200 and b >= 200:
                px[x, y] = (0, 0, 0, 0)
                continue
            if r > 40 and b < r and g < r:
                px[x, y] = BURGUNDY
            elif r < 40 and g < 40 and b < 40:
                px[x, y] = (BURGUNDY[0], BURGUNDY[1], BURGUNDY[2], max(a, 200))
            elif r > g + 20 and r > b + 20:
                alpha = min(255, max(100, a))
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
    for out_dir in OUT_DIRS:
        out_dir.mkdir(parents=True, exist_ok=True)
        for name, im in (
            ("dama-mark.png", burgundy),
            ("dama-mark-burgundy.png", burgundy),
            ("dama-mark-white.png", white),
        ):
            path = out_dir / name
            im.save(path, "PNG", optimize=True)
            print(f"wrote {path} ({path.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
