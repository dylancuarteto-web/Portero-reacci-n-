"""Borra la decoración morada del nivel y genera una decoración dorada.

Uso:
    python3 generar_decoracion.py nivel_original_backup.gdlvl referencia_objetos.gdlvl nivel_decorado.gdlvl

El original nunca se modifica: solo se lee.
"""
import base64
import gzip
import json
import re
import struct
import sys
import zlib
from collections import Counter, deque

# ---------------------------------------------------------------- formato .gdlvl

def decode(s):
    s = s.strip()
    return gzip.decompress(base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))).decode()


def encode(text):
    # Mismo formato que escribe GD: cabecera gzip con mtime 0, XFL 0, OS 3.
    data = text.encode()
    comp = zlib.compressobj(9, zlib.DEFLATED, -15)
    raw = comp.compress(data) + comp.flush()
    gz = (b'\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\x03' + raw
          + struct.pack('<II', zlib.crc32(data) & 0xffffffff, len(data) & 0xffffffff))
    return base64.urlsafe_b64encode(gz).decode()


def read_level(path):
    outer = decode(open(path).read())
    inner = decode(re.search(r'<k>k4</k><s>([^<]*)</s>', outer).group(1))
    parts = inner.split(';')
    header, raws = parts[0], [p for p in parts[1:] if p]
    objs = []
    for raw in raws:
        kv = raw.split(',')
        objs.append(dict(zip(kv[0::2], kv[1::2])))
    return outer, header, raws, objs


def obj_str(o):
    keys = ['1', '2', '3'] + [k for k in o if k not in ('1', '2', '3')]
    return ','.join(f'{k},{o[k]}' for k in keys)


def fmt(v):
    v = round(float(v), 3)
    return str(int(v)) if v == int(v) else str(v)


# ---------------------------------------------------------------- clasificación

# Gameplay y triggers que se conservan siempre.
GAMEPLAY = {
    '467': 'bloque sólido (plataformas/paredes)', '8': 'pincho', '39': 'pincho pequeño',
    '36': 'orbe amarillo', '84': 'orbe azul', '141': 'orbe rosa', '1332': 'pad rojo',
    '200': 'velocidad lenta', '201': 'velocidad normal', '203': 'velocidad x3',
    '99': 'portal tamaño normal', '101': 'portal mini', '10': 'portal gravedad azul',
    '11': 'portal gravedad amarilla',
}
TRIGGERS = {
    '901': 'trigger de movimiento', '1006': 'trigger de pulso', '899': 'trigger de color',
    '1934': 'trigger de canción', '2913': 'trigger de cámara (zoom)', '2915': 'trigger de cámara (estática)',
}
# Dudosos: se conservan sin tocar (decisión del usuario).
DUDOSOS = {
    '1275': 'llave (recogible)', '186': 'objeto giratorio', '187': 'objeto giratorio',
    '1734': 'objeto giratorio', '1722': 'objeto en el suelo', '1719': 'objeto en el suelo',
    '1720': 'objeto en el suelo', '481': 'objeto desconocido', '507': 'objeto desconocido',
    '103': 'objeto desconocido', '3884': 'objeto 2.2 desconocido', '3890': 'objeto 2.2 desconocido',
    '1743': 'objeto dentro de la torre (grupo 1)',
}
DECO = {
    '50': 'círculos/brillos decorativos', '1011': 'glow de borde', '1': 'bloque básico escalado usado como dibujo',
    '20': 'pincho decorativo', '21': 'pincho decorativo', '19': 'pincho decorativo grande',
    '54': 'destellos decorativos', '51': 'anillos decorativos', '53': 'brillos grandes de fondo',
    '3638': 'detalle 2.2 de borde', '1820': 'relleno decorativo', '1753': 'detalle de contorno',
    '1754': 'detalle de contorno', '1886': 'glow', '3827': 'glow 2.2', '1888': 'glow de esquina',
    '1887': 'glow cuadrado', '41': 'cadenas colgantes', '413': 'cuadrado con bisel', '410': 'cuadrado con bisel',
}

# ---------------------------------------------------------------- paleta

