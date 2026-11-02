import { EasingType, HudVisibility, InputPermissionCategory, Player, system, world } from "@minecraft/server";
import { ANIM, PARTICLES, PROP } from "../config.js";
import { sostener } from "../equipo.js";
import { estados } from "../estado.js";
import { animate, avisar, blockAt, FRENTES, mirarA, now, particleAt, reemplazable, soundAt } from "../util.js";

// Cinemática de la construcción del robot (10 segundos), en planos cortos unidos por
// transiciones suaves (fundido a negro):
//   1. Un Claude agarra un bloque de hierro y lo mira.
//   2. Un Claude trabaja con el destornillador (chispas).
//   3. Un Claude martilla un bloque de hierro (sonido de martillo).
//   4. Un Claude aprieta con la llave inglesa (sonido metálico de la palanca).
//   5. Aparece el robot ya construido, con los cinco Claudes arriba.
// Mientras tanto las piezas del robot se van armando detrás (holograma cian y
// destello). Los jugadores que la ven no se mueven ni reciben daño.

export const DURACION = 200;
const CORTES = [40, 80, 120, 160]; // cambios de plano (en el negro del fundido)
const INICIO_PIEZAS = 10;
const ENTRE_PIEZAS = 5.4;
const HERRAMIENTAS = [0, 2, 1, 3, 1]; // 0 nada (bloque de hierro), 1 martillo, 2 destornillador, 3 llave

// Jugadores que están viendo una cinemática (no reciben daño mientras tanto).
export const enCinematica = new Set();

world.beforeEvents.entityHurt.subscribe((event) => {
  if (event.hurtEntity instanceof Player && enCinematica.has(event.hurtEntity.id)) event.cancel = true;
});

// Punto con ejes del sitio: a hacia el jugador (frente), b a la derecha, h hacia arriba.
function local(o, a, h, b) {
  const f = FRENTES[o.frente];
  return { x: o.c.x + 0.5 + f.x * a - f.z * b, y: o.c.y + h, z: o.c.z + 0.5 + f.z * a + f.x * b };
}

// Puesto de trabajo de cada Claude alrededor del robot (frente izq./der., lados y atrás).
const ANGULOS = [-0.75, 0.75, -1.75, 1.75, Math.PI];
function puesto(o, k) {
  const ang = ANGULOS[k] ?? 0;
  return local(o, Math.cos(ang) * 3.3, 0, Math.sin(ang) * 3.3);
}

// Desde el puesto k: hacia el robot, a su derecha y un punto "relativo" a él.
function marco(o, k) {
  const p = puesto(o, k);
  const c = local(o, 0, 0, 0);
  const d = Math.hypot(c.x - p.x, c.z - p.z) || 1;
  const haciaRobot = { x: (c.x - p.x) / d, z: (c.z - p.z) / d };
  const derecha = { x: -haciaRobot.z, z: haciaRobot.x };
  const rel = (adelante, alto, lado) => ({
    x: p.x + haciaRobot.x * adelante + derecha.x * lado, y: p.y + alto, z: p.z + haciaRobot.z * adelante + derecha.z * lado });
  return { p, rel };
}

function camara(o, desde, hacia, mira, segundos) {
  for (const p of o.cine.jugadores) {
    try {
      p.camera.setCamera("minecraft:free", { location: desde, facingLocation: mira });
    } catch {
      // Sin cámara.
    }
  }
  if (!hacia) return;
  system.runTimeout(() => {
    for (const p of o.cine?.jugadores ?? []) {
      if (!enCinematica.has(p.id)) continue;
      try {
        p.camera.setCamera("minecraft:free", { location: hacia, facingLocation: mira,
          easeOptions: { easeTime: segundos, easeType: EasingType.InOutSine } });
      } catch {
        // Sin cámara.
      }
    }
  }, 1);
}

// Transición suave: fundido a negro que tapa el corte de plano.
function transicion(o) {
  for (const p of o.cine.jugadores) {
    try {
      p.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.3, holdTime: 0.15, fadeOutTime: 0.45 } });
      p.playSound("item.book.page_turn", { pitch: 0.7, volume: 0.6 });
    } catch {
      // Sin fundido.
    }
  }
}

