#!/usr/bin/env python3
"""Best-effort static validator for Minecraft Bedrock add-on folders.

This tool uses only the Python standard library. It is not a Mojang schema
validator and cannot prove in-game compatibility or runtime behavior.
"""
from __future__ import annotations
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

SKIP_DIRS = {".git", "node_modules", "build", "dist", ".cache", "__pycache__", ".venv"}
UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
ID_RE = re.compile(r"^[a-z0-9_.-]+:[a-z0-9_./-]+$")
IMPORT_RE = re.compile(r"(?:from\s*|import\s*\()\s*[\"'](@minecraft/[a-z0-9_-]+)")

class Reporter:
    def __init__(self) -> None:
        self.errors = 0
        self.warnings = 0
    def emit(self, level: str, path: str, message: str) -> None:
        print(f"[{level}] {path}: {message}")
        if level == "ERROR": self.errors += 1
        elif level == "WARN": self.warnings += 1


def iter_files(root: Path) -> Iterable[Path]:
    for p in root.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(root)
        if any(part in SKIP_DIRS or part.startswith(".") and part not in {".claude"} for part in rel.parts):
            continue
        yield p


def load_json(path: Path, root: Path, report: Reporter) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        report.emit("ERROR", str(path.relative_to(root)), f"JSON inválido/no legible: {exc}")
        return None


