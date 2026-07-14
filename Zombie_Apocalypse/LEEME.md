# 🧟 Zombie Apocalypse — Addon para Minecraft Bedrock 1.21.90+

22 zombies especializados que atacan tu **estrategia**, no solo tu vida.
Sistema de **Desesperación** (1–99) que escala la horda, y una **Guía de
Supervivencia** in-game con sistema de descubrimiento.

Solo Bedrock nativo: Behavior Pack + Resource Pack + Script API
(`@minecraft/server` 2.0.0, `@minecraft/server-ui` 2.0.0). Compatible con
Realms y servidores Bedrock (BDS).

---

## 📥 Instalación

1. **Copia tus texturas** (no venían en el repo):
   - Las 22 texturas de zombie → `resource_pack/textures/entity/zombie_apocalypse/`
   - `guia_supervivencia.png` → `resource_pack/textures/items/`
   - (cada carpeta tiene un `COLOCA_AQUI_*.md` con la lista exacta)
2. Empaqueta:
   - Renombra `behavior_pack/` → `Zombie_Apocalypse_BP` y comprímelo en `.zip` → renombra a `.mcpack` (o copia la carpeta a `development_behavior_packs`).
   - Igual con `resource_pack/` → `Zombie_Apocalypse_RP`.
3. Actívalos en el mundo (el BP ya declara dependencia del RP: al activar el BP se activa el RP solo).
4. **Requisito**: activar **Beta APIs NO es necesario** (se usan solo módulos estables), pero sí "Ciclos de experimentos" desactivados está bien. Mundo en 1.21.90 o superior.
5. En Realms: sube el mundo con los packs ya aplicados.

Al entrar por primera vez recibes la **Guía de Supervivencia** (también se
craftea: `1 papel + 1 carne podrida`, shapeless). Úsala con clic derecho.

---

## 🖥️ HUD: ¿actionbar o `ui/hud_screen.json`?

**Recomendación implementada: actionbar.** Razones:

- **No rompe con otros addons.** `hud_screen.json` es un archivo global: dos
  packs que lo toquen entran en conflicto y uno pisa al otro.
- **Sobrevive a las actualizaciones de Mojang.** La UI JSON no tiene contrato
  estable; cada update de cliente puede romper un HUD custom. La actionbar es
  API estable de script.
- **Coste cero de mantenimiento** y funciona idéntico en móvil/consola/PC.

Contra: no tiene "marco dorado" ni posición fija en la esquina — es texto
centrado sobre la hotbar, refrescado cada 2 s. Si más adelante quieres el
marco dorado de verdad, se puede añadir un `hud_screen.json` opcional, pero
sabiendo que pierdes compatibilidad con otros packs de UI.

---

## ⚙️ Qué se adaptó de las ideas imposibles (y por qué)

| Idea | Realidad | Implementación |
|---|---|---|
| "Zombies que aprenden" | No hay ML en Bedrock | Escalonado por Desesperación: a más nivel, spawn de tipos con mejores parámetros de IA (velocidad, rango, habilidades) |
| "Coordinación táctica" | No hay pathfinding grupal | El **General** aplica Speed por effect y dispara el evento `za:coordinar`, que activa un component group con `follow_range` 24→48 en los zombies a 16 bloques. Al morir, `za:descoordinar` lo revierte |
| "Construir cualquier estructura" | No existe | El **Constructor** coloca patrones fijos: escalón de rampa si estás >3 bloques arriba, bloque de puente si hay foso. Siempre `mossy_cobblestone`, registrado y **auto-limpiado a los 2 min** |
| "Romper bloques inteligente" | Parcial | **Raycast** al jugador; si no hay línea de visión, rompe bloques del frente que estén en la **lista permitida**, con cooldown por dureza. Obsidiana ≈ 30 s por operación (lentísimo, no imposible). Bedrock/barrier/reforzado: intocables |
| "Túnel 3×3" | Costoso | Túnel **2×2** (pasa el resto de la horda), máx. 2 bloques por operación por zombie y **6 bloques globales por pasada** (cada 10 ticks) |
| "IA que nunca se atora" | Imposible de garantizar | **Watchdog**: 10 s sin moverse → si no hay jugador a <24 bloques, despawn; si lo hay, se le perdona y se reinicia el reloj. Minero/Constructor "trabajando" no cuentan como atorados |

## ❌ Qué NO se pudo hacer (aunque se pidió)

1. **El Hacha NO rompe escudos.** En Bedrock los ataques de mobs no
   deshabilitan escudos (ni existe componente para ello). Compensación: es el
   daño más alto de su rango (8) con ataque lento. La ficha de la Guía se
   redactó acorde ("no intercambies golpes"), sin prometer rotura de escudo.
2. **El Arquero no "busca alturas"** de forma deliberada: no hay goal de
   pathfinding "ir a terreno alto". Tiene IA de tirador a distancia (12
   bloques), que en la práctica niega torres igualmente.
3. **"Armadura alta" de Caballero/General** no es un componente de armadura de
   entidad (no existe): se implementó con **equipamiento real** (armadura de
   hierro/diamante vía `minecraft:equipment`), que sí reduce daño físico, más
   resistencia a knockback. Coincide con la ficha: fuego/veneno la ignoran.
