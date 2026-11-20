"""Generate favicons, OG, Android/iOS launcher + splash logos from dama marks."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC_LIGHT = ROOT / "apps/web/public/brand/dama-mark.png"
SRC_WHITE = ROOT / "apps/web/public/brand/dama-mark-white.png"
BURGUNDY = (0xA3, 0x1D, 0x38, 255)
DARK_BG = (0x0A, 0x0A, 0x0B, 255)
LIGHT_BG = (0xFA, 0xFA, 0xFA, 255)


def load_rgba(path: Path) -> Image.Image:
    return Image.open(path).convert("RGBA")


def fit_mark(mark: Image.Image, canvas_size: int, mark_ratio: float = 0.42) -> Image.Image:
    target = max(1, int(canvas_size * mark_ratio))
    m = mark.copy()
    m.thumbnail((target, target), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    x = (canvas_size - m.width) // 2
    y = (canvas_size - m.height) // 2
    canvas.paste(m, (x, y), m)
    return canvas


def solid_icon(mark: Image.Image, size: int, bg: tuple[int, int, int, int]) -> Image.Image:
    base = Image.new("RGBA", (size, size), bg)
    layered = fit_mark(mark, size, 0.55)
    base.alpha_composite(layered)
    return base.convert("RGBA")


def main() -> None:
    mark_l = load_rgba(SRC_LIGHT)
    mark_w = load_rgba(SRC_WHITE)

    for app in ("web", "admin"):
        pub = ROOT / f"apps/{app}/public"
        pub.mkdir(parents=True, exist_ok=True)
        fit_mark(mark_l, 32).save(pub / "favicon-32x32.png", optimize=True)
        fit_mark(mark_l, 16).save(pub / "favicon-16x16.png", optimize=True)
        fit_mark(mark_l, 48).save(pub / "favicon-48x48.png", optimize=True)
        solid_icon(mark_l, 180, LIGHT_BG).save(pub / "apple-touch-icon.png", optimize=True)
        solid_icon(mark_w, 512, DARK_BG).save(pub / "icon-512-dark.png", optimize=True)
        solid_icon(mark_l, 512, LIGHT_BG).save(pub / "icon-512-light.png", optimize=True)
        solid_icon(mark_l, 192, LIGHT_BG).save(pub / "icon-192.png", optimize=True)
        solid_icon(mark_w, 192, DARK_BG).save(pub / "icon-192-dark.png", optimize=True)
        solid_icon(mark_l, 1200, LIGHT_BG).save(pub / "og-image.png", optimize=True)
        # ICO for legacy browsers
        ico_sizes = [(16, 16), (32, 32), (48, 48)]
        ico_images = [fit_mark(mark_l, s[0]) for s in ico_sizes]
        ico_images[0].save(
            pub / "favicon.ico",
            format="ICO",
            sizes=ico_sizes,
            append_images=ico_images[1:],
        )
        print(f"generated {app} public icons")

        app_dir = ROOT / f"apps/{app}/src/app"
        app_dir.mkdir(parents=True, exist_ok=True)
        fit_mark(mark_l, 32).save(app_dir / "icon.png", optimize=True)
        solid_icon(mark_l, 180, LIGHT_BG).save(app_dir / "apple-icon.png", optimize=True)

    android_res = ROOT / "apps/mobile/android/app/src/main/res"
    densities = {
        "mdpi": 48,
        "hdpi": 72,
        "xhdpi": 96,
        "xxhdpi": 144,
        "xxxhdpi": 192,
    }
    for dens, size in densities.items():
        mipmap = android_res / f"mipmap-{dens}"
        mipmap.mkdir(parents=True, exist_ok=True)
        solid_icon(mark_w, size, BURGUNDY).save(mipmap / "ic_launcher.png", optimize=True)
        fit_mark(mark_w, size, 0.66).save(mipmap / "ic_launcher_foreground.png", optimize=True)

    for folder, mark in (("drawable", mark_w), ("drawable-night", mark_w)):
        d = android_res / folder
        d.mkdir(parents=True, exist_ok=True)
        fit_mark(mark, 288, 0.72).save(d / "splash_logo.png", optimize=True)

    # Color XML for splash backgrounds
    values = android_res / "values"
    values.mkdir(parents=True, exist_ok=True)
    (values / "colors.xml").write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="dama_splash_bg">#A31D38</color>
    <color name="dama_splash_bg_light">#FAFAFA</color>
    <color name="dama_brand">#A31D38</color>
    <color name="ic_launcher_background">#A31D38</color>
</resources>
""",
        encoding="utf-8",
    )
    values_night = android_res / "values-night"
    values_night.mkdir(parents=True, exist_ok=True)
    (values_night / "colors.xml").write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="dama_splash_bg">#0A0A0B</color>
</resources>
""",
        encoding="utf-8",
    )

    ios_launch = ROOT / "apps/mobile/ios/Runner/Assets.xcassets/LaunchImage.imageset"
    if ios_launch.exists():
        for name, size in (
            ("LaunchImage.png", 168),
            ("LaunchImage@2x.png", 336),
            ("LaunchImage@3x.png", 504),
        ):
            # Match Android splash: white mark on burgundy plate.
            solid_icon(mark_w, size, BURGUNDY).save(ios_launch / name, optimize=True)

    ios_icon = ROOT / "apps/mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset"
    if ios_icon.exists():
        for p in ios_icon.glob("*.png"):
            try:
                with Image.open(p) as im:
                    w, h = im.size
                if w == h and w >= 20:
                    solid_icon(mark_w, w, BURGUNDY).save(p, optimize=True)
            except Exception as exc:  # noqa: BLE001
                print("skip", p, exc)

    print("done")


if __name__ == "__main__":
    main()
