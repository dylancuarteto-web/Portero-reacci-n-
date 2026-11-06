"""Arte de la fase final de Claude Golden (v7.9): corazón dorado, fondo negro de la
cinemática, orbes, relojes, signos de pregunta, rayos, marionetas, ilusiones del
jugador, el ítem Corazón dorado, la niebla gris de la pausa del tiempo, la cara de la
barra de jefe (fuente de glifos) y las entidades de comportamiento de todo eso.

Todo el arte es original (formas y colores propios). Se ejecuta desde build_assets.py.
"""
import math
import random

from PIL import Image, ImageDraw

import build_assets as ba

RP = ba.RP
BP = ba.ROOT / "BP"
FACES = ba.FACES
write_json = ba.write_json
clamp = ba.clamp
TEX = RP / "textures/entity/claudenpc"


def geo(identifier, bones, tw, th, bounds=(2, 3, 1.5)):
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": identifier, "texture_width": tw, "texture_height": th,
                        "visible_bounds_width": bounds[0], "visible_bounds_height": bounds[1],
                        "visible_bounds_offset": [0, bounds[2], 0]},
        "bones": bones}]}


def uvmap(regs, **por_cara):
    """UV por cara: uvmap(REGS, north="a", resto="b"). Las regiones son (u, v, ancho, alto)."""
    resto = por_cara.get("resto")
    out = {}
    for f in FACES:
        n = por_cara.get(f, resto)
        if n is None:
            continue
        u, v, w, h = regs[n] if isinstance(n, str) else n
        out[f] = {"uv": [u, v], "uv_size": [w, h]}
    return out


def r3(v):
    return [round(x, 3) for x in v]


# =============================================================================
# Corazón (dorado para la cinemática y el ítem; blanco con hilos para las marionetas)
# =============================================================================

CORAZON = [
    "..XXX...XXX..",
    ".XXXXX.XXXXX.",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    "XXXXXXXXXXXXX",
    ".XXXXXXXXXXX.",
    "..XXXXXXXXX..",
    "...XXXXXXX...",
    "....XXXXX....",
    ".....XXX.....",
    "......X......",
]
CW, CH = len(CORAZON[0]), len(CORAZON)


def _lleno(c, r):
    return 0 <= r < CH and 0 <= c < CW and CORAZON[r][c] == "X"


def _erosion(c, r):
    return _lleno(c, r) and all(_lleno(c + dc, r + dr) for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)))


def corazon_cubos(u0, v0, borde, y0=0.0, escala=1.0):
    """Corazón 3D por capas: núcleo de 3 px y capas delantera y trasera más chicas (redondeado).
    La cara frontal muestra la imagen del corazón (u0, v0) píxel a píxel."""
    cubos = []
    capas = ((_lleno, -1.5, 3.0), (_erosion, -2.5, 1.0), (_erosion, 1.5, 1.0))
    for fn, z0, prof in capas:
        for r in range(CH):
            c = 0
            while c < CW:
                if not fn(c, r):
                    c += 1
                    continue
                c1 = c
                while c1 < CW and fn(c1, r):
                    c1 += 1
                largo = c1 - c
                x = (c - CW / 2) * escala
                y = y0 + (CH - 1 - r) * escala
                uv = {
                    "north": {"uv": [u0 + c, v0 + r], "uv_size": [largo, 1]},
                    "south": {"uv": [u0 + c1, v0 + r], "uv_size": [-largo, 1]},
                    "east": {"uv": list(borde[:2]), "uv_size": list(borde[2:])},
                    "west": {"uv": list(borde[:2]), "uv_size": list(borde[2:])},
                    "up": {"uv": list(borde[:2]), "uv_size": list(borde[2:])},
                    "down": {"uv": list(borde[:2]), "uv_size": list(borde[2:])},
                }
                cubos.append({"origin": r3([x, y, z0 * escala]), "size": r3([largo * escala, escala, prof * escala]), "uv": uv})
                c = c1
    return cubos


def pintar_corazon(px, u0, v0, base, claro, oscuro, brillo, alfa, alfa_brillo=0):
    """Imagen del corazón: degradado de arriba (claro) a abajo (oscuro), borde y un reflejo."""
    for r in range(CH):
        for c in range(CW):
            if not _lleno(c, r):
                continue
            t = r / (CH - 1)
            col = [claro[i] + (oscuro[i] - claro[i]) * t for i in range(3)]
            mezcla = [base[i] * 0.5 + col[i] * 0.5 for i in range(3)]
            a = alfa
            if not _erosion(c, r):  # borde
                mezcla = [m * 0.82 for m in mezcla]
            # Reflejo en el lóbulo izquierdo
            if (c, r) in ((2, 1), (3, 1), (1, 2), (2, 2), (1, 3)):
                mezcla, a = list(brillo), alfa_brillo
            px[u0 + c, v0 + r] = tuple(clamp(m) for m in mezcla) + (a,)


def corazon_textura():
    img = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    px = img.load()
    pintar_corazon(px, 0, 0, (255, 196, 40), (255, 236, 140), (214, 128, 16), (255, 255, 240), 60, 0)
    for y in range(4):
        for x in range(4):
            px[16 + x, y] = (226, 150, 24, 90)  # bordes
    return img


def corazon_geo():
    borde = (16, 0, 4, 4)
    cubos = corazon_cubos(0, 0, borde, y0=-CH / 2)
    huesos = [{"name": "corazon", "pivot": [0, 0, 0], "cubes": cubos, "locators": {"centro": [0, 0, 0]}}]
    return geo("geometry.claudenpc.corazon_dorado", huesos, 32, 16, bounds=(3, 3, 0))


# =============================================================================
# Fondo negro (caja vista desde adentro) para el momento en que solo se ve el corazón
# =============================================================================

def fondo_geo():
    n = 80  # media caja (px): 10 bloques de lado
    g = 1
    uv = {f: {"uv": [0, 0], "uv_size": [4, 4]} for f in FACES}
    paredes = [
        ([-n, -n, -n - g], [2 * n, 2 * n, g]), ([-n, -n, n], [2 * n, 2 * n, g]),
        ([-n - g, -n, -n], [g, 2 * n, 2 * n]), ([n, -n, -n], [g, 2 * n, 2 * n]),
        ([-n, -n - g, -n], [2 * n, g, 2 * n]), ([-n, n, -n], [2 * n, g, 2 * n]),
    ]
    cubos = [{"origin": o, "size": s, "uv": uv} for o, s in paredes]
    return geo("geometry.claudenpc.fondo", [{"name": "fondo", "pivot": [0, 0, 0], "cubes": cubos}], 16, 16, bounds=(14, 14, 0))


def fondo_textura():
    return Image.new("RGBA", (16, 16), (0, 0, 0, 255))


# =============================================================================
# Orbes: amarilla, azul y la definitiva (grande, con capas azul y amarilla)
# =============================================================================

REG_ORBE = {"amarilla": (0, 0, 8, 8), "azul": (8, 0, 8, 8), "nucleo": (16, 0, 8, 8),
            "capa_am": (24, 0, 8, 8), "capa_az": (32, 0, 8, 8), "anillo": (40, 0, 8, 2)}


def esfera(prefijo, radio, padre, region, n_lon=8, bandas=(-60, -20, 20, 60), pivote=(0, 0, 0)):
    """Esfera de paneles planos (como la de la fusión), en huesos por meridiano."""
    huesos = [{"name": prefijo, "pivot": list(pivote), **({"parent": padre} if padre else {})}]
    mitad = (bandas[1] - bandas[0]) / 2
    alto = 2 * radio * math.tan(math.radians(mitad)) * 1.04
    cy = pivote[1]
    u, v, w, h = REG_ORBE[region]
    uv = {f: {"uv": [u, v], "uv_size": [w, h]} for f in FACES}
    for i in range(n_lon):
        cubos = []
        for lat in bandas:
            borde = max(0.0, abs(lat) - mitad)
            ancho = 2 * radio * math.cos(math.radians(borde)) * math.tan(math.pi / n_lon) * 1.06
            cubos.append({"origin": r3([-ancho / 2, cy - alto / 2, pivote[2] - radio]), "size": r3([ancho, alto, 0]),
                          "uv": uv, "pivot": list(pivote), "rotation": [-lat, 0, 0]})
        # Tapas de los polos
        if i == 0:
            for signo in (1, -1):
                tapa = 2 * radio * math.cos(math.radians(abs(bandas[-1]) + mitad - 2)) * 1.3
                cubos.append({"origin": r3([-tapa / 2, cy + signo * radio * 0.995 - (0 if signo > 0 else 0), pivote[2] - tapa / 2]),
                              "size": r3([tapa, 0, tapa]), "uv": uv})
        huesos.append({"name": f"{prefijo}_m{i}", "parent": prefijo, "pivot": list(pivote),
                       "rotation": [0, round(i * 360 / n_lon, 3), 0], "cubes": cubos})
    return huesos


def gema(origen_centro, lado, uv):
    """Bola pequeña: tres cubos girados (se ve redonda al brillar)."""
    cx, cy, cz = origen_centro
    o = r3([cx - lado / 2, cy - lado / 2, cz - lado / 2])
    s = [lado, lado, lado]
    return [{"origin": o, "size": s, "uv": uv},
            {"origin": o, "size": s, "uv": uv, "pivot": [cx, cy, cz], "rotation": [45, 0, 0]},
            {"origin": o, "size": s, "uv": uv, "pivot": [cx, cy, cz], "rotation": [0, 45, 45]}]


def orbe_geo():
    uv = lambda n: {f: {"uv": list(REG_ORBE[n][:2]), "uv_size": list(REG_ORBE[n][2:])} for f in FACES}
    huesos = [{"name": "raiz", "pivot": [0, 0, 0], "locators": {"centro": [0, 0, 0]}}]
    huesos.append({"name": "amarilla", "parent": "raiz", "pivot": [0, 0, 0], "cubes": gema((0, 0, 0), 4, uv("amarilla"))
                   + [{"origin": [-3, -3, -3], "size": [6, 6, 6], "uv": uv("capa_am"), "inflate": 0.2}]})
    huesos.append({"name": "azul", "parent": "raiz", "pivot": [0, 0, 0], "cubes": gema((0, 0, 0), 4, uv("azul"))
                   + [{"origin": [-3, -3, -3], "size": [6, 6, 6], "uv": uv("capa_az"), "inflate": 0.2}]})
    huesos.append({"name": "definitiva", "parent": "raiz", "pivot": [0, 0, 0]})
    huesos += esfera("def_nucleo", 4.5, "definitiva", "nucleo", n_lon=8)
    huesos += esfera("def_azul", 6.5, "definitiva", "capa_az", n_lon=10)
    huesos += esfera("def_amarilla", 8.0, "definitiva", "capa_am", n_lon=12)
    anillo = []
    segs = 24
    rr = 11.5
    w = 2 * rr * math.tan(math.pi / segs) * 1.05
    for j in range(segs):
        anillo.append({"origin": r3([-w / 2, -0.6, -rr]), "size": r3([w, 1.2, 0]), "uv": uv("anillo"),
                       "pivot": [0, 0, 0], "rotation": [0, round(j * 360 / segs, 3), 0]})
    huesos.append({"name": "def_anillo", "parent": "definitiva", "pivot": [0, 0, 0], "rotation": [28, 0, 0], "cubes": anillo})
    return geo("geometry.claudenpc.orbe", huesos, 64, 16, bounds=(4, 4, 0))


