#!/usr/bin/env bash
# Corre las pruebas del Infinito en el simulador (Node 18 o más nuevo).
#   bash tests/simulador/correr.sh            (desde la carpeta ClaudeNPC)
#   bash tests/simulador/correr.sh 10         (10 veces seguidas)
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/node_modules/@minecraft/server" "$TMP/node_modules/@minecraft/server-ui"
cp "$AQUI/minecraft-server-mock.js" "$TMP/node_modules/@minecraft/server/index.js"
cp "$AQUI/minecraft-server-ui-mock.js" "$TMP/node_modules/@minecraft/server-ui/index.js"
echo '{ "name": "@minecraft/server", "type": "module", "main": "index.js" }' > "$TMP/node_modules/@minecraft/server/package.json"
echo '{ "name": "@minecraft/server-ui", "type": "module", "main": "index.js" }' > "$TMP/node_modules/@minecraft/server-ui/package.json"
echo '{ "type": "module" }' > "$TMP/package.json"
cp -r "$RAIZ/BP/scripts" "$TMP/scripts"
cp "$AQUI/test_infinito.mjs" "$TMP/"
export BP_ENT="$RAIZ/BP/entities"
VECES="${1:-1}"
BIEN=0
for i in $(seq 1 "$VECES"); do
  if (cd "$TMP" && node test_infinito.mjs > "$TMP/salida_$i.txt" 2>&1); then BIEN=$((BIEN + 1)); else echo "Corrida $i con fallas:"; grep -E "pruebas bien|^ - " "$TMP/salida_$i.txt" || tail -20 "$TMP/salida_$i.txt"; fi
done
tail -3 "$TMP/salida_1.txt"
echo "Corridas sin fallas: $BIEN de $VECES"
[ "$BIEN" -eq "$VECES" ]
