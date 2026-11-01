import { EasingType, HudVisibility, InputPermissionCategory, Player, system, world } from "@minecraft/server";
import { ANIM, PARTICLES, PROP } from "../config.js";
import { sostener } from "../equipo.js";
import { estados } from "../estado.js";
import { animate, avisar, blockAt, FRENTES, mirarA, now, particleAt, soundAt } from "../util.js";

// Cinemática de la construcción del robot (10 segundos). Los cinco Claudes, con
// martillo, destornillador y llave, arman el robot pieza por pieza: cada pieza aparece
// primero como un holograma cian y luego se materializa con chispas y un destello.
// Los que trabajan arriba vuelan con botas cohete. La cámara cambia de plano con
// fundidos (piernas, torso y brazos, cabina) y al final un destello blanco: los
// bloques se transforman en el robot y los cinco se suben de un salto.

export const DURACION = 200;
const INICIO_PIEZAS = 12;
const ENTRE_PIEZAS = 5.4;
const HERRAMIENTAS = [1, 2, 3, 1, 2]; // 1 martillo, 2 destornillador, 3 llave
const ANIM_HERR = { 1: ANIM.martillar, 2: ANIM.atornillar, 3: ANIM.apretar };
const SECCIONES = [
  { hasta: 6, texto: "§7Piernas y cadera §f· hierro a martillazos" },
  { hasta: 12, texto: "§7Torso §f· núcleo de redstone y placas de cobre" },
  { hasta: 18, texto: "§7Brazos §f· minigun y cañón láser" },
  { hasta: 21, texto: "§7Hombros §f· lanzamisiles" },
  { hasta: 25, texto: "§7Cabina §f· visor y cúpula de vidrio" },
];

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

// Corte de plano: pone la cámara en "desde" y, un tick después, la lleva suave hasta "hacia".
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

function fundido(o, color, entra, queda, sale) {
  for (const p of o.cine.jugadores) {
    try {
      p.camera.fade({ fadeColor: color, fadeTime: { fadeInTime: entra, holdTime: queda, fadeOutTime: sale } });
    } catch {
      // Sin fundido.
    }
  }
}

