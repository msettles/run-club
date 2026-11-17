"""Generate install icons with Pillow: python3 scripts/generate-install-icons.py.

Size the mark to 82.16% of the canvas diameter, with a 1.8% optical shift left.
The complete mark fits within an 86% circle; teal backgrounds stay opaque.
This favors a larger, visually balanced mark on circular phone launchers.
"""
from pathlib import Path
from math import hypot
from PIL import Image

PUBLIC = Path(__file__).resolve().parents[1] / 'public'
source = Image.open(PUBLIC / 'woodland_woodchucker_app_icon.png').convert('RGBA')
source = source.crop(source.getbbox())
cx, cy = source.width / 2, source.height / 2
radius = max(
    hypot(x + .5 - cx, y + .5 - cy)
    for y in range(source.height)
    for x in range(source.width)
    if source.getpixel((x, y))[3]
) + 1  # Include the outer pixel edge.

for name, size in [('pwa-192x192.png', 192), ('pwa-512x512.png', 512),
                   ('pwa-maskable-512x512.png', 512), ('apple-touch-icon.png', 180)]:
    scale = size * .4108 / radius
    mark = source.resize((round(source.width * scale), round(source.height * scale)), Image.Resampling.LANCZOS)
    icon = Image.new('RGBA', (size, size), '#1a607c')
    icon.alpha_composite(mark, (round((size - mark.width) / 2 - size * .018), round((size - mark.height) / 2)))
    icon.convert('RGB').save(PUBLIC / name)