def collect_ids(data: Any, key: str) -> set[str]:
    out: set[str] = set()
    if isinstance(data, dict):
        value = data.get(key)
        if isinstance(value, dict):
            for item in value.values():
                if isinstance(item, str): out.add(item)
        for child in data.values(): out.update(collect_ids(child, key))
    elif isinstance(data, list):
        for child in data: out.update(collect_ids(child, key))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Static Bedrock add-on validator (best effort)")
    ap.add_argument("root", nargs="?", default=".", help="Folder containing BP/RP or a project")
    ap.add_argument("--strict", action="store_true", help="Return failure when warnings exist")
    args = ap.parse_args()
    root = Path(args.root).expanduser().resolve()
    if not root.is_dir():
        print(f"[ERROR] Not a directory: {root}")
        return 2
    report = Reporter()
    files = list(iter_files(root))
    json_files = [p for p in files if p.suffix.lower() == ".json"]
    if not json_files:
        print("[WARN] No JSON files found. Is this an add-on project root?")
        return 1

    docs: dict[Path, Any] = {}
    manifests: list[tuple[Path, dict[str, Any]]] = []
    seen_uuids: dict[str, Path] = {}
    particle_ids: dict[str, Path] = {}
    all_ids: dict[str, Path] = {}

    for path in json_files:
        data = load_json(path, root, report)
        if data is None:
            continue
        docs[path] = data
        rel = str(path.relative_to(root))
        if path.name.lower() == "manifest.json":
            if not isinstance(data, dict):
                report.emit("ERROR", rel, "La raíz del manifest debe ser un objeto JSON")
            else:
                manifests.append((path, data))
        # Detect custom particle IDs.
        if "particles" in {part.lower() for part in path.relative_to(root).parts}:
            effect = data.get("particle_effect") if isinstance(data, dict) else None
            desc = effect.get("description") if isinstance(effect, dict) else None
            identifier = desc.get("identifier") if isinstance(desc, dict) else None
            if not isinstance(identifier, str) or not ID_RE.fullmatch(identifier):
                report.emit("ERROR", rel, "Falta particle_effect.description.identifier válido")
            elif identifier.startswith("minecraft:"):
                report.emit("WARN", rel, "El contenido propio no debería usar el namespace reservado minecraft:")
            elif identifier in particle_ids:
                report.emit("ERROR", rel, f"Identifier de partícula duplicado; también aparece en {particle_ids[identifier].relative_to(root)}")
            else:
                particle_ids[identifier] = path
        if isinstance(data, dict):
            # General duplicate identifiers that are top-level common definitions.
            for key in ("identifier",):
                identifier = data.get(key)
                if isinstance(identifier, str) and ID_RE.fullmatch(identifier):
                    if identifier in all_ids:
                        report.emit("ERROR", rel, f"Identifier duplicado {identifier}; también en {all_ids[identifier].relative_to(root)}")
                    else:
                        all_ids[identifier] = path

    # Validate manifests and UUIDs.
    script_manifest_modules: set[str] = set()
    for path, manifest in manifests:
        rel = str(path.relative_to(root))
        if manifest.get("format_version") not in (2, 3):
            report.emit("WARN", rel, "format_version del manifest no es 2 ni 3; confirma el esquema de esta build")
        if manifest.get("format_version") == 3:
            report.emit("WARN", rel, "Manifest format_version 3 está documentado como preview en la referencia consultada; confirma antes de publicar stable")
        header = manifest.get("header")
        modules = manifest.get("modules")
        if not isinstance(header, dict):
            report.emit("ERROR", rel, "Falta header objeto")
            continue
        if not isinstance(header.get("name"), str) or not header["name"].strip():
            report.emit("WARN", rel, "header.name está vacío")
        uid = header.get("uuid")
        if not isinstance(uid, str) or not UUID_RE.fullmatch(uid):
            report.emit("ERROR", rel, "header.uuid no es UUID canónico")
        else:
            key = uid.lower()
            if key in seen_uuids:
                report.emit("ERROR", rel, f"UUID duplicado con {seen_uuids[key].relative_to(root)}")
            else: seen_uuids[key] = path
        min_engine = header.get("min_engine_version")
        if not (isinstance(min_engine, list) and len(min_engine) == 3 and all(isinstance(x, int) and x >= 0 for x in min_engine)):
            report.emit("WARN", rel, "header.min_engine_version debería ser [major, minor, patch]")
        if not isinstance(modules, list) or not modules:
            report.emit("ERROR", rel, "modules debe ser un array no vacío")
            continue
        for index, module in enumerate(modules):
            if not isinstance(module, dict):
                report.emit("ERROR", rel, f"modules[{index}] debe ser un objeto")
                continue
            muid = module.get("uuid")
            if not isinstance(muid, str) or not UUID_RE.fullmatch(muid):
                report.emit("ERROR", rel, f"modules[{index}].uuid no es UUID canónico")
            else:
                key = muid.lower()
                if key in seen_uuids:
                    report.emit("ERROR", rel, f"UUID de módulo duplicado con {seen_uuids[key].relative_to(root)}")
                else: seen_uuids[key] = path
            version = module.get("version")
            if not (isinstance(version, list) and len(version) == 3 and all(isinstance(x, int) for x in version)):
                report.emit("WARN", rel, f"modules[{index}].version debería ser un array de tres enteros")
            if module.get("type") == "script":
                entry = module.get("entry")
                if not isinstance(entry, str) or not entry.strip():
                    report.emit("ERROR", rel, f"modules[{index}] es script pero no declara entry")
                elif not (path.parent / entry).is_file():
                    report.emit("ERROR", rel, f"No existe el entrypoint: {entry}")
                if module.get("language") not in ("javascript", "typescript", None):
                    report.emit("WARN", rel, f"language no habitual: {module.get('language')}")
        deps = manifest.get("dependencies", [])
        if deps is not None and not isinstance(deps, list):
            report.emit("ERROR", rel, "dependencies debe ser array")
        if isinstance(deps, list):
            for dep in deps:
                if isinstance(dep, dict) and isinstance(dep.get("module_name"), str):
                    script_manifest_modules.add(dep["module_name"])

    # Script imports vs dependencies declared in manifests (cross-pack set).
    import_modules: set[str] = set()
    script_files = [p for p in files if p.suffix.lower() in {".js", ".ts", ".mjs"}]
    for path in script_files:
        try: source = path.read_text(encoding="utf-8-sig")
        except (OSError, UnicodeError):
            report.emit("WARN", str(path.relative_to(root)), "No se pudo leer archivo de script")
            continue
        import_modules.update(IMPORT_RE.findall(source))
        if "runCommandAsync" in source:
            report.emit("ERROR", str(path.relative_to(root)), "Se detectó runCommandAsync; fue retirado de la API moderna consultada. Usa la API documentada para el target.")
    for module_name in sorted(import_modules - script_manifest_modules):
        report.emit("WARN", ".", f"Se importa {module_name} pero no se encontró esa dependencia en ningún manifest escaneado")

    # Check particle event references against declared local particle IDs.
    def particle_refs(node: Any):
        if isinstance(node, dict):
            pe = node.get("particle_effect")
            if isinstance(pe, dict):
                effect = pe.get("effect")
                if isinstance(effect, str) and ":" in effect and not effect.startswith("minecraft:"):
                    yield effect
            for value in node.values(): yield from particle_refs(value)
        elif isinstance(node, list):
            for value in node: yield from particle_refs(value)
    for path, data in docs.items():
        refs = set(particle_refs(data))
        for ref in refs:
            if ref not in particle_ids:
                report.emit("WARN", str(path.relative_to(root)), f"La referencia de partícula {ref} no coincide con un identifier local encontrado")

    print("\nResumen de validación estática")
    print(f"Archivos totales: {len(files)}")
    print(f"JSON inspeccionados: {len(json_files)}")
    print(f"Manifests: {len(manifests)}")
    print(f"Scripts: {len(script_files)}")
    print(f"IDs de partículas: {len(particle_ids)}")
    print(f"Errores: {report.errors}")
    print(f"Advertencias: {report.warnings}")
    print("Nota: esto no reemplaza la validación oficial ni las pruebas dentro de Minecraft.")
    return 1 if report.errors or (args.strict and report.warnings) else 0

if __name__ == "__main__":
    raise SystemExit(main())