def orbe_textura():
    img = Image.new("RGBA", (64, 16), (0, 0, 0, 0))
    px = img.load()

    def bloque(nombre, fn):
        u, v, w, h = REG_ORBE[nombre]
        for y in range(h):
            for x in range(w):
                px[u + x, v + y] = fn(x / max(1, w - 1), y / max(1, h - 1))

    def brillo(c1, c2):
        def f(x, y):
            d = math.hypot(x - 0.35, y - 0.35)
            t = min(1, d * 1.3)
            return tuple(clamp(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (0,)
        return f
    bloque("amarilla", brillo((255, 255, 230), (255, 196, 30)))
    bloque("azul", brillo((235, 250, 255), (40, 140, 255)))
    bloque("nucleo", brillo((255, 255, 255), (255, 240, 170)))
    # Capas translúcidas con remolinos (diseño propio)
    def remolino(color, a0):
        def f(x, y):
            onda = 0.5 + 0.5 * math.sin((x * 2.2 + y * 1.4) * math.pi * 2)
            return color + (clamp(a0 + 90 * onda),)
        return f
    bloque("capa_am", remolino((255, 214, 70), 70))
    bloque("capa_az", remolino((70, 170, 255), 80))
    bloque("anillo", lambda x, y: (255, 255, 255, 0) if 0.3 < x < 0.7 else (255, 230, 120, 0))
    return img


# =============================================================================
# Reloj despertador 3D (requisito RELOJ)
# =============================================================================

REG_RELOJ = {"esfera": (0, 0, 16, 16), "aro": (16, 0, 4, 4), "aguja": (20, 0, 2, 2), "campana": (22, 0, 4, 4),
             "pata": (26, 0, 2, 2), "eje": (28, 0, 2, 2)}


def reloj_geo():
    uv = lambda n, **kw: uvmap(REG_RELOJ, **kw) if kw else uvmap(REG_RELOJ, resto=n)
    cuerpo = []
    for a in (0, 30, 60):
        cuerpo.append({"origin": [-6, 4, -2], "size": [12, 12, 4], "uv": uv("aro"), "pivot": [0, 10, 0], "rotation": [0, 0, a]})
    # Esferas (delante y detrás) con números propios y borde dorado; recorte redondo.
    cuerpo.append({"origin": [-6, 4, -2.15], "size": [12, 12, 0], "uv": {"north": {"uv": [0, 0], "uv_size": [16, 16]}}})
    cuerpo.append({"origin": [-6, 4, 2.15], "size": [12, 12, 0], "uv": {"south": {"uv": [0, 0], "uv_size": [16, 16]}}})
    # Campanas, martillo y patas
    for lado in (-1, 1):
        cx = 3.6 * lado
        cuerpo.append({"origin": r3([cx - 2, 15.2, -2]), "size": [4, 2.2, 4], "uv": uv("campana"),
                       "pivot": [cx, 15.2, 0], "rotation": [0, 0, -22 * lado]})
        cuerpo.append({"origin": r3([cx - 1.2, 17.1, -1.2]), "size": [2.4, 1, 2.4], "uv": uv("campana"),
                       "pivot": [cx, 15.2, 0], "rotation": [0, 0, -22 * lado]})
        cuerpo.append({"origin": r3([cx - 0.5 - 0.6 * lado, 2.2, -0.5]), "size": [1, 2.4, 1], "uv": uv("pata"),
                       "pivot": [cx, 4, 0], "rotation": [0, 0, 18 * lado]})
    cuerpo.append({"origin": [-0.4, 16, -0.4], "size": [0.8, 2.6, 0.8], "uv": uv("aguja")})
    cuerpo.append({"origin": [-1.4, 18.4, -0.6], "size": [2.8, 0.8, 1.2], "uv": uv("aguja")})
    cuerpo.append({"origin": [-0.6, 9.4, -2.6], "size": [1.2, 1.2, 5.2], "uv": uv("eje")})
    huesos = [
        {"name": "reloj", "pivot": [0, 10, 0], "locators": {"centro": [0, 10, 0], "arriba": [0, 18, 0]}},
        {"name": "cuerpo", "parent": "reloj", "pivot": [0, 10, 0], "cubes": cuerpo},
        {"name": "campana_izq", "parent": "reloj", "pivot": [3.6, 15.2, 0]},
        {"name": "campana_der", "parent": "reloj", "pivot": [-3.6, 15.2, 0]},
    ]
    for lado, z in (("f", -2.4), ("t", 2.2)):
        huesos.append({"name": f"horario_{lado}", "parent": "reloj", "pivot": [0, 10, 0], "cubes": [
            {"origin": [-0.5, 10, z], "size": [1, 3.2, 0.2], "uv": uv("aguja")}]})
        huesos.append({"name": f"minutero_{lado}", "parent": "reloj", "pivot": [0, 10, 0], "cubes": [
            {"origin": [-0.35, 10, z - 0.05], "size": [0.7, 4.8, 0.2], "uv": uv("aguja")}]})
    return geo("geometry.claudenpc.reloj", huesos, 32, 16, bounds=(2.5, 2.5, 0.6))


def reloj_textura(apagado=False):
    img = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    px = img.load()
    oro = (255, 200, 60) if not apagado else (110, 104, 96)
    oro_osc = (196, 130, 24) if not apagado else (70, 66, 62)
    crema = (255, 248, 226) if not apagado else (92, 92, 96)
    tinta = (60, 40, 20) if not apagado else (40, 40, 44)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            if d > 7.9:
                continue
            if d > 6.6:
                px[x, y] = oro + (255,)
            elif d > 6.0:
                px[x, y] = oro_osc + (255,)
            else:
                px[x, y] = crema + (255,)
    for i in range(12):  # marcas de las horas
        a = i * math.pi / 6
        for rr in ((5.2, 4.4) if i % 3 == 0 else (5.2,)):
            x, y = 7.5 + math.sin(a) * rr, 7.5 - math.cos(a) * rr
            px[int(round(x)), int(round(y))] = tinta + (255,)
    for x in range(4):
        for y in range(4):
            px[16 + x, y] = (oro if (x + y) % 3 else oro_osc) + (255,)
            px[22 + x, y] = oro + (255,)
    for x in range(2):
        for y in range(2):
            px[20 + x, y] = tinta + (255,)
            px[26 + x, y] = oro_osc + (255,)
            px[28 + x, y] = oro + (255,)
    return img


# =============================================================================
# Signo de pregunta 3D (marca dónde caerá un rayo) y rayo 3D
# =============================================================================

PREGUNTA = [
    ".XXX.",
    "XX.XX",
    "...XX",
    "..XX.",
    "..X..",
    ".....",
    "..X..",
]


def signo_geo():
    cubos = []
    uv = {f: {"uv": [0, 0], "uv_size": [4, 4]} for f in FACES}
    uv_borde = {f: {"uv": [4, 0], "uv_size": [4, 4]} for f in FACES}
    alto = len(PREGUNTA)
    for r, fila in enumerate(PREGUNTA):
        c = 0
        while c < len(fila):
            if fila[c] != "X":
                c += 1
                continue
            c1 = c
            while c1 < len(fila) and fila[c1] == "X":
                c1 += 1
            cubos.append({"origin": r3([c - 2.5, alto - 1 - r, -0.75]), "size": [c1 - c, 1, 1.5], "uv": uv})
            cubos.append({"origin": r3([c - 2.5, alto - 1 - r, -0.75]), "size": [c1 - c, 1, 1.5], "uv": uv_borde, "inflate": 0.25})
            c = c1
    huesos = [{"name": "signo", "pivot": [0, 3.5, 0], "cubes": cubos}]
    return geo("geometry.claudenpc.signo", huesos, 16, 8, bounds=(2, 2, 0.8))


def signo_textura(color):
    img = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
    px = img.load()
    for y in range(4):
        for x in range(4):
            px[x, y] = (255, 255, 255, 0)
            px[4 + x, y] = color + (110,)
    return img


def rayo_geo():
    rnd = random.Random(7)
    huesos = [{"name": "rayo", "pivot": [0, 0, 0]}]
    uv_n = {f: {"uv": [0, 0], "uv_size": [4, 4]} for f in FACES}
    uv_g = {f: {"uv": [4, 0], "uv_size": [4, 4]} for f in FACES}
    for var in range(3):
        pts = [(0.0, 0.0, 0.0)]
        y = 0.0
        while y < 300:
            y += rnd.uniform(18, 30)
            pts.append((rnd.uniform(-10, 10), y, rnd.uniform(-10, 10)))
        cubos = []

        def segmento(a, b, grueso, uv, inflar=None):
            dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
            largo = math.sqrt(dx * dx + dy * dy + dz * dz)
            # Un cubo vertical girado para unir a con b. El motor gira primero en x y después en
            # z: (0, L, 0) queda en (sen z·cos x, cos z·cos x, -sen x)·L.
            rz = math.degrees(math.atan2(dx, dy))
            rx = math.degrees(math.atan2(-dz, math.hypot(dx, dy)))
            c = {"origin": r3([a[0] - grueso / 2, a[1], a[2] - grueso / 2]), "size": r3([grueso, largo, grueso]),
                 "uv": uv, "pivot": r3(a), "rotation": r3([rx, 0, rz])}
            if inflar:
                c["inflate"] = inflar
            return c
        for a, b in zip(pts, pts[1:]):
            cubos.append(segmento(a, b, 1.6, uv_n))
            cubos.append(segmento(a, b, 1.6, uv_g, 1.6))
            if rnd.random() < 0.35:  # rama
                rama = (b[0] + rnd.uniform(-16, 16), b[1] - rnd.uniform(10, 20), b[2] + rnd.uniform(-16, 16))
                cubos.append(segmento(b, rama, 0.9, uv_n))
        huesos.append({"name": f"rayo_{var}", "parent": "rayo", "pivot": [0, 0, 0], "cubes": cubos})
    return geo("geometry.claudenpc.rayo", huesos, 16, 8, bounds=(6, 22, 9))


def rayo_textura(color):
    img = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
    px = img.load()
    for y in range(4):
        for x in range(4):
            px[x, y] = (255, 255, 255, 0)
            px[4 + x, y] = color + (150,)
    return img


# =============================================================================
# Marioneta: ojos dorados y corazón blanco enredado con hilo amarillo (se pega a un mob)
# =============================================================================

def marioneta_geo():
    """Corazón blanco 3D enredado con hilo amarillo. El script lo pone delante del pecho del mob
    en cada tick (no depende del giro del mob); los ojos dorados son partículas en sus ojos."""
    uv_hilo = {f: {"uv": [18, 0], "uv_size": [1, 1]} for f in FACES}
    corazon = corazon_cubos(0, 0, (20, 0, 2, 2), y0=-CH / 2 * 0.42, escala=0.42)
    hilos = []
    # Tres vueltas de hilo (aros cuadrados finos) cruzando el corazón en distintos ángulos.
    for ang, inc in ((0, 20), (60, -35), (120, 50)):
        r = 3.6
        for k in range(4):
            a = k * 90
            hilos.append({"origin": r3([-r, -0.12, -r]), "size": r3([2 * r, 0.24, 0.24]), "uv": uv_hilo,
                          "pivot": [0, 0, 0], "rotation": [inc, ang + a, 0]})
    huesos = [
        {"name": "raiz", "pivot": [0, 0, 0]},
        {"name": "corazon", "parent": "raiz", "pivot": [0, 0, 0], "cubes": corazon, "locators": {"corazon": [0, 0, 0]}},
        {"name": "hilos", "parent": "raiz", "pivot": [0, 0, 0], "cubes": hilos},
    ]
    return geo("geometry.claudenpc.marioneta", huesos, 32, 16, bounds=(1.5, 1.5, 0))


def marioneta_textura():
    img = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    px = img.load()
    pintar_corazon(px, 0, 0, (246, 246, 252), (255, 255, 255), (200, 206, 222), (255, 255, 255), 120, 0)
    for x in range(2):
        px[16 + x, 0] = (255, 214, 60, 0)  # ojos dorados que brillan
    px[18, 0] = (255, 226, 80, 0)  # hilo amarillo
    for x in range(2):
        for y in range(2):
            px[20 + x, y] = (214, 218, 232, 140)
    return img


# =============================================================================
# Ilusión del jugador (ítem Corazón dorado): figura dorada translúcida
# =============================================================================

def ilusion_textura():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    ba.pintar_cuerpo(px, (255, 246, 200), (255, 222, 120), (226, 170, 60), alpha=150, ruido=2)
    u, v, w, h = ba.REG["ojo"]
    for y in range(h):
        for x in range(w):
            px[u + x, v + y] = (255, 255, 255, 230)
    return img


# =============================================================================
# Ítem: Corazón dorado (icono propio) y cara de la barra de jefe (glifos)
# =============================================================================

def icono_corazon():
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    px = img.load()
    for r in range(CH):
        for c in range(CW):
            if not _lleno(c, r):
                continue
            t = r / (CH - 1)
            col = (clamp(255 - 30 * t), clamp(230 - 100 * t), clamp(110 - 90 * t))
            if not _erosion(c, r):
                col = tuple(clamp(k * 0.78) for k in col)
            for dy in range(2):
                for dx in range(2):
                    px[3 + c * 2 + dx, 5 + r * 2 + dy] = col + (255,)
    for x, y in ((8, 9), (9, 9), (7, 10), (8, 10), (7, 11)):
        for dy in range(2):
            for dx in range(2):
                px[x + dx - 1, y + dy - 1] = (255, 255, 236, 255)
    # Destellos amarillo y azul (lanza bolas de esos colores)
    for (cx, cy, col) in ((27, 5, (255, 236, 90)), (4, 26, (90, 190, 255))):
        for d in range(-2, 3):
            px[cx + d, cy] = col + (255 if abs(d) < 2 else 160,)
            px[cx, cy + d] = col + (255 if abs(d) < 2 else 160,)
    return img


# =============================================================================
# Íconos de los relojes (fuente del paquete) y barra de jefe propia (JSON UI)
# =============================================================================

def hoja_glifos():
    """RP/font/glyph_E9.png (256 x 256, celdas de 16 px: el motor dibuja cada glifo más o
    menos del tamaño de su celda, así que 16 px es como un ícono pequeño junto al texto).
    U+E907 reloj encendido, U+E908 reloj apagado, U+E909 tiempo lleno, U+E90A tiempo vacío.
    La vida de Golden ya no va en la barra de acción: va arriba, en su barra de jefe."""
    hoja = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    for i, encendido in ((7, True), (8, False)):
        ic = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(ic)
        aro = (255, 200, 60, 255) if encendido else (120, 116, 110, 255)
        cara = (255, 248, 226, 255) if encendido else (80, 80, 86, 255)
        tinta = (70, 44, 20, 255) if encendido else (40, 40, 44, 255)
        d.ellipse([1, 3, 14, 15], fill=aro)
        d.ellipse([3, 5, 12, 13], fill=cara)
        d.line([(7, 9), (7, 6)], fill=tinta)
        d.line([(7, 9), (10, 9)], fill=tinta)
        for x in (2, 13):
            d.ellipse([x - 2, 0, x + 2, 4], fill=aro)
        if not encendido:
            d.line([(2, 14), (14, 2)], fill=(210, 40, 50, 255), width=2)
        # Bordes casi invisibles: todos los relojes ocupan lo mismo (el motor recorta el
        # ancho de cada glifo por su parte visible).
        ic.putpixel((0, 10), (255, 255, 255, 12))
        ic.putpixel((15, 10), (255, 255, 255, 12))
        hoja.alpha_composite(ic, (i * 16, 0))
    for i, lleno in ((9, True), (10, False)):
        ic = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        d = ImageDraw.Draw(ic)
        if lleno:
            d.rectangle([0, 5, 4, 12], fill=(255, 196, 40, 255), outline=(180, 110, 20, 255))
            d.line([(1, 6), (3, 6)], fill=(255, 244, 190, 255))
        else:
            d.rectangle([0, 5, 4, 12], fill=(40, 34, 30, 210), outline=(120, 100, 70, 255))
        hoja.alpha_composite(ic, (i * 16, 0))
    return hoja


# --- Barra de jefe de Claude Golden ------------------------------------------------------
# Se dibuja a 2 px por píxel de la interfaz y se guarda al doble (4 px por píxel) para que
# se vea nítida en cualquier escala de interfaz del celular.
JEFE_ANCHO, JEFE_ALTO = 232, 28          # tamaño en píxeles de la interfaz
JEFE_BARRA = (25, 20, 182, 5)           # x, y, ancho, alto del relleno (como la barra vanilla)
_S = 2                                   # píxeles de dibujo por píxel de interfaz


def _mezcla(a, b, t):
    return tuple(clamp(a[k] + (b[k] - a[k]) * t) for k in range(len(a)))


def _pluma(d, raiz, ang, largo, ancho, col, brillo):
    """Una pluma: un rombo alargado desde la raíz, con su nervio claro."""
    x0, y0 = raiz
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    punta = (x0 + dx * largo, y0 + dy * largo)
    medio = (x0 + dx * largo * 0.45, y0 + dy * largo * 0.45)
    d.polygon([(x0, y0), (medio[0] + nx * ancho, medio[1] + ny * ancho), punta,
               (medio[0] - nx * ancho, medio[1] - ny * ancho)], fill=col)
    d.line([(x0, y0), (x0 + dx * largo * 0.85, y0 + dy * largo * 0.85)], fill=brillo)


def _ala_jefe(d, cx, cy, izquierda):
    """Ala dorada de plumas (diseño propio) que sale del medallón hacia un lado."""
    sentido = -1 if izquierda else 1
    for i in range(6):
        t = i / 5
        ang_grados = (180 - 22 + i * 9) if izquierda else (22 - i * 9)
        ang = math.radians(ang_grados)
        largo = (31 - i * 3.4) * _S
        col = (255, clamp(226 - 60 * t), clamp(120 - 90 * t), 255)
        raiz = (cx + sentido * 7 * _S, cy + (i * 0.6 - 1) * _S)
        _pluma(d, raiz, ang, largo, 2.4 * _S - i * 0.2 * _S, col, (255, 250, 222, 255))
    # Contorno oscuro de la base del ala
    d.ellipse([cx + sentido * 7 * _S - 3 * _S, cy - 3 * _S, cx + sentido * 7 * _S + 3 * _S, cy + 3 * _S],
              fill=(214, 150, 40, 255), outline=(150, 96, 20, 255))


def _cara_jefe(img, ox, oy):
    """Cara de Claude Golden (12 x 12 px de interfaz): cabeza dorada como la de su skin,
    ojos blancos, el ojo derecho brillando y la corona."""
    d = ImageDraw.Draw(img)
    S = _S
    # Corona
    d.rectangle([ox + 1 * S, oy + 1.5 * S, ox + 11 * S - 1, oy + 3 * S - 1], fill=(255, 196, 40, 255))
    for x in (1.5, 6, 10.5):
        d.polygon([(ox + (x - 1.2) * S, oy + 1.6 * S), (ox + (x + 1.2) * S, oy + 1.6 * S), (ox + x * S, oy - 0.4 * S)],
                  fill=(255, 220, 90, 255))
    d.rectangle([ox + 5.5 * S, oy + 2 * S, ox + 6.5 * S - 1, oy + 3 * S - 1], fill=(230, 40, 60, 255))
    # Cabeza (degradado dorado, más claro arriba a la izquierda)
    for y in range(int(3 * S), int(12 * S)):
        for x in range(int(1 * S), int(11 * S)):
            t = ((x - S) / (10 * S)) * 0.45 + ((y - 3 * S) / (9 * S)) * 0.55
            img.putpixel((ox + x, oy + y), _mezcla((255, 236, 150), (226, 160, 46), t) + (255,))
    d.rectangle([ox + 1 * S, oy + 3 * S, ox + 11 * S - 1, oy + 12 * S - 1], outline=(150, 96, 20, 255))
    # Ojos blancos (como en su skin)
    for ex in (3, 7.5):
        d.rectangle([ox + ex * S, oy + 6 * S, ox + (ex + 1.5) * S - 1, oy + 9 * S - 1], fill=(255, 255, 250, 255))
    # Ojo derecho luminoso (a la izquierda en la imagen) con destello
    cx, cy = ox + int(3.75 * S), oy + int(7.5 * S)
    for k in range(-5, 6):
        a = 255 if abs(k) <= 2 else 150 if abs(k) <= 4 else 70
        for p in ((cx + k, cy), (cx, cy + k)):
            base = img.getpixel(p)
            img.putpixel(p, _mezcla(base[:3], (255, 255, 214), a / 255) + (max(base[3], a),))


def barra_jefe_texturas():
    """RP/textures/ui/claudenpc/jefe_marco.png y jefe_lleno.png (diseño propio)."""
    W, H = JEFE_ANCHO * _S, JEFE_ALTO * _S
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = _S
    # Adornos de los extremos (plumas pequeñas hacia afuera)
    for izquierda in (True, False):
        x0 = 16 * S if izquierda else (JEFE_ANCHO - 16) * S
        for i in range(3):
            ang = math.radians((180 + (i - 1) * 24) if izquierda else (-(i - 1) * 24))
            col = (255, clamp(214 - 30 * i), clamp(96 - 30 * i), 255)
            _pluma(d, (x0, 16 * S), ang, (15 - i * 2) * S, 2.2 * S, col, (255, 246, 210, 255))
    # Placa: oscura y casi opaca, con borde dorado
    x0, y0, x1, y1 = 14 * S, 4 * S, (JEFE_ANCHO - 14) * S - 1, JEFE_ALTO * S - 1
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        d.line([(x0, y), (x1, y)], fill=_mezcla((46, 32, 14), (20, 13, 6), t) + (244,))
    d.rounded_rectangle([x0, y0, x1, y1], radius=3 * S, outline=(206, 154, 54, 255), width=S)
    d.line([(x0 + 3 * S, y0 + S), (x1 - 3 * S, y0 + S)], fill=(255, 228, 140, 255))
    d.line([(x0 + 3 * S, y1 - S), (x1 - 3 * S, y1 - S)], fill=(120, 80, 24, 255))
    # Ranura de la barra (vacía): marco dorado y fondo oscuro
    bx, by, bw, bh = JEFE_BARRA
    d.rectangle([(bx - 1) * S, (by - 1) * S, (bx + bw + 1) * S - 1, (by + bh + 1) * S - 1], fill=(206, 154, 54, 255))
    d.rectangle([bx * S, by * S, (bx + bw) * S - 1, (by + bh) * S - 1], fill=(22, 14, 6, 255))
    d.line([(bx * S, by * S), ((bx + bw) * S - 1, by * S)], fill=(8, 5, 2, 255))
    d.line([(bx * S, (by + bh) * S - 1), ((bx + bw) * S - 1, (by + bh) * S - 1)], fill=(52, 36, 16, 255))
    # Alas y medallón con la cara, arriba al centro (donde iba el nombre)
    cx, cy = JEFE_ANCHO // 2 * S, 10 * S
    _ala_jefe(d, cx, cy, True)
    _ala_jefe(d, cx, cy, False)
    d.ellipse([cx - 10 * S, cy - 10 * S, cx + 10 * S - 1, cy + 10 * S - 1], fill=(206, 154, 54, 255))
    d.ellipse([cx - 9 * S, cy - 9 * S, cx + 9 * S - 1, cy + 9 * S - 1], fill=(255, 226, 132, 255))
    d.ellipse([cx - 8 * S, cy - 8 * S, cx + 8 * S - 1, cy + 8 * S - 1], fill=(30, 20, 8, 255))
    _cara_jefe(img, cx - 6 * S, cy - 6 * S)
    marco = img.resize((W * 2, H * 2), Image.NEAREST)

    # Relleno: oro con brillo arriba y marcas cada décimo de vida
    rw, rh = bw * S, bh * S
    lleno = Image.new("RGBA", (rw, rh), (0, 0, 0, 0))
    filas = [(255, 248, 204), (255, 232, 120), (255, 210, 70), (255, 200, 56), (248, 182, 40),
             (236, 160, 32), (222, 140, 26), (200, 118, 20), (176, 98, 16), (150, 82, 14)]
    for y in range(rh):
        col = filas[min(len(filas) - 1, int(y * len(filas) / rh))]
        for x in range(rw):
            lleno.putpixel((x, y), col + (255,))
    for k in range(1, 10):
        x = round(k * rw / 10)
        for y in range(1, rh):
            r, g, b, a = lleno.getpixel((x, y))
            lleno.putpixel((x, y), (clamp(r * 0.72), clamp(g * 0.66), clamp(b * 0.6), a))
    lleno = lleno.resize((rw * 2, rh * 2), Image.NEAREST)
    return marco, lleno


def _no_es_golden(prop):
    # El jefe NO es Golden (su nombre no tiene "laude" ni "olden"): sirve tanto si el
    # nombre llega como texto ("Claude Golden") como si llega como clave de idioma.
    return f"(((#{prop} - 'olden') = #{prop}) or ((#{prop} - 'laude') = #{prop}))"


def _es_golden(prop):
    return f"(not {_no_es_golden(prop)})"


def _visible_si(expresion):
    return [
        {"binding_name": "#bossName", "binding_type": "collection", "binding_collection_name": "boss_bars",
         "binding_condition": "always"},
        {"binding_type": "view", "source_property_name": expresion, "target_property_name": "#visible",
         "binding_condition": "always"},
    ]


def ui_barra_jefe():
    """JSON UI de la barra de jefe propia (sin tocar el resto del HUD):
    - RP/ui/claudenpc_jefe.json (espacio de nombres propio): la barra dorada con su cara.
    - RP/ui/hud_screen.json: un solo punto de entrada (insert_back en boss_health_panel) y
      la condición que oculta el nombre y la barra morada vanilla solo cuando el jefe es
      Claude Golden. Los demás jefes (el robot, el Wither...) se ven como siempre."""
    marco, lleno = barra_jefe_texturas()
    carpeta = RP / "textures/ui/claudenpc"
    carpeta.mkdir(parents=True, exist_ok=True)
    marco.save(carpeta / "jefe_marco.png")
    lleno.save(carpeta / "jefe_lleno.png")
    bx, by, bw, bh = JEFE_BARRA
    write_json(RP / "ui/_ui_defs.json", {"ui_defs": ["ui/claudenpc_jefe.json"]})
    write_json(RP / "ui/claudenpc_jefe.json", {
        "namespace": "claudenpc_jefe",
        "barra_golden": {
            "type": "panel",
            "size": [JEFE_ANCHO, JEFE_ALTO],
            "anchor_from": "top_middle",
            "anchor_to": "top_middle",
            "layer": 30,
            "bindings": _visible_si(_es_golden("bossName")),
            "controls": [
                {"marco": {"type": "image", "texture": "textures/ui/claudenpc/jefe_marco",
                           "size": [JEFE_ANCHO, JEFE_ALTO], "layer": 1}},
                {"vida": {
                    "type": "image",
                    "texture": "textures/ui/claudenpc/jefe_lleno",
                    "size": [bw, bh],
                    "anchor_from": "top_left",
                    "anchor_to": "top_left",
                    "offset": [bx, by],
                    "layer": 2,
                    "clip_direction": "left",
                    "clip_pixelperfect": False,
                    "bindings": [{"binding_name": "#progress_percentage", "binding_name_override": "#clip_ratio",
                                  "binding_type": "collection", "binding_collection_name": "boss_bars"}],
                }},
            ],
        },
    })
    write_json(RP / "ui/hud_screen.json", {
        "namespace": "hud",
        "boss_name_panel": {"bindings": _visible_si(_no_es_golden("bossName"))},
        "boss_health_panel/progress_bar_for_collections": {"bindings": _visible_si(_no_es_golden("bossName"))},
        "boss_health_panel": {"modifications": [{
            "array_name": "controls",
            "operation": "insert_back",
            "value": [{"claudenpc_barra_golden@claudenpc_jefe.barra_golden": {}}],
        }]},
    })


def vista_barra_jefe(ruta):
    """Vista previa de la barra (a 4x) con 100 %, 62 % y 18 % de vida."""
    marco, lleno = barra_jefe_texturas()
    bx, by, bw, bh = JEFE_BARRA
    E = 4
    lienzo = Image.new("RGBA", (JEFE_ANCHO * E + 40, (JEFE_ALTO * E + 24) * 3 + 20), (88, 120, 168, 255))
    for i, frac in enumerate((1.0, 0.62, 0.18)):
        y0 = 20 + i * (JEFE_ALTO * E + 24)
        lienzo.alpha_composite(marco, (20, y0))
        corte = lleno.crop((0, 0, max(1, round(lleno.width * frac)), lleno.height))
        lienzo.alpha_composite(corte, (20 + bx * E, y0 + by * E))
    lienzo.save(ruta)


# =============================================================================
# Partículas nuevas
# =============================================================================

def particulas():
    U = lambda nombre: ba.ATLAS[nombre]

    def efecto(nombre, sprite, comps, color, size, material="particles_add", facing="lookat_xyz"):
        u, v, w, h = U(sprite)
        billboard = {"size": size, "facing_camera_mode": facing,
                     "uv": {"texture_width": 64, "texture_height": 32, "uv": [u, v], "uv_size": [w, h]}}
        tinte = {"color": {"gradient": color, "interpolant": "variable.particle_age / variable.particle_lifetime"}} \
            if isinstance(color, dict) else {"color": color}
        write_json(RP / f"particles/{nombre}.particle.json", {"format_version": "1.10.0", "particle_effect": {
            "description": {"identifier": f"claudenpc:{nombre}",
                            "basic_render_parameters": {"material": material, "texture": "textures/particle/claudenpc"}},
            "components": {"minecraft:particle_appearance_billboard": billboard,
                           "minecraft:particle_appearance_tinting": tinte, **comps}}})

    edad = "variable.particle_age / variable.particle_lifetime"
    baja = lambda a: [f"{a} * (1 - {edad})", f"{a} * (1 - {edad})"]
    sube = lambda a, b: [f"{a} + ({b} - {a}) * {edad}", f"{a} + ({b} - {a}) * {edad}"]
    unavez = lambda t=0.05: {"minecraft:emitter_lifetime_once": {"active_time": t}}
    bucle = {"minecraft:emitter_lifetime_looping": {"active_time": 1}}
    inst = lambda n: {"minecraft:emitter_rate_instant": {"num_particles": n}}
    fijo = lambda rate, maxp: {"minecraft:emitter_rate_steady": {"spawn_rate": rate, "max_particles": maxp}}
    vida = lambda t: {"minecraft:particle_lifetime_expression": {"max_lifetime": t}}
    vel = lambda s: {"minecraft:particle_initial_speed": s}
    mov = lambda **kw: {"minecraft:particle_motion_dynamic": kw}
    mundo = {"minecraft:emitter_local_space": {"position": False, "rotation": False}}
    pegado = {"minecraft:emitter_local_space": {"position": True, "rotation": True}}
    punto = {"minecraft:emitter_shape_point": {}}

    # Estelas de las espadas (salen de la punta mientras corta y se quedan en el aire).
    for nombre, col in (("estela_amarilla", {"0.0": "#FFFFFFFF", "0.25": "#FFFFE45A", "1.0": "#00FF9A10"}),
                        ("estela_azul", {"0.0": "#FFFFFFFF", "0.25": "#FF7CD2FF", "1.0": "#001E6EFF"}),
                        ("estela_morada", {"0.0": "#FFFFFFFF", "0.25": "#FFC27CFF", "1.0": "#005A14A0"})):
        efecto(nombre, "brillo", {**mundo, **fijo(700, 160), **unavez(0.16), **punto, **vida(0.24), **vel(0), **mov()},
               col, baja(0.2))
    efecto("destello_corte", "estrella", {**inst(5), "minecraft:emitter_shape_sphere": {"radius": 0.2, "direction": "outwards"},
                                          **unavez(), **vida(0.25), **vel(4), **mov(linear_drag_coefficient=8)},
           {"0.0": "#FFFFFFFF", "1.0": "#00FFE6A0"}, sube(0.5, 0.1))
    # Corazón dorado: brillo grande que late y destellos.
    efecto("brillo_corazon", "brillo", {**pegado, **fijo(12, 8), **bucle, **punto, **vida(0.35), **vel(0), **mov()},
           {"0.0": "#AAFFE070", "1.0": "#00FFB020"}, ["1.3 + math.sin(variable.particle_age * 900) * 0.15"] * 2)
    efecto("destello_corazon", "brillo", {**inst(3), **unavez(), **punto, **vida(1.2), **vel(0), **mov()},
           {"0.0": "#FFFFFFFF", "0.3": "#FFFFF0A0", "1.0": "#00FFC040"}, sube(4.5, 1.2))
    efecto("rayos_corazon", "estrella", {**pegado, **fijo(18, 30), **bucle,
                                         "minecraft:emitter_shape_sphere": {"radius": 0.6, "surface_only": True, "direction": "outwards"},
                                         **vida(0.6), **vel(0.6), **mov(linear_drag_coefficient=1.5)},
           {"0.0": "#FFFFFFFF", "1.0": "#00FFD25A"}, baja(0.14))
    efecto("converge_dorado", "estrella", {**inst(36), **unavez(),
                                           "minecraft:emitter_shape_sphere": {"radius": 3.2, "surface_only": True, "direction": "inwards"},
                                           **vida(0.8), **vel(4), **mov(linear_drag_coefficient=0.6)},
           {"0.0": "#00FFE070", "0.3": "#FFFFE070", "1.0": "#FFFFFFFF"}, baja(0.16))
    # Lluvia de rayitas doradas que caen (fondo negro de la cinemática).
    efecto("lluvia_dorada", "cuadro", {**fijo(40, 60), **unavez(1.0),
                                       "minecraft:emitter_shape_box": {"half_dimensions": [3.5, 0.2, 3.5], "direction": [0, -1, 0]},
                                       **vida(1.1), **vel(5), **mov()},
           {"0.0": "#00FFE6A0", "0.15": "#FFFFE6A0", "0.8": "#AAFFD25A", "1.0": "#00FFB020"}, [0.22, 0.02], facing="lookat_direction")
    # Orbes
    for nombre, col in (("estela_orbe_amarilla", {"0.0": "#FFFFF5C8", "1.0": "#00FFAA1E"}),
                        ("estela_orbe_azul", {"0.0": "#FFDCF2FF", "1.0": "#001E78FF"})):
        efecto(nombre, "brillo", {**mundo, **fijo(40, 40), **bucle, "minecraft:emitter_shape_sphere": {"radius": 0.12},
                                  **vida(0.35), **vel(0), **mov()}, col, baja(0.3))
    efecto("anillo_sonico", "anillo", {**pegado, **fijo(5, 6), **bucle, **punto, **vida(0.5), **vel(0), **mov()},
           {"0.0": "#FFFFFFFF", "0.5": "#AA9AD8FF", "1.0": "#00FFD25A"}, sube(1.2, 4.2))
    efecto("chispas_definitiva", "chispa", {**pegado, **fijo(50, 50), **bucle,
                                            "minecraft:emitter_shape_sphere": {"radius": 1.8, "surface_only": True, "direction": "inwards"},
                                            **vida(0.4), **vel(4), **mov()},
           {"0.0": "#FFFFFFFF", "0.5": "#FF7CD2FF", "1.0": "#00FFD25A"}, baja(0.12))
    for nombre, col in (("explosion_dorada", {"0.0": "#FFFFFFFF", "0.3": "#FFFFDC50", "1.0": "#00FF8C14"}),
                        ("explosion_azul", {"0.0": "#FFFFFFFF", "0.3": "#FF78C8FF", "1.0": "#001450FF"})):
        efecto(nombre, "brillo", {**inst(18), **unavez(), "minecraft:emitter_shape_sphere": {"radius": 0.3, "direction": "outwards"},
                                  **vida(0.5), **vel(5), **mov(linear_drag_coefficient=5)}, col, sube(0.5, 0.05))
    efecto("explosion_definitiva", "brillo", {**inst(60), **unavez(), "minecraft:emitter_shape_sphere": {"radius": 0.8, "direction": "outwards"},
                                              **vida(0.9), **vel(12), **mov(linear_drag_coefficient=4)},
           {"0.0": "#FFFFFFFF", "0.3": "#FFFFE070", "0.6": "#FF7CD2FF", "1.0": "#00145AFF"}, sube(1.2, 0.1))
    # Rayos: aviso en el suelo (amarillo o azul) e impacto.
    for nombre, col in (("aviso_amarillo", {"0.0": "#FFFFE45A", "1.0": "#44FFB020"}),
                        ("aviso_azul", {"0.0": "#FF7CD2FF", "1.0": "#441E6EFF"}),
                        ("aviso_morado", {"0.0": "#FFC27CFF", "1.0": "#445A14A0"})):
        efecto(nombre, "anillo", {**inst(1), **unavez(), **punto, **vida(0.3), **vel(0), **mov()}, col,
               ["variable.radio", "variable.radio"], facing="emitter_transform_xz")
    for nombre, col in (("impacto_amarillo", {"0.0": "#FFFFFFFF", "0.3": "#FFFFE45A", "1.0": "#00FF9A10"}),
                        ("impacto_azul", {"0.0": "#FFFFFFFF", "0.3": "#FF7CD2FF", "1.0": "#001E6EFF"}),
                        ("impacto_morado", {"0.0": "#FFFFFFFF", "0.3": "#FFC27CFF", "1.0": "#005A14A0"})):
        efecto(nombre, "chispa", {**inst(24), **unavez(), "minecraft:emitter_shape_disc": {"radius": 0.5, "plane_normal": "y", "direction": "outwards"},
                                  **vida(0.5), **vel(7), **mov(linear_acceleration=[0, 4, 0], linear_drag_coefficient=4)}, col, baja(0.16))
    # Espada morada (v8.2): chispas que giran y se juntan en la hoja al volverse morada, y la
    # descarga morada sobre quien toca un rayo morado o la inundación.
    efecto("chispas_moradas", "estrella", {**inst(30), **unavez(),
                                           "minecraft:emitter_shape_sphere": {"radius": 1.6, "surface_only": True, "direction": "inwards"},
                                           **vida(0.6), **vel(3), **mov(linear_drag_coefficient=1.2)},
           {"0.0": "#00C27CFF", "0.3": "#FFC27CFF", "1.0": "#FFFFFFFF"}, baja(0.14))
    efecto("descarga_morada", "chispa", {**inst(16), **unavez(), "minecraft:emitter_shape_box": {"half_dimensions": [0.35, 0.9, 0.35], "direction": "outwards"},
                                         **vida(0.35), **vel(4), **mov(linear_drag_coefficient=6)},
           {"0.0": "#FFFFFFFF", "0.4": "#FFC27CFF", "1.0": "#005A14A0"}, baja(0.12))
    # Reloj apagado (humo), pausa del tiempo (onda gris), arena que se rompe (trozos de oro).
    efecto("humo_reloj", "humo", {**inst(10), **unavez(), "minecraft:emitter_shape_sphere": {"radius": 0.4, "direction": "outwards"},
                                  **vida(0.9), **vel(0.8), **mov(linear_acceleration=[0, 0.8, 0], linear_drag_coefficient=2)},
           {"0.0": "#CC9A9AA0", "1.0": "#006E6E74"}, sube(0.3, 0.8), "particles_alpha")
    efecto("onda_pausa", "anillo", {**inst(2), **unavez(), **punto, **vida(0.8), **vel(0), **mov()},
           {"0.0": "#FFE6E9EE", "1.0": "#00787C82"}, sube(0.5, 18.0))
    efecto("fragmento_dorado", "cuadro", {**inst(8), **unavez(), "minecraft:emitter_shape_box": {"half_dimensions": [0.5, 0.5, 0.5], "direction": "outwards"},
                                          **vida(1.0), **vel(3), **mov(linear_acceleration=[0, -14, 0])},
           {"0.0": "#FFFFE070", "1.0": "#FFC88C1E"}, [0.09, 0.09], "particles_alpha")
    # Motas doradas que flotan en la arena (ambiente).
    efecto("motas_doradas", "chispa", {**inst(10), **unavez(), "minecraft:emitter_shape_box": {"half_dimensions": [6, 3, 6]},
                                       **vida("2 + variable.particle_random_1 * 2"), **vel(0.1),
                                       **mov(linear_acceleration=[0, 0.12, 0])},
           {"0.0": "#00FFE6A0", "0.3": "#CCFFE070", "1.0": "#00FFC850"}, [0.05, 0.05])
    efecto("curacion_dorada", "estrella", {**inst(30), **unavez(), "minecraft:emitter_shape_disc": {"radius": 1.2, "plane_normal": "y"},
                                           **vida(1.2), **vel(0.3), **mov(linear_acceleration=[0, 3, 0])},
           {"0.0": "#FFFFFFFF", "1.0": "#00FFD25A"}, baja(0.2))
    efecto("chasquido_destello", "estrella", {**inst(3), **unavez(), **punto, **vida(0.3), **vel(0), **mov()},
           {"0.0": "#FFFFFFFF", "1.0": "#00FFD25A"}, sube(0.2, 0.9))
    efecto("plumas_doradas", "estrella", {**inst(16), **unavez(), "minecraft:emitter_shape_sphere": {"radius": 1.2, "direction": "outwards"},
                                          **vida(1.6), **vel(1.2), **mov(linear_acceleration=[0, -0.6, 0], linear_drag_coefficient=1.5)},
           {"0.0": "#FFFFF5C8", "1.0": "#00FFC850"}, baja(0.14))
    for nombre, col in (("mano_amarilla", {"0.0": "#CCFFE45A", "1.0": "#00FFB020"}),
                        ("mano_azul", {"0.0": "#CC7CD2FF", "1.0": "#001E6EFF"})):
        efecto(nombre, "brillo", {**pegado, **fijo(14, 8), **bucle, **punto, **vida(0.3), **vel(0), **mov()}, col, [0.5, 0.5])


# =============================================================================
# Niebla gris de la pausa del tiempo
# =============================================================================

def niebla_dorada():
    oro = "#D8B24C"
    capa = {"fog_start": 12.0, "fog_end": 58.0, "fog_color": oro, "render_distance_type": "fixed"}
    write_json(RP / "fogs/claudenpc_dorada.json", {"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": "claudenpc:dorada"},
        "distance": {"air": capa, "weather": capa, "water": {**capa, "fog_end": 30.0}}}})