4. **Espadachín "bloquea"**: no hay mecánica de parry para mobs. Se simula en
   script: 25% de los golpes del jugador le devuelven la mitad del daño
   (con sonido de escudo). El resultado percibido es el mismo.
5. **Lobos del Domador**: no hay 23ª textura, así que son lobos **vanilla** a
   los que se les dispara su evento de ira por script (se prueban los dos
   nombres de evento conocidos). Si Mojang los renombra, los lobos aparecen
   igual pero tardarían en agredir hasta que los golpees.
6. **Emojis en la Guía**: la fuente de Bedrock no renderiza emoji (salen
   cuadros). Se usan códigos de color `§` y texto plano en los formularios.
7. **Lentitud II / Veneno / Fuego al golpear**: el JSON de entidad solo admite
   amplificador 0, así que estos efectos se aplican por script en
   `entityHurt` (exactos: Lentitud II 5 s, Veneno 7 s, fuego 5 s).

## ✅ Verificaciones hechas antes de entregar

- Los **22 `identifier`** coinciden 1:1 entre `behavior_pack/entities/`,
  `resource_pack/entity/`, `scripts/zombies_data.js`, `sounds.json` y los
  `.lang` (BP y RP se generan desde la misma tabla; verificado con script).
- Las **22 texturas** están referenciadas con la ruta exacta
  `textures/entity/zombie_apocalypse/<nombre>` (los `.png` los pones tú, ver
  arriba).
- Todos los `.json` validados y todos los `.js` pasan chequeo de sintaxis.
- Ningún texto vive en los scripts: todo sale de `texts/es_MX.lang` y
  `texts/en_US.lang` vía `rawtext`/`translate`.

---

## 📊 Sistema de Desesperación (resumen técnico)

- Por jugador, dynamic property `za:desesperacion`, persiste al salir.
- Sube: +2/día, +1 cada 10 kills, +1 por estar 3 min continuos bajo tierra,
  +1 por 5 min continuos muy fortificado (muestreo barato de ~40 bloques
  fijos alrededor, umbral 70% sólidos). Los contadores se reinician al salir
  a la superficie/moverse: **se siente como impaciencia de la horda, no como
  impuesto por jugar bien**.
- Baja: morir (−10). Única forma.
- Cada decena cruzada avisa en pantalla ("la horda se impacienta").

## ⚡ Presupuesto de rendimiento

| Sistema | Frecuencia | Límite |
|---|---|---|
| Spawner | cada 600 ticks | cap global 40 zombies |
| Minero/Demoledor/Mutante | cada 10 ticks | 2 bloques/zombie, 6 globales, cooldown por dureza |
| Constructor | cada 20 ticks | 1 bloque/zombie, 4 globales, registro ≤400 con auto-limpieza |
| Chamán / Enderman / Invocador | 60 / 40 / 120 ticks | acotado por radio al jugador |
| Watchdog | cada 100 ticks | — |
| HUD / día / refugio | 40 / 200 / 1200 ticks | — |
| Despawn a >64 bloques | componente nativo `minecraft:despawn` | gratis |

Ningún `getEntities()` sin `location` + `maxDistance` (o `families`).

## 📁 Estructura

```
Zombie_Apocalypse/
├── behavior_pack/
│   ├── manifest.json            deps: @minecraft/server + server-ui + RP
│   ├── entities/                22 entidades (generadas de una tabla única)
│   ├── items/guia_supervivencia.json
│   ├── recipes/guia_supervivencia.json
│   ├── loot_tables/entities/    loot común, loot del Mutante, equipamiento
│   └── scripts/
│       ├── main.js              punto de entrada
│       ├── zombies_data.js      tabla de spawn (generada, no editar ids)
│       ├── util.js              helpers + lista permitida de bloques
│       ├── desesperacion.js     contador, HUD, subidas/bajadas
│       ├── spawner.js           oleadas según nivel, cap 40, boss
│       ├── combate.js           efectos, explosión, tótem, kills
│       ├── guia.js              formularios del papel + descubrimiento
│       └── ia/
│           ├── minero.js        raycast + túnel 2x2 (también Demoledor/Mutante)
│           ├── constructor.js   rampas/puentes marcados y auto-limpiados
│           ├── general.js       buffs + follow_range vía component group
│           ├── especiales.js    Chamán, Invocador, Enderman, Domador
│           └── watchdog.js      anti-atorados
└── resource_pack/
    ├── manifest.json
    ├── entity/                  22 client entities (geometry.zombie + tu textura)
    ├── textures/                ← AQUÍ van tus .png (ver COLOCA_AQUI_*.md)
    ├── animations/              minar, construir, lanzar_pearl, usar_totem, trepar
    ├── animation_controllers/   cambio por q.property('za:accion') / trepado
    ├── render_controllers/
    ├── sounds.json              sonidos vanilla de zombie reutilizados
    └── texts/                   es_MX.lang, en_US.lang, languages.json
```

## 🎯 Filosofía de diseño

Cada zombie existe para romper una estrategia concreta: muro → Trepador,
techo → Minero, búnker → Demoledor, torre → Arquero, obsidiana → Enderman.
Durísimo, nunca imposible: la Guía siempre da la salida — pero primero tienes
que **sobrevivir al encuentro** para desbloquear su ficha.