// Sonido para los que ven la cinemática (suena "en su oído", aunque la cámara esté lejos)
// y en el lugar, para los demás.
function sonar(o, id, donde, pitch = 1, volumen = 1) {
  for (const p of o.cine.jugadores) {
    try {
      p.playSound(id, { pitch, volume: volumen });
    } catch {
      // Sin sonido.
    }
  }
  soundAt(o.dim, donde, id, pitch, volumen * 0.6);
}

function titulo(o, texto, sub) {
  for (const p of o.cine.jugadores) {
    try {
      p.onScreenDisplay.setTitle(texto, { subtitle: sub, fadeInDuration: 8, stayDuration: 40, fadeOutDuration: 12 });
    } catch {
      // Sin título.
    }
  }
}

function barra(o, texto) {
  for (const p of o.cine.jugadores) {
    try {
      p.onScreenDisplay.setActionBar(texto);
    } catch {
      // Sin barra.
    }
  }
}

// Donde esperan, sin estorbar a la cámara, los jugadores que estaban lejos.
function palco(o) {
  return { x: o.c.x + 0.5, y: o.c.y + 18, z: o.c.z + 0.5 };
}

export function empezarCinematica(o, jugadores) {
  o.cine = { t: 0, jugadores: jugadores.filter((p) => p.isValid), yunque: undefined, viajeros: new Map() };
  for (const p of o.cine.jugadores) {
    enCinematica.add(p.id);
    // Lejos (o en otra dimensión): la cámara no podría mostrar el sitio (el mundo no está
    // cargado ahí). Lo lleva un momento al sitio y al terminar lo devuelve.
    try {
      const lejos = p.dimension.id !== o.dim.id || Math.hypot(p.location.x - o.c.x, p.location.z - o.c.z) > 40;
      if (lejos) {
        o.cine.viajeros.set(p.id, { p, pos: { ...p.location }, rot: p.getRotation(), dim: p.dimension });
        p.teleport(palco(o), { dimension: o.dim, keepVelocity: false });
      }
    } catch {
      // No se pudo llevar.
    }
    try {
      p.onScreenDisplay.setHudVisibility(HudVisibility.Hide);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
      p.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0, holdTime: 0.3, fadeOutTime: 0.6 } });
    } catch {
      // Jugador no disponible.
    }
  }
  const centro = local(o, 0, 2, 0);
  o.grupo.forEach((n, k) => {
    try {
      const h = HERRAMIENTAS[k] ?? 1;
      n.setProperty(PROP.herramienta, h);
      sostener(n, h === 0 ? "minecraft:iron_block" : "minecraft:air");
      sostener(n, "minecraft:air", "slot.weapon.offhand");
      n.teleport(puesto(o, k), { facingLocation: centro });
      const s = estados.get(n.id);
      if (s) s.sinCaidaHasta = now() + 400;
    } catch {
      // Claude no disponible.
    }
  });
  // Plano 1: el Claude que agarra un bloque de hierro, de frente y de cerca.
  const { rel } = marco(o, 0);
  camara(o, rel(2.3, 1.7, -0.9), rel(2.0, 1.6, 0.6), rel(0.4, 1.4, 0), 1.8);
  titulo(o, "§b§lIQ 500 × 5", "§fLos Claudes construyen su robot");
  barra(o, "§7Un bloque de hierro...");
}

export function soltarJugadores(o) {
  // Los que estaban lejos vuelven a donde estaban.
  for (const v of o.cine?.viajeros?.values() ?? []) {
    try {
      if (v.p.isValid) v.p.teleport(v.pos, { dimension: v.dim, rotation: v.rot, keepVelocity: false });
    } catch {
      // El jugador salió.
    }
  }
  o.cine?.viajeros?.clear();
  for (const p of o.cine?.jugadores ?? []) {
    enCinematica.delete(p.id);
    try {
      p.camera.clear();
      p.onScreenDisplay.setHudVisibility(HudVisibility.Reset);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
    } catch {
      // El jugador salió.
    }
  }
  for (const n of o.grupo) {
    try {
      if (n.isValid) n.setProperty(PROP.herramienta, 0);
    } catch {
      // Claude no disponible.
    }
  }
  quitarYunque(o);
}

function quitarYunque(o) {
  const y = o.cine?.yunque;
  if (!y) return;
  o.cine.yunque = undefined;
  try {
    const b = blockAt(o.dim, y);
    if (b?.typeId === "minecraft:iron_block") b.setType("minecraft:air");
  } catch {
    // Chunk descargado.
  }
}