PALETA = {  # canal: (hex, opacidad, blending)
    50: ('FFD700', 1.0, 0),   # dorado brillante: borde principal, torre, pinchos altos
    51: ('FFE066', 0.8, 1),   # amarillo suave: glow de esquina y brillos
    52: ('B8860B', 1.0, 0),   # dorado oscuro: sombras y degradados
    53: ('FFF8E1', 0.9, 1),   # blanco cálido: destellos pequeños
    54: ('0D1B3E', 0.9, 0),   # azul marino muy oscuro: relleno
    55: ('1B2A4F', 0.7, 0),   # azul marino medio: paneles
    56: ('000000', 1.0, 0),   # negro: huecos e interior de la puerta
}
GOLD, YELLOW, DGOLD, WARM, NAVY, NAVY2, BLACK = 50, 51, 52, 53, 54, 55, 56
# Canales del juego que se redefinen (los demás canales especiales no se tocan).
CANALES_JUEGO = {
    1000: ('0A0F1E', 1.0, 0),  # fondo
    1001: ('0D1B3E', 1.0, 0),  # suelo
    1009: ('000000', 1.0, 0),  # suelo 2
    1013: ('0A0F1E', 1.0, 0),  # middleground
    1014: ('0D1B3E', 1.0, 0),  # middleground 2
    1002: ('FFD700', 1.0, 1),  # línea del suelo
    1004: ('FFD700', 1.0, 0),  # color de objeto: pinchos y bloques de juego visibles
    1010: ('000000', 1.0, 0),
    1011: ('FFF8E1', 1.0, 0),
    1: ('000000', 1.0, 0),     # copias escaladas del bloque 467: contorno oscuro
}

# Pulsos existentes (sincronizados con la música): canal viejo -> (canal nuevo, color del flash)
PULSOS = {
    '1004': ('1004', 'FFF8E1'), '1000': ('1000', '1B2A4F'), '2': ('50', 'FFE066'),
    '21': ('51', 'FFF8E1'), '1002': ('1002', 'FFF8E1'), '40': ('52', 'FFD700'),
    '22': ('53', 'FFE066'), '1': ('1', '1B2A4F'), '1013': ('1013', '1B2A4F'),
    '12': ('55', 'FFE066'), '10': ('54', '1B2A4F'), '23': ('51', 'FFE066'), '44': ('50', 'FFF8E1'),
}
# Triggers de color iniciales: canal -> color
COLOR_INICIAL = {'1000': '0A0F1E', '1001': '0D1B3E', '1009': '000000', '1013': '0A0F1E', '1002': 'FFD700'}


def rgb(h):
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def color_entry(ch, hexc, opa, blend):
    r, g, b = rgb(hexc)
    s = f'1_{r}_2_{g}_3_{b}_11_255_12_255_13_255_4_-1_6_{ch}'
    if blend:
        s += '_5_1'
    return s + f'_7_{fmt(opa)}_15_1_18_0_8_1'


# ---------------------------------------------------------------- pasos del tutorial
# Mapeo de los objetos de referencia_objetos.gdlvl a cada paso (mejor suposición, ver cambios.md).
PASOS = {
    11: ('Contorno', ['469', '471', '1265', '1263', '1203', '1157']),
    12: ('Relleno', ['211']),
    13: ('Detalles del contorno', ['1292', '1010', '1009', '503', '504']),
    14: ('Detalles interiores', ['190', '231', '237', '1735', '1909', '326', '1754', '884', '1279']),
    15: ('Más detalles', ['3035', '3034', '3042', '3046']),
    16: ('Detalles finales', ['1887', '1886', '2974', '505', '504']),
    17: ('Pinchos + cuadrados', ['3048', '3044', '3047', '3043', '3045', '3049']),
    18: ('Glow T3 + glow de esquina', ['2974', '1887', '504']),
}
B4, B3, B2, B1, T1, T2, T3 = -3, -1, 1, 3, 5, 7, 9  # valores de capa Z


