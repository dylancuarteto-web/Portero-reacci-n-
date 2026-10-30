"""Dibuja cada entidad del addon (frente, lado y espalda) con su textura y geometría.

Uso:
    python3 herramientas/vista_previa.py [carpeta_del_addon] [--salida vistas.png] [--solo za:zombie_minero]

Necesita Pillow (pip install pillow). Es una vista ortográfica en pose de reposo,
sin animaciones ni iluminación: sirve para ver si la textura encaja en el modelo,
si hay caras vacías o estiradas, y cómo se ven los zombies uno al lado del otro.
Si falta la textura, dibuja el cuadriculado morado y negro que pone el juego.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from validar import cargar_geometrias, quitar_comentarios  # noqa: E402

ESCALA = 6  # píxeles por unidad del modelo (1 bloque = 16 unidades)


def tablero_faltante(w, h):
    img = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(img)
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            d.rectangle([x, y, x + 3, y + 3], fill=(248, 0, 248, 255) if (x + y) // 4 % 2 else (0, 0, 0, 255))
    return img


def recorte(tex, sx, sy, x, y, w, h, voltear):
    if w <= 0 or h <= 0:
        return None
    caja = (round(x * sx), round(y * sy), round((x + w) * sx), round((y + h) * sy))
    if caja[2] <= caja[0] or caja[3] <= caja[1]:
        return None
    parte = tex.crop(caja)
    return parte.transpose(Image.FLIP_LEFT_RIGHT) if voltear else parte


def caras(cubo, espejo):
    """Devuelve las regiones UV (x, y, w, h) de frente, lado derecho (-x), lado izquierdo (+x) y espalda."""
    w, h, d = cubo['size']
    u, v = cubo.get('uv', [0, 0]) if isinstance(cubo.get('uv', [0, 0]), list) else (0, 0)
    derecho = (u, v + d, d, h)
    frente = (u + d, v + d, w, h)
    izquierdo = (u + d + w, v + d, d, h)
    espalda = (u + 2 * d + w, v + d, w, h)
    if espejo:
        derecho, izquierdo = izquierdo, derecho
    return frente, derecho, izquierdo, espalda


def dibujar(geo, tex, vista):
    cubos = []
    for hueso in geo.get('bones') or []:
        if hueso.get('neverRender'):
            continue
        for c in hueso.get('cubes', []):
            cubos.append((c, c.get('mirror', hueso.get('mirror', False))))
    if not cubos:
        return None
    infl = lambda c: c.get('inflate', 0)
    def limites(c):
        (x, y, z), (w, h, d), i = c['origin'], c['size'], infl(c)
        return x - i, y - i, z - i, x + w + i, y + h + i, z + d + i
    todos = [limites(c) for c, _ in cubos]
    x0, y0, z0 = (min(b[k] for b in todos) for k in range(3))
    x1, y1, z1 = (max(b[k] for b in todos) for k in range(3, 6))
    ancho = (x1 - x0) if vista in ('frente', 'espalda') else (z1 - z0)
    lienzo = Image.new('RGBA', (int(ancho * ESCALA) + 2, int((y1 - y0) * ESCALA) + 2), (0, 0, 0, 0))
    sx, sy = tex.width / geo['tw'], tex.height / geo['th']
    # Lo más lejano primero.
    if vista == 'frente':
        orden = sorted(cubos, key=lambda c: -limites(c[0])[2])
    elif vista == 'espalda':
        orden = sorted(cubos, key=lambda c: limites(c[0])[5])
    else:
        orden = sorted(cubos, key=lambda c: -limites(c[0])[0])
    for c, espejo in orden:
        bx0, by0, bz0, bx1, by1, bz1 = limites(c)
        frente, derecho, izquierdo, espalda = caras(c, espejo)
        if vista == 'frente':
            region, voltear, izq, der = frente, espejo, bx0 - x0, bx1 - x0
        elif vista == 'espalda':
            region, voltear, izq, der = espalda, not espejo, x1 - bx1, x1 - bx0
        else:  # visto desde la derecha de la entidad: el frente queda a la izquierda
            region, voltear, izq, der = derecho, not espejo, bz0 - z0, bz1 - z0
        parte = recorte(tex, sx, sy, *region, voltear)
        if parte is None:
            continue
        caja = (int(izq * ESCALA), int((y1 - by1) * ESCALA), int(der * ESCALA), int((y1 - by0) * ESCALA))
        if caja[2] > caja[0] and caja[3] > caja[1]:
            parte = parte.resize((caja[2] - caja[0], caja[3] - caja[1]), Image.NEAREST)
            lienzo.alpha_composite(parte, (caja[0], caja[1]))
    return lienzo


def main():
    args = sys.argv[1:]
    raiz = Path(__file__).resolve().parent.parent
    salida = raiz / 'dist' / 'vistas.png'
    solo = None
    if '--salida' in args:
        salida = Path(args[args.index('--salida') + 1]).resolve()
        del args[args.index('--salida'):args.index('--salida') + 2]
    if '--solo' in args:
        solo = args[args.index('--solo') + 1]
        del args[args.index('--solo'):args.index('--solo') + 2]
    base = Path(args[0]).resolve() if args else raiz / 'Zombie_Apocalypse'
    rp = base / 'resource_pack'
    geos = cargar_geometrias([raiz / 'herramientas' / 'vanilla', rp])

    filas = []
    for ruta in sorted((rp / 'entity').glob('*.json')):
        d = json.loads(quitar_comentarios(ruta.read_text(encoding='utf-8-sig')))
        desc = d.get('minecraft:client_entity', {}).get('description', {})
        ident = desc.get('identifier')
        if solo and ident != solo:
            continue
        geo = geos.get(desc.get('geometry', {}).get('default'))
        tex_ruta = desc.get('textures', {}).get('default', '')
        png = next((rp / f'{tex_ruta}{e}' for e in ('.png', '.tga') if (rp / f'{tex_ruta}{e}').exists()), None)
        if not geo or not geo.get('bones'):
            print(f'{ident}: geometría {desc.get("geometry")} no encontrada, se salta')
            continue
        tex = Image.open(png).convert('RGBA') if png else tablero_faltante(geo['tw'], geo['th'])
        vistas = [dibujar(geo, tex, v) for v in ('frente', 'lado', 'espalda')]
        filas.append((ident, png is not None, vistas, tex.size, (geo['tw'], geo['th'])))

    if not filas:
        sys.exit('No hay entidades que dibujar.')
    alto_fila = max(max(v.height for v in vs if v) for _, _, vs, _, _ in filas) + 30
    ancho = max(sum(v.width + 20 for v in vs if v) for _, _, vs, _, _ in filas) + 20
    columnas = 2 if len(filas) > 4 else 1
    nfilas = (len(filas) + columnas - 1) // columnas
    hoja = Image.new('RGBA', (ancho * columnas, alto_fila * nfilas), (24, 26, 32, 255))
    d = ImageDraw.Draw(hoja)
    for i, (ident, tiene_tex, vistas, tam, tam_geo) in enumerate(filas):
        ox, oy = (i % columnas) * ancho + 10, (i // columnas) * alto_fila + 4
        nota = '' if tiene_tex else '  (SIN TEXTURA)'
        if tiene_tex and tam[0] * tam_geo[1] != tam[1] * tam_geo[0]:
            nota = f'  (textura {tam[0]}x{tam[1]}, el modelo espera {tam_geo[0]}x{tam_geo[1]})'
        d.text((ox, oy), ident + nota, fill=(255, 220, 120, 255) if nota else (230, 230, 230, 255))
        x = ox
        for v in vistas:
            if v:
                hoja.alpha_composite(v, (x, oy + 20))
                x += v.width + 20
    salida.parent.mkdir(parents=True, exist_ok=True)
    hoja.convert('RGB').save(salida)
    print(f'Vista previa guardada en {salida}')


if __name__ == '__main__':
    main()
