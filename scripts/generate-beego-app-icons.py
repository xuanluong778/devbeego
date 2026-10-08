#!/usr/bin/env python3
"""Beego app icons — honey gradient tile + bee (matches .beego-brand-mark on web)."""
from __future__ import annotations

import os
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMOJI_FONT = "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf"
BEE = "\U0001f41d"

# .beego-brand-mark: linear-gradient(135deg, #ffb020, #ff8c00)
HONEY_A = (0xFF, 0xB0, 0x20)
HONEY_B = (0xFF, 0x8C, 0x00)
SHADOW = (0xE6, 0x95, 0x00)


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def rounded_mask(size: int, radius: int):
    mask = [[0] * size for _ in range(size)]
    r = radius
    for y in range(size):
        for x in range(size):
            inside = True
            if x < r and y < r:
                inside = (x - r) ** 2 + (y - r) ** 2 <= r * r
            elif x >= size - r and y < r:
                inside = (x - (size - r - 1)) ** 2 + (y - r) ** 2 <= r * r
            elif x < r and y >= size - r:
                inside = (x - r) ** 2 + (y - (size - r - 1)) ** 2 <= r * r
            elif x >= size - r and y >= size - r:
                inside = (x - (size - r - 1)) ** 2 + (y - (size - r - 1)) ** 2 <= r * r
            mask[y][x] = 255 if inside else 0
    return mask


def render_icon(size: int, *, pad_ratio: float = 0.06, radius_ratio: float = 0.22):
    from PIL import Image, ImageDraw, ImageFont

    pad = max(2, int(size * pad_ratio))
    inner = size - pad * 2
    radius = max(4, int(inner * radius_ratio))

    base = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    tile = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
    px = tile.load()
    for y in range(inner):
        for x in range(inner):
            t = (x / max(1, inner - 1) + y / max(1, inner - 1)) / 2
            r = lerp(HONEY_A[0], HONEY_B[0], t)
            g = lerp(HONEY_A[1], HONEY_B[1], t)
            b = lerp(HONEY_A[2], HONEY_B[2], t)
            px[x, y] = (r, g, b, 255)

    # bottom shadow strip (brand box-shadow)
    shadow_h = max(2, inner // 14)
    for y in range(inner - shadow_h, inner):
        for x in range(inner):
            px[x, y] = (*SHADOW, 255)

    mask = Image.new("L", (inner, inner), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner - 1, inner - 1), radius=radius, fill=255)
    tile.putalpha(mask)

    base.alpha_composite(tile, (pad, pad))

    # Noto Color Emoji exposes a fixed bitmap size (109px) on this host.
    font = ImageFont.truetype(EMOJI_FONT, 109)
    emoji_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ed = ImageDraw.Draw(emoji_layer)
    ed.text((size // 2, size // 2 - max(1, inner // 40)), BEE, font=font, anchor="mm", embedded_color=True)
    target = max(12, int(inner * 0.55))
    bbox = emoji_layer.getbbox()
    if bbox:
        crop = emoji_layer.crop(bbox)
        cw, ch = crop.size
        scale = target / max(cw, ch)
        nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
        crop = crop.resize((nw, nh), Image.Resampling.LANCZOS)
        emoji_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        emoji_layer.paste(crop, ((size - nw) // 2, (size - nh) // 2 - max(1, inner // 40)), crop)
    base.alpha_composite(emoji_layer)
    return base


def save_png(img, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "PNG", optimize=True)
    print("wrote", path, img.size)


def main() -> None:
    from PIL import Image

    web_sizes = {
        ROOT / "public/icons/beego-180.png": 180,
        ROOT / "public/icons/beego-192.png": 192,
        ROOT / "public/icons/beego-512.png": 512,
        ROOT / "app/icon.png": 512,
        ROOT / "app/apple-icon.png": 180,
    }
    for path, size in web_sizes.items():
        save_png(render_icon(size), path)

    # Android legacy launcher + adaptive foreground (transparent bg, bee on honey tile centered)
    mipmap = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    fg_map = {
        "mipmap-mdpi": 108,
        "mipmap-hdpi": 162,
        "mipmap-xhdpi": 216,
        "mipmap-xxhdpi": 324,
        "mipmap-xxxhdpi": 432,
    }
    res = ROOT / "android/app/src/main/res"
    for folder, size in mipmap.items():
        icon = render_icon(size, pad_ratio=0.04)
        save_png(icon, res / folder / "ic_launcher.png")
        save_png(icon, res / folder / "ic_launcher_round.png")

    for folder, size in fg_map.items():
        fg = render_icon(size, pad_ratio=0.12)
        save_png(fg, res / folder / "ic_launcher_foreground.png")

    # favicon multi-size in app/favicon.ico
    fav = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    fav.paste(render_icon(32, pad_ratio=0.05), (0, 0))
    fav_path = ROOT / "app/favicon.ico"
    fav.save(fav_path, format="ICO", sizes=[(32, 32)])
    print("wrote", fav_path)


if __name__ == "__main__":
    main()