function titulo(o, texto, sub) {
  for (const p of o.cine.jugadores) {
    try {
      p.onScreenDisplay.setTitle(texto, { subtitle: sub, fadeInDuration: 6, stayDuration: 40, fadeOutDuration: 10 });
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

const NEGRO = { red: 0, green: 0, blue: 0 };
const BLANCO = { red: 1, green: 1, blue: 1 };

// Puestos de trabajo alrededor del robot (frente izquierda y derecha, lados y atrás).
function puesto(o, k) {
  const ang = [-0.75, 0.75, -1.75, 1.75, Math.PI][k] ?? 0;
  return local(o, Math.cos(ang) * 3.3, 0, Math.sin(ang) * 3.3);
}

export function empezarCinematica(o, jugadores) {
  o.cine = { t: 0, jugadores: jugadores.filter((p) => p.isValid), alturas: o.grupo.map(() => 0) };
  for (const p of o.cine.jugadores) {
    enCinematica.add(p.id);
    try {
      p.onScreenDisplay.setHudVisibility(HudVisibility.Hide);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
      p.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
    } catch {
      // Jugador no disponible.
    }
  }
  fundido(o, NEGRO, 0, 0.35, 0.8);
  titulo(o, "§b§lIQ 500 × 5", "§fLos Claudes construyen su robot");
  const centro = local(o, 0, 3, 0);
  camara(o, local(o, 9, 6.5, -9), local(o, 9, 5, 7), centro, 2.5);
  o.grupo.forEach((n, k) => {
    try {
      n.setProperty(PROP.herramienta, HERRAMIENTAS[k] ?? 1);
      sostener(n, "minecraft:air");
      sostener(n, "minecraft:air", "slot.weapon.offhand");
      n.teleport(puesto(o, k), { facingLocation: centro });
      const s = estados.get(n.id);
      if (s) s.sinCaidaHasta = now() + 400;
    } catch {
      // Claude no disponible.
    }
  });
  soundAt(o.dim, o.c, "random.anvil_use", 0.8, 1);
}

export function soltarJugadores(o) {
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
}

const idDe = (b) => (typeof b === "string" ? b : b.type.id);

function ponerPieza(o, k, vivos) {
  const paso = o.plano[k];
  if (!paso) return;
  const n = vivos[k % vivos.length];
  const herr = HERRAMIENTAS[o.grupo.indexOf(n)] ?? 1;
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
  particleAt(o.dim, herr === 2 ? PARTICLES.chispaElectrica : herr === 3 ? PARTICLES.idea : PARTICLES.chispaCae, centro);
  if (herr === 1) soundAt(o.dim, centro, "random.anvil_land", 1.6 + Math.random() * 0.4, 0.4);
  else if (herr === 2) soundAt(o.dim, centro, "random.click", 1.4, 0.8);
  else soundAt(o.dim, centro, "random.anvil_use", 1.9, 0.35);
  if (/glass/.test(idDe(paso.bloque))) soundAt(o.dim, centro, "random.glass", 1.4, 0.4);
  if (k % 5 === 4) soundAt(o.dim, o.c, "note.pling", 1 + k / 30, 0.6);
  const seccion = SECCIONES.find((x) => x.hasta === k);
  if (seccion) {
    barra(o, seccion.texto);
    particleAt(o.dim, PARTICLES.onda, local(o, 0, 0.2, 0));
    soundAt(o.dim, o.c, "random.levelup", 1.2 + k / 40, 0.5);
  }
}

// Un tick de la cinemática. Devuelve true al terminar.
export function tickCinematica(o, vivos, alTransformar) {
  const ci = o.cine;
  const t = ++ci.t;
  const centro = local(o, 0, 3, 0);

  // --- Las piezas: holograma, herramienta y materialización ---
  for (let k = 0; k < o.plano.length; k++) {
    const tk = INICIO_PIEZAS + Math.round(k * ENTRE_PIEZAS);
    const paso = o.plano[k];
    if (t === tk - 6) {
      particleAt(o.dim, PARTICLES.holo, { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 });
      soundAt(o.dim, paso.pos, "random.orb", 2, 0.25);
    }
    if (t === tk - 3) {
      const n = vivos[k % vivos.length];
      const herr = HERRAMIENTAS[o.grupo.indexOf(n)] ?? 1;
      const i = o.grupo.indexOf(n);
      ci.alturas[i] = Math.max(0, paso.pos.y - o.c.y - 1.4); // los de arriba vuelan con botas cohete
      mirarA(n, { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 });
      animate(n, ANIM_HERR[herr]);
    }
    if (t === tk) ponerPieza(o, k, vivos);
  }

  // Cada Claude va (suave) a la altura de su pieza; si está en el aire, echa fuego por los pies.
  if (t < 166) {
    vivos.forEach((n) => {
      const i = o.grupo.indexOf(n);
      const base = puesto(o, i);
      try {
        const y = n.location.y + (base.y + ci.alturas[i] - n.location.y) * 0.25;
        n.teleport({ x: base.x, y, z: base.z }, { rotation: n.getRotation(), keepVelocity: false });
        if (y > base.y + 0.3 && t % 2 === 0) particleAt(o.dim, PARTICLES.cohete, { x: base.x, y: y - 0.1, z: base.z });
      } catch {
        // Claude no disponible.
      }
    });
  }

  // --- Planos de cámara con transiciones ---
  if (t === 47) fundido(o, NEGRO, 0.15, 0.1, 0.3);
  if (t === 50) camara(o, local(o, 4.6, 0.6, -2.2), local(o, 4.0, 0.9, 2.0), local(o, 0, 1.4, 0), 2.2);
  if (t === 93) fundido(o, BLANCO, 0.1, 0.05, 0.35);
  if (t === 95) camara(o, local(o, 1.5, 3.2, 7.6), local(o, -1.2, 3.4, 6.6), local(o, 0, 3.2, 0), 2.0);
  if (t === 133) fundido(o, NEGRO, 0.12, 0.08, 0.3);
  if (t === 135) camara(o, local(o, -4.5, 10, -3), local(o, -2.6, 9.2, 2.2), local(o, 0, 6, 0), 1.4);
  if (t === 158) fundido(o, NEGRO, 0.1, 0.05, 0.25);
  if (t === 160) camara(o, local(o, 8.8, 1.2, 0.6), local(o, 7.2, 1.7, -0.4), local(o, 0, 3.5, 0), 2.0);

  // --- Encendido: chispas por toda la estructura ---
  if (t >= 152 && t < 166 && t % 2 === 0) {
    for (const p of o.puestos) if (Math.random() < 0.25) particleAt(o.dim, PARTICLES.chispaElectrica, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
  }
  if (t === 152) {
    soundAt(o.dim, o.c, "beacon.power", 0.8, 1);
    barra(o, "§b¡Encendido!");
  }
  if (t === 156) {
    vivos.forEach((n) => {
      animate(n, ANIM.celebrar);
      try {
        n.setProperty(PROP.herramienta, 0);
      } catch {
        // Claude no disponible.
      }
    });
  }
  // --- Transformación: destello blanco, los bloques se vuelven el robot y se suben ---
  if (t === 166) {
    fundido(o, BLANCO, 0.15, 0.25, 0.9);
    particleAt(o.dim, PARTICLES.fusionDestello, centro);
    particleAt(o.dim, PARTICLES.onda, local(o, 0, 0.2, 0));
    soundAt(o.dim, o.c, "random.explode", 1.4, 0.7);
    alTransformar();
  }
  if (t === 186) titulo(o, "§b§lROBOT DE LOS CLAUDES", "§fIQ 500 · ¡5 minutos de batalla!");
  if (t >= DURACION) {
    fundido(o, NEGRO, 0.15, 0.1, 0.4);
    soltarJugadores(o);
    return true;
  }
  return false;
}

// Para los mensajes de la cinemática fuera de cámara (jugadores lejos).
export function avisarConstruccion(o) {
  avisar(o.dim, o.c, "§b¡Los Claudes están armando su robot!", 96);
}
