"""Valida un addon de Minecraft Bedrock antes de probarlo en el juego.

Uso:
    python3 herramientas/validar.py [carpeta_del_addon]

La carpeta debe contener behavior_pack/ y resource_pack/ (por defecto: Zombie_Apocalypse).
Sale con código 1 si hay errores (cosas que el juego va a mostrar mal o rechazar).
Los avisos son cosas que conviene revisar pero que no rompen el addon.
"""
import json
import re
import struct
import sys
import uuid
from pathlib import Path

errores, avisos = [], []


def error(archivo, msg):
    errores.append(f'ERROR  {archivo}: {msg}')


def aviso(archivo, msg):
    avisos.append(f'AVISO  {archivo}: {msg}')


# ---------------------------------------------------------------- lectura de JSON

def quitar_comentarios(texto):
    # Bedrock acepta comentarios // y /* */ en sus JSON; json de Python no.
    out, i, n, en_cadena = [], 0, len(texto), False
    while i < n:
        c = texto[i]
        if en_cadena:
            out.append(c)
            if c == '\\' and i + 1 < n:
                out.append(texto[i + 1])
                i += 1
            elif c == '"':
                en_cadena = False
        elif c == '"':
            en_cadena = True
            out.append(c)
        elif texto.startswith('//', i):
            while i < n and texto[i] != '\n':
                i += 1
            continue
        elif texto.startswith('/*', i):
            fin = texto.find('*/', i + 2)
            out.append(re.sub(r'[^\n]', ' ', texto[i:fin + 2]))
            i = fin + 2
            continue
        else:
            out.append(c)
        i += 1
    return ''.join(out)


def leer_json(ruta, base):
    rel = ruta.relative_to(base)
    try:
        texto = ruta.read_text(encoding='utf-8-sig')
    except UnicodeDecodeError:
        error(rel, 'no está en UTF-8')
        return None
    try:
        return json.loads(quitar_comentarios(texto))
    except json.JSONDecodeError as e:
        error(rel, f'JSON inválido en línea {e.lineno}, columna {e.colno}: {e.msg}')
        return None


def jsons(carpeta, base):
    datos = {}
    for ruta in sorted(carpeta.rglob('*.json')):
        d = leer_json(ruta, base)
        if d is not None:
            datos[ruta] = d
    return datos


def cargar_geometrias(carpetas):
    geos = {}
    for carpeta in carpetas:
        for ruta in sorted(Path(carpeta).rglob('*.json')):
            try:
                d = json.loads(quitar_comentarios(ruta.read_text(encoding='utf-8-sig')))
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if not isinstance(d, dict):
                continue
            for g in d.get('minecraft:geometry', []):
                desc = g.get('description', {})
                geos[desc.get('identifier')] = {
                    'bones': g.get('bones', []),
                    'tw': desc.get('texture_width', 64), 'th': desc.get('texture_height', 64)}
            for clave, g in d.items():
                if clave.startswith('geometry.'):
                    nombre, _, padre = clave.partition(':')
                    geos[nombre] = {'bones': g.get('bones'), 'tw': g.get('texturewidth'),
                                    'th': g.get('textureheight'), 'padre': padre or None}
    # Resolver herencia "geometry.hijo:geometry.padre".
    def resolver(nombre, vistos=()):
        g = dict(geos.get(nombre) or {})
        if g.get('padre') and g['padre'] not in vistos:
            p = resolver(g['padre'], vistos + (nombre,))
            for k in ('bones', 'tw', 'th'):
                if g.get(k) is None:
                    g[k] = p.get(k)
        g['tw'] = g.get('tw') or 64
        g['th'] = g.get('th') or 64
        return g
    return {n: resolver(n) for n in geos}