def niebla_pausa():
    gris = "#6F747B"
    capa = {"fog_start": 0.0, "fog_end": 15.0, "fog_color": gris, "render_distance_type": "fixed"}
    write_json(RP / "fogs/claudenpc_pausa.json", {"format_version": "1.16.100", "minecraft:fog_settings": {
        "description": {"identifier": "claudenpc:pausa"},
        "distance": {"air": capa, "weather": capa, "water": {**capa, "fog_end": 10.0}}}})


# =============================================================================
# Animaciones y controladores de los objetos nuevos
# =============================================================================

def animaciones_objetos():
    write_json(RP / "animations/golden_objetos.animation.json", {"format_version": "1.8.0", "animations": {
        "animation.claudenpc.corazon.girar": {"loop": True, "bones": {"corazon": {
            "rotation": [0, "query.life_time * 110", "math.sin(query.life_time * 80) * 6"],
            "position": [0, "math.sin(query.life_time * 120) * 0.8", 0],
            "scale": "math.min(1, query.life_time * 3) * (1 + math.pow(math.sin(query.life_time * 420), 16) * 0.12)"}}},
        "animation.claudenpc.orbe.giro": {"loop": True, "bones": {
            "raiz": {"scale": "math.min(1, query.life_time * 6)"},
            "amarilla": {"rotation": ["query.life_time * 400", "query.life_time * 300", 0]},
            "azul": {"rotation": ["query.life_time * -300", "query.life_time * 420", 0]},
            "def_nucleo": {"scale": "1 + math.sin(query.life_time * 1400) * 0.06"},
            "def_azul": {"rotation": [0, "query.life_time * 160", "query.life_time * 40"]},
            "def_amarilla": {"rotation": ["query.life_time * -50", "query.life_time * -220", 0]},
            "def_anillo": {"rotation": [0, "query.life_time * 300", 0], "scale": "1 + math.sin(query.life_time * 600) * 0.08"}}},
        # La definitiva crece mientras la carga (3,3 s) y después queda grande.
        "animation.claudenpc.orbe.crecer": {"loop": True, "bones": {
            "definitiva": {"scale": "0.3 + 2.1 * math.min(1, query.life_time / 3.3)"}}},
        "animation.claudenpc.reloj.tic": {"loop": True, "bones": {
            "reloj": {"rotation": [0, "query.life_time * 45", 0], "position": [0, "math.sin(query.life_time * 100) * 0.8", 0]},
            "minutero_f": {"rotation": [0, 0, "-math.floor(query.life_time * 2) * 30"]},
            "minutero_t": {"rotation": [0, 0, "math.floor(query.life_time * 2) * 30"]},
            "horario_f": {"rotation": [0, 0, "-query.life_time * 15"]},
            "horario_t": {"rotation": [0, 0, "query.life_time * 15"]}}},
        "animation.claudenpc.reloj.alarma": {"loop": True, "bones": {
            "reloj": {"position": ["math.sin(query.life_time * 2400) * 0.35", 0, 0], "rotation": [0, 0, "math.sin(query.life_time * 1800) * 4"]},
            "minutero_f": {"rotation": [0, 0, "-query.life_time * 720"]},
            "minutero_t": {"rotation": [0, 0, "query.life_time * 720"]},
            "campana_izq": {"rotation": [0, 0, "math.sin(query.life_time * 3000) * 12"]},
            "campana_der": {"rotation": [0, 0, "math.sin(query.life_time * 3000) * -12"]}}},
        "animation.claudenpc.reloj.apagado": {"loop": True, "bones": {
            "reloj": {"rotation": [8, "query.life_time * 4", 14], "position": [0, -1, 0]}}},
        "animation.claudenpc.marioneta.seguir": {"loop": True, "bones": {
            "corazon": {"rotation": [0, "query.life_time * 90", 0],
                        "scale": "1 + math.pow(math.sin(query.life_time * 300), 12) * 0.25"},
            "hilos": {"rotation": ["math.sin(query.life_time * 70) * 10", "query.life_time * -60", 0]}}},
        "animation.claudenpc.ilusion.aparecer": {"loop": True, "bones": {
            "root": {"scale": "math.min(1, query.life_time * 4)"}}},
    }})
    write_json(RP / "animation_controllers/golden_objetos.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.claudenpc.corazon.brillo": {"initial_state": "brilla", "states": {"brilla": {
            "particle_effects": [{"effect": "brillo", "locator": "centro"}, {"effect": "rayos", "locator": "centro"}]}}},
        "controller.animation.claudenpc.orbe.amarilla": {"initial_state": "vuela", "states": {"vuela": {
            "particle_effects": [{"effect": "estela_am", "locator": "centro"}]}}},
        "controller.animation.claudenpc.orbe.azul": {"initial_state": "vuela", "states": {"vuela": {
            "particle_effects": [{"effect": "estela_az", "locator": "centro"}]}}},
        "controller.animation.claudenpc.orbe.definitiva": {"initial_state": "vuela", "states": {"vuela": {
            "particle_effects": [{"effect": "sonico", "locator": "centro"}, {"effect": "chispas", "locator": "centro"},
                                 {"effect": "estela_am", "locator": "centro"}]}}},
        "controller.animation.claudenpc.reloj.estado": {"initial_state": "tic", "states": {
            "tic": {"animations": ["tic"], "transitions": [{"alarma": "query.mark_variant == 1"}, {"apagado": "query.mark_variant == 2"}],
                    "blend_transition": 0.2},
            "alarma": {"animations": ["tic", "alarma"], "transitions": [{"tic": "query.mark_variant == 0"}, {"apagado": "query.mark_variant == 2"}],
                       "blend_transition": 0.2},
            "apagado": {"animations": ["apagado"], "particle_effects": [{"effect": "humo", "locator": "arriba"}],
                        "transitions": [{"tic": "query.mark_variant == 0"}], "blend_transition": 0.4}}},
    }})


