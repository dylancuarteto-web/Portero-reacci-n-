# Flujo de MCP y herramientas externas

## Diferencias

- **Skill**: instrucciones y conocimiento que Claude sigue.
- **MCP server**: programa externo que expone herramientas mediante Model Context Protocol.
- **Blockbench**: aplicación de modelado/animación.
- **Conector MCP de Blockbench**: integración separada que permite operar sobre la aplicación.

Instalar esta carpeta no instala ni inicia un servidor MCP.

## Comprobación antes de usar Blockbench

1. Lista las herramientas MCP realmente disponibles en la sesión.
2. Identifica comandos de estado, proyectos abiertos, formatos y exportación.
3. Comprueba que el formato activo es Bedrock Entity o Bedrock Attachable según el recurso.
4. Guarda el archivo editable `.bbmodel` antes de exportar.
5. Exporta geometría/textura/animación a rutas del RP.
6. Confirma que los archivos existen en disco y que los identificadores coinciden.
7. No afirmes que se modificó Blockbench si no hubo evidencia de una llamada exitosa.

## Sin MCP

Continúa con archivos de texto que puedan generarse con fiabilidad, scripts auxiliares e instrucciones de edición manual. Marca las partes visuales que requieren Blockbench/Blender como “pendientes de exportación visual”, nunca como completadas.

## Blender + MCblend

MCblend es un complemento de Blender que permite importar/exportar geometrías Bedrock (incluyendo modelos en cubos y polymesh según la documentación del proyecto), crear UV/texturas y hornear animaciones/keyframes para el formato Bedrock. Los rigs, constraints o IK de Blender pueden necesitar baking; el runtime de Bedrock no es el runtime de Blender.

## Herramientas

- Blockbench: https://blockbench.net/
- Blender: https://www.blender.org/
- MCblend: https://mcblend.readthedocs.io/en/stable/
- Snowstorm (editor de partículas comunitario): https://snowstorm.app/
