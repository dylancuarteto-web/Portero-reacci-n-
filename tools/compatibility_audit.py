#!/usr/bin/env python3
"""Audit Bedrock manifests and Script API declarations (offline, best effort)."""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

IMPORT_RE = re.compile(r"(?:from\s*|import\s*\()\s*[\"'](@minecraft/[a-z0-9_-]+)")
BETA_RE = re.compile(r"(?:beta|preview|internal)", re.I)


def parse_version(value: str) -> tuple[int, ...] | None:
    nums = re.findall(r"\d+", value)
    if not nums: return None
    return tuple(int(x) for x in nums[:3])


def read_json(path: Path):
    try: return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as exc:
        print(f"[ERROR] {path}: no se pudo leer JSON: {exc}")
        return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Offline Bedrock compatibility audit")
    ap.add_argument("root", nargs="?", default=".")
    ap.add_argument("--bedrock-version", help="Target product version, e.g. 1.21.0 or 26.60")
    ap.add_argument("--expected-server-api", help="Expected @minecraft/server version, e.g. 2.11.0")
    ap.add_argument("--strict", action="store_true", help="Warnings cause a non-zero exit")
    args = ap.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"[ERROR] No existe carpeta: {root}")
        return 2
    errors = 0
    warns = 0
    def emit(level: str, path: str, msg: str):
        nonlocal errors, warns
        print(f"[{level}] {path}: {msg}")
        if level == "ERROR": errors += 1
        elif level == "WARN": warns += 1

    manifests = list(root.rglob("manifest.json"))
    manifests = [p for p in manifests if not any(x in {"node_modules", "dist", "build", "__pycache__"} for x in p.parts)]
    if not manifests:
        emit("WARN", ".", "No se encontraron manifests")
    declared: set[str] = set()
    api_versions: list[tuple[str, str]] = []
    min_engines: list[tuple[Path, tuple[int, ...]]] = []
    for path in manifests:
        data = read_json(path)
        if not isinstance(data, dict):
            errors += 1
            continue
        header = data.get("header", {})
        if isinstance(header, dict):
            m = header.get("min_engine_version")
            if isinstance(m, list) and len(m) >= 2:
                try: min_engines.append((path, tuple(int(x) for x in m[:3])))
                except (ValueError, TypeError): emit("WARN", str(path.relative_to(root)), "min_engine_version no numérico")
        for dep in data.get("dependencies", []) if isinstance(data.get("dependencies", []), list) else []:
            if isinstance(dep, dict) and isinstance(dep.get("module_name"), str):
                name = dep["module_name"]
                declared.add(name)
                if name == "@minecraft/server" and isinstance(dep.get("version"), str):
                    api_versions.append((str(path.relative_to(root)), dep["version"]))
                    if BETA_RE.search(dep["version"]):
                        emit("WARN", str(path.relative_to(root)), f"Script API {dep['version']} parece beta/preview/internal; no usar en release estable sin aprobación")

    imports: set[str] = set()
    for path in root.rglob("*"):
        if path.suffix.lower() not in {".js", ".ts", ".mjs"} or not path.is_file():
            continue
        if any(x in {"node_modules", "dist", "build", "__pycache__"} for x in path.parts):
            continue
        try: source = path.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError): continue
        imports.update(IMPORT_RE.findall(source))
        if "runCommandAsync" in source:
            emit("ERROR", str(path.relative_to(root)), "runCommandAsync detectado; revisar API moderna, donde aparece como retirado")
    for name in sorted(imports - declared):
        emit("WARN", ".", f"Import de {name} detectado pero falta dependencia declarada en manifest")

    target = parse_version(args.bedrock_version) if args.bedrock_version else None
    if args.bedrock_version and target is None:
        emit("ERROR", ".", f"Formato de Bedrock inválido: {args.bedrock_version}")
    if target:
        for path, minv in min_engines:
            if target < minv:
                emit("ERROR", str(path.relative_to(root)), f"El target {args.bedrock_version} es inferior a min_engine_version {'.'.join(map(str, minv))}")
        # Product version and Script API use distinct number lines.
        for path, version in api_versions:
            api = parse_version(version)
            if api and api[0] >= 2 and target[0] == 1 and target[1:2] == (21,) and (len(target) < 3 or target[2] < 70):
                emit("WARN", path, f"API {version} es major 2 y el target parece anterior a 1.21.70; confirma disponibilidad en esa build o crea un perfil legacy")
    if args.expected_server_api:
        for path, version in api_versions:
            if version != args.expected_server_api:
                emit("WARN", path, f"Se declara @minecraft/server {version}, pero se esperaba {args.expected_server_api}")
        if not api_versions:
            emit("WARN", ".", "No hay dependencia @minecraft/server para comparar")

    # Optional config file is informational only.
    config_path = root / "bedrock.config.json"
    if config_path.exists():
        config = read_json(config_path)
        if isinstance(config, dict):
            policy = config.get("compatibility", {})
            if isinstance(policy, dict):
                minimum = policy.get("minimumBedrock")
                if minimum and args.bedrock_version:
                    minv = parse_version(str(minimum))
                    if minv and target and target < minv:
                        emit("ERROR", "bedrock.config.json", f"El target está por debajo de la política mínima declarada {minimum}")

    print("\nResumen de compatibilidad")
    print(f"Bedrock objetivo: {args.bedrock_version or 'no especificado'}")
    print(f"Manifests: {len(manifests)}")
    print(f"Dependencias @minecraft/server: {len(api_versions)}")
    print(f"Errores: {errors}")
    print(f"Advertencias: {warns}")
    print("Auditoría offline: no confirma que una API esté disponible; coteja siempre la documentación oficial y prueba en juego.")
    return 1 if errors or (args.strict and warns) else 0

if __name__ == "__main__":
    raise SystemExit(main())