# =============================================================================
# Entidades de cliente y render controllers de los objetos nuevos
# =============================================================================

def entidades_cliente():
    def cliente(ident, archivo, materiales, texturas, geometria, animaciones=None, animar=None, particulas=None,
                controlador="controller.render.default", sonidos=None):
        desc = {"identifier": ident, "materials": materiales, "textures": texturas, "geometry": {"default": geometria},
                "render_controllers": [controlador]}
        if animaciones:
            desc["animations"] = animaciones
            desc["scripts"] = {"animate": animar or list(animaciones)}
        if particulas:
            desc["particle_effects"] = particulas
        if sonidos:
            desc["sound_effects"] = sonidos
        write_json(RP / f"entity/{archivo}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": desc}})

    cliente("claudenpc:corazon_dorado", "corazon_dorado", {"default": "entity_emissive_alpha"},
            {"default": "textures/entity/claudenpc/corazon_dorado"}, "geometry.claudenpc.corazon_dorado",
            {"girar": "animation.claudenpc.corazon.girar", "ctrl_brillo": "controller.animation.claudenpc.corazon.brillo"},
            particulas={"brillo": "claudenpc:brillo_corazon", "rayos": "claudenpc:rayos_corazon"})
    cliente("claudenpc:fondo", "fondo", {"default": "entity_alphatest"}, {"default": "textures/entity/claudenpc/fondo"},
            "geometry.claudenpc.fondo")
    # Tres orbes: cada una es su propia entidad (no depende de datos que cambian).
    for ident, archivo, ctrl, extra in (("claudenpc:orbe", "orbe", "amarilla", {}), ("claudenpc:orbe_azul", "orbe_azul", "azul", {}),
                                        ("claudenpc:orbe_definitiva", "orbe_definitiva", "definitiva",
                                         {"crecer": "animation.claudenpc.orbe.crecer"})):
        cliente(ident, archivo, {"default": "entity_emissive_alpha", "capa": "entity_alphablend"},
                {"default": "textures/entity/claudenpc/orbe"}, "geometry.claudenpc.orbe",
                {"giro": "animation.claudenpc.orbe.giro", **extra, "ctrl_efectos": f"controller.animation.claudenpc.orbe.{ctrl}"},
                particulas={"estela_am": "claudenpc:estela_orbe_amarilla", "estela_az": "claudenpc:estela_orbe_azul",
                            "sonico": "claudenpc:anillo_sonico", "chispas": "claudenpc:chispas_definitiva"},
                controlador=f"controller.render.claudenpc_orbe_{ctrl}")
    cliente("claudenpc:reloj", "reloj", {"default": "entity_alphatest"},
            {"default": "textures/entity/claudenpc/reloj", "apagado": "textures/entity/claudenpc/reloj_apagado"},
            "geometry.claudenpc.reloj",
            {"tic": "animation.claudenpc.reloj.tic", "alarma": "animation.claudenpc.reloj.alarma",
             "apagado": "animation.claudenpc.reloj.apagado", "ctrl_estado": "controller.animation.claudenpc.reloj.estado"},
            animar=["ctrl_estado"], particulas={"humo": "claudenpc:humo_reloj"}, controlador="controller.render.claudenpc_reloj")
    cliente("claudenpc:marioneta", "marioneta", {"default": "entity_emissive_alpha"},
            {"default": "textures/entity/claudenpc/marioneta"}, "geometry.claudenpc.marioneta",
            {"seguir": "animation.claudenpc.marioneta.seguir"})
    cliente("claudenpc:ilusion_jugador", "ilusion_jugador", {"default": "entity_alphablend"},
            {"default": "textures/entity/claudenpc/ilusion"}, "geometry.claudenpc.claude",
            {"mirar": "animation.claudenpc.mirar", "caminar": "animation.claudenpc.caminar", "respirar": "animation.claudenpc.respirar",
             "lanzar": "animation.claudenpc.lanzar", "aparecer": "animation.claudenpc.ilusion.aparecer"},
            animar=["mirar", "caminar", "respirar", "aparecer"], controlador="controller.render.claudenpc_ilusion")


