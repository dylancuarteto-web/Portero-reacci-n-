---
name: bedrock-blockbench-bridge
description: Conecta y coordina Claude Code con Blockbench Desktop mediante el servidor MCP, verificando el estado real, formatos, herramientas, cambios visuales y exportaciones Bedrock.
---

# Bedrock Blockbench Bridge

Usa esta Skill cuando el usuario pida crear, revisar, texturizar, riggear o animar un recurso directamente dentro de Blockbench.

## Regla principal: comprueba la conexión real

1. Inspecciona las herramientas MCP que están realmente disponibles en esta sesión y busca el servidor Blockbench.
2. Si están disponibles, consulta primero el estado del servidor y los formatos de proyecto mediante las herramientas de estado/formato que el catálogo exponga.
3. Confirma si existe un proyecto activo y qué formato admite.
4. No confundas la presencia de `.mcp.json`, el plugin instalado o Blockbench abierto con una conexión funcional.
5. Si no existen herramientas MCP disponibles, informa que no hay conexión en esta sesión. Puedes crear archivos fuente y explicar cómo activar el puente, pero no afirmes que has editado la interfaz de Blockbench.
6. Nunca inventes nombres de herramientas, parámetros o resultados. Inspecciona el catálogo y las descripciones reales.

## Flujo de trabajo en Blockbench

1. Lee la guía disponible del servidor si existe (`get_guide` u otra herramienta equivalente) y consulta los formatos admitidos.
2. Confirma el proyecto activo y el destino Bedrock: entidad, recurso decorativo, attachable, icono o animación.
3. Si es necesario un proyecto nuevo, presenta nombre, formato y resolución de textura y pide aprobación antes de sustituir un proyecto existente.
4. Construye el blockout y verifica silueta, escala, pivotes y jerarquía.
5. Añade detalle solo donde mejore el resultado; evita geometría repetida/invisible y microdetalles que penalicen Android.
6. Crea texturas y revisa cobertura UV, caras sin textura, alineación y paleta.
7. Para animación, comprueba que el rig tiene pivotes y jerarquía apropiados, y crea ciclos fluidos y no ofensivos.
8. Inspecciona capturas desde varios ángulos. Usa herramientas de auditoría/revisión si están disponibles.
9. Corrige errores detectados y vuelve a capturar. No exportes antes de que el usuario haya podido revisar el resultado cuando el cambio sea amplio.
10. Exporta usando el codec/formato Bedrock real disponible, conserva `.bbmodel` y fuentes, y registra cada archivo entregado.
11. Ejecuta los validadores de V6 y marca las pruebas dentro de Minecraft como `NOT_TESTED` hasta que realmente se realicen.

## Políticas de guardado y cambios

- No sobrescribas archivos existentes sin crear backup o recibir aprobación.
- No cierres ni cambies el proyecto activo sin autorización.
- Antes de acciones irreversibles (borrar elementos, cerrar proyecto, reemplazar/exportar un archivo existente), pide confirmación.
- Mantén el proyecto original y crea una copia de trabajo cuando sea posible.
- No instales plugins externos de Blockbench ni descargues referencias sin permiso explícito.
- No uses `execute_script` en el flujo normal. Puede ejecutar JavaScript sin sandbox con privilegios completos de Blockbench; el usuario debe mantenerlo desactivado.
- Opera solo con activos creativos no ofensivos: criaturas pacíficas, compañeros, decoración, herramientas de construcción/utilidad y recursos visuales de apoyo.

## Si no conecta

Lee `references/connection-diagnostics.md` y remite al instalador en `integrations/blockbench-mcp/`. El puente requiere Blockbench Desktop, no la aplicación web, Node.js 18+, servidor compilado, permiso de red concedido al plugin y puerto coincidente (`127.0.0.1:8787`).

## Entregables

- `.bbmodel` editable.
- `geo.json` y textura(s) exportadas cuando el formato sea Bedrock.
- Archivos de animación/controladores cuando correspondan.
- Capturas de vista previa.
- Registro de formato, herramientas MCP utilizadas, archivos exportados y estado de pruebas.
