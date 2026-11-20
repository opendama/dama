#!/usr/bin/env python3
"""Build theme-aware default avatar plates from existing transparent dama marks."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "apps" / "web" / "public" / "brand"
MOBILE = ROOT / "apps" / "mobile" / "assets" / "brand"
ADMIN = ROOT / "apps" / "admin" / "public" / "brand"

# Official brand burgundy from dama-mark (#A31D38)
BURGUNDY = (163, 29, 56, 255)
LIGHT_PLATE = (244, 244, 245, 255)  # near zinc-100 / --dama-surface light
DARK_PLATE = (39, 39, 42, 255)  # near zinc-800 / --dama-surface dark


def load_mark(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def compose_avatar(mark: Image.Image, plate: tuple[int, int, int, int], size: int = 512) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), plate)
    # Keep mark ~62% of plate with breathing room (Telegram-style brand placeholder).
    target = int(size * 0.62)
    m = mark.copy()
    m.thumbnail((target, target), Image.Resampling.LANCZOS)
    x = (size - m.width) // 2
    y = (size - m.height) // 2
    canvas.alpha_composite(m, (x, y))
    return canvas


def write_svg_white_hq(path: Path) -> None:
    """Match burgundy SVG geometry at 512 with white fill for dark surfaces."""
    path.write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="dama">
  <!-- Transparent white mark (no disc) - HQ vector for dark surfaces / default avatar. -->
  <g fill="#FFFFFF">
    <path d="M136 192 L176 280 L256 160 L336 280 L376 192 L360 312 L152 312 Z"/>
    <circle cx="256" cy="232" r="88"/>
    <ellipse cx="256" cy="336" rx="88" ry="40"/>
    <ellipse cx="256" cy="368" rx="112" ry="48"/>
  </g>
</svg>
""",
        encoding="utf-8",
    )


def main() -> None:
    burgundy_png = WEB / "dama-mark.png"
    white_png = WEB / "dama-mark-white.png"
    if not burgundy_png.exists() or not white_png.exists():
        raise SystemExit("missing source marks")

    burgundy = load_mark(burgundy_png)
    white = load_mark(white_png)

    light_av = compose_avatar(burgundy, LIGHT_PLATE)
    dark_av = compose_avatar(white, DARK_PLATE)

    for dest in (WEB, MOBILE, ADMIN):
        dest.mkdir(parents=True, exist_ok=True)
        light_av.save(dest / "dama-avatar-default-light.png", "PNG", optimize=True)
        dark_av.save(dest / "dama-avatar-default-dark.png", "PNG", optimize=True)
        # Keep transparent marks in all apps.
        burgundy.save(dest / "dama-mark.png", "PNG", optimize=True)
        burgundy.save(dest / "dama-mark-burgundy.png", "PNG", optimize=True)
        white.save(dest / "dama-mark-white.png", "PNG", optimize=True)

    write_svg_white_hq(WEB / "dama-mark-white.svg")
    write_svg_white_hq(MOBILE / "dama-mark-white.svg")
    write_svg_white_hq(ADMIN / "dama-mark-white.svg")
    # Burgundy SVG already HQ on web; mirror to mobile + admin.
    svg_b = (WEB / "dama-mark.svg").read_text(encoding="utf-8")
    for dest in (WEB, MOBILE, ADMIN):
        (dest / "dama-mark.svg").write_text(svg_b, encoding="utf-8")
        (dest / "dama-mark-burgundy.svg").write_text(svg_b, encoding="utf-8")

    print("wrote default avatar plates + synced brand marks to web + mobile + admin")


if __name__ == "__main__":
    main()
