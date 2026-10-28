"""Mini toolkit de pixel-art para generar las texturas originales de La Cobra.

Todo se dibuja a resolución nativa (sin antialiasing) para que las texturas
queden nítidas en Bedrock.
"""
import math
import random
from PIL import Image, ImageDraw

# ---------------------------------------------------------------- paleta
BLACK = (16, 12, 20, 255)
DARK = (34, 27, 44, 255)
DARK2 = (52, 42, 66, 255)
GOLD_D = (150, 96, 14, 255)
GOLD = (232, 170, 30, 255)
GOLD_L = (255, 214, 90, 255)
GOLD_W = (255, 244, 186, 255)
WHITE = (246, 242, 232, 255)
VIOLET_D = (70, 26, 128, 255)
VIOLET = (132, 64, 216, 255)
VIOLET_L = (190, 138, 255, 255)
VIOLET_W = (232, 210, 255, 255)
GREY = (120, 116, 130, 255)
IVORY = (238, 228, 200, 255)
IVORY_D = (190, 172, 132, 255)
CLEAR = (0, 0, 0, 0)


def rgba(c, a=255):
    return (c[0], c[1], c[2], a)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(4))


def shade(c, f):
    """f>1 aclara, f<1 oscurece."""
    return (min(255, int(c[0] * f)), min(255, int(c[1] * f)), min(255, int(c[2] * f)), c[3])


def canvas(w, h=None):
    return Image.new("RGBA", (w, h or w), CLEAR)


def px(img, x, y, c):
    if 0 <= x < img.width and 0 <= y < img.height:
        img.putpixel((int(x), int(y)), c)


def get(img, x, y):
    if 0 <= x < img.width and 0 <= y < img.height:
        return img.getpixel((int(x), int(y)))
    return CLEAR


def poly(img, pts, c):
    ImageDraw.Draw(img).polygon([(round(x), round(y)) for x, y in pts], fill=c)


def rect(img, x0, y0, x1, y1, c):
    ImageDraw.Draw(img).rectangle([x0, y0, x1, y1], fill=c)


def ellipse(img, x0, y0, x1, y1, c):
    ImageDraw.Draw(img).ellipse([x0, y0, x1, y1], fill=c)


def line(img, x0, y0, x1, y1, c, w=1):
    ImageDraw.Draw(img).line([(x0, y0), (x1, y1)], fill=c, width=w)


def circle_mask(img, cx, cy, r):
    return [(x, y) for y in range(img.height) for x in range(img.width)
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r]


def outline(img, c=BLACK, diag=False):
    """Añade un contorno de 1px alrededor de los píxeles opacos."""
    src = img.copy()
    nb = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    if diag:
        nb += [(1, 1), (-1, -1), (1, -1), (-1, 1)]
    for y in range(img.height):
        for x in range(img.width):
            if src.getpixel((x, y))[3] == 0:
                for dx, dy in nb:
                    if get(src, x + dx, y + dy)[3] > 0:
                        img.putpixel((x, y), c)
                        break
    return img


def inner_shade(img, light=(-1, -1), hi=1.25, lo=0.7):
    """Ilumina los bordes que miran a la luz y oscurece los opuestos."""
    src = img.copy()
    lx, ly = light
    for y in range(img.height):
        for x in range(img.width):
            c = src.getpixel((x, y))
            if c[3] == 0:
                continue
            if get(src, x + lx, y + ly)[3] == 0:
                img.putpixel((x, y), shade(c, hi))
            elif get(src, x - lx, y - ly)[3] == 0:
                img.putpixel((x, y), shade(c, lo))
    return img


def sparkle(img, x, y, c=WHITE, size=1):
    px(img, x, y, c)
    for i in range(1, size + 1):
        cc = mix(c, CLEAR, i / (size + 1.5))
        for dx, dy in ((i, 0), (-i, 0), (0, i), (0, -i)):
            if get(img, x + dx, y + dy)[3] == 0 or size > 1:
                px(img, x + dx, y + dy, cc if get(img, x + dx, y + dy)[3] == 0 else mix(get(img, x + dx, y + dy), c, 0.6))


def noise_fill(img, region, base, var=0.08, seed=1):
    rnd = random.Random(seed)
    for (x, y) in region:
        f = 1 + rnd.uniform(-var, var)
        px(img, x, y, shade(base, f))


def glow_halo(img, color, radius=2, strength=0.55):
    """Halo suave semitransparente (para iconos que brillan)."""
    src = img.copy()
    out = img.copy()
    for y in range(img.height):
        for x in range(img.width):
            if src.getpixel((x, y))[3] > 0:
                continue
            best = 99
            for dy in range(-radius, radius + 1):
                for dx in range(-radius, radius + 1):
                    if get(src, x + dx, y + dy)[3] > 0:
                        best = min(best, math.hypot(dx, dy))
            if best <= radius:
                a = int(255 * strength * (1 - (best - 1) / radius))
                if a > 0:
                    out.putpixel((x, y), rgba(color, max(0, min(255, a))))
    return out


def save(img, path):
    import os
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)
