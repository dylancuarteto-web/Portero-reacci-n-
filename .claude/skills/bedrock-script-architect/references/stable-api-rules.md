# Reglas de Script API y versionado

## Selección de dependencia

No elijas la versión por intuición ni por ser la más alta. La numeración de Script API es SemVer, separada de Bedrock product version. Usa la tabla oficial y la documentación API de la versión objetivo.

- Para los primeros lanzamientos 1.21, Microsoft lista `@minecraft/server` 1.11.0 para Bedrock 1.21.0.
- La tabla también lista 1.13.0 para 1.21.20, 1.14.0 para 1.21.30, 1.15.0 para 1.21.40, 1.16.0 para 1.21.50 y 1.17.0 para 1.21.60.
- La API estable actual consultada lista `2.11.0` sin sufijo; la documentación también distingue releases beta/preview.
- No asumas que una versión de API moderna está disponible en una instalación antigua. Si hace falta, genera un perfil legacy y otro moderno.

## Eventos

`world.afterEvents.itemUse` es un evento documentado para el uso exitoso de un objeto. El evento `ItemUseAfterEvent` expone `itemStack` y `source` en la referencia consultada. Aun así, verifica que las propiedades y el evento están disponibles en la dependencia elegida.

## APIs obsoletas o riesgos

- `runCommandAsync` se eliminó de la API moderna consultada; no lo uses.
- No copies ejemplos antiguos sin verificar imports, tipos y módulos.
- No asumas que APIs de entidades, UI, input, cámara o storage están estables; verifica el carril.
- En manifests, declara cada módulo importado en scripts.

## Buen patrón

1. Suscripción única en bootstrap.
2. Filtro por identifier.
3. Validación del jugador y del estado del objeto.
4. Cooldown.
5. Ejecución breve/segura.
6. Feedback visual.
7. Prueba en la versión elegida.

## Referencias
- https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/versioning?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/minecraft-server?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemuseafterevent?view=minecraft-bedrock-stable
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable
