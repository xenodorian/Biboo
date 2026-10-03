#!/usr/bin/env python3
"""Normalize story/background images for the native 640x480 web renderer.

Large source images are center-cropped to 4:3 and then resized to exactly
640x480. Smaller sources are enlarged to cover the 4:3 frame and cropped.
The game never scales these scene images at runtime.
"""
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image
from io import BytesIO

ROOT = Path(__file__).resolve().parents[1]
VIEW = ROOT / "web" / "assets" / "story" / "view"
W, H = 640, 480
VILLAGE_URL = "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3053990/page_bg_raw.jpg?t=1787774509"


def cover_crop(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    scale = max(W / im.width, H / im.height)
    nw = max(W, round(im.width * scale))
    nh = max(H, round(im.height * scale))
    # These are pixel-art scene assets. Nearest keeps the source pixels crisp.
    if (nw, nh) != im.size:
        im = im.resize((nw, nh), Image.Resampling.NEAREST)
    left = max(0, (im.width - W) // 2)
    top = max(0, (im.height - H) // 2)
    return im.crop((left, top, left + W, top + H))


def fetch_village() -> Image.Image:
    req = Request(VILLAGE_URL, headers={"User-Agent": "Biboo-build/1.0"})
    with urlopen(req, timeout=30) as r:
        return Image.open(BytesIO(r.read())).convert("RGBA")


def main() -> None:
    VIEW.mkdir(parents=True, exist_ok=True)

    # The new high-resolution meadow source supplied for the prologue.
    cover_crop(fetch_village()).save(VIEW / "village_meadow.png")

    # Normalize every full-scene story still so drawStoryBg() can blit it 1:1.
    # The boat is a sprite, not a scene background, and stays at its native size.
    for p in sorted(VIEW.glob("*.png")):
        if p.name in {"boat.png", "village_meadow.png"}:
            continue
        cover_crop(Image.open(p)).save(p)


if __name__ == "__main__":
    main()