def render_controllers():
    def orbe(cual):
        visibles = {"amarilla": ["amarilla"], "azul": ["azul"], "definitiva": ["definitiva", "def_*"]}[cual]
        vis = [{"*": True}, {"amarilla": False}, {"azul": False}, {"definitiva": False}, {"def_*": False}] + [{v: True} for v in visibles]
        return {"geometry": "Geometry.default", "textures": ["Texture.default"],
                "materials": [{"*": "Material.default"}, {"def_azul*": "Material.capa"}, {"def_amarilla*": "Material.capa"}],
                "part_visibility": vis}
    write_json(RP / "render_controllers/golden_objetos.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.claudenpc_orbe_amarilla": orbe("amarilla"),
        "controller.render.claudenpc_orbe_azul": orbe("azul"),
        "controller.render.claudenpc_orbe_definitiva": orbe("definitiva"),
        "controller.render.claudenpc_reloj": {
            "arrays": {"textures": {"Array.pieles": ["Texture.default", "Texture.apagado"]}},
            "geometry": "Geometry.default", "textures": ["Array.pieles[query.mark_variant == 2 ? 1 : 0]"],
            "materials": [{"*": "Material.default"}]},
        "controller.render.claudenpc_ilusion": {
            "geometry": "Geometry.default", "textures": ["Texture.default"], "materials": [{"*": "Material.default"}],
            "part_visibility": [{"*": True}, {"emblema": False}, {"herr_*": False}]},
    }})


# =============================================================================
# Entidades de comportamiento (BP) de los objetos nuevos
# =============================================================================

def entidad_bp(ident, familias, caja=(0.1, 0.1), golpeable=False, propiedades=None, eventos=None, extra=None, grupos=None):
    sensor = [{"cause": "all", "deals_damage": "no"}]
    if golpeable:
        sensor = [{"cause": "entity_attack", "deals_damage": "yes"}, {"cause": "projectile", "deals_damage": "yes"},
                  {"cause": "all", "deals_damage": "no"}]
    comps = {
        "minecraft:type_family": {"family": ["claudenpc", "claudenpc_objeto", "inanimate"] + familias},
        "minecraft:collision_box": {"width": caja[0], "height": caja[1]},
        "minecraft:physics": {"has_gravity": False, "has_collision": False},
        "minecraft:pushable": {"is_pushable": False, "is_pushable_by_piston": False},
        "minecraft:health": {"value": 1000 if golpeable else 1, "max": 1000 if golpeable else 1},
        "minecraft:damage_sensor": {"triggers": sensor},
        "minecraft:knockback_resistance": {"value": 1.0},
        "minecraft:fire_immune": True,
        "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0, "breathes_water": True},
        "minecraft:movement": {"value": 0},
        **(extra or {}),
    }
    desc = {"identifier": ident, "is_spawnable": False, "is_summonable": True}
    if propiedades:
        desc["properties"] = propiedades
    cuerpo = {"description": desc, "components": comps}
    if grupos:
        cuerpo["component_groups"] = grupos
    if eventos:
        cuerpo["events"] = eventos
    nombre = ident.split(":")[1]
    write_json(BP / f"entities/{nombre}.entity.json", {"format_version": "1.21.0", "minecraft:entity": cuerpo})


def entidades_bp():
    """Sin propiedades: lo que se ve cambia con variantes (minecraft:variant y mark_variant) y
    escalas puestas por eventos, que el juego siempre manda al cliente."""
    def grupo(nombre, **comps):
        return {f"claudenpc:{nombre}": comps}

    def evento(agregar, quitar=()):
        ev = {"add": {"component_groups": [f"claudenpc:{g}" for g in agregar]}}
        if quitar:
            ev["remove"] = {"component_groups": [f"claudenpc:{g}" for g in quitar]}
        return ev
    # Corazón: tamaño con la escala de la entidad (crece y se encoge al absorberlo).
    tams = (4, 8, 12, 16, 22)
    grupos = {}
    for t in tams:
        grupos.update(grupo(f"tam_{t}", **{"minecraft:scale": {"value": t / 10}}))
    eventos = {f"claudenpc:tam_{t}": evento([f"tam_{t}"], [f"tam_{x}" for x in tams if x != t]) for t in tams}
    entidad_bp("claudenpc:corazon_dorado", ["claudenpc_corazon"], grupos=grupos, eventos=eventos)
    entidad_bp("claudenpc:fondo", ["claudenpc_fondo"])
    for ident in ("claudenpc:orbe", "claudenpc:orbe_azul", "claudenpc:orbe_definitiva"):
        entidad_bp(ident, ["claudenpc_orbe"], caja=(0.5, 0.5) if ident != "claudenpc:orbe_definitiva" else (1.2, 1.2), golpeable=True)
    # Reloj: 0 tic-tac, 1 alarma, 2 apagado (mark_variant).
    estados = ("tic", "alarma", "apagado")
    grupos = {}
    for i, n in enumerate(estados):
        grupos.update(grupo(n, **{"minecraft:mark_variant": {"value": i}}))
    eventos = {f"claudenpc:{n}": evento([n], [x for x in estados if x != n]) for n in estados}
    entidad_bp("claudenpc:reloj", ["claudenpc_reloj"], caja=(1.0, 1.4), golpeable=True, grupos=grupos, eventos=eventos)
    entidad_bp("claudenpc:marioneta", ["claudenpc_marioneta"], caja=(0.05, 0.05))
    entidad_bp("claudenpc:ilusion_jugador", ["claudenpc_ilusion"], caja=(0.5, 1.8),
               extra={"minecraft:nameable": {"always_show": True, "allow_name_tag_renaming": False}})


def item_corazon():
    write_json(BP / "items/corazon_dorado.json", {"format_version": "1.21.40", "minecraft:item": {
        "description": {"identifier": "claudenpc:corazon_dorado", "menu_category": {"category": "equipment"}},
        "components": {
            "minecraft:icon": "claudenpc_corazon_dorado",
            "minecraft:display_name": {"value": "§6Corazón dorado"},
            "minecraft:max_stack_size": 1,
            "minecraft:glint": True,
            "minecraft:use_modifiers": {"use_duration": 0.3, "movement_modifier": 1.0},
            "minecraft:cooldown": {"category": "claudenpc_corazon", "duration": 25},
        }}})
    write_json(RP / "textures/item_texture.json", {"resource_pack_name": "claudenpc", "texture_name": "atlas.items",
                                                   "texture_data": {"claudenpc_corazon_dorado": {"textures": "textures/items/corazon_dorado"}}})


# =============================================================================

def generar():
    m = RP / "models/entity"
    write_json(m / "corazon_dorado.geo.json", corazon_geo())
    write_json(m / "fondo.geo.json", fondo_geo())
    write_json(m / "orbe.geo.json", orbe_geo())
    write_json(m / "reloj.geo.json", reloj_geo())
    write_json(m / "marioneta.geo.json", marioneta_geo())
    TEX.mkdir(parents=True, exist_ok=True)
    corazon_textura().save(TEX / "corazon_dorado.png")
    fondo_textura().save(TEX / "fondo.png")
    orbe_textura().save(TEX / "orbe.png")
    reloj_textura().save(TEX / "reloj.png")
    reloj_textura(apagado=True).save(TEX / "reloj_apagado.png")
    marioneta_textura().save(TEX / "marioneta.png")
    ilusion_textura().save(TEX / "ilusion.png")
    (RP / "textures/items").mkdir(parents=True, exist_ok=True)
    icono_corazon().save(RP / "textures/items/corazon_dorado.png")
    (RP / "font").mkdir(parents=True, exist_ok=True)
    hoja_glifos().save(RP / "font/glyph_E9.png")
    ui_barra_jefe()
    particulas()
    for viejo in ("hilo", "ojos_marioneta", "brillo_corazon_fuerte", "hilo_punto", "ojo_dorado"):
        (RP / f"particles/{viejo}.particle.json").unlink(missing_ok=True)
    niebla_pausa()
    niebla_dorada()
    animaciones_objetos()
    entidades_cliente()
    render_controllers()
    entidades_bp()
    item_corazon()
    v82()
    sonidos_y_textos()
    import v90_assets
    v90_assets.generar()


# =============================================================================
# Claude Golden: partes nuevas (textura de 128 x 128; la piel original queda arriba a la
# izquierda y lo nuevo va en el resto)
# =============================================================================

REG_G = {
    "sombra": (64, 0, 9, 8), "sombra_borde": (74, 0, 2, 2),
    "pluma": (64, 10, 16, 3), "pluma2": (64, 14, 16, 3), "pluma_borde": (82, 10, 2, 2), "ala_brazo": (86, 10, 2, 2),
    "corona_banda": (64, 18, 9, 3), "corona_punta": (74, 18, 1, 2), "gema_roja": (76, 18, 2, 2), "gema_azul": (78, 18, 2, 2),
    "corona_borde": (80, 18, 2, 2),
    "hoja_am_lado": (64, 24, 18, 2), "hoja_az_lado": (64, 27, 18, 2),
    "fantasma_am_lado": (64, 30, 18, 2), "fantasma_az_lado": (64, 33, 18, 2),
    "hoja_am_cabo": (84, 24, 1, 2), "hoja_az_cabo": (86, 24, 1, 2), "fantasma_am_cabo": (88, 24, 1, 2), "fantasma_az_cabo": (90, 24, 1, 2),
    "punta_am": (92, 24, 2, 2), "punta_az": (94, 24, 2, 2), "guarda": (96, 24, 2, 2), "mango": (98, 24, 2, 2),
    "pomo_am": (92, 28, 2, 2), "pomo_az": (94, 28, 2, 2),
    "hoja_am_filo": (100, 0, 1, 18), "hoja_az_filo": (102, 0, 1, 18), "fantasma_am_filo": (104, 0, 1, 18), "fantasma_az_filo": (106, 0, 1, 18),
    "orbe_mano_am": (108, 0, 4, 4), "orbe_mano_az": (112, 0, 4, 4),
    # Espada morada (v8.2): una capa morada sobre la hoja amarilla o la azul.
    "hoja_mo_lado": (64, 40, 18, 2), "hoja_mo_filo": (84, 40, 1, 18), "hoja_mo_cabo": (86, 40, 1, 2),
    "punta_mo": (88, 40, 2, 2), "pomo_mo": (90, 40, 2, 2),
}
GRIP = {"der": (-6.0, 11.0, 0.0), "izq": (6.0, 11.0, 0.0)}
HOMBRO = {"der": (-5.0, 22.0, 0.0), "izq": (5.0, 22.0, 0.0)}


def ug(**kw):
    return uvmap(REG_G, **kw)


def espada_cubos(lado, fantasma=False):
    """Espada en la mano (mira hacia -z con el brazo abajo): mango, pomo, guarda, hoja y punta."""
    s = -1 if lado == "der" else 1
    c = "am" if lado == "der" else "az"
    pre = "fantasma" if fantasma else "hoja"

    def x(x0, w):  # espeja en x para la mano izquierda
        return round(x0 if s < 0 else -(x0 + w), 3)
    hoja = ug(east=f"{pre}_{c}_lado", west=f"{pre}_{c}_lado", up=f"{pre}_{c}_filo", down=f"{pre}_{c}_filo",
              north=f"{pre}_{c}_cabo", south=f"{pre}_{c}_cabo")
    cubos = [
        {"origin": [x(-6.4, 0.8), 10.0, -21.5], "size": [0.8, 2.0, 18.0], "uv": hoja},
        {"origin": [x(-6.3, 0.6), 10.25, -23.5], "size": [0.6, 1.5, 2.0], "uv": ug(resto=f"punta_{c}" if not fantasma else f"{pre}_{c}_cabo")},
    ]
    if not fantasma:
        cubos += [
            {"origin": [x(-8.0, 4.0), 10.0, -3.5], "size": [4.0, 2.0, 1.0], "uv": ug(resto="guarda")},
            {"origin": [x(-6.5, 1.0), 10.5, -2.5], "size": [1.0, 1.0, 4.0], "uv": ug(resto="mango")},
            {"origin": [x(-6.75, 1.5), 10.25, 1.5], "size": [1.5, 1.5, 1.0], "uv": ug(resto=f"pomo_{c}")},
        ]
    return cubos


def ala_cubos(lado):
    """Ala de plumas doradas que sale de la espalda hacia el costado (lado -1 derecha, +1 izquierda).
    El motor gira en z al revés que la matemática habitual: para levantar una pluma que
    apunta a +x se usa z negativo (y positivo para la que apunta a -x)."""
    rx, ry, rz = 1.6 * lado, 21.0, 2.6
    cubos = []

    def pluma(ang, largo, ancho, z, region, grosor=0.5):
        x0 = rx if lado > 0 else rx - largo
        return {"origin": r3([x0, ry - ancho / 2, z]), "size": r3([largo, ancho, grosor]),
                "uv": ug(north=region, south=region, resto="pluma_borde"),
                "pivot": r3([rx, ry, z]), "rotation": [0, 0, round(-ang * lado, 2)]}
    for ang, largo in zip((64, 50, 36, 22, 8, -6, -20), (19, 21, 20, 18, 16, 13, 10)):
        cubos.append(pluma(ang, largo, 2.6, rz + 0.5, "pluma"))
    for ang, largo in zip((58, 41, 24, 7), (11, 11, 10, 8)):
        cubos.append(pluma(ang, largo, 3.0, rz, "pluma2"))
    brazo = pluma(60, 15, 1.6, rz - 0.4, "ala_brazo", grosor=1.0)
    brazo["uv"] = ug(resto="ala_brazo")
    cubos.append(brazo)
    return cubos


def corona_cubos():
    banda = ug(north="corona_banda", south="corona_banda", east="corona_banda", west="corona_banda", resto="corona_borde")
    punta = ug(resto="corona_punta")
    cubos = [
        {"origin": [-4.5, 31.6, -4.5], "size": [9, 2.4, 0.5], "uv": banda},
        {"origin": [-4.5, 31.6, 4.0], "size": [9, 2.4, 0.5], "uv": banda},
        {"origin": [4.0, 31.6, -4.0], "size": [0.5, 2.4, 8], "uv": banda},
        {"origin": [-4.5, 31.6, -4.0], "size": [0.5, 2.4, 8], "uv": banda},
    ]
    for z0 in (-4.5, 4.0):
        for xx, h in ((-3.5, 1.8), (0.0, 2.6), (3.5, 1.8)):
            cubos.append({"origin": [xx - 0.5, 34.0, z0], "size": [1, h, 0.5], "uv": punta})
            cubos.append({"origin": [xx - 0.5, 34.0 + h, z0 - 0.1], "size": [1, 1, 0.7], "uv": ug(resto="gema_roja" if xx == 0 else "corona_punta")})
    for x0 in (4.0, -4.5):
        for zz in (-2.2, 2.2):
            cubos.append({"origin": [x0, 34.0, zz - 0.5], "size": [0.5, 1.8, 1], "uv": punta})
    cubos.append({"origin": [-0.9, 32.2, -4.75], "size": [1.8, 1.3, 0.3], "uv": ug(resto="gema_roja")})
    cubos.append({"origin": [4.3, 32.3, -0.7], "size": [0.3, 1.2, 1.4], "uv": ug(resto="gema_azul")})
    cubos.append({"origin": [-4.6, 32.3, -0.7], "size": [0.3, 1.2, 1.4], "uv": ug(resto="gema_azul")})
    return cubos


def huesos_golden_final():
    huesos = [
        # Sombra sobre los ojos (cuando está herido y cabizbajo).
        {"name": "sombra", "parent": "head", "pivot": [0, 28, -4.7], "cubes": [
            {"origin": [-4.4, 25.0, -4.78], "size": [8.8, 7.4, 0.12], "uv": ug(north="sombra", south="sombra", resto="sombra_borde")}]},
        {"name": "corona", "parent": "head", "pivot": [0, 32, 0], "cubes": corona_cubos()},
        {"name": "alas", "parent": "body", "pivot": [0, 21, 2.6]},
        {"name": "ala_der", "parent": "alas", "pivot": [-1.6, 21, 2.6], "rotation": [0, 28, 0], "cubes": ala_cubos(-1)},
        {"name": "ala_izq", "parent": "alas", "pivot": [1.6, 21, 2.6], "rotation": [0, -28, 0], "cubes": ala_cubos(1)},
        {"name": "orbe_mano_der", "parent": "rightArm", "pivot": [-6, 9.5, -0.5],
         "cubes": gema((-6, 9.5, -0.5), 3.0, ug(resto="orbe_mano_am"))},
        {"name": "orbe_mano_izq", "parent": "leftArm", "pivot": [6, 9.5, -0.5],
         "cubes": gema((6, 9.5, -0.5), 3.0, ug(resto="orbe_mano_az"))},
    ]
    for lado, brazo in (("der", "rightArm"), ("izq", "leftArm")):
        g = list(GRIP[lado])
        sx = -1 if lado == "der" else 1
        huesos.append({"name": f"espada_{lado}", "parent": brazo, "pivot": g, "cubes": espada_cubos(lado),
                       "locators": {f"punta_{lado}": [6 * sx, 11, -23.5], f"medio_{lado}": [6 * sx, 11, -13]}})
        huesos.append({"name": f"espada_{lado}_morada", "parent": f"espada_{lado}", "pivot": g, "cubes": espada_morada_cubos(lado)})
    return huesos


def espada_morada_cubos(lado):
    """Capa morada (un poco más grande) sobre la hoja, la punta y el pomo de una espada: así la
    espada amarilla o la azul se ve morada sin cambiar sus animaciones."""
    s = -1 if lado == "der" else 1

    def x(x0, w):
        return round(x0 if s < 0 else -(x0 + w), 3)
    hoja = ug(east="hoja_mo_lado", west="hoja_mo_lado", up="hoja_mo_filo", down="hoja_mo_filo",
              north="hoja_mo_cabo", south="hoja_mo_cabo")
    return [
        {"origin": [x(-6.4, 0.8), 10.0, -21.5], "size": [0.8, 2.0, 18.0], "uv": hoja, "inflate": 0.08},
        {"origin": [x(-6.3, 0.6), 10.25, -23.5], "size": [0.6, 1.5, 2.0], "uv": ug(resto="punta_mo"), "inflate": 0.08},
        {"origin": [x(-6.75, 1.5), 10.25, 1.5], "size": [1.5, 1.5, 1.0], "uv": ug(resto="pomo_mo"), "inflate": 0.08},
    ]


def pintar_golden_final(img):
    px = img.load()

    def reg(nombre, fn):
        u, v, w, h = REG_G[nombre]
        for y in range(h):
            for x in range(w):
                px[u + x, v + y] = fn(x, y, w, h)
    reg("sombra", lambda x, y, w, h: (12, 6, 0, clamp(238 - 14 * y - (40 if y == h - 1 else 0))))
    reg("sombra_borde", lambda x, y, w, h: (12, 6, 0, 190))

    def pluma(c0, c1):
        def f(x, y, w, h):
            t = x / (w - 1)
            col = [c0[i] + (c1[i] - c0[i]) * t for i in range(3)]
            if y != 1:
                col = [k * 0.86 for k in col]
            return tuple(clamp(k) for k in col) + (clamp(130 * (1 - t)),)
        return f
    reg("pluma", pluma((222, 150, 34), (255, 250, 214)))
    reg("pluma2", pluma((236, 170, 40), (255, 236, 160)))
    reg("pluma_borde", lambda x, y, w, h: (204, 136, 30, 150))
    reg("ala_brazo", lambda x, y, w, h: (255, 214, 80, 90))
    reg("corona_banda", lambda x, y, w, h: ((255, 236, 150) if y == 0 else (255, 200, 56) if y == 1 else (196, 128, 24)) + (120,))
    reg("corona_punta", lambda x, y, w, h: (255, 220, 90, 60))
    reg("corona_borde", lambda x, y, w, h: (210, 140, 30, 150))
    reg("gema_roja", lambda x, y, w, h: (236, 40, 64, 0))
    reg("gema_azul", lambda x, y, w, h: (60, 160, 255, 0))

    def hoja(borde, centro, alfa):
        def f(x, y, w, h):
            return (centro if y == 0 else borde) + (alfa,) if h == 2 else centro + (alfa,)
        return f
    reg("hoja_am_lado", hoja((255, 214, 50), (255, 255, 222), 0))
    reg("hoja_az_lado", hoja((60, 160, 255), (232, 248, 255), 0))
    reg("hoja_mo_lado", hoja((170, 60, 255), (246, 226, 255), 0))
    for n, col in (("hoja_mo_filo", (252, 240, 255)), ("hoja_mo_cabo", (206, 130, 255)), ("punta_mo", (255, 255, 255)),
                   ("pomo_mo", (180, 80, 255))):
        reg(n, lambda x, y, w, h, col=col: col + (0,))
    reg("fantasma_am_lado", hoja((255, 220, 90), (255, 250, 220), 95))
    reg("fantasma_az_lado", hoja((110, 190, 255), (230, 246, 255), 95))
    for n, col, a in (("hoja_am_filo", (255, 255, 240), 0), ("hoja_az_filo", (240, 252, 255), 0),
                      ("fantasma_am_filo", (255, 246, 200), 80), ("fantasma_az_filo", (210, 236, 255), 80),
                      ("hoja_am_cabo", (255, 236, 140), 0), ("hoja_az_cabo", (140, 210, 255), 0),
                      ("fantasma_am_cabo", (255, 236, 140), 80), ("fantasma_az_cabo", (140, 210, 255), 80),
                      ("punta_am", (255, 255, 255), 0), ("punta_az", (255, 255, 255), 0),
                      ("guarda", (196, 134, 34), 170), ("mango", (92, 60, 30), 255),
                      ("pomo_am", (255, 222, 70), 0), ("pomo_az", (80, 176, 255), 0)):
        reg(n, lambda x, y, w, h, col=col, a=a: col + (a,))

    def bola(c0, c1):
        def f(x, y, w, h):
            t = min(1, math.hypot(x - 1.2, y - 1.2) / 2.6)
            return tuple(clamp(c0[i] + (c1[i] - c0[i]) * t) for i in range(3)) + (0,)
        return f
    reg("orbe_mano_am", bola((255, 255, 236), (255, 196, 30)))
    reg("orbe_mano_az", bola((236, 250, 255), (40, 140, 255)))


# =============================================================================
# Animaciones de Golden: poses (con transiciones suaves en un controlador), gestos y el
# corte rápido de espada estilo Dusttrust
# =============================================================================

Z3 = [0, 0, 0]
# Las poses las pone el script con playAnimation en un controlador con nombre (una reemplaza
# a la otra con una transición suave), sin depender de propiedades de la entidad.
POSES = {
    0: ("ninguna", {"root": {"rotation": [0, 0, 0]}}),
    # Herido en el suelo: agachado bajo (se dobla por la cintura, una pierna adelante y otra
    # atrás, la mano hacia el suelo). Los pies quedan justo en el suelo: no se hunde.
    1: ("herido", {"root": {"position": [0, -2, 0]}, "waist": {"rotation": [40, 0, 0]}, "head": {"rotation": [10, 0, 0]},
                   "rightLeg": {"rotation": [-30, 0, 10]}, "leftLeg": {"rotation": [34, 0, -8]},
                   "rightArm": {"rotation": [-16, 0, 16]}, "leftArm": {"rotation": [10, 0, -16]},
                   "ala_der": {"rotation": [0, 18, -24]}, "ala_izq": {"rotation": [0, -18, 24]}}),
    # Agachado (como agacharse en Minecraft): mientras baja herido y al levantarse.
    2: ("agachado", {"root": {"position": [0, -0.4, 0]}, "waist": {"rotation": [30, 0, 0]}, "head": {"rotation": [14, 0, 0]},
                     "rightArm": {"rotation": [-26, 0, 10]}, "leftArm": {"rotation": [-18, 0, -10]},
                     "rightLeg": {"rotation": [-12, 0, 6]}, "leftLeg": {"rotation": [4, 0, -6]},
                     "ala_der": {"rotation": [0, 14, -18]}, "ala_izq": {"rotation": [0, -14, 18]}}),
    3: ("alzar_derecho", {"rightArm": {"rotation": [-172, 0, 4]}, "head": {"rotation": [-20, 0, 0]},
                          "body": {"rotation": [-4, 0, 0]}, "leftArm": {"rotation": [4, 0, -10]}}),
    4: ("mano_pecho", {"rightArm": {"rotation": [-80, -44, 0]}, "leftArm": {"rotation": [-72, 42, 0]},
                       "head": {"rotation": [16, 0, 0]}, "body": {"rotation": [6, 0, 0]}}),
    5: ("revelacion", {"rightArm": {"rotation": [-26, 0, 74]}, "leftArm": {"rotation": [-26, 0, -74]},
                       "head": {"rotation": [-14, 0, 0]}, "body": {"rotation": [-8, 0, 0]},
                       "ala_der": {"rotation": [0, -16, 10]}, "ala_izq": {"rotation": [0, 16, -10]}}),
    6: ("chasquido_listo", {"leftArm": {"rotation": [-110, 20, -20]}}),
    7: ("brazos_arriba", {"rightArm": {"rotation": [-168, 0, 14]}, "leftArm": {"rotation": [-168, 0, -14]},
                          "head": {"rotation": [-38, 0, 0]}, "body": {"rotation": [-6, 0, 0]}}),
    8: ("orbes_arriba", {"rightArm": {"rotation": [-150, 0, 34]}, "leftArm": {"rotation": [-150, 0, -34]},
                         "head": {"rotation": [-18, 0, 0]}}),
    9: ("orbes_juntas", {"rightArm": {"rotation": [-88, -32, 0]}, "leftArm": {"rotation": [-88, 32, 0]},
                         "body": {"rotation": [-4, 0, 0]}}),
    10: ("marionetas", {"rightArm": {"rotation": ["-140 + math.sin(query.life_time * 420) * 6", "math.sin(query.life_time * 260) * 8", 18]},
                        "leftArm": {"rotation": [-40, 24, 0]}, "head": {"rotation": [-8, 0, 0]}}),
    11: ("pausa", {"rightArm": {"rotation": [-92, 0, 0]}, "leftArm": {"rotation": [6, 0, -10]}}),
    12: ("espadas", {"rightArm": {"rotation": [-48, -18, 22]}, "leftArm": {"rotation": [-48, 18, -22]},
                     "body": {"rotation": [8, 0, 0]}, "head": {"rotation": [-8, 0, 0]},
                     "rightLeg": {"rotation": [-14, 0, 6]}, "leftLeg": {"rotation": [14, 0, -6]},
                     "espada_der": {"rotation": ["-18 + math.sin(query.life_time * 140) * 3", 0, 22]},
                     "espada_izq": {"rotation": ["-18 + math.sin(query.life_time * 140 + 90) * 3", 0, -22]}}),
}
POSE_ESPADAS = 12


def kf(lista):
    """Fotogramas clave: (tiempo, valor, modo). Modo 'suave' = catmullrom."""
    out = {}
    for t, v, modo in lista:
        clave = f"{max(0.0, t):.3f}"
        out[clave] = {"post": v, "lerp_mode": "catmullrom"} if modo == "suave" else v
    return out


# Curva del corte (fracción del tiempo total, progreso). El progreso negativo es la
# anticipación (se escala con "anti"). El tramo explosivo dura ~0,07 s: casi instantáneo.
CURVA_CORTE = [
    (0.00, 0.00, "suave"), (0.14, -0.60, "suave"), (0.24, -1.00, "suave"), (0.33, -1.05, "lineal"),
    (0.37, 0.62, "lineal"), (0.41, 0.97, "lineal"), (0.45, 1.07, "suave"), (0.52, 1.00, "suave"),
    (0.62, 0.98, "suave"), (0.76, 0.62, "suave"), (0.88, 0.20, "suave"), (1.00, 0.00, "suave"),
]
TRAMO_EXPLOSIVO = (0.33, 0.45)


