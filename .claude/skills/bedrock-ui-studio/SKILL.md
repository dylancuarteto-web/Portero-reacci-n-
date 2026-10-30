---
name: bedrock-ui-studio
description: Diseña interfaces profesionales para add-ons de Minecraft Bedrock: HUD, menús, botones, formularios, controles de habilidades y alternativas táctiles.
---

# Bedrock UI Studio

No entregues interfaces improvisadas ni te limites al botón vanilla de atacar. Diseña una experiencia de usuario clara, atractiva, coherente y viable en la versión real de Bedrock.

## Principios visuales
- Define una identidad visual: paleta, tipografía disponible, iconografía, bordes, fondos, espaciado y jerarquía.
- Mantén contraste alto, texto legible y controles cómodos en pantallas pequeñas.
- Usa iconos consistentes, etiquetas breves, estados visibles y feedback inmediato.
- Diseña estados normal, seleccionado, pulsado, deshabilitado, cooldown, error y confirmación.
- Evita saturar la pantalla; prioriza la información contextual y la navegación simple.
- Mantén una estética consistente entre HUD, menús, objetos, partículas y mensajes.

## Controles y botones que puedes proponer
Según la mecánica, diseña controles con funciones diferenciadas, por ejemplo:
- **Habilidad**: activa la habilidad seleccionada.
- **Habilidad secundaria**: ejecuta una segunda acción.
- **Esquivar / impulso**: activa movilidad si la mecánica lo permite.
- **Bloquear / defensa**: activa una postura defensiva.
- **Cambiar modo**: rota entre habilidades o modos.
- **Seleccionar objetivo**: abre una selección de objetivo cuando sea viable.
- **Interactuar**: ejecuta la acción contextual.
- **Abrir menú**: muestra inventario de habilidades, configuración o mejoras.
- **Confirmar / cancelar**: controles claros para formularios y diálogos.

No añadas botones decorativos sin función. Cada control debe tener acción, estado, feedback, cooldown si corresponde y comportamiento al tocarlo repetidamente.

## Implementación realista en Bedrock
Antes de prometer un botón táctil permanente, verifica la versión y las APIs/documentación actuales. Bedrock no ofrece necesariamente una API estable y universal para insertar botones táctiles arbitrarios en el HUD.

Elige y explica la mejor opción viable:
1. UI nativa de Script API (`@minecraft/server-ui`) con formularios y botones de menú.
2. Interacción con un ítem personalizado para activar habilidades.
3. Interacción con entidad/bloque o NPC como panel de acciones.
4. Combinación de uso del ítem, agacharse y otros eventos soportados, solo si la versión lo permite.
5. HUD/actionbar, scoreboard o mensajes contextuales como feedback/estado.
6. JSON UI/resource pack solo cuando el formato, permisos y compatibilidad estén documentados; advierte si depende de overrides frágiles o de interfaz experimental.

Si el botón flotante permanente no es viable, no finjas que lo has creado: entrega una alternativa funcional y profesional, y explica claramente la diferencia.

## Especificación antes de construir
Crea `docs/UI_SPEC.md` con:
- usuarios/plataforma y tamaño de pantalla objetivo;
- mapa de navegación;
- inventario de botones y acciones;
- wireframe textual o esquema;
- paleta, iconos, tipografía y jerarquía;
- estados y feedback;
- controles táctiles alternativos;
- método técnico de implementación y compatibilidad;
- pruebas de accesibilidad, legibilidad y multiplayer.

## Entrega
- Capturas o mockups solo si el entorno puede generarlos realmente.
- Archivos UI/JSON/Script completos con rutas exactas.
- No declares que una UI está probada en el juego si no se importó y probó.
- Para cada botón, documenta qué hace, cómo se activa, cooldown, estado visual y fallback.
