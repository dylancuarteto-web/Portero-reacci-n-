"""Empaqueta el addon en un .mcaddon listo para importar (doble clic / abrir con Minecraft).

Uso:
    python3 herramientas/empaquetar.py [--subir-version] [--forzar] [carpeta_del_addon]

  --subir-version  sube el parche (1.0.0 -> 1.0.1) en los dos manifests y en la
                   dependencia BP -> RP. Hazlo cada vez que reinstales en el móvil:
                   Minecraft no reemplaza un pack ya importado con la misma versión.
  --forzar         empaqueta aunque el validador encuentre errores.

Genera en dist/: <Nombre>.mcaddon y un .mcpack por pack.
"""
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path

IGNORAR = {'.md', '.DS_Store'}


def subir_version(bp, rp):
    rp_m = rp / 'manifest.json'
    bp_m = bp / 'manifest.json'
    rp_d = json.loads(rp_m.read_text(encoding='utf-8'))
    viejo = rp_d['header']['version']
    nuevo = viejo[:2] + [viejo[2] + 1]
    rp_uuid = rp_d['header']['uuid']
    for ruta in (rp_m, bp_m):
        texto = ruta.read_text(encoding='utf-8')
        d = json.loads(texto)
        v = d['header']['version']
        d['header']['version'] = v[:2] + [v[2] + 1]
        for mod in d.get('modules', []):
            mod['version'] = mod['version'][:2] + [mod['version'][2] + 1] if isinstance(mod.get('version'), list) else mod.get('version')
        for dep in d.get('dependencies', []):
            if dep.get('uuid') == rp_uuid:
                dep['version'] = nuevo
        ruta.write_text(compactar(json.dumps(d, indent=2, ensure_ascii=False)) + '\n', encoding='utf-8')
    return viejo, nuevo


def compactar(texto):
    # Deja las listas cortas de números en una línea, como estaban: [1, 0, 0].
    return re.sub(r'\[\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\s*\]', r'[\1, \2, \3]', texto)


def comprimir(origen, zf, prefijo):
    for ruta in sorted(origen.rglob('*')):
        if ruta.is_file() and ruta.suffix not in IGNORAR and ruta.name not in IGNORAR:
            zf.write(ruta, f'{prefijo}/{ruta.relative_to(origen).as_posix()}')


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    raiz = Path(__file__).resolve().parent.parent
    base = Path(args[0]).resolve() if args else raiz / 'Zombie_Apocalypse'
    bp, rp = base / 'behavior_pack', base / 'resource_pack'
    nombre = base.name

    if '--subir-version' in sys.argv:
        viejo, nuevo = subir_version(bp, rp)
        print(f'Versión {".".join(map(str, viejo))} -> {".".join(map(str, nuevo))}')

    validar = subprocess.run([sys.executable, str(Path(__file__).parent / 'validar.py'), str(base)])
    if validar.returncode != 0 and '--forzar' not in sys.argv:
        sys.exit('\nNo se empaqueta: corrige los errores de arriba (o usa --forzar para probar igualmente).')

    dist = raiz / 'dist'
    dist.mkdir(exist_ok=True)
    salidas = {
        dist / f'{nombre}.mcaddon': [(bp, f'{nombre}_BP'), (rp, f'{nombre}_RP')],
        dist / f'{nombre}_BP.mcpack': [(bp, f'{nombre}_BP')],
        dist / f'{nombre}_RP.mcpack': [(rp, f'{nombre}_RP')],
    }
    for destino, packs in salidas.items():
        with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as zf:
            for origen, prefijo in packs:
                comprimir(origen, zf, prefijo)
        print(f'Creado {destino.relative_to(raiz)} ({destino.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
