import { EasingType, GameMode, HudVisibility, InputPermissionCategory, MolangVariableMap, system, world } from "@minecraft/server";
import { GOLDEN_FINAL } from "../../config.js";
import { enCinematica } from "../../robot/cinematica.js";
import { blockAt, now } from "../../util.js";

// Herramientas de la fase final de Claude Golden: propiedades, puntos alrededor de él,
// cámara, fundidos, música y textos que aparecen letra por letra (o que tiemblan).

export function prop(e, id, valor) {
  try {
    e.setProperty(id, valor);
    return true;
  } catch {
    return false;
  }
}

export function leerProp(e, id, defecto = 0) {
  try {
    return e.getProperty(id) ?? defecto;
  } catch {
    return defecto;
  }
}

// --- Cómo se ve Golden (sin propiedades: eventos y animaciones que el juego siempre manda) ---

// Forma: 0 normal, 1 con alas y corona, 2 además con las dos espadas (mark_variant).
export function forma(e, n) {
  try {
    e.triggerEvent(`claudenpc:forma_${n}`);
  } catch {
    // Entidad no disponible.
  }
}

// Detalle: 0 nada, 1 sombra sobre los ojos (herido), 2 una orbe en cada mano (skin_id).
export function detalle(g, n) {
  if (g.detalle === n) return;
  g.detalle = n;
  try {
    g.entidad.triggerEvent(`claudenpc:detalle_${n}`);
  } catch {
    // Entidad no disponible.
  }
}

const POSES = ["ninguna", "herido", "cabizbajo", "alzar_derecho", "mano_pecho", "revelacion", "chasquido_listo", "brazos_arriba",
  "orbes_arriba", "orbes_juntas", "marionetas", "pausa", "espadas"];

// Postura que se mantiene (se reemplaza por la siguiente con una transición suave). Se pone
// con playAnimation en un controlador con nombre, igual que los gestos.
export function pose(g, n) {
  const e = g.entidad;
  g.pose = n;
  try {
    e.playAnimation(`animation.claudenpc.golden.pose_${POSES[n] ?? "ninguna"}`, { controller: "claudenpc_golden_pose", blendOutTime: 0.4 });
  } catch {
    // Paquete de recursos no activo.
  }
  if (n === 1 || n === 2) detalle(g, 1);
  else if (g.detalle === 1) detalle(g, 0);
}

// Corte rápido de espada: 1 amarilla (derecha), 2 azul (izquierda), 0 las dos en X.
export function cortar(e, variante) {
  const nombre = ["corte_x", "corte_der", "corte_izq"][variante] ?? "corte_der";
  try {
    e.playAnimation(`animation.claudenpc.golden.${nombre}`, { controller: "claudenpc_golden_corte", blendOutTime: 0.05 });
  } catch {
    // Paquete de recursos no activo.
  }
}

export function animar(e, animacion, blend = 0.2) {
  try {
    e.playAnimation(animacion, { blendOutTime: blend });
  } catch {
    // Paquete de recursos no activo.
  }
}

// Adelante y derecha de alguien que mira con este giro (en Bedrock 0° = sur, 90° = oeste).
export function ejes(yaw) {
  const r = (yaw * Math.PI) / 180;
  return { adelante: { x: -Math.sin(r), z: Math.cos(r) }, derecha: { x: -Math.cos(r), z: -Math.sin(r) } };
}

// Punto relativo a una base: "adelante" bloques hacia donde mira, "alto" hacia arriba y
// "derecha" hacia su derecha (negativo: su izquierda).
export function punto(base, yaw, adelante, alto, derecha = 0) {
  const { adelante: a, derecha: d } = ejes(yaw);
  return { x: base.x + a.x * adelante + d.x * derecha, y: base.y + alto, z: base.z + a.z * adelante + d.z * derecha };
}

export function yawHacia(desde, hacia) {
  return (Math.atan2(-(hacia.x - desde.x), hacia.z - desde.z) * 180) / Math.PI;
}

export function lerp(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
}

export const suave = (k) => k * k * (3 - 2 * k);

export function vivos(jugadores) {
  return jugadores.filter((p) => {
    try {
      return p.isValid;
    } catch {
      return false;
    }
  });
}

// --- Cámara y pantalla --------------------------------------------------------------

export function camara(jugadores, desde, mira, segundos = 0, hasta) {
  for (const p of vivos(jugadores)) {
    try {
      p.camera.setCamera("minecraft:free", { location: desde, facingLocation: mira });
    } catch {
      // Sin cámara.
    }
  }
  if (!hasta) return;
  system.runTimeout(() => {
    for (const p of vivos(jugadores)) {
      if (!enCinematica.has(p.id)) continue;
      try {
        p.camera.setCamera("minecraft:free", { location: hasta, facingLocation: mira,
          easeOptions: { easeTime: segundos, easeType: EasingType.InOutSine } });
      } catch {
        // Sin cámara.
      }
    }
  }, 1);
}

export const NEGRO = { red: 0, green: 0, blue: 0 };
export const AMARILLO = { red: 1, green: 0.86, blue: 0.22 };
export const DORADO = { red: 1, green: 0.78, blue: 0.3 };
export const PLOMO = { red: 0.44, green: 0.46, blue: 0.49 };
export const BLANCO = { red: 1, green: 1, blue: 0.94 };

export function fundido(jugadores, color, entrada, quieto, salida) {
  for (const p of vivos(jugadores)) {
    try {
      p.camera.fade({ fadeColor: color, fadeTime: { fadeInTime: entrada, holdTime: quieto, fadeOutTime: salida } });
    } catch {
      // Sin fundido.
    }
  }
}

