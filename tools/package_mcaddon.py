#!/usr/bin/env python3
"""Package a folder containing BP and RP directories into a .mcaddon archive."""
from __future__ import annotations
import argparse
import json
import zipfile
from pathlib import Path

SKIP_PARTS = {".git", "node_modules", "__pycache__", ".venv", "dist", "build"}


def find_pack(root: Path, names: tuple[str, ...]) -> Path | None:
    for name in names:
        candidate = root / name
        if candidate.is_dir() and (candidate / "manifest.json").is_file():
            return candidate
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Build a .mcaddon containing BP and RP")
    ap.add_argument("root", nargs="?", default=".")
    ap.add_argument("--bp", help="Behavior Pack directory (optional explicit path)")
    ap.add_argument("--rp", help="Resource Pack directory (optional explicit path)")
    ap.add_argument("--out", default="addon.mcaddon")
    args = ap.parse_args()
    root = Path(args.root).expanduser().resolve()
    bp = Path(args.bp).expanduser().resolve() if args.bp else find_pack(root, ("BP", "Behavior_Pack", "behavior_pack", "behavior_packs"))
    rp = Path(args.rp).expanduser().resolve() if args.rp else find_pack(root, ("RP", "Resource_Pack", "resource_pack", "resource_packs"))
    if not bp or not (bp / "manifest.json").is_file():
        print("[ERROR] No se encontró Behavior Pack con manifest.json; usa --bp")
        return 2
    if not rp or not (rp / "manifest.json").is_file():
        print("[ERROR] No se encontró Resource Pack con manifest.json; usa --rp")
        return 2
    for p in (bp, rp):
        try: json.loads((p / "manifest.json").read_text(encoding="utf-8-sig"))
        except Exception as exc:
            print(f"[ERROR] Manifest inválido en {p}: {exc}")
            return 2
    out = Path(args.out).expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as zf:
        for pack in (bp, rp):
            for file in sorted(pack.rglob("*")):
                if not file.is_file(): continue
                rel_parts = file.relative_to(pack).parts
                if any(part in SKIP_PARTS for part in rel_parts): continue
                arc = Path(pack.name) / Path(*rel_parts)
                zf.write(file, arc.as_posix())
    print(f"[OK] .mcaddon generado: {out}")
    print("Comprueba importación y activación de ambos packs dentro de Bedrock.")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
