---
name: bedrock-validator
description: Ejecuta validaciones estáticas, auditorías de compatibilidad, comprobaciones de referencias y empaquetado de add-ons Minecraft Bedrock.
---

# Bedrock Validator

Este módulo organiza el QA y distingue comprobaciones automatizadas de pruebas dentro del juego.

## Comandos

```bash
python tools/validate_addon.py <proyecto>
python tools/compatibility_audit.py <proyecto> --bedrock-version 26.60
python tools/package_mcaddon.py <carpeta-con-BP-y-RP> --out addon.mcaddon
```

En Windows se puede usar `py -3`.

## Validación estática

Revisa:
- JSON parseable;
- manifests con estructura básica;
- UUID canónicos y no duplicados;
- `min_engine_version` y module versions;
- entrypoint de scripts;
- módulos importados que falten en manifest;
- identifiers repetidos de partículas;
- referencias locales detectables;
- llamadas conocidas a métodos retirados como `runCommandAsync`.

## Auditoría de versión

- Comprueba target Bedrock.
- Señala dependencias beta/preview.
- Advierte si API 2.x se pretende ejecutar en targets antiguos sin comprobación.
- Comprueba que la versión objetivo no es inferior a min_engine_version.
- No decide por sí sola que una API funciona; requiere fuente/documentación.

## Paquetizado

- Empaqueta BP y RP sin archivos de desarrollo innecesarios.
- Verifica que ambos packs existen y que hay un manifest por pack.
- No incluye rutas absolutas ni carpetas temporales.

## Informe final obligatorio

Lista errores, warnings, número de archivos, comandos ejecutados, pruebas manuales pendientes, target exacto y estado de cada función. No marques `IN_GAME_OK` sin evidencia del juego.