def tam_png(ruta):
    with open(ruta, 'rb') as f:
        cab = f.read(24)
    if cab[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    return struct.unpack('>II', cab[16:24])


def existe_textura(rp, ruta_sin_ext):
    return any((rp / f'{ruta_sin_ext}{ext}').exists() for ext in ('.png', '.tga', '.jpg'))


# ---------------------------------------------------------------- comprobaciones

def validar_manifests(bp, rp, base):
    mans = {}
    for nombre, carpeta in (('BP', bp), ('RP', rp)):
        ruta = carpeta / 'manifest.json'
        if not ruta.exists():
            error(carpeta.relative_to(base), 'falta manifest.json')
            continue
        m = leer_json(ruta, base)
        if m is None:
            continue
        mans[nombre] = m
        rel = ruta.relative_to(base)
        h = m.get('header', {})
        for clave in ('name', 'uuid', 'version', 'min_engine_version'):
            if clave not in h:
                error(rel, f'falta header.{clave}')
        for u in [h.get('uuid')] + [mod.get('uuid') for mod in m.get('modules', [])]:
            try:
                uuid.UUID(str(u))
            except ValueError:
                error(rel, f'UUID inválido: {u}')
        v = h.get('version')
        if not (isinstance(v, list) and len(v) == 3):
            error(rel, 'header.version debe ser [mayor, menor, parche]')
        for mod in m.get('modules', []):
            if mod.get('type') == 'script':
                entrada = carpeta / mod.get('entry', '')
                if not entrada.exists():
                    error(rel, f'el módulo de script apunta a {mod.get("entry")}, que no existe')
    todos = []
    for nombre, m in mans.items():
        todos += [m.get('header', {}).get('uuid')] + [mod.get('uuid') for mod in m.get('modules', [])]
    repetidos = {u for u in todos if todos.count(u) > 1}
    if repetidos:
        error('manifests', f'UUIDs repetidos: {", ".join(sorted(repetidos))}')
    if 'BP' in mans and 'RP' in mans:
        rp_h = mans['RP']['header']
        deps = [d for d in mans['BP'].get('dependencies', []) if 'uuid' in d]
        dep = next((d for d in deps if d['uuid'] == rp_h.get('uuid')), None)
        if dep is None:
            aviso('behavior_pack/manifest.json', 'no declara dependencia del RP: habrá que activar los dos packs a mano')
        elif dep.get('version') != rp_h.get('version'):
            error('behavior_pack/manifest.json',
                  f'depende del RP versión {dep.get("version")} pero el RP es {rp_h.get("version")}')
    return mans


def validar_versiones_npm(mans, raiz):
    pkg = raiz / 'herramientas' / 'package.json'
    if 'BP' not in mans or not pkg.exists():
        return
    instaladas = json.loads(pkg.read_text()).get('devDependencies', {})
    for d in mans['BP'].get('dependencies', []):
        mod = d.get('module_name')
        if mod in instaladas and instaladas[mod].lstrip('^~') != d.get('version'):
            aviso('behavior_pack/manifest.json',
                  f'{mod} es {d.get("version")} en el manifest y {instaladas[mod]} en herramientas/package.json '
                  '(la comprobación de tipos usaría otra versión)')


def recoger(bp, rp, base):
    # Solo los JSON con objeto raíz (languages.json, por ejemplo, es una lista).
    bp_json = {r: d for r, d in jsons(bp, base).items() if isinstance(d, dict)}
    rp_json = {r: d for r, d in jsons(rp, base).items() if isinstance(d, dict)}
    ent_bp, ent_rp = {}, {}
    for ruta, d in bp_json.items():
        if 'minecraft:entity' in d:
            ident = d['minecraft:entity'].get('description', {}).get('identifier')
            ent_bp[ident] = (ruta, d['minecraft:entity'])
    animaciones, controladores, render, geometrias = set(), set(), set(), set()
    for ruta, d in rp_json.items():
        if 'minecraft:client_entity' in d:
            ident = d['minecraft:client_entity'].get('description', {}).get('identifier')
            ent_rp[ident] = (ruta, d['minecraft:client_entity'])
        animaciones |= set(d.get('animations', {}) if isinstance(d.get('animations'), dict) else {})
        controladores |= set(d.get('animation_controllers', {}))
        render |= set(d.get('render_controllers', {}) if isinstance(d.get('render_controllers'), dict) else {})
        for g in d.get('minecraft:geometry', []):
            geometrias.add(g.get('description', {}).get('identifier'))
        for k in d:
            if k.startswith('geometry.'):
                geometrias.add(k.split(':')[0])
    return bp_json, rp_json, ent_bp, ent_rp, animaciones, controladores, render, geometrias


def validar_entidades(bp, rp, base, ent_bp, ent_rp, animaciones, controladores, render, geometrias, rp_json):
    props_por_entidad, geo_vanilla = {}, {}
    geos_completas = cargar_geometrias([Path(__file__).parent / 'vanilla', rp])
    for ident, (ruta, e) in ent_bp.items():
        rel = ruta.relative_to(base)
        if not ident or ':' not in ident:
            error(rel, f'identificador sin namespace: {ident}')
            continue
        if ident.startswith('minecraft:'):
            aviso(rel, f'{ident} sobrescribe una entidad vanilla')
        props_por_entidad[ident] = set(e.get('description', {}).get('properties', {}))
        grupos = set(e.get('component_groups', {}))
        for nombre, ev in e.get('events', {}).items():
            for usado in re.findall(r'"component_groups"\s*:\s*\[([^\]]*)\]', json.dumps(ev)):
                for g in re.findall(r'"([^"]+)"', usado):
                    if g not in grupos:
                        error(rel, f'el evento {nombre} usa el component group "{g}", que no existe')
        texto = json.dumps(e)
        for tabla in re.findall(r'"table"\s*:\s*"([^"]+)"', texto):
            if not (bp / tabla).exists():
                error(rel, f'la loot table {tabla} no existe')
        if ident not in ent_rp and not ident.startswith('minecraft:'):
            error(rel, f'{ident} no tiene client entity en el RP: será invisible')

    for ident, (ruta, e) in ent_rp.items():
        rel = ruta.relative_to(base)
        desc = e.get('description', {})
        if ident not in ent_bp and not ident.startswith('minecraft:'):
            aviso(rel, f'{ident} no tiene entidad en el BP')
        for clave, tex in desc.get('textures', {}).items():
            if not existe_textura(rp, tex):
                error(rel, f'falta la textura "{tex}" (.png): se verá morada y negra')
                continue
            geo = geos_completas.get(desc.get('geometry', {}).get(clave) or desc.get('geometry', {}).get('default'))
            png = rp / f'{tex}.png'
            tam = tam_png(png) if png.exists() else None
            if geo and tam and tam[0] * geo['th'] != tam[1] * geo['tw']:
                error(rel, f'la textura {tex}.png mide {tam[0]}x{tam[1]} pero la geometría espera '
                           f'{geo["tw"]}x{geo["th"]} (o múltiplo): se verá estirada')
        for clave, geo in desc.get('geometry', {}).items():
            if geo not in geometrias and geo not in geos_completas:
                geo_vanilla.setdefault(geo, []).append(ident)
        anims = desc.get('animations', {})
        for corto, largo in anims.items():
            if largo.startswith('controller.animation.'):
                if largo not in controladores and not es_vanilla(largo):
                    error(rel, f'el controlador "{largo}" no existe en el RP')
            elif largo not in animaciones and not es_vanilla(largo):
                error(rel, f'la animación "{largo}" no existe en el RP')
        for item in desc.get('scripts', {}).get('animate', []):
            nombre = item if isinstance(item, str) else next(iter(item))
            if nombre not in anims:
                error(rel, f'scripts.animate usa "{nombre}", que no está en "animations"')
        for rc in desc.get('render_controllers', []):
            nombre = rc if isinstance(rc, str) else next(iter(rc))
            if nombre not in render and not es_vanilla(nombre):
                error(rel, f'el render controller "{nombre}" no existe en el RP')
        # Animaciones que piden los controladores usados por esta entidad.
        for corto, largo in anims.items():
            for ruta_c, d in rp_json.items():
                ctrl = d.get('animation_controllers', {}).get(largo)
                if not ctrl:
                    continue
                for estado in ctrl.get('states', {}).values():
                    for a in estado.get('animations', []):
                        a = a if isinstance(a, str) else next(iter(a))
                        if a not in anims:
                            error(rel, f'el controlador {largo} usa la animación "{a}", que esta entidad no define')
        # Propiedades consultadas desde el RP.
        texto = json.dumps(e)
        for prop in set(re.findall(r"(?:q|query)\.property\('([^']+)'\)", texto)):
            if ident in props_por_entidad and prop not in props_por_entidad[ident]:
                error(rel, f'consulta la propiedad {prop}, que la entidad del BP no declara')
        for corto, largo in anims.items():
            for d in rp_json.values():
                ctrl = d.get('animation_controllers', {}).get(largo)
                if ctrl:
                    for prop in set(re.findall(r"(?:q|query)\.property\('([^']+)'\)", json.dumps(ctrl))):
                        if ident in props_por_entidad and prop not in props_por_entidad[ident]:
                            error(rel, f'el controlador {largo} consulta {prop}, que la entidad del BP no declara')
    for geo, quien in geo_vanilla.items():
        aviso('resource_pack', f'{len(quien)} entidades usan "{geo}", que no está en el RP ni en '
                               'herramientas/vanilla: si no es una geometría del juego, serán invisibles')
    return props_por_entidad


def es_vanilla(nombre):
    # Identificadores del juego base: no tienen namespace propio de addon.
    return bool(re.match(r'^(animation|controller\.animation|controller\.render)\.'
                         r'(humanoid|zombie|player|skeleton|wolf|default|item_default|husk|drowned|piglin)\b', nombre)) \
        or nombre.startswith('controller.render.zombie') or nombre.startswith('controller.render.default')


def validar_items(bp, rp, base, bp_json, rp_json):
    iconos = {}
    for ruta, d in rp_json.items():
        if d.get('texture_name') == 'atlas.items':
            for nombre, info in d.get('texture_data', {}).items():
                iconos[nombre] = info.get('textures')
                tex = info.get('textures')
                for t in (tex if isinstance(tex, list) else [tex]):
                    if isinstance(t, str) and not existe_textura(rp, t):
                        error(ruta.relative_to(base), f'falta la textura del icono "{t}" (.png)')
    items = {}
    for ruta, d in bp_json.items():
        if 'minecraft:item' in d:
            it = d['minecraft:item']
            ident = it.get('description', {}).get('identifier')
            items[ident] = ruta
            icono = it.get('components', {}).get('minecraft:icon')
            if isinstance(icono, dict):
                icono = icono.get('textures', {}).get('default') or icono.get('texture')
            if icono and icono not in iconos:
                error(ruta.relative_to(base), f'el icono "{icono}" no está en item_texture.json')
    return items


def validar_textos(rp, base, ent_bp, items):
    langs = sorted((rp / 'texts').glob('*.lang'))
    if not langs:
        aviso('resource_pack/texts', 'no hay archivos .lang: las entidades saldrán con su identificador')
        return
    claves_por_archivo = {}
    for lang in langs:
        claves = {}
        for n, linea in enumerate(lang.read_text(encoding='utf-8-sig').splitlines(), 1):
            linea = linea.split('##')[0].rstrip()
            if not linea.strip():
                continue
            if '=' not in linea:
                aviso(lang.relative_to(base), f'línea {n} sin "=": {linea[:40]}')
                continue
            k = linea.split('=', 1)[0]
            if k in claves:
                aviso(lang.relative_to(base), f'clave repetida "{k}" (líneas {claves[k]} y {n})')
            claves[k] = n
        claves_por_archivo[lang] = set(claves)
        rel = lang.relative_to(base)
        for ident in ent_bp:
            for k in (f'entity.{ident}.name', f'item.spawn_egg.entity.{ident}.name'):
                if k not in claves:
                    aviso(rel, f'falta "{k}"')
        for ident in items:
            if f'item.{ident}' not in claves and f'item.{ident}.name' not in claves:
                aviso(rel, f'falta el nombre del item "item.{ident}"')
    todas = set().union(*claves_por_archivo.values())
    for lang, claves in claves_por_archivo.items():
        faltan = todas - claves
        if faltan:
            aviso(lang.relative_to(base), f'le faltan {len(faltan)} claves que sí tienen otros idiomas, p. ej. {sorted(faltan)[0]}')
    idiomas = rp / 'texts' / 'languages.json'
    if idiomas.exists():
        lista = leer_json(idiomas, base) or []
        for lang in langs:
            if lang.stem not in lista:
                aviso(idiomas.relative_to(base), f'no incluye {lang.stem}')


def validar_scripts(bp, base, ent_bp, props_por_entidad):
    scripts = sorted((bp / 'scripts').rglob('*.js')) if (bp / 'scripts').exists() else []
    eventos = {ident: set(e.get('events', {})) for ident, (_, e) in ent_bp.items()}
    todos_eventos = set().union(*eventos.values()) if eventos else set()
    todas_props = set().union(*props_por_entidad.values()) if props_por_entidad else set()
    for js in scripts:
        rel = js.relative_to(base)
        texto = js.read_text(encoding='utf-8')
        for n, linea in enumerate(texto.splitlines(), 1):
            for ev in re.findall(r'triggerEvent\(\s*"([a-z0-9_]+:[^"]+)"', linea):
                if not ev.startswith('minecraft:') and ev not in todos_eventos:
                    error(rel, f'línea {n}: triggerEvent("{ev}") no existe en ninguna entidad')
            for ent in re.findall(r'spawnEntity\(\s*"([a-z0-9_]+:[^"]+)"', linea):
                if not ent.startswith('minecraft:') and ent not in ent_bp:
                    error(rel, f'línea {n}: spawnEntity("{ent}") no existe en el BP')
            for prop in re.findall(r'[sg]etProperty\(\s*"([^"]+)"', linea):
                if prop not in todas_props:
                    error(rel, f'línea {n}: la propiedad "{prop}" no está declarada en ninguna entidad')
        for imp in re.findall(r'from\s+"(\.{1,2}/[^"]+)"', texto):
            if not (js.parent / imp).resolve().exists():
                error(rel, f'importa "{imp}", que no existe')
        # Identificadores za:... escritos a mano en el script.
        for ident in set(re.findall(r'"(za:zombie_[a-z_]+)"', texto)):
            if ident not in ent_bp:
                error(rel, f'menciona la entidad "{ident}", que no existe en el BP')


def validar_recetas(bp_json, base, items):
    ids = {}
    for ruta, d in bp_json.items():
        for tipo in ('minecraft:recipe_shapeless', 'minecraft:recipe_shaped', 'minecraft:recipe_furnace'):
            if tipo in d:
                r = d[tipo]
                ident = r.get('description', {}).get('identifier')
                if ident in ids:
                    error(ruta.relative_to(base), f'receta repetida {ident}')
                ids[ident] = ruta
                res = r.get('result', {})
                res = res.get('item') if isinstance(res, dict) else res
                if isinstance(res, str) and not res.startswith('minecraft:') and res not in items:
                    error(ruta.relative_to(base), f'el resultado {res} no es un item del BP')


def main():
    raiz = Path(__file__).resolve().parent.parent
    base = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else raiz / 'Zombie_Apocalypse'
    bp, rp = base / 'behavior_pack', base / 'resource_pack'
    mans = validar_manifests(bp, rp, base)
    validar_versiones_npm(mans, raiz)
    bp_json, rp_json, ent_bp, ent_rp, anims, ctrls, render, geos = recoger(bp, rp, base)
    props = validar_entidades(bp, rp, base, ent_bp, ent_rp, anims, ctrls, render, geos, rp_json)
    items = validar_items(bp, rp, base, bp_json, rp_json)
    validar_textos(rp, base, ent_bp, items)
    validar_scripts(bp, base, ent_bp, props)
    validar_recetas(bp_json, base, items)

    for linea in errores + avisos:
        print(linea)
    print(f'\n{len(ent_bp)} entidades, {len(items)} items, {len(bp_json) + len(rp_json)} JSON revisados: '
          f'{len(errores)} errores, {len(avisos)} avisos')
    sys.exit(1 if errores else 0)


if __name__ == '__main__':
    main()
