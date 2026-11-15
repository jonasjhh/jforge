"""Writes placeholder app icons (a letter on a coloured square) into a
module's public/ folder.

Usage: python3 tooling/make-icons.py <public-dir> <letter> <background> <ink>
Example: python3 tooling/make-icons.py modules/melee/public M "#7a1f1f" "#fff3e8"
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def icon(size: int, letter: str, bg: str, ink: str, scale: float) -> Image.Image:
    image = Image.new("RGB", (size, size), bg)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT, int(size * scale))
    draw.text((size / 2, size / 2), letter, font=font, fill=ink, anchor="mm")
    return image


def main() -> None:
    out, letter, bg, ink = Path(sys.argv[1]), sys.argv[2], sys.argv[3], sys.argv[4]
    out.mkdir(parents=True, exist_ok=True)
    icon(192, letter, bg, ink, 0.6).save(out / "pwa-192x192.png")
    icon(512, letter, bg, ink, 0.6).save(out / "pwa-512x512.png")
    # Maskable icons get cropped to a circle, so keep the letter well inside.
    icon(512, letter, bg, ink, 0.4).save(out / "pwa-512x512-maskable.png")
    icon(180, letter, bg, ink, 0.6).save(out / "apple-touch-icon.png")
    icon(64, letter, bg, ink, 0.7).save(out / "favicon.png")


if __name__ == "__main__":
    main()