// Las piezas del robot se van armando detrás de los planos cortos.
function ponerPieza(o, k) {
  const paso = o.plano[k];
  if (!paso) return;
  const centro = { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 };
  try {
    const b = blockAt(o.dim, paso.pos);
    if (b) {
      if (typeof paso.bloque === "string") b.setType(paso.bloque);
      else b.setPermutation(paso.bloque);
      o.puestos.push(paso.pos);
    }
  } catch {
    // No se pudo colocar.
  }
  particleAt(o.dim, PARTICLES.construir, centro);
  particleAt(o.dim, PARTICLES.fogonazo, centro);
  particleAt(o.dim, PARTICLES.chispaCae, centro);
  soundAt(o.dim, centro, "random.anvil_land", 1.7 + Math.random() * 0.3, 0.25);
}

// Un tick de la cinemática. Devuelve true al terminar.
export function tickCinematica(o, vivos, alTransformar) {
  const ci = o.cine;
  const t = ++ci.t;
  // Los que vinieron de lejos esperan quietos en el palco (sin caerse).
  for (const v of ci.viajeros?.values() ?? []) {
    try {
      if (v.p.isValid) v.p.teleport(palco(o), { dimension: o.dim, keepVelocity: false });
    } catch {
      // El jugador salió.
    }
  }
  const vivo = (k) => o.grupo[k]?.isValid ? o.grupo[k] : undefined;

  // --- Piezas detrás de cámara: holograma y materialización ---
  for (let k = 0; k < o.plano.length; k++) {
    const tk = INICIO_PIEZAS + Math.round(k * ENTRE_PIEZAS);
    if (t === tk - 6) {
      const pz = o.plano[k].pos;
      particleAt(o.dim, PARTICLES.holo, { x: pz.x + 0.5, y: pz.y + 0.5, z: pz.z + 0.5 });
    }
    if (t === tk) ponerPieza(o, k);
  }

  // --- Transiciones suaves (fundido a negro) antes de cada corte ---
  if (CORTES.some((c) => t === c - 6)) transicion(o);

  // --- Plano 1 (0-2 s): agarra un bloque de hierro, lo levanta y lo mira ---
  if (t === 4 && vivo(0)) {
    animate(vivo(0), ANIM.levantarBloque);
    sonar(o, "random.pop", puesto(o, 0), 0.7, 0.6);
    sonar(o, "random.anvil_land", puesto(o, 0), 1.4, 0.3);
  }
  if (t === 26 && vivo(0)) {
    particleAt(o.dim, PARTICLES.idea, marco(o, 0).rel(0.4, 2.3, 0));
    sonar(o, "random.orb", puesto(o, 0), 1.6, 0.4);
  }

  // --- Plano 2 (2-4 s): destornillador ---
  if (t === CORTES[0]) {
    if (vivo(0)) sostener(vivo(0), "minecraft:air"); // el bloque ya está puesto en el robot
    const { rel } = marco(o, 1);
    camara(o, rel(-1.0, 1.9, 1.5), rel(-0.6, 1.8, 1.0), rel(1.0, 1.3, 0), 1.8);
    barra(o, "§7Destornillador: §fpieza por pieza...");
  }
  if (t >= CORTES[0] && t < CORTES[1] && vivo(1)) {
    const n = vivo(1);
    const punta = marco(o, 1).rel(1.0, 1.25, 0.15);
    if ((t - CORTES[0]) % 12 === 0) {
      mirarA(n, punta);
      animate(n, ANIM.atornillar);
    }
    if ((t - CORTES[0]) % 4 === 0) {
      particleAt(o.dim, PARTICLES.chispaElectrica, punta);
      sonar(o, "random.click", punta, 1.5 + Math.random() * 0.3, 0.45);
    }
  }

  // --- Plano 3 (4-6 s): martilla un bloque de hierro ---
  if (t === CORTES[1]) {
    const { rel } = marco(o, 2);
    const yunque = rel(1.1, 0, 0);
    const pos = { x: Math.floor(yunque.x), y: Math.floor(yunque.y), z: Math.floor(yunque.z) };
    try {
      const b = blockAt(o.dim, pos);
      if (b && reemplazable(b)) {
        b.setType("minecraft:iron_block");
        ci.yunque = pos;
      }
    } catch {
      // Sin bloque.
    }
    camara(o, rel(0.9, 0.9, -2.2), rel(1.2, 1.1, -1.7), rel(0.9, 0.6, 0), 1.8);
    barra(o, "§7Martillo: §fhierro reforzado");
  }
  if (t >= CORTES[1] && t < CORTES[2] && vivo(2)) {
    const n = vivo(2);
    const golpe = marco(o, 2).rel(1.1, 1.05, 0);
    if ((t - CORTES[1]) % 10 === 0) {
      mirarA(n, golpe);
      animate(n, ANIM.martillar);
    }
    if ((t - CORTES[1]) % 10 === 6) { // el martillo baja a los 0,28 s de la animación
      sonar(o, "claudenpc.martillo", golpe, 0.95 + Math.random() * 0.1, 1);
      particleAt(o.dim, PARTICLES.chispaCae, golpe);
      particleAt(o.dim, PARTICLES.fogonazo, golpe);
    }
  }

  // --- Plano 4 (6-8 s): llave inglesa ---
  if (t === CORTES[2]) {
    quitarYunque(o);
    const { rel } = marco(o, 3);
    camara(o, rel(-0.8, 1.2, -1.9), rel(-0.3, 1.5, -1.5), rel(1.0, 1.4, 0), 1.8);
    barra(o, "§7Llave inglesa: §ftodo bien apretado");
    sonar(o, "claudenpc.palanca", marco(o, 3).rel(1.0, 1.3, 0), 1, 0.9);
  }
  if (t >= CORTES[2] && t < CORTES[3] && vivo(3)) {
    const n = vivo(3);
    const tuerca = marco(o, 3).rel(1.0, 1.35, -0.1);
    if ((t - CORTES[2]) % 12 === 0) {
      mirarA(n, tuerca);
      animate(n, ANIM.apretar);
    }
    if ((t - CORTES[2]) % 12 === 7) {
      particleAt(o.dim, PARTICLES.chispaCae, tuerca);
      sonar(o, "random.anvil_use", tuerca, 1.9, 0.25);
    }
  }

  // --- Plano 5 (8-10 s): en el negro, los bloques se vuelven el robot y aparece ya construido ---
  if (t === CORTES[3] - 2) {
    // Las piezas que falten se ponen ya (por si algo se atrasó).
    for (let k = 0; k < o.plano.length; k++) {
      const paso = o.plano[k];
      if (!o.puestos.some((p) => p.x === paso.pos.x && p.y === paso.pos.y && p.z === paso.pos.z)) ponerPieza(o, k);
    }
    o.grupo.forEach((n) => {
      try {
        if (n.isValid) n.setProperty(PROP.herramienta, 0);
      } catch {
        // Claude no disponible.
      }
    });
  }
  if (t === CORTES[3]) {
    alTransformar();
    camara(o, local(o, 9, 0.8, 1.5), local(o, 7, 1.8, -0.5), local(o, 0, 3.4, 0), 2.0);
    sonar(o, "beacon.power", local(o, 0, 2, 0), 0.8, 1);
    sonar(o, "claudenpc.martillando", local(o, 0, 1, 0), 0.8, 0.6);
  }
  if (t === CORTES[3] + 8) {
    particleAt(o.dim, PARTICLES.onda, local(o, 0, 0.2, 0));
    particleAt(o.dim, PARTICLES.fusionDestello, local(o, 0, 3, 0));
    sonar(o, "random.anvil_use", local(o, 0, 2, 0), 0.6, 0.8);
    titulo(o, "§b§lROBOT DE LOS CLAUDES", "§fIQ 500 · ¡5 minutos de batalla!");
  }
  if (t >= DURACION) {
    for (const p of ci.jugadores) {
      try {
        p.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.2, holdTime: 0.1, fadeOutTime: 0.5 } });
      } catch {
        // Sin fundido.
      }
    }
    soltarJugadores(o);
    return true;
  }
  return false;
}

// Para los mensajes de la cinemática fuera de cámara (jugadores lejos).
export function avisarConstruccion(o) {
  avisar(o.dim, o.c, "§b¡Los Claudes están armando su robot!", 96);
}
