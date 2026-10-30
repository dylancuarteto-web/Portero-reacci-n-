---
name: bedrock-addon
description: Crear, mejorar o depurar el addon de Minecraft Bedrock de este repo (Zombie_Apocalypse) — entidades, scripts con @minecraft/server, animaciones, texturas, items, recetas, textos. Usar siempre que se toque algo dentro de Zombie_Apocalypse/ o se hable de zombies, mobs, el addon o el mod de Minecraft.
---

# Addon de Minecraft Bedrock (Zombie Apocalypse)

El usuario juega en **Bedrock en el móvil (Android)**. No hay PC ni consola de comandos de por medio:
lo que se entrega es un `.mcaddon` que importa abriéndolo con Minecraft. No se puede abrir el juego
desde aquí, así que la calidad depende de **comprobar todo lo comprobable antes** y de **pedir
capturas al usuario** para lo visual.

## Mapa del proyecto

```
Zombie_Apocalypse/
  behavior_pack/    manifest, entities/ (22 zombies), items/, recipes/, loot_tables/, scripts/ (Script API)
  resource_pack/    manifest, entity/ (client entities), animations/, animation_controllers/,
                    render_controllers/, textures/, texts/ (en_US, es_MX), sounds.json
  LEEME.md          diseño, decisiones y límites de Bedrock ya investigados: léelo antes de cambiar mecánicas
herramientas/       validar.py, empaquetar.py, vista_previa.py, tipos de @minecraft/server (npm)
dist/               salida: .mcaddon, .mcpack, vistas.png (no se sube al repo)
```

## Flujo de trabajo (siempre en este orden)

1. **Entender antes de tocar.** Lee `Zombie_Apocalypse/LEEME.md` y los archivos implicados. Para
   formatos y reglas, mira [referencia.md](referencia.md). Si algo de la API no está claro, búscalo en
   los tipos: `herramientas/node_modules/@minecraft/server/index.d.ts` (es la versión exacta que usa el
   manifest). No inventes métodos ni componentes.
2. **Hacer el cambio**, imitando el estilo del código que ya hay (español, comentarios cortos,
   `system.runInterval` espaciado, nada cada tick).
3. **Comprobar** (desde la raíz del repo):
   ```bash
   (cd herramientas && npm ci --no-audit --no-fund >/dev/null) # una vez por sesión
   python3 herramientas/validar.py                              # JSON, referencias cruzadas, texturas, textos
   (cd herramientas && npx tsc -p tsconfig.json)                # scripts contra la API real
   ```
   Arregla **todos** los errores. Los avisos, revísalos uno a uno.
4. **Mirar** si cambió algo visual (texturas, geometría, entidades nuevas):
   ```bash
   pip install pillow -q 2>/dev/null; python3 herramientas/vista_previa.py   # -> dist/vistas.png
   ```
   **Abre la imagen y mírala** antes de dar nada por bueno. Dibuja frente, lado y espalda en pose de
   reposo, sin animaciones: sirve para ver texturas que no encajan, caras vacías o estiradas.
5. **Empaquetar** para que el usuario pruebe:
   ```bash
   python3 herramientas/empaquetar.py --subir-version   # -> dist/Zombie_Apocalypse.mcaddon
   ```
   `--subir-version` es obligatorio si el usuario ya importó una versión anterior: Minecraft **no
   reemplaza** un pack con el mismo UUID y versión. Envía el `.mcaddon` con SendUserFile.
6. **Commit y push** a la rama de trabajo.
7. **Pedir la prueba** con instrucciones concretas (ver abajo) y corregir con lo que el usuario mande.

## Reglas que más fallan en Bedrock

- **Texturas de los zombies: 64×32.** Todos usan `geometry.zombie` (vanilla, 64×32). Una skin de
  64×64 se ve estirada. El validador lo detecta. Si se quiere 64×64 (con capas de ropa), hay que
  cambiar la geometría a `geometry.humanoid.custom` o a una propia, no solo la imagen.
- **Toda entidad del BP necesita su client entity en el RP** con el mismo `identifier`, o es invisible.
- **Las propiedades que lee el RP** (`q.property('za:accion')`) deben estar declaradas en el BP con
  `"client_sync": true`.
- **Scripts:** solo módulos estables (`@minecraft/server` y `@minecraft/server-ui` 2.0.0, sin Beta
  APIs). Nada de llamadas nativas al cargar el módulo: todo se inicializa dentro de `system.run()`
  (ya está así en `main.js`). Envolver en `try/catch` lo que toque entidades que pueden haber muerto.
- **UUIDs:** no cambiar nunca los del header una vez publicado (el usuario perdería el pack en sus
  mundos). Al crear un pack nuevo, generar UUIDs nuevos con `python3 -c "import uuid;print(uuid.uuid4())"`.
- **Textos:** cada entidad necesita `entity.<id>.name` y `item.spawn_egg.entity.<id>.name` en
  **los dos** `.lang`. Bedrock no muestra emojis.
- **Rendimiento en móvil:** límite global de zombies (40) y bucles espaciados. No añadir bucles por
  tick ni búsquedas de entidades en radios grandes.

## Lo visual: no adivinar

En otro proyecto se perdió mucho tiempo colocando objetos a ciegas. Aquí:
- No digas que algo "se ve bien" sin haber mirado `dist/vistas.png` o una captura del usuario.
- Si un cambio visual no se puede comprobar (animaciones, partículas, cómo se mueve), dilo y pide un
  video corto.
- Prefiere cambios pequeños con prueba entre medias a una entrega enorme sin probar.

## Qué pedir al usuario en cada prueba

1. Importar `Zombie_Apocalypse.mcaddon`, activar **los dos** packs en un mundo de prueba (copia, no su mundo principal).
2. Activar **Content Log** (Ajustes → Creador → "Content Log GUI" y "Content Log File") y mandar
   **captura de los errores** que salgan al entrar.
3. Invocar lo que se cambió (`/summon za:zombie_minero`, por ejemplo) y mandar **capturas o un video
   corto** de frente, de lado y en movimiento.
4. Decir qué esperaba ver y qué vio.
