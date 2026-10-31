import { EasingType, HudVisibility, InputPermissionCategory, system, world } from "@minecraft/server";
import { ANIM, AURA, DIMENSIONES, FUSION, GOLDEN, NPC, PARTICLES } from "./config.js";
import { estados } from "./estado.js";
import { registrarGolden } from "./golden.js";
import { caminarA, detener, velocidad } from "./movimiento.js";
import { animate, burst, distancia, particleAt, soundAt } from "./util.js";

// Fusión: cinco Claudes con IQ 300 dejan de perseguir al jugador, se reúnen en
// círculo, bailan una danza propia, los envuelve una esfera de aura y, tras una
// cinemática de 10 s, nace Claude Golden.

let activa;

function promedio(lista) {
  const s = lista.reduce((a, e) => ({ x: a.x + e.location.x, y: a.y + e.location.y, z: a.z + e.location.z }), { x: 0, y: 0, z: 0 });
  return { x: s.x / lista.length, y: s.y / lista.length, z: s.z / lista.length };
}

export function enFusion() {
  return !!activa;
}

// Cada 2 s: si hay 5 genios juntos, empieza; si están lejos, se buscan entre ellos.
export function revisarFusion() {
  if (activa) return;
  for (const id of DIMENSIONES) {
    let lista;
    try {
      lista = world.getDimension(id).getEntities({ type: NPC });
    } catch {
      continue;
    }
    const genios = lista.filter((n) => {
      const s = estados.get(n.id);
      return s && s.iq >= FUSION.iq && !s.bote;
    });
    if (genios.length < FUSION.cantidad) {
      for (const n of lista) {
        const s = estados.get(n.id);
        if (s) s.reunion = undefined;
      }
      continue;
    }
    for (const a of genios) {
      const cerca = genios.filter((b) => distancia(a.location, b.location) <= FUSION.radio)
        .sort((x, y) => distancia(a.location, x.location) - distancia(a.location, y.location));
      if (cerca.length >= FUSION.cantidad) {
        iniciar(cerca.slice(0, FUSION.cantidad));
        return;
      }
    }
    const centro = promedio(genios);
    for (const n of genios) {
      const s = estados.get(n.id);
      if (s && distancia(n.location, centro) < FUSION.busqueda) s.reunion = centro;
    }
  }
}

function jugadoresCerca(centro, dimension) {
  try {
    return dimension.getPlayers({ location: centro, maxDistance: 48 });
  } catch {
    return [];
  }
}

function soltarJugador(p) {
  try {
    p.camera.clear();
    p.onScreenDisplay.setHudVisibility(HudVisibility.Reset);
    p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
    p.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, true);
  } catch {
    // El jugador salió.
  }
}

function iniciar(grupo) {
  const dimension = grupo[0].dimension;
  const c = promedio(grupo);
  const centro = { x: c.x, y: Math.min(...grupo.map((n) => n.location.y)), z: c.z };
  const miembros = grupo.map((npc, i) => {
    const s = estados.get(npc.id);
    s.fusion = true;
    s.reunion = undefined;
    s.obra = undefined;
    detener(npc);
    velocidad(npc, 0);
    const a = (i / grupo.length) * Math.PI * 2;
    return { npc, a, slot: { x: centro.x + Math.cos(a) * 3, y: centro.y, z: centro.z + Math.sin(a) * 3 } };
  });
  activa = { dimension, centro, miembros, t: 0, jugadores: [], aura: undefined };
  for (const p of jugadoresCerca(centro, dimension)) {
    p.onScreenDisplay.setActionBar("§d¡Cinco Claudes con IQ 300 se están reuniendo...!");
  }
  soundAt(dimension, centro, "beacon.activate", 0.7);
  activa.id = system.runInterval(tickFusion, 1);
  // Seguro: pase lo que pase, a los 40 s se libera a los jugadores.
  system.runTimeout(() => {
    if (activa) terminar(false);
  }, 800);
}

function abortar() {
  terminar(false);
}

function terminar(exito) {
  const f = activa;
  if (!f) return;
  system.clearRun(f.id);
  activa = undefined;
  for (const p of f.jugadores) soltarJugador(p);
  try {
    if (f.aura?.isValid) f.aura.remove();
  } catch {
    // Ya no existe.
  }
  if (!exito) {
    for (const m of f.miembros) {
      const s = estados.get(m.npc.id);
      if (s) s.fusion = false;
    }
  }
}

function camara(f, angulo, radio, alto, ease) {
  const loc = { x: f.centro.x + Math.cos(angulo) * radio, y: f.centro.y + alto, z: f.centro.z + Math.sin(angulo) * radio };
  for (const p of f.jugadores) {
    try {
      p.camera.setCamera("minecraft:free", {
        location: loc, facingLocation: { x: f.centro.x, y: f.centro.y + 2.5, z: f.centro.z },
        easeOptions: { easeTime: ease, easeType: EasingType.InOutSine },
      });
    } catch {
      // Sin cámara.
    }
  }
}

// Melodía propia de la danza (arpegio ascendente y vuelta).
const DANZA = [1.0, 1.19, 1.5, 1.78, 2.0, 1.78, 1.5, 1.19, 1.0, 1.33, 1.68, 2.0, 1.68, 1.33, 1.0, 2.0];

