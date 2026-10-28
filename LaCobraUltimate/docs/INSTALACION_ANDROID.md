# Instalación en Android

## Requisitos

- Minecraft Bedrock **26.50 o superior** (recomendado: 26.60).
- Nada más. El addon no necesita activar ningún experimento.

## Opción A: importar el .mcaddon (recomendada)

1. Descarga `LaCobraUltimate.mcaddon` en el teléfono (carpeta `dist/` del proyecto).
2. Abre la app **Archivos** (o la de descargas) y toca el archivo.
   - Si Android pregunta con qué abrirlo, elige **Minecraft**.
3. Minecraft se abre y muestra *«Importación iniciada…»* y luego dos mensajes de *«Importación correcta»*: uno para **La Cobra Ultimate [BP]** y otro para **[RP]**.

> Si al tocarlo no se abre Minecraft, cambia el nombre de `LaCobraUltimate.mcaddon` a `LaCobraUltimate.zip`, descomprímelo y copia las carpetas `LaCobra_BP` y `LaCobra_RP` como se explica en la opción B.

## Opción B: copia manual

Los dos `.mcpack` de `dist/` también se pueden tocar uno a uno para importarlos. Para copiar a mano:

- Minecraft 26.x en Android guarda los packs en
  `Android/data/com.mojang.minecraftpe/files/games/com.mojang/`
  - `LaCobra_BP` → `behavior_packs/`
  - `LaCobra_RP` → `resource_packs/`
- Desde Android 11, para ver la carpeta `Android/data` puede hacer falta un gestor de archivos con acceso a ella, o conectar el teléfono a un ordenador.

## Activarlo en un mundo

1. **Crear nuevo mundo** (o editar uno existente; **haz una copia de seguridad antes**).
2. En **Paquetes de comportamiento** → *Disponibles* → **La Cobra Ultimate [BP]** → *Activar*.
   Minecraft activa también el Resource Pack, porque cada pack depende del otro.
3. Comprueba que en **Paquetes de recursos** aparece **La Cobra Ultimate [RP]** como activo.
4. **Experimentos: no hace falta activar ninguno.**
5. Si quieres usar los comandos de prueba (`/lacobra:kit`, `/lacobra:jefe`), activa **Trucos** en el mundo.

## Primera partida

- Al entrar, un mensaje en el chat explica cómo empezar.
- **En creativo:** busca «Cobra» en el inventario creativo, o escribe `/lacobra:kit` (con trucos activados) para recibir todos los objetos.
- **En supervivencia:** sigue la progresión de [RECETAS.md](RECETAS.md).

## Problemas frecuentes

| Problema | Solución |
|---|---|
| «Importación fallida» | Comprueba que la versión es 26.50 o superior. Borra versiones anteriores del addon que tengan el mismo nombre y vuelve a importar |
| Los objetos se ven negro y morado (sin textura) | El Resource Pack no está activo en el mundo: actívalo en *Paquetes de recursos* |
| Las habilidades no hacen nada | El Behavior Pack no está activo, o el mundo se creó con el BP desactivado. Abre la configuración del mundo y actívalo |
| No aparece la barra de energía | Solo se muestra cuando llevas un objeto de La Cobra en la mano o hay una habilidad activa |
| El jefe no aparece | No aparece en dificultad **Pacífica**, ni si ya hay otro jefe a menos de 96 bloques |

## Ver errores de contenido

Ajustes → Creador → activa **Registro de errores de contenido** (Content Log) en la pantalla y en el archivo. Si algo falla, el registro indica el archivo y la línea. Comparte ese texto para poder corregirlo.
