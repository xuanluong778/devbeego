"""Copy gate 1 PNGs and make lossless 320px alpha WebPs for 62–68px artwork.

Run from anywhere: python3 scripts/optimize-gate-01-icons.py
Requires Pillow; the original PNGs and manifest are copied byte for byte.
"""
import json
import shutil
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / "docs/beego-icon-cua-1"
destination = root / "public/uploads/lesson-icons/gate-01"
destination.mkdir(parents=True, exist_ok=True)
manifest = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
shutil.copy2(source / "manifest.json", destination / "manifest.json")
png_bytes = webp_bytes = 0
for entry in manifest:
    filename = entry["file"]
    if Path(filename).name != filename or Path(filename).suffix != ".png":
        raise ValueError(f"Invalid icon filename: {filename}")
    original = source / filename
    output = destination / Path(filename).with_suffix(".webp")
    shutil.copy2(original, destination / filename)
    with Image.open(original) as image:
        image.convert("RGBA").resize((320, 320), Image.Resampling.LANCZOS).save(
            output, "WEBP", lossless=True, quality=100, method=6, exact=True
        )
    png_bytes += original.stat().st_size
    webp_bytes += output.stat().st_size
print(f"{len(manifest)} icons: PNG {png_bytes} bytes → WebP {webp_bytes} bytes")
