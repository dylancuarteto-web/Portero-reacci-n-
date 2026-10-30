# Limitaciones de validadores

Los scripts de este paquete son verificadores auxiliares hechos en Python estándar. No cargan el esquema interno de Mojang, no ejecutan Script API y no renderizan geometrías/partículas.

Una validación `STATIC_OK` solo significa que han pasado las comprobaciones locales implementadas. No prueba:
- parsing completo del schema Bedrock;
- compatibilidad exacta con todas las builds;
- funcionamiento de un controller en runtime;
- comportamiento real de Molang;
- renderizado de geometría/material/textura;
- interacción multijugador;
- ausencia de caída de FPS.

Para complementar, usa el Inspector de `mctools.dev` cuando esté disponible y carga el paquete dentro de Minecraft en la versión objetivo.
