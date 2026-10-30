# Compatibilidad de Bedrock 1.21+

## Snapshot comprobado

- Fecha de auditoría del paquete: **2026-10-30**.
- Última publicación estable comprobada: **Bedrock 26.60**, publicada el **2026-10-27**.
- La página estable de `@minecraft/server` consultada lista `2.11.0` sin sufijo y versiones beta/preview separadas. No conviertas esa observación en una suposición de compatibilidad para todos los puntos del rango 1.21+.
- Microsoft explica que los números de Script API usan SemVer y son independientes de la numeración del producto Minecraft.

## Versiones que no deben confundirse

| Campo | Qué representa | Ejemplo |
|---|---|---|
| Bedrock product version | Versión del juego instalado | `1.21.0`, `26.60` |
| `min_engine_version` | Mínimo de motor declarado por el pack | `[1, 21, 0]` |
| JSON `format_version` | Esquema de un archivo concreto | `1.21.0`, `1.10.0` |
| Manifest `format_version` | Formato del manifiesto | `2` estable común; `3` en preview según documentación consultada |
| `@minecraft/server` | Versión del módulo Script API | `1.11.0`, `2.11.0` |
| Track | Estabilidad del módulo | estable / `-beta` / preview |

## Política de soporte

1. Declara versión mínima de producto y versiones exactas probadas.
2. Mantén un perfil `data_driven` sin Script API cuando la función pueda resolverse con JSON/components compatibles. Este perfil suele ser el que ofrece el rango más amplio.
3. Para Script API, elige una dependencia compatible con el menor Bedrock que se pretenda soportar **y** con las funciones usadas. Revisa cada función en la documentación de esa versión.
4. La tabla oficial de versionado relaciona `@minecraft/server` 1.11.0 con Bedrock 1.21.0, 1.13.0 con 1.21.20, 1.14.0 con 1.21.30, 1.15.0 con 1.21.40, 1.16.0 con 1.21.50 y 1.17.0 con 1.21.60. No interpolar versiones no listadas ni extrapolar indefinidamente.
5. La documentación estable más reciente lista `2.11.0`; la página de API también indica que la publicación más reciente de ese módulo corresponde al contexto 1.26.70-beta.22. Antes de publicar contra 26.60, verifica el módulo compatible con la build instalada/target. No copies una versión beta por ser numéricamente mayor.
6. Si el usuario necesita simultáneamente Bedrock 1.21 temprano y 26.60, genera perfiles distintos para Script API si los métodos usados cruzan un salto mayor. Comparte recursos data-driven cuando sea posible.
7. No uses módulos `-beta`, `-preview` o `-internal` en perfil estable salvo petición explícita, indicando toggles, riesgos y fallbacks.
8. Revisa que el manifiesto de BP declare cada módulo importado por los scripts.
9. No actualices todos los `format_version` para que “coincidan” con el juego. Cada tipo de archivo usa su propio esquema.
10. Después de cambios de versión, valida otra vez y prueba en el cliente objetivo.

## Matriz de perfiles sugerida

| Perfil | Uso | Regla |
|---|---|---|
| `broad-data` | Modelos, texturas, entidades/ítems data-driven, partículas compatibles | Evita Script API; valida cada esquema. |
| `legacy-1.21` | Primeras versiones 1.21 | Usa solamente las funciones existentes en el módulo estable de esa versión. |
| `modern-stable` | Versión estable actual | Usa el módulo estable que Microsoft documente para la versión concreta. |
| `preview-lab` | Pruebas de API aún no estables | Separado del release; nunca habilitarlo por accidente en stable. |

## Herramientas y fuentes

- [Latest Platform Version Guidance](https://learn.microsoft.com/en-us/minecraft/creator/documents/practices/latestplatformversion?view=minecraft-bedrock-stable)
- [Script Module Versioning](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/versioning?view=minecraft-bedrock-stable)
- [`@minecraft/server` stable API](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/minecraft-server?view=minecraft-bedrock-stable)
- [26.60 changelog](https://feedback.minecraft.net/hc/en-us/articles/49852828563853-Minecraft-Bedrock-Edition-26-60-Changelog)
- [Manifest reference](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/addonsreference/packmanifest?view=minecraft-bedrock-stable)

## Entrega de compatibilidad

En el README final de cada add-on incluye esta tabla:

| Target Bedrock | Pack/Perfil | Script API | Estado |
|---|---|---|---|
| versión mínima solicitada | nombre del build | versión exacta o “sin script” | probado / validado estáticamente / no probado |
| versión actual | nombre del build | versión exacta | probado / validado estáticamente / no probado |