def _prog(v, anti):
    return v * anti if v < 0 else v


def _num(x):
    return round(x, 2)


def corte_dusttrust(lados, p, colores=None):
    """Animación de corte rápido reutilizable (para cualquier espada en la mano de un humanoide).
    lados: ["der"], ["izq"] o ["der", "izq"].
    p: dur (duración en s: la velocidad), dist (distancia del desplazamiento en px), dir (vector
       del desplazamiento en el espacio del brazo: la diagonal), rot (giro sincronizado de la
       espada al final, grados), brazo (barrido del brazo), anti (retroceso de la anticipación,
       0-1), cuerpo (giro del cuerpo en y), inclina (cuerpo en x)."""
    dur = p["dur"]
    anti = p.get("anti", 0.25)
    huesos = {}
    for lado in lados:
        s = 1 if lado == "der" else -1  # espejo para la izquierda: y, z y el x del desplazamiento
        brazo = [p["brazo"][0], p["brazo"][1] * s, p["brazo"][2] * s]
        rot = [p["rot"][0], p["rot"][1] * s, p["rot"][2] * s]
        d = p["dir"]
        dl = math.sqrt(sum(c * c for c in d))
        dirv = [d[0] / dl * s, d[1] / dl, d[2] / dl]
        hueso_brazo = "rightArm" if lado == "der" else "leftArm"
        filas_brazo, filas_pos, filas_rot = [], [], []
        for f, v, modo in CURVA_CORTE:
            t = f * dur
            k = _prog(v, anti)
            filas_brazo.append((t, [_num(brazo[i] * k) for i in range(3)], modo))
            filas_pos.append((t, [_num(dirv[i] * p["dist"] * k) for i in range(3)], modo))
            filas_rot.append((t, [_num(rot[i] * k) for i in range(3)], modo))
        huesos[hueso_brazo] = {"rotation": kf(filas_brazo)}
        huesos[f"espada_{lado}"] = {"position": kf(filas_pos), "rotation": kf(filas_rot)}
    # El cuerpo acompaña el corte (giro e inclinación), la cabeza compensa un poco.
    cuerpo = []
    cabeza = []
    signo = 1 if lados == ["der"] else -1 if lados == ["izq"] else 0
    for f, v, modo in CURVA_CORTE:
        k = _prog(v, anti)
        cuerpo.append((f * dur, [_num(p.get("inclina", 0) * k), _num(p.get("cuerpo", 0) * signo * k), 0], modo))
        cabeza.append((f * dur, [0, _num(-p.get("cuerpo", 0) * 0.45 * signo * k), 0], modo))
    huesos["body"] = {"rotation": kf(cuerpo)}
    huesos["head"] = {"rotation": kf(cabeza)}
    t_explota = TRAMO_EXPLOSIVO[0] * dur
    t_final = 0.45 * dur
    particulas = {}
    for i, lado in enumerate(lados):
        color = (colores or {}).get(lado) or ("am" if lado == "der" else "az")
        # Estela luminosa en la punta y en el medio de la hoja (una cinta de luz que se apaga).
        particulas.setdefault(f"{t_explota - 0.012 + i * 0.001:.3f}", []).extend([
            {"effect": f"estela_{color}", "locator": f"punta_{lado}"}, {"effect": f"estela_{color}", "locator": f"medio_{lado}"}])
        particulas.setdefault(f"{t_final + i * 0.001:.3f}", []).append({"effect": "destello_corte", "locator": f"punta_{lado}"})
    return {"animation_length": dur, "bones": huesos, "particle_effects": particulas,
            "sound_effects": {f"{t_explota:.3f}": {"effect": "corte"}}}


def animaciones_golden_final():
    a = {}
    for n, (nombre, huesos) in POSES.items():
        a[f"animation.claudenpc.golden.pose_{nombre}"] = {"loop": True, "bones": huesos}
    a["animation.claudenpc.golden.alas"] = {"loop": True, "bones": {
        "ala_der": {"rotation": [0, "math.sin(query.life_time * 100) * 7", "math.sin(query.life_time * 100) * 5"]},
        "ala_izq": {"rotation": [0, "-math.sin(query.life_time * 100) * 7", "-math.sin(query.life_time * 100) * 5"]}}}
    a["animation.claudenpc.golden.alas_batir"] = {"animation_length": 1.2, "bones": {
        "ala_der": {"rotation": kf([(0, Z3, "suave"), (0.2, [0, -30, 28], "suave"), (0.45, [0, 10, -18], "suave"),
                                    (0.7, [0, -26, 24], "suave"), (0.95, [0, 6, -10], "suave"), (1.2, Z3, "suave")])},
        "ala_izq": {"rotation": kf([(0, Z3, "suave"), (0.2, [0, 30, -28], "suave"), (0.45, [0, -10, 18], "suave"),
                                    (0.7, [0, 26, -24], "suave"), (0.95, [0, -6, 10], "suave"), (1.2, Z3, "suave")])}},
        "particle_effects": {"0.2": {"effect": "plumas", "locator": "pecho"}}}
    a["animation.claudenpc.golden.chasquido_izq"] = {"animation_length": 0.6, "bones": {
        "leftArm": {"rotation": kf([(0, Z3, "suave"), (0.18, [-14, 12, -10], "suave"), (0.3, [6, -6, 4], "lineal"), (0.6, Z3, "suave")])}},
        "particle_effects": {"0.3": {"effect": "chasquido", "locator": "mano_izq"}}}
    a["animation.claudenpc.golden.chasquido_der"] = {"animation_length": 0.8, "bones": {
        "rightArm": {"rotation": kf([(0, Z3, "suave"), (0.2, [-110, -30, 0], "suave"), (0.32, [-120, -20, 10], "lineal"), (0.8, Z3, "suave")])}},
        "particle_effects": {"0.32": {"effect": "chasquido", "locator": "mano_der"}}}
    a["animation.claudenpc.golden.lanzar_orbe"] = {"animation_length": 0.9, "bones": {
        "rightArm": {"rotation": kf([(0, Z3, "suave"), (0.2, [40, 0, 0], "suave"), (0.32, [-50, 0, 0], "lineal"), (0.9, Z3, "suave")])},
        "leftArm": {"rotation": kf([(0, Z3, "suave"), (0.2, [40, 0, 0], "suave"), (0.32, [-50, 0, 0], "lineal"), (0.9, Z3, "suave")])},
        "body": {"rotation": kf([(0, Z3, "suave"), (0.2, [-10, 0, 0], "suave"), (0.32, [14, 0, 0], "lineal"), (0.9, Z3, "suave")])}}}
    a["animation.claudenpc.golden.combo"] = {"animation_length": 2.6, "bones": {
        "rightArm": {"rotation": kf([(0, Z3, "suave"), (0.12, [30, 0, 0], "suave"), (0.25, [-95, -10, 0], "lineal"), (0.4, [-20, 0, 0], "suave"),
                                     (0.85, [20, 0, 10], "suave"), (0.98, [-150, -20, 0], "lineal"), (1.15, [-40, 0, 0], "suave"),
                                     (1.7, [20, 0, 0], "suave"), (1.85, [-90, 0, 0], "lineal"), (2.0, [-80, 0, 0], "suave"),
                                     (2.05, [-170, 0, 0], "suave"), (2.25, [-30, 0, 0], "lineal"), (2.6, Z3, "suave")])},
        "leftArm": {"rotation": kf([(0, Z3, "suave"), (0.45, Z3, "suave"), (0.5, [30, 0, 0], "suave"), (0.6, [-95, 10, 0], "lineal"),
                                    (0.75, [-20, 0, 0], "suave"), (1.7, [20, 0, 0], "suave"), (1.85, [-90, 0, 0], "lineal"),
                                    (2.0, [-80, 0, 0], "suave"), (2.05, [-170, 0, 0], "suave"), (2.25, [-30, 0, 0], "lineal"), (2.6, Z3, "suave")])},
        "body": {"rotation": kf([(0, Z3, "suave"), (0.85, [10, 0, 0], "suave"), (0.98, [-15, 0, 0], "lineal"), (1.2, Z3, "suave"),
                                 (1.45, [0, 360, 0], "lineal"), (1.5, [0, 360, 0], "lineal"), (2.05, [-12, 360, 0], "suave"),
                                 (2.25, [25, 360, 0], "lineal"), (2.6, [0, 360, 0], "suave")])},
        "rightLeg": {"rotation": kf([(0, Z3, "suave"), (1.25, [-90, 0, 0], "lineal"), (1.45, [-90, 0, 0], "lineal"), (1.6, Z3, "suave")])}},
        "particle_effects": {"0.25": {"effect": "chasquido", "locator": "mano_der"}, "0.6": {"effect": "chasquido", "locator": "mano_izq"},
                             "0.98": {"effect": "chasquido", "locator": "mano_der"}, "1.85": {"effect": "chasquido", "locator": "pecho"},
                             "2.25": {"effect": "chasquido", "locator": "pecho"}}}
    a["animation.claudenpc.golden.sacar_espadas"] = {"animation_length": 1.4, "bones": {
        "rightArm": {"rotation": kf([(0, Z3, "suave"), (0.35, [-165, 0, -30], "suave"), (0.6, [-172, 0, -18], "suave"),
                                     (0.85, [-60, 0, 62], "lineal"), (1.4, Z3, "suave")])},
        "leftArm": {"rotation": kf([(0, Z3, "suave"), (0.35, [-165, 0, 30], "suave"), (0.6, [-172, 0, 18], "suave"),
                                    (0.85, [-60, 0, -62], "lineal"), (1.4, Z3, "suave")])},
        "head": {"rotation": kf([(0, Z3, "suave"), (0.6, [-12, 0, 0], "suave"), (0.85, [8, 0, 0], "suave"), (1.4, Z3, "suave")])}},
        "particle_effects": {"0.62": [{"effect": "destello_corte", "locator": "punta_der"}, {"effect": "destello_corte", "locator": "punta_izq"}]}}
    a["animation.claudenpc.golden.temblor_final"] = {"loop": True, "bones": {
        "body": {"rotation": ["math.sin(query.life_time * 2600) * 3", "math.sin(query.life_time * 1900) * 4", 0]},
        "rightArm": {"rotation": [-30, 0, "70 + math.sin(query.life_time * 2300) * 6"]},
        "leftArm": {"rotation": [-30, 0, "-70 - math.sin(query.life_time * 2100) * 6"]},
        "head": {"rotation": ["-30 + math.sin(query.life_time * 2900) * 4", 0, 0]}}}
    # Los tres cortes (velocidad, distancia, rotación y duración se ajustan aquí).
    base = {"dur": 0.6, "dist": 7.0, "dir": (0.15, -0.35, -0.92), "rot": (70, 0, -35), "brazo": (28, -42, -32),
            "anti": 0.25, "cuerpo": 18, "inclina": 6}
    a["animation.claudenpc.golden.corte_der"] = corte_dusttrust(["der"], base)
    a["animation.claudenpc.golden.corte_izq"] = corte_dusttrust(["izq"], base)
    a["animation.claudenpc.golden.corte_x"] = corte_dusttrust(["der", "izq"], {**base, "dur": 0.7, "cuerpo": 0, "inclina": 14})
    # Con la espada morada (v8.2): la misma curva, con estela morada en esa espada.
    a["animation.claudenpc.golden.corte_der_morada"] = corte_dusttrust(["der"], base, {"der": "mo"})
    a["animation.claudenpc.golden.corte_izq_morada"] = corte_dusttrust(["izq"], base, {"izq": "mo"})
    for lado in ("der", "izq"):
        a[f"animation.claudenpc.golden.corte_x_morada_{lado}"] = corte_dusttrust(
            ["der", "izq"], {**base, "dur": 0.7, "cuerpo": 0, "inclina": 14}, {lado: "mo"})
    return a


def controladores_golden_final():
    mano = "query.skin_id == 2"
    return {
        "controller.animation.claudenpc.golden.orbes_mano": {"initial_state": "no", "states": {
            "no": {"transitions": [{"si": mano}]},
            "si": {"particle_effects": [{"effect": "mano_am", "locator": "mano_der"}, {"effect": "mano_az", "locator": "mano_izq"}],
                   "transitions": [{"no": f"!({mano})"}]}}},
    }


# =============================================================================
# Sonidos (música de Golden y efectos propios) y textos
# =============================================================================

NOMBRE_GOLDEN = "Claude Golden"
NOMBRES = {
    "es": {"corazon_dorado": "Corazón dorado", "orbe": "Orbe", "orbe_azul": "Orbe azul", "orbe_definitiva": "Orbe definitiva",
           "reloj": "Reloj", "signo": "Signo", "rayo": "Rayo",
           "marioneta": "Hilos de marioneta", "ilusion_jugador": "Ilusión", "fondo": "Fondo",
           "cuerda": "Cuerda de marioneta", "aldeano_marioneta": "Aldeano marioneta", "inundacion": "Inundación de rayos"},
    "en": {"corazon_dorado": "Golden Heart", "orbe": "Orb", "orbe_azul": "Blue Orb", "orbe_definitiva": "Ultimate Orb",
           "reloj": "Clock", "signo": "Mark", "rayo": "Lightning",
           "marioneta": "Puppet Strings", "ilusion_jugador": "Illusion", "fondo": "Backdrop",
           "cuerda": "Puppet String", "aldeano_marioneta": "Puppet Villager", "inundacion": "Lightning Flood"},
}


def sonidos_y_textos():
    import json
    ruta = RP / "sounds/sound_definitions.json"
    datos = json.loads(ruta.read_text(encoding="utf-8"))
    defs = datos["sound_definitions"]
    for nombre, vol in (("corazon", 1.0), ("combate", 0.9)):
        defs[f"claudenpc.golden.{nombre}"] = {"category": "music", "sounds": [
            {"name": f"sounds/claudenpc/golden/{nombre}", "stream": True, "volume": vol, "load_on_low_memory": True}]}
    for nombre, vol in (("chasquido", 1.0), ("tictac", 0.8), ("pausa", 1.0), ("reanudar", 1.0), ("latido", 1.0),
                        ("corte", 0.9), ("carga", 0.9), ("rayo_morado", 1.0)):
        defs[f"claudenpc.golden.{nombre}"] = {"category": "hostile", "max_distance": 48.0, "sounds": [
            {"name": f"sounds/claudenpc/golden/{nombre}", "volume": vol, "load_on_low_memory": True}]}
    write_json(ruta, datos)
    for archivo, idioma in (("en_US", "en"), ("es_ES", "es"), ("es_MX", "es")):
        ruta = RP / f"texts/{archivo}.lang"
        lineas = ruta.read_text(encoding="utf-8").splitlines()
        claves = {}
        claves["entity.claudenpc:claude_golden.name"] = NOMBRE_GOLDEN
        claves["entity.claudenpc:espejismo.name"] = NOMBRE_GOLDEN
        for ident, texto in NOMBRES[idioma].items():
            claves[f"entity.claudenpc:{ident}.name"] = texto
        salida = []
        for ln in lineas:
            clave = ln.split("=", 1)[0]
            if clave in claves:
                salida.append(f"{clave}={claves.pop(clave)}")
            else:
                salida.append(ln)
        salida += [f"{c}={v}" for c, v in claves.items()]
        ruta.write_text("\n".join(salida) + "\n", encoding="utf-8")


