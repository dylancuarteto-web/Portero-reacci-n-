"""Atlas de partículas 128x128 (celdas de 16px) en escala de grises para teñir.

Fila 0: 0 brillo suave, 1 estrella, 2 punto, 3 anillo, 4 escama, 5 serpiente S, 6 rayo, 7 destello cruz
Fila 1: humo (8 frames)
Fila 2: runas (8 glifos)
Fila 3: 0-3 onda expansiva grande (32x32 en celdas 0..1 de filas 3-4)
"""
import math
import os
import random
import sys
from PIL import Image

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))


def put(x, y, a, v=255):
    a = max(0, min(255, int(a)))
    if a <= 0:
        return
    img.putpixel((x, y), (v, v, v, a))


def cell(ix, iy, fn, size=16):
    for y in range(size):
        for x in range(size):
            r = fn(x + 0.5 - size / 2, y + 0.5 - size / 2)
            if r:
                put(ix * 16 + x, iy * 16 + y, *r) if isinstance(r, tuple) else put(ix * 16 + x, iy * 16 + y, r)


cell(0, 0, lambda x, y: 255 * max(0, 1 - math.hypot(x, y) / 8) ** 1.6)
cell(1, 0, lambda x, y: 255 if (abs(x) < 1 and abs(y) < 7 - abs(x)) or (abs(y) < 1 and abs(x) < 7) or math.hypot(x, y) < 2.2 else
     (140 if abs(x) + abs(y) < 5 else 0))
cell(2, 0, lambda x, y: 255 if math.hypot(x, y) < 3 else (110 if math.hypot(x, y) < 4.5 else 0))
cell(3, 0, lambda x, y: 255 * max(0, 1 - abs(math.hypot(x, y) - 6) / 1.6))
cell(4, 0, lambda x, y: (255 if abs(x) + abs(y) * 0.8 < 6.5 else 0, 230 if abs(x) + abs(y) * 0.8 < 4 else 255))
cell(5, 0, lambda x, y: 255 if abs(x - 3.5 * math.sin(y / 2.4)) < 1.6 and abs(y) < 7 else 0)
cell(6, 0, lambda x, y: 255 * max(0, 1 - abs(x) / 3.5) * (1 - abs(y) / 9))
cell(7, 0, lambda x, y: 255 if (abs(x) < 0.6 or abs(y) < 0.6) and math.hypot(x, y) < 7.5 else (255 * max(0, 1 - math.hypot(x, y) / 3.5)))

rnd = random.Random(3)
blobs = [(rnd.uniform(-3, 3), rnd.uniform(-3, 3), rnd.uniform(2, 4)) for _ in range(6)]
for f in range(8):
    grow = 0.6 + f * 0.12
    fade = 1 - f / 8.5

    def smoke(x, y, grow=grow, fade=fade):
        v = 0
        for bx, by, br in blobs:
            d = math.hypot(x - bx * grow, y - by * grow) / (br * grow)
            v = max(v, 1 - d)
        return 230 * max(0, v) * fade
    cell(f, 1, smoke)

glyphs = [
    ["..##..", ".#..#.", "######", ".#..#.", "..##..", ".#..#."],
    ["#....#", ".#..#.", "..##..", "..##..", ".#..#.", "#....#"],
    ["######", "#.....", "####..", "#.....", "#.....", "######"],
    ["..#...", ".###..", "#.#.#.", "..#...", "..#...", ".###.."],
    ["#.##.#", "#....#", "######", "#....#", "#.##.#", "......"],
    [".####.", "#....#", "...##.", "..#...", "......", "..#..."],
    ["##..##", ".#..#.", "..##..", ".#..#.", "##..##", "......"],
    ["#.....", "##....", "#.#...", "#..#..", "#...#.", "######"],
]
for i, g in enumerate(glyphs):
    for j, row in enumerate(g):
        for k, ch in enumerate(row):
            if ch == "#":
                for dy in range(2):
                    for dx in range(2):
                        put(i * 16 + 2 + k * 2 + dx, 32 + 2 + j * 2 + dy, 255)

# onda grande 32x32 en (0,48)
for y in range(32):
    for x in range(32):
        r = math.hypot(x + 0.5 - 16, y + 0.5 - 16)
        put(x, 48 + y, 255 * max(0, 1 - abs(r - 13) / 2.5))
# escama de serpiente con brillo (32x32) en (32,48)
for y in range(32):
    for x in range(32):
        dx, dy = x + 0.5 - 16, y + 0.5 - 16
        if abs(dx) * 0.9 + abs(dy) < 13:
            put(32 + x, 48 + y, 255 if abs(dx) * 0.9 + abs(dy) > 10 else 200, 255 if abs(dx) * 0.9 + abs(dy) > 10 else 200)

os.makedirs(os.path.join(OUT, "textures/particle"), exist_ok=True)
img.save(os.path.join(OUT, "textures/particle/lacobra_particles.png"))
print("atlas de partículas listo")