export function sonar(jugadores, id, pitch = 1, volumen = 1) {
  for (const p of vivos(jugadores)) {
    try {
      p.playSound(id, { pitch, volume: volumen });
    } catch {
      // Sin sonido.
    }
  }
}

export function barra(jugadores, texto) {
  for (const p of vivos(jugadores)) {
    try {
      p.onScreenDisplay.setActionBar(texto);
    } catch {
      // Sin barra.
    }
  }
}

export function titulo(jugadores, texto, sub = "", entrada = 0, quieto = 12, salida = 4) {
  for (const p of vivos(jugadores)) {
    try {
      p.onScreenDisplay.setTitle(texto, { subtitle: sub || undefined, fadeInDuration: entrada, stayDuration: quieto, fadeOutDuration: salida });
    } catch {
      // Sin título.
    }
  }
}

export function borrarTextos(jugadores) {
  for (const p of vivos(jugadores)) {
    try {
      p.onScreenDisplay.setActionBar(" ");
      p.onScreenDisplay.clearTitle();
    } catch {
      // Sin pantalla.
    }
  }
}

// Bloquea a los jugadores para una cinemática (sin moverse, sin HUD y sin recibir daño).
export function bloquear(jugadores) {
  for (const p of vivos(jugadores)) {
    enCinematica.add(p.id);
    try {
      p.onScreenDisplay.setHudVisibility(HudVisibility.Hide);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
    } catch {
      // Jugador no disponible.
    }
  }
}

export function soltar(jugadores) {
  for (const p of vivos(jugadores)) {
    enCinematica.delete(p.id);
    try {
      p.camera.clear();
      p.onScreenDisplay.setHudVisibility(HudVisibility.Reset);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
    } catch {
      // Jugador no disponible.
    }
  }
}

// --- Música ---------------------------------------------------------------------------

export function musica(jugadores, pista, bucle = false, fundir = 1) {
  for (const p of vivos(jugadores)) {
    try {
      p.playMusic(pista, { fade: fundir, loop: bucle, volume: GOLDEN_FINAL.volumenMusica });
    } catch {
      // Sin música.
    }
  }
}

export function pararMusica(jugadores) {
  for (const p of vivos(jugadores)) {
    try {
      p.stopMusic();
    } catch {
      // Sin música.
    }
  }
}

// --- Partículas con variables ------------------------------------------------------------

export function particula(dim, id, pos, vars) {
  try {
    if (!vars) {
      dim.spawnParticle(id, pos);
      return;
    }
    const mv = new MolangVariableMap();
    for (const [k, v] of Object.entries(vars)) {
      if (typeof v === "number") mv.setFloat(k, v);
      else mv.setVector3(k, v);
    }
    dim.spawnParticle(id, pos, mv);
  } catch {
    // Chunk no cargado.
  }
}

// Una tira (hilo) entre dos puntos: una sola partícula estirada.
export function tira(dim, id, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const largo = Math.hypot(dx, dy, dz);
  if (largo < 0.1) return;
  particula(dim, id, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
    { "variable.dir": { x: dx / largo, y: dy / largo, z: dz / largo }, "variable.largo": largo });
}

// --- Textos: letra por letra y temblorosos ---------------------------------------------

// Primeras "n" letras visibles de un texto (los códigos de color no cuentan).
export function escribir(texto, n) {
  let out = "";
  let vistas = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "§" && i + 1 < texto.length) {
      out += c + texto[i + 1];
      i++;
      continue;
    }
    if (c !== "\n") {
      if (vistas >= n) break;
      vistas++;
    }
    out += c;
  }
  return out;
}

export function letras(texto) {
  return texto.replace(/§./g, "").replace(/\n/g, "").length;
}

// Palabra que tiembla: se corre de lado y cambia de rojo claro a oscuro.
export function temblar(palabra, colores = ["§c", "§4"]) {
  const izq = " ".repeat(Math.floor(Math.random() * 3));
  const der = " ".repeat(Math.floor(Math.random() * 3));
  const col = colores[Math.floor(Math.random() * colores.length)];
  return `${izq}${col}§l${palabra}§r${der}`;
}

// "Esta vez estás" con cada letra de un color dorado distinto.
export function arcoiris(texto, colores = ["§6", "§e", "§g", "§f"]) {
  let out = "";
  let i = 0;
  for (const c of texto) {
    out += c === " " ? c : `${colores[i++ % colores.length]}${c}`;
  }
  return out;
}

// --- Suelo -------------------------------------------------------------------------------

export function solidoEn(dim, p) {
  const b = blockAt(dim, p);
  return !!b && !b.isAir && !b.isLiquid && !/(grass|fern|flower|torch|snow_layer|carpet|vine|sapling|bush|_sign|button|lever|rail)/.test(b.typeId);
}

// Bloque de suelo (el primero sólido) debajo de "p": devuelve la posición encima de él.
export function sueloBajo(dim, p, max = 48) {
  const x = Math.floor(p.x);
  const z = Math.floor(p.z);
  let y = Math.floor(p.y);
  for (let i = 0; i < max; i++, y--) {
    if (solidoEn(dim, { x, y, z })) return { x: x + 0.5, y: y + 1, z: z + 0.5 };
  }
  return { x: x + 0.5, y: Math.floor(p.y), z: z + 0.5 };
}

// --- Jugadores ---------------------------------------------------------------------------

export function jugadoresCerca(dim, centro, radio) {
  try {
    return dim.getPlayers({ location: centro, maxDistance: radio, excludeGameModes: [GameMode.Spectator] });
  } catch {
    return [];
  }
}

export function tiempo() {
  return now();
}

export function todosLosJugadores() {
  try {
    return world.getAllPlayers();
  } catch {
    return [];
  }
}