# =============================================================================
# v8.2: cuerdas amarillas de verdad, ojos y corazón pegados al mob (como un casco), aldeano
# marioneta que ataca e inundación de rayos morados del parkour
# =============================================================================

PASO_CUERDA = 0.25      # bloques de largo por animación
LARGOS_CUERDA = 192     # hasta 48 bloques
OFICIOS = ("farmer", "librarian", "cleric", "fisherman", "butcher", "armorer")


def cuerda_geo():
    """Cuerda amarilla de 1 bloque hacia adelante (-z: hacia donde "mira" la entidad). El hueso
    "giro" apunta como la cabeza de un mob (con la rotación de la entidad) y "cuerda" se estira
    con las animaciones de largo. Dos prismas cruzados a 45° la hacen redonda de cualquier lado."""
    g = 1.1
    uv = {"north": {"uv": [20, 0], "uv_size": [2, 2]}, "south": {"uv": [20, 0], "uv_size": [2, 2]},
          "east": {"uv": [0, 0], "uv_size": [16, 2]}, "west": {"uv": [0, 0], "uv_size": [16, 2]},
          "up": {"uv": [16, 0], "uv_size": [2, 16]}, "down": {"uv": [16, 0], "uv_size": [2, 16]}}
    cubos = [{"origin": r3([-g / 2, -g / 2, -16]), "size": r3([g, g, 16]), "uv": uv},
             {"origin": r3([-g / 2, -g / 2, -16]), "size": r3([g, g, 16]), "uv": uv, "pivot": [0, 0, 0], "rotation": [0, 0, 45]}]
    huesos = [{"name": "giro", "pivot": [0, 0, 0]},
              {"name": "cuerda", "parent": "giro", "pivot": [0, 0, 0], "cubes": cubos}]
    return geo("geometry.claudenpc.cuerda", huesos, 32, 16, bounds=(100, 100, 0))


def cuerda_textura():
    """Amarillo de cuerda: claro arriba, más oscuro abajo (alfa 170: brilla un poco, pero se ve
    sólida, no de luz)."""
    img = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    px = img.load()
    claro, medio, oscuro = (255, 230, 120), (244, 192, 52), (200, 140, 26)
    for x in range(16):
        px[x, 0] = claro + (170,)
        px[x, 1] = oscuro + (170,)
    for y in range(16):
        px[16, y] = claro + (170,)
        px[17, y] = medio + (170,)
    for x in range(2):
        for y in range(2):
            px[20 + x, y] = medio + (170,)
    return img


def ojos_marioneta_geo():
    """Ojos dorados y corazón enredado como si fueran un casco: el juego los pega a la cabeza
    ("head") y al pecho ("body") del mob por el nombre de sus huesos, así se mueven con él
    sin retraso ni parpadeo (zombis, husks, ahogados, aldeanos zombi, esqueletos, strays,
    bogged y el aldeano marioneta: todos tienen los ojos a 27,5 px y la cara a 4 px)."""
    ojo = {f: {"uv": [16, 0], "uv_size": [2, 1]} for f in FACES}
    uv_hilo = {f: {"uv": [18, 0], "uv_size": [1, 1]} for f in FACES}
    cx, cy, cz = 1.3, 19.6, -4.3  # delante del pecho, un poco a su izquierda (como un corazón)
    corazon = []
    for c in corazon_cubos(0, 0, (20, 0, 2, 2), y0=-CH / 2 * 0.42, escala=0.42):
        o = c["origin"]
        corazon.append({**c, "origin": r3([o[0] + cx, o[1] + cy, o[2] + cz])})
    hilos = []
    for ang, inc in ((0, 20), (60, -35), (120, 50)):
        r = 3.0
        for k in range(4):
            hilos.append({"origin": r3([cx - r, cy - 0.12, cz - r]), "size": r3([2 * r, 0.24, 0.24]), "uv": uv_hilo,
                          "pivot": r3([cx, cy, cz]), "rotation": [inc, ang + k * 90, 0]})
    huesos = [
        {"name": "body", "pivot": [0, 24, 0], "cubes": corazon + hilos},
        {"name": "head", "pivot": [0, 24, 0], "cubes": [
            {"origin": [-3.2, 26.8, -4.72], "size": [2.4, 1.4, 0.2], "uv": ojo},
            {"origin": [0.8, 26.8, -4.72], "size": [2.4, 1.4, 0.2], "uv": ojo}]},
    ]
    return geo("geometry.claudenpc.ojos_marioneta", huesos, 32, 16, bounds=(2, 3, 1.5))


def ojos_marioneta_textura():
    img = marioneta_textura()
    px = img.load()
    for x in range(2):
        px[16 + x, 0] = (255, 236, 96, 0)  # ojos amarillos que brillan (emisivos)
    return img


def icono_ojos():
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([1, 3, 14, 12], radius=3, fill=(40, 30, 16, 255), outline=(200, 150, 40, 255))
    for x0 in (3, 9):
        d.rectangle([x0, 6, x0 + 3, 8], fill=(255, 236, 96, 255))
        d.point((x0 + 1, 6), fill=(255, 255, 230, 255))
    return img


def inundacion_geo():
    """Inundación de rayos del parkour: una superficie morada redonda (radio 5,7 bloques) con
    rayos en zigzag que cuelgan hacia abajo y parpadean. El script la sube poco a poco."""
    rnd = random.Random(23)
    agua = {"up": {"uv": [0, 0], "uv_size": [8, 8]}, "down": {"uv": [0, 0], "uv_size": [8, 8]}}
    uv_rayo = {f: {"uv": [8, 0], "uv_size": [4, 4]} for f in FACES}
    R = 91.0
    tiras = []
    for k in range(-4, 5):
        z0 = k * 20.0 - 10
        zc = abs(k * 20.0) + (10 if k else 0)
        w = math.sqrt(max(0.0, R * R - zc * zc)) if abs(zc) < R else 0
        if w <= 4:
            continue
        tiras.append({"origin": r3([-w, 0, z0]), "size": r3([2 * w, 0, 20]), "uv": agua})
    huesos = [{"name": "raiz", "pivot": [0, 0, 0], "locators": {"centro": [0, 1, 0]}},
              {"name": "superficie", "parent": "raiz", "pivot": [0, 0, 0], "cubes": tiras}]

    def segmento(a, b, grueso):
        dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
        largo = math.sqrt(dx * dx + dy * dy + dz * dz)
        rz = math.degrees(math.atan2(dx, dy))
        rx = math.degrees(math.atan2(-dz, math.hypot(dx, dy)))
        return {"origin": r3([a[0] - grueso / 2, a[1], a[2] - grueso / 2]), "size": r3([grueso, largo, grueso]),
                "uv": uv_rayo, "pivot": r3(a), "rotation": r3([rx, 0, rz])}
    for i in range(18):
        ang = rnd.uniform(0, math.tau)
        rad = math.sqrt(rnd.uniform(0.02, 1.0)) * 80
        x, z = math.cos(ang) * rad, math.sin(ang) * rad
        pts = [(x, 6.0, z)]
        y = 6.0
        while y > -56:
            y -= rnd.uniform(10, 18)
            pts.append((x + rnd.uniform(-7, 7), y, z + rnd.uniform(-7, 7)))
        cubos = [segmento(b, a, 1.3) for a, b in zip(pts, pts[1:])]
        huesos.append({"name": f"rayo_{i}", "parent": "raiz", "pivot": r3(pts[0]), "cubes": cubos})
    return geo("geometry.claudenpc.inundacion", huesos, 16, 8, bounds=(14, 8, -1))


def inundacion_textura():
    img = Image.new("RGBA", (16, 8), (0, 0, 0, 0))
    px = img.load()
    for y in range(8):
        for x in range(8):
            t = math.hypot(x - 3.5, y - 3.5) / 5
            px[x, y] = (clamp(150 + 60 * (1 - t)), clamp(50 + 40 * (1 - t)), 255, 120)
    for y in range(4):
        for x in range(4):
            px[8 + x, y] = (246, 226, 255, 0) if 0 < x < 3 and 0 < y < 3 else (186, 84, 255, 0)
    return img


def v82():
    m = RP / "models/entity"
    write_json(m / "inundacion.geo.json", inundacion_geo())
    inundacion_textura().save(TEX / "inundacion.png")
    # Animaciones: cuerda (apuntar y largo), aldeano marioneta (brazos de marioneta y golpe) e
    # inundación (rayos que parpadean y superficie que se mueve).
    anims = {}
    anims["animation.claudenpc.aldeano.marioneta"] = {"loop": True, "bones": {
        "arms": {"rotation": ["-112 + math.sin(query.life_time * 240) * 7", "math.sin(query.life_time * 170) * 5", 0]},
        "head": {"rotation": [0, 0, "math.sin(query.life_time * 130) * 6"]}}}
    anims["animation.claudenpc.aldeano.golpe"] = {"loop": True, "bones": {
        "body": {"rotation": ["math.sin(variable.attack_time * 180) * 22", 0, 0]},
        "arms": {"rotation": ["-math.sin(variable.attack_time * 180) * 40", 0, 0]}}}
    rnd = random.Random(5)
    vivir = {"superficie": {"rotation": [0, "query.life_time * 24", 0], "position": [0, "math.sin(query.life_time * 300) * 0.5", 0]}}
    for i in range(18):
        f = round(rnd.uniform(5, 11), 2)
        fase = round(rnd.uniform(0, 1), 2)
        vivir[f"rayo_{i}"] = {"scale": f"math.mod(query.life_time * {f} + {fase}, 1.0) < 0.5 ? 1.0 : 0.0"}
    anims["animation.claudenpc.inundacion.vivir"] = {"loop": True, "bones": vivir}
    write_json(RP / "animations/marionetas_v82.animation.json", {"format_version": "1.8.0", "animations": anims})
    write_json(RP / "animation_controllers/marionetas_v82.animation_controllers.json", {"format_version": "1.10.0", "animation_controllers": {
        "controller.animation.claudenpc.inundacion.chispas": {"initial_state": "viva", "states": {"viva": {
            "particle_effects": [{"effect": "chispas", "locator": "centro"}]}}}}})
    # Entidades de cliente.
    write_json(RP / "entity/aldeano_marioneta.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:aldeano_marioneta",
        "materials": {"default": "villager_v2", "masked": "villager_v2_masked"},
        "textures": {"base": "textures/entity/villager2/villager", "plains": "textures/entity/villager2/biomes/biome_plains",
                     **{o: f"textures/entity/villager2/professions/{o}" for o in OFICIOS}},
        "geometry": {"default": "geometry.villager_v2"},
        "animations": {"mirar": "animation.common.look_at_target", "mover": "animation.villager.move",
                       "marioneta": "animation.claudenpc.aldeano.marioneta", "golpe": "animation.claudenpc.aldeano.golpe"},
        "scripts": {"scale": "0.9375", "animate": ["mirar", {"mover": "query.modified_move_speed"}, "marioneta", "golpe"]},
        "render_controllers": ["controller.render.claudenpc_aldeano_base", "controller.render.claudenpc_aldeano_oficio"],
        "enable_attachables": True}}})
    write_json(RP / "entity/inundacion.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": "claudenpc:inundacion", "materials": {"default": "entity_emissive_alpha", "agua": "entity_alphablend"},
        "textures": {"default": "textures/entity/claudenpc/inundacion"}, "geometry": {"default": "geometry.claudenpc.inundacion"},
        "animations": {"vivir": "animation.claudenpc.inundacion.vivir", "ctrl_chispas": "controller.animation.claudenpc.inundacion.chispas"},
        "particle_effects": {"chispas": "claudenpc:inundacion_chispas"},
        "scripts": {"animate": ["vivir", "ctrl_chispas"]},
        "render_controllers": ["controller.render.claudenpc_inundacion"]}}})
    write_json(RP / "render_controllers/marionetas_v82.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        "controller.render.claudenpc_aldeano_base": {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}],
                                                     "textures": ["Texture.base"]},
        "controller.render.claudenpc_aldeano_oficio": {
            "arrays": {"textures": {"Array.oficios": [f"Texture.{o}" for o in OFICIOS]}},
            "geometry": "Geometry.default", "materials": [{"*": "Material.masked"}],
            "textures": ["Texture.plains", "Array.oficios[query.variant]"]},
        "controller.render.claudenpc_inundacion": {"geometry": "Geometry.default", "textures": ["Texture.default"],
                                                   "materials": [{"*": "Material.default"}, {"superficie": "Material.agua"}]},
    }})
    # Comportamiento.
    entidad_bp("claudenpc:inundacion", ["claudenpc_inundacion"], caja=(0.05, 0.05))
    oficios = {f"claudenpc:oficio_{i}": {"minecraft:variant": {"value": i}} for i in range(len(OFICIOS))}
    jugadores = {"test": "is_family", "subject": "other", "value": "player"}
    write_json(BP / "entities/aldeano_marioneta.entity.json", {"format_version": "1.21.0", "minecraft:entity": {
        "description": {"identifier": "claudenpc:aldeano_marioneta", "is_spawnable": False, "is_summonable": True},
        "component_groups": oficios,
        "components": {
            # Sin la familia "villager": los zombis y los illagers no lo persiguen.
            "minecraft:type_family": {"family": ["claudenpc", "claudenpc_aldeano_marioneta", "mob"]},
            "minecraft:collision_box": {"width": 0.6, "height": 1.9},
            "minecraft:health": {"value": 24, "max": 24},
            "minecraft:movement": {"value": 0.32},
            "minecraft:navigation.walk": {"can_path_over_water": True, "avoid_water": True, "avoid_damage_blocks": True},
            "minecraft:movement.basic": {},
            "minecraft:jump.static": {},
            "minecraft:can_climb": {},
            "minecraft:physics": {},
            "minecraft:pushable": {"is_pushable": True, "is_pushable_by_piston": True},
            "minecraft:breathable": {"total_supply": 15, "suffocate_time": 0},
            "minecraft:nameable": {},
            "minecraft:persistent": {},
            "minecraft:attack": {"damage": 4},
            "minecraft:follow_range": {"value": 48, "max": 48},
            "minecraft:behavior.float": {"priority": 0},
            # Solo ataca a jugadores (nunca a otros mobs).
            "minecraft:behavior.nearest_attackable_target": {"priority": 1, "must_see": False, "reselect_targets": True,
                                                             "within_radius": 48.0,
                                                             "entity_types": [{"filters": jugadores, "max_dist": 48}]},
            "minecraft:behavior.melee_attack": {"priority": 2, "speed_multiplier": 1.25, "track_target": True},
            "minecraft:behavior.random_stroll": {"priority": 6, "speed_multiplier": 0.8},
            "minecraft:behavior.look_at_player": {"priority": 7, "look_distance": 8},
            "minecraft:behavior.random_look_around": {"priority": 8},
        },
        "events": {"minecraft:entity_spawned": {"randomize": [
            {"weight": 1, "add": {"component_groups": [f"claudenpc:oficio_{i}"]}} for i in range(len(OFICIOS))]}},
    }})