function tickFusion() {
  const f = activa;
  if (!f) return;
  f.t++;
  const t = f.t;
  if (t < 400 && f.miembros.some((m) => !m.npc.isValid)) return abortar();
  try {
    // 0-3 s: se reúnen en círculo mirando al centro.
    if (t === 1 || t === 21 || t === 41) {
      for (const m of f.miembros) caminarA(m.npc, m.slot, 0.25);
    }
    if (t === 58) {
      for (const m of f.miembros) {
        detener(m.npc);
        m.npc.teleport(m.slot, { facingLocation: { x: f.centro.x, y: f.centro.y + 1.6, z: f.centro.z } });
      }
    }
    // 3-11 s: danza sincronizada con música y anillos de luz.
    if (t === 60) for (const m of f.miembros) animate(m.npc, ANIM.danza);
    if (t >= 60 && t < 220 && (t - 60) % 10 === 0) {
      const nota = DANZA[((t - 60) / 10) % DANZA.length];
      soundAt(f.dimension, f.centro, "note.pling", nota, 0.9);
      if ((t - 60) % 20 === 0) particleAt(f.dimension, PARTICLES.fusionAnillo, { x: f.centro.x, y: f.centro.y + 0.2, z: f.centro.z });
      for (const m of f.miembros) burst(m.npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
    }
    // 11-13 s: la esfera de aura los envuelve y empiezan a flotar.
    if (t === 220) {
      f.aura = f.dimension.spawnEntity(AURA, f.centro);
      soundAt(f.dimension, f.centro, "beacon.activate", 0.6);
      soundAt(f.dimension, f.centro, "ambient.weather.thunder", 1.5, 0.5);
      particleAt(f.dimension, PARTICLES.fusionDestello, { x: f.centro.x, y: f.centro.y + 2, z: f.centro.z });
      for (const m of f.miembros) animate(m.npc, ANIM.fusion);
    }
    if (t > 220 && t < 260) {
      for (const m of f.miembros) {
        const l = m.npc.location;
        m.npc.teleport({ x: l.x, y: l.y + 0.04, z: l.z }, { facingLocation: { x: f.centro.x, y: l.y + 0.04, z: f.centro.z } });
      }
    }
    // 13-23 s: cinemática.
    if (t === 260) {
      f.jugadores = jugadoresCerca(f.centro, f.dimension);
      for (const p of f.jugadores) {
        try {
          p.onScreenDisplay.setHudVisibility(HudVisibility.Hide);
          p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, false);
          p.inputPermissions.setPermissionCategory(InputPermissionCategory.Camera, false);
          p.onScreenDisplay.setTitle("§6§lFUSIÓN", { subtitle: "§eIQ 300 × 5", fadeInDuration: 10, stayDuration: 40, fadeOutDuration: 10 });
        } catch {
          // Jugador no disponible.
        }
      }
      camara(f, 0, 14, 7, 0.1);
    }
    if (t > 260 && t < 400 && (t - 260) % 40 === 0) {
      const k = (t - 260) / 40;
      camara(f, k * 1.3, 14 - k * 2, 7 - k, 2);
    }
    if (t > 260 && t < 400) {
      const avance = (t - 260) / 140;
      for (const m of f.miembros) {
        m.a += 0.03 + avance * 0.15;
        const r = 3 * (1 - avance);
        const y = f.centro.y + 1.6 + avance * 2.4;
        m.npc.teleport({ x: f.centro.x + Math.cos(m.a) * r, y, z: f.centro.z + Math.sin(m.a) * r },
          { facingLocation: { x: f.centro.x, y, z: f.centro.z } });
      }
      if ((t - 260) % 20 === 0) {
        particleAt(f.dimension, PARTICLES.fusionEspiral, { x: f.centro.x, y: f.centro.y + 3, z: f.centro.z });
        soundAt(f.dimension, f.centro, "beacon.ambient", 0.6 + (t - 260) / 200, 1);
      }
    }
    if (t === 400) {
      for (const p of f.jugadores) {
        try {
          p.camera.fade({ fadeColor: { red: 1, green: 1, blue: 1 }, fadeTime: { fadeInTime: 0.4, holdTime: 0.6, fadeOutTime: 1.2 } });
        } catch {
          // Sin fundido.
        }
      }
      particleAt(f.dimension, PARTICLES.fusionDestello, { x: f.centro.x, y: f.centro.y + 3, z: f.centro.z });
      soundAt(f.dimension, f.centro, "random.explode", 1.6, 0.5);
      for (const m of f.miembros) {
        try {
          m.npc.remove();
        } catch {
          // Ya no está.
        }
      }
    }
    if (t === 412) {
      const golden = f.dimension.spawnEntity(GOLDEN, { x: f.centro.x, y: f.centro.y + 1, z: f.centro.z });
      registrarGolden(golden);
      f.golden = golden;
      soundAt(f.dimension, f.centro, "random.levelup", 0.8, 1);
      particleAt(f.dimension, PARTICLES.confeti, { x: f.centro.x, y: f.centro.y + 2.5, z: f.centro.z });
      for (const p of f.jugadores) {
        try {
          p.onScreenDisplay.setTitle("§6§lCLAUDE GOLDEN", { subtitle: "§eIQ: §k???§r", fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 15 });
        } catch {
          // Sin título.
        }
      }
      camara(f, -Math.PI / 2, 3.4, 2.6, 1.2);
    }
    if (t >= 470) terminar(true);
  } catch {
    abortar();
  }
}

// Si alguien entra al mundo con la cámara bloqueada (p. ej. tras un cierre), se libera.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (initialSpawn && !activa) soltarJugador(player);
});
