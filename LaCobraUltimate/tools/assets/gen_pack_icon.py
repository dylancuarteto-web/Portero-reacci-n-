"""Icono de los packs (128x128): emblema de La Cobra sobre fondo oscuro."""
import math, sys, os
from PIL import Image
from pix import *

OUT = sys.argv[1]
ITEMS = os.path.join(OUT, "LaCobra_RP/textures/items")
img = Image.new("RGBA", (128, 128))
for y in range(128):
    for x in range(128):
        d = math.hypot(x - 64, y - 64) / 90
        img.putpixel((x, y), mix(VIOLET_D, BLACK, min(1, d * 1.3)))
for i in range(128):
    for t in range(3):
        for (x, y) in ((i, t), (i, 127 - t), (t, i), (127 - t, i)):
            img.putpixel((x, y), GOLD if t < 2 else GOLD_D)
ball = Image.open(os.path.join(ITEMS, "balon_dorado.png")).resize((64, 64), Image.NEAREST)
sword = Image.open(os.path.join(ITEMS, "espada_cobra.png")).resize((96, 96), Image.NEAREST)
img.alpha_composite(ball, (48, 52))
img.alpha_composite(sword, (12, 8))
for name in ("LaCobra_BP", "LaCobra_RP"):
    img.save(os.path.join(OUT, name, "pack_icon.png"))
print("pack_icon listo")