def main(src, ref, dst):
    outer, header, raws, objs = read_level(src)
    _, _, _, ref_objs = read_level(ref)
    ref_meta = {}
    for o in ref_objs:
        ref_meta.setdefault(o['1'], {k: o[k] for k in ('155', '156') if k in o})
    permitidos = set(ref_meta)

    # ---------------- paso 1: separar gameplay / decoración
    keep_raw, borrados, conservados = [], Counter(), Counter()
    for raw, o in zip(raws, objs):
        oid = o['1']
        if oid in DECO:
            borrados[oid] += 1
            continue
        if oid not in GAMEPLAY and oid not in TRIGGERS and oid not in DUDOSOS:
            raise SystemExit(f'Objeto sin clasificar: {oid}')
        conservados[oid] += 1
        if oid == '1006':
            nuevo, color = PULSOS[o['51']]
            o['51'] = nuevo
            o['7'], o['8'], o['9'] = map(str, rgb(color))
            o['47'] = fmt(min(0.3, max(0.1, float(o.get('47', '0.2')))))
            raw = obj_str(o)
        elif oid == '899':
            o['7'], o['8'], o['9'] = map(str, rgb(COLOR_INICIAL[o['23']]))
            raw = obj_str(o)
        keep_raw.append((raw, o))

    # ---------------- paso 2: geometría del gameplay
    bloques = {}
    for _, o in keep_raw:
        if o['1'] != '467' or float(o['3']) < 0:  # lo que está bajo el suelo no se ve
            continue
        p = (float(o['2']), float(o['3']))
        g1 = '1' in o.get('57', '').split('.')
        bloques[p] = bloques.get(p, False) or g1
    celdas = set(bloques)
    gameplay_pts = [(float(o['2']), float(o['3'])) for _, o in keep_raw
                    if o['1'] not in TRIGGERS and o['1'] != '467']

    def hay(x, y):
        return (x, y) in celdas

    nuevos = []

    def add(oid, x, y, paso, ch, z, zo, rot=0, sx=1.0, sy=None, grupo=None, ch2=None, flipx=False):
        assert oid in permitidos, oid
        assert oid in PASOS[paso][1], (oid, paso)
        o = {'1': oid, '2': fmt(x), '3': fmt(y)}
        o.update(ref_meta[oid])
        if rot % 360:
            o['6'] = fmt(rot % 360)
        if flipx:
            o['4'] = '1'
        o['20'] = str(paso)
        o['21'] = str(ch)
        if ch2:
            o['22'] = str(ch2)
        o['24'] = str(z)
        o['25'] = str(zo)
        sy = sx if sy is None else sy
        if sx != 1.0 or sy != 1.0:
            o['128'], o['129'] = fmt(sx), fmt(sy)
        if grupo:
            o['57'] = grupo
        nuevos.append(o)

    # Calibrado con el video del nivel: 471 sin girar es una línea en el borde DERECHO,
    # 469 sin girar es "┌", 3034 es un triángulo de contorno de 1 bloque que apunta arriba,
    # los triángulos 3043-3049 miden medio bloque a escala 1.
    LADOS = {'R': (30, 0, 0), 'D': (0, -30, 90), 'L': (-30, 0, 180), 'U': (0, 30, 270)}
    HACIA_FUERA = {'U': (0, 1, 0), 'R': (1, 0, 90), 'D': (0, -1, 180), 'L': (-1, 0, 270)}
    ESQUINAS = [('L', 'U', 0), ('U', 'R', 90), ('R', 'D', 180), ('D', 'L', 270)]
    MEDIO = 15  # tamaño de los triángulos 3043-3049 a escala 1

    # Torre del grupo 1: columna central = puerta.
    torre = {p for p, g in bloques.items() if g}
    puerta_x = 315.0
    puerta = {p for p in torre if p[0] == puerta_x and p[1] < max(y for _, y in torre)}

    # Celdas con otro objeto conservado dentro (481, 507...): no se tapan.
    ocupadas = {(x, y) for (x, y) in celdas
                if any(abs(px - x) <= 15 and abs(py - y) <= 15 for px, py in gameplay_pts)}

    # Profundidad de cada celda (0 = borde) y estructuras conectadas.
    prof, cola = {}, deque()
    for (x, y) in celdas:
        if any(not hay(x + dx, y + dy) for dx, dy, _ in LADOS.values()):
            prof[(x, y)] = 0
            cola.append((x, y))
    while cola:
        x, y = cola.popleft()
        for dx, dy, _ in LADOS.values():
            n = (x + dx, y + dy)
            if n in celdas and n not in prof:
                prof[n] = prof[(x, y)] + 1
                cola.append(n)
    estructura, estructuras = {}, []
    for c in sorted(celdas):
        if c in estructura:
            continue
        comp, pila = [], [c]
        estructura[c] = len(estructuras)
        while pila:
            x, y = pila.pop()
            comp.append((x, y))
            for dx, dy, _ in LADOS.values():
                n = (x + dx, y + dy)
                if n in celdas and n not in estructura:
                    estructura[n] = len(estructuras)
                    pila.append(n)
        estructuras.append(comp)

    def pincho(x, base_y, s, grupo, rot=0, paso=17, contorno=True):
        # Pincho del tutorial: 5 triángulos apilados (claro -> oscuro) + contorno.
        sgn = 1 if rot == 0 else -1
        cy = base_y + sgn * MEDIO / 2 * s
        add('3044', x, cy, paso, DGOLD, T3, 10, rot=rot, sx=s, grupo=grupo)
        add('3047', x, cy, paso, GOLD, T3, 11, rot=rot, sx=s * 0.92, grupo=grupo)
        add('3043', x, cy + sgn * 1.5 * s, paso, YELLOW, T3, 12, rot=rot, sx=s * 0.8, grupo=grupo)
        add('3045', x, cy, paso, GOLD, T3, 13, rot=rot, sx=s, grupo=grupo)
        add('3049', x, base_y + sgn * 3.5 * s, paso, BLACK, T3, 14, rot=rot, sx=s * 0.45, grupo=grupo)
        if contorno:
            add('3034', x, cy, 15, GOLD, T3, 15, rot=rot, sx=s * MEDIO / 30, grupo=grupo)

    def rombo(x, y, s, grupo, ch=GOLD):
        # Rombo hecho con dos triángulos de contorno (uno arriba, otro abajo).
        h = 30 * s
        add('3034', x, y + h / 2, 15, ch, T3, 6, sx=s, grupo=grupo)
        add('3034', x, y - h / 2, 15, ch, T3, 6, rot=180, sx=s, grupo=grupo)

    # Rasgos de cada estructura grande: interior, esquinas reales del interior y celda del rombo.
    rasgos = []
    for comp in estructuras:
        interior = [c for c in comp if prof[c] >= 1 and c not in ocupadas]
        if not interior or set(comp) & torre:
            continue
        y0, y1 = min(y for _, y in interior), max(y for _, y in interior)
        arriba = sorted(x for x, y in interior if y == y1)
        abajo = sorted(x for x, y in interior if y == y0)
        esquinas = [(arriba[0], y1, -1, 1), (arriba[-1], y1, 1, 1), (abajo[0], y0, -1, -1), (abajo[-1], y0, 1, -1)]
        centro = (arriba[len(arriba) // 2], y1) if len(arriba) >= 3 else None
        rasgos.append((comp, interior, esquinas, centro))
    centros = {r[3] for r in rasgos if r[3]}

    for (x, y), g1 in sorted(bloques.items()):
        if (x, y) in ocupadas:
            continue
        grp = '1' if g1 else None
        d = prof[(x, y)]
        maxd = max(prof[c] for c in estructuras[estructura[(x, y)]])
        expuesto = {k: not hay(x + dx, y + dy) for k, (dx, dy, _) in LADOS.items()}
        en_suelo = y - 15 <= 0
        es_puerta = (x, y) in puerta

        # Relleno: borde en azul marino, interior y puerta en negro (estilo "dark").
        add('211', x, y, 12, BLACK if (d >= 1 or es_puerta) else NAVY, T2, 0, grupo=grp)

        # Ladrillo en el interior.
        if d >= 1 and not es_puerta:
            add('3046', x, y, 15, NAVY2, T2, 2, grupo=grp)

        # Contorno exterior: L en esquinas, línea en cada lado suelto.
        usados = set()
        for a, b, rot in ESQUINAS:
            if expuesto[a] and expuesto[b] and not usados & {a, b}:
                add('469', x, y, 11, GOLD, T3, 5, rot=rot, grupo=grp)
                usados |= {a, b}
        for lado, (_, _, rot) in LADOS.items():
            if expuesto[lado] and lado not in usados:
                add('471', x, y, 11, GOLD, T3, 5, rot=rot, grupo=grp)
        if usados:
            add('3048', x, y, 17, GOLD, T2, 5, sx=0.6, grupo=grp, ch2=NAVY)

        # Contorno interior (marco doble del tutorial): línea donde el interior toca el borde.
        if d == 1 and not es_puerta:
            for lado, (dx, dy, rot) in LADOS.items():
                if prof.get((x + dx, y + dy)) == 0:
                    add('471', x, y, 11, DGOLD, T3, 4, rot=rot, grupo=grp)

        # Borde dentado: dientes pequeños apuntando hacia fuera, dentro del bloque.
        if d == 0:
            for lado, (nx, ny, rot) in HACIA_FUERA.items():
                if not expuesto[lado] or (lado == 'D' and en_suelo):
                    continue
                for t in (-7.5, 7.5):
                    cx = x + nx * 10.5 + (0 if nx else t)
                    cy = y + ny * 10.5 + (0 if ny else t)
                    add('3034', cx, cy, 15, DGOLD, T3, 3, rot=rot, sx=0.3, grupo=grp)
            # Luces con degradado en las paredes laterales.
            pilar = expuesto['L'] and expuesto['R']
            if expuesto['L'] and not pilar:
                add('1292', x, y, 13, DGOLD, T2, 4, rot=0, grupo=grp)
            if expuesto['R'] and not pilar:
                add('1292', x, y, 13, DGOLD, T2, 4, rot=180, grupo=grp)
            # Pilares de 1 bloque: cadena de rombos por el centro.
            if expuesto['L'] and expuesto['R'] and not (expuesto['U'] and expuesto['D']) and maxd == 0:
                add('231' if int((y - 15) // 30) % 2 == 0 else '237', x, y, 14, DGOLD, T3, 2, sx=0.6, grupo=grp)

        # Triángulos del tutorial en las columnas laterales del interior: ▲ y ▼ alternados.
        if d == 1 and not es_puerta and (x, y) not in centros and (prof.get((x - 30, y)) == 0 or prof.get((x + 30, y)) == 0):
            arriba = int((y - 15) // 30) % 2 == 0
            pincho(x, y - 13 if arriba else y + 13, 1.7, grp, rot=0 if arriba else 180)

    # Detalles por estructura grande (rombo central, glow, destellos, engranaje).
    for comp, interior, esquinas, centro in rasgos:
        grp = None
        (xa, ya, _, _), (xb, yb, _, _) = esquinas[0], esquinas[1]
        add('505', xa, ya, 16, YELLOW, T3, 1, sx=0.9, grupo=grp)
        add('505', xb, yb, 16, YELLOW, T3, 1, sx=0.9, grupo=grp, flipx=True)
        for cx, cy, sx_, sy_ in esquinas:
            add('884', cx + 8 * sx_, cy + 8 * sy_, 14, WARM, T3, 20, sx=0.5, grupo=grp)
        if centro:
            rombo(*centro, 0.5, grp)
            rombo(*centro, 0.3, grp, ch=YELLOW)
        if max(prof[c] for c in comp) >= 2:
            x0, x1 = min(x for x, _ in interior), max(x for x, _ in interior)
            cx, cy = max(interior, key=lambda c: (prof[c], -abs(c[0] - (x0 + x1) / 2)))
            add('505', cx, cy, 16, YELLOW, T3, 1, sx=1.2, grupo=grp)
            add('1735', cx, cy, 14, GOLD, T3, 3, sx=1.1, grupo=grp)

    # ---------------- la torre (elemento central)
    ys = sorted({y for _, y in torre})
    top = ys[-1]
    base_top = max(y for (x, y) in torre if x == min(x for x, _ in torre))
    xs_col = sorted({x for x, y in torre if y == top})
    base = sorted(p for p in torre if p[1] <= base_top)
    bx0, bx1 = min(x for x, _ in base), max(x for x, _ in base)

    # Puerta: líneas a los lados, marco arriba, "|||" y engranajes.
    for (x, y) in sorted(puerta):
        add('1157', x, y, 11, GOLD, T3, 6, rot=0, grupo='1')
        add('1157', x, y, 11, GOLD, T3, 6, rot=180, grupo='1')
    yp = max(y for _, y in puerta)
    add('1203', puerta_x, yp, 11, GOLD, T3, 6, rot=0, grupo='1')
    add('1203', puerta_x, yp, 11, GOLD, T3, 6, rot=90, grupo='1')
    add('1265', puerta_x - 13, yp + 13, 11, WARM, T3, 7, grupo='1')
    add('1263', puerta_x + 13, yp + 13, 11, WARM, T3, 7, grupo='1')
    for dx in (-6, 0, 6):
        add('3042', puerta_x + dx, yp - 4, 15, GOLD, T3, 3, sx=0.5, grupo='1')
    for gy, dx in ((ys[-3], 6), (ys[2], -6)):
        add('505', puerta_x + dx, gy, 16, YELLOW, T3, 1, sx=1.1, grupo='1')
        add('1735', puerta_x + dx, gy, 14, GOLD, T3, 3, sx=1.0, grupo='1')

    # Cadena de rombos a los lados de la columna.
    for x in (xs_col[0], xs_col[-1]):
        for i, y in enumerate(y for y in ys if base_top < y < top):
            add('231' if i % 2 == 0 else '237', x, y, 14, DGOLD, T3, 2, sx=0.8, grupo='1')

    # Rombo grande arriba de la columna y glow en las esquinas.
    rombo(puerta_x, top, 0.6, '1')
    rombo(puerta_x, top, 0.35, '1', ch=YELLOW)
    add('505', bx0, base_top, 16, YELLOW, T3, 1, grupo='1')
    add('505', bx1, base_top, 16, YELLOW, T3, 1, grupo='1', flipx=True)
    for x, y in ((xs_col[0] - 8, top + 8), (xs_col[-1] + 8, top + 8), (bx0 - 8, base_top + 8), (bx1 + 8, base_top + 8)):
        add('884', x, y, 14, WARM, T3, 20, sx=0.6, grupo='1')

    # Pinchos grandes encima de la torre (suben con el grupo 1): grande, más grande, pequeño.
    techo = top + 15
    for x, s in zip(xs_col, (3.0, 3.8, 2.4)):
        pincho(x, techo, s, '1')

    # Glow T3: líneas de brillo por fuera de la columna (dentro de sus bloques).
    for x in (xs_col[0] - 14, xs_col[-1] + 14):
        for y in ys:
            if y > base_top:
                add('2974', x, y, 18, YELLOW, T3, 4, grupo='1')

    # ---------------- decoración que rebota con la música (grupos 101-106 ya existentes)
    colgantes = []
    for o in objs:
        gs = o.get('57', '').split('.')
        g = next((g for g in gs if g in {'101', '102', '103', '104', '105', '106'}), None)
        if g and o['1'] == '1':
            colgantes.append((float(o['2']), float(o['3']), g))
    vistos, saltados = set(), []
    alto_torre = top + 15 + 75 + 60  # techo de la torre levantada + pinchos
    for x, y, g in colgantes:
        if (x, y) in vistos:
            continue
        vistos.add((x, y))
        cerca = any(abs(px - x) < 45 and y - 58 - 75 < py < y + 45 for px, py in gameplay_pts) \
            or any(abs(px - x) < 45 and y - 58 - 75 < py < y + 45 for px, py in celdas) \
            or (min(x for x, _ in torre) - 45 < x < max(x for x, _ in torre) + 45 and y - 58 - 30 < alto_torre)
        if cerca:
            saltados.append((x, y, g))
            continue
        add('2974', x, y + 45, 16, DGOLD, T3, 0, sy=2.0, grupo=g)
        add('505', x, y + 8, 16, YELLOW, T3, 1, sx=0.7, grupo=g)
        pincho(x, y + 15, 1.8, g, rot=180)

    # ---------------- cabecera y colores
    hparts = header.split(',')
    i = hparts.index('kS38')
    entradas = [c for c in hparts[i + 1].split('|') if c]
    nuevas = []
    for c in entradas:
        kv = c.split('_')
        ch = int(dict(zip(kv[0::2], kv[1::2]))['6'])
        if ch in CANALES_JUEGO:
            nuevas.append(color_entry(ch, *CANALES_JUEGO[ch]))
        elif ch >= 1000:
            nuevas.append(c)
    for ch, val in PALETA.items():
        nuevas.append(color_entry(ch, *val))
    hparts[i + 1] = '|'.join(nuevas) + '|'
    new_header = ','.join(hparts)

    final = [raw for raw, _ in keep_raw] + [obj_str(o) for o in nuevos]
    inner = new_header + ';' + ';'.join(final) + ';'
    new_outer = re.sub(r'(<k>k4</k><s>)[^<]*(</s>)', lambda m: m.group(1) + encode(inner) + m.group(2), outer)
    new_outer = re.sub(r'(<k>k48</k><i>)\d+(</i>)', lambda m: m.group(1) + str(len(final)) + m.group(2), new_outer)
    open(dst, 'w').write(encode(new_outer))

    stats = {
        'borrados': dict(borrados), 'conservados': dict(conservados),
        'nuevos_por_paso': {PASOS[k][0]: v for k, v in sorted(Counter(int(o['20']) for o in nuevos).items())},
        'nuevos_por_id': dict(Counter(o['1'] for o in nuevos)),
        'colgantes_saltados': saltados, 'total_final': len(final),
        'torre': {'celdas': len(torre), 'puerta': len(puerta)},
    }
    print(json.dumps(stats, indent=1))


if __name__ == '__main__':
    main(*sys.argv[1:4])
