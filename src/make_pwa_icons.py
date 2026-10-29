#!/usr/bin/env python3
"""Generate Bridge DDS install icons from the approved artwork."""
from pathlib import Path
from PIL import Image
from io import BytesIO
import base64
import hashlib
import sys

source_dir = Path(__file__).resolve().parent
parts = [source_dir / f"icon_artwork_{i}.b64" for i in range(1, 5)]
encoded = "".join(part.read_text(encoding="ascii").strip() for part in parts)
artwork_bytes = base64.b64decode(encoded, validate=True)
expected = "8d15bc9357b4167935ca5090d748cf6a659c5402b1b3cb16ef13111788ee3cb6"
assert hashlib.sha256(artwork_bytes).hexdigest() == expected, "Icon source mismatch"
image = Image.open(BytesIO(artwork_bytes)).convert("RGB")
assert image.size == (288, 288)

destination = Path(sys.argv[1])
destination.mkdir(parents=True, exist_ok=True)
for size, name in ((180, "apple-touch-icon.png"),
                   (192, "icon-192.png"),
                   (512, "icon-512.png")):
    result = image.resize((size, size), Image.Resampling.LANCZOS)
    result.save(destination / name, format="PNG", optimize=True)
    print("Created", name)
