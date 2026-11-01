import { EasingType, GameMode, HudVisibility, InputPermissionCategory, system, world } from "@minecraft/server";
import { ANIM, AURA, DIMENSIONES, FUSION, GOLDEN, NPC, PARTICLES } from "./config.js";
import { estados } from "./estado.js";
import { registrarGolden } from "./golden/index.js";
import { caminarA, detener, velocidad } from "./movimiento.js";
import { animate, burst, distancia, now, particleAt, soundAt, superficie } from "./util.js";
import { salirDeClase } from "./clase.js";

// Fusión: cinco Claudes con IQ 1000 dejan de perseguir al jugador, se reúnen en
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

// Búsqueda del jugador antes de fusionarse.
let busqueda;

function sueloEn(dimension, x, z, yRef) {
  const top = superficie(dimension, x, z);
  if (!top || top.isLiquid || Math.abs(top.location.y + 1 - yRef) > 6) return undefined;
  return { x: Math.floor(x) + 0.5, y: top.location.y + 1, z: Math.floor(z) + 0.5 };
}

// Punto de encuentro: unos 7 bloques delante del jugador, donde lo vea bien.
function puntoDelante(jugador) {
  const v = jugador.getViewDirection();
  const h = Math.hypot(v.x, v.z) || 1;
  for (const d of [7, 5, 9, 4]) {
    const p = sueloEn(jugador.dimension, jugador.location.x + (v.x / h) * d, jugador.location.z + (v.z / h) * d, jugador.location.y);
    if (p) return p;
  }
  return { ...jugador.location };
}

function liberar(lista) {
  for (const n of lista) {
    const s = estados.get(n.id);
    if (s) {
      s.reunion = undefined;
      s.reunionDesde = undefined;
    }
  }
}

// Cada 2 s: con 5 genios (IQ 1000) no se fusionan al instante. Primero avisan, buscan
// al jugador y se colocan en círculo frente a él; recién entonces empieza la danza,
// la esfera y la cinemática.
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
      return s && s.iq >= FUSION.iq && !s.bote && !s.robot && !s.robotObra;
    });
    if (genios.length < FUSION.cantidad) {
      liberar(lista);
      if (busqueda?.dim === id) busqueda = undefined;
      continue;
    }
    // Los cinco genios dejan la clase: esto es más importante.
    for (const n of genios) {
      const s = estados.get(n.id);
      if (s?.clase) salirDeClase(n, s, false);
    }
    const centroGenios = promedio(genios);
    let jugador;
    try {
      [jugador] = world.getDimension(id).getPlayers({ location: centroGenios, maxDistance: FUSION.busqueda, closest: 1,
        excludeGameModes: [GameMode.Spectator] });
    } catch {
      jugador = undefined;
    }
    if (!jugador) {
      // Nadie a la vista: se juntan entre ellos y esperan.
      for (const n of genios) {
        const s = estados.get(n.id);
        if (s) s.reunion = centroGenios;
      }
      continue;
    }
    if (!busqueda || busqueda.jugador !== jugador || now() - busqueda.actualizado > 60) {
      busqueda = { dim: id, jugador, punto: puntoDelante(jugador), actualizado: now(), avisado: busqueda?.avisado && busqueda.jugador === jugador };
    }
    const punto = busqueda.punto;
    if (!busqueda.avisado) {
      busqueda.avisado = true;
      try {
        jugador.onScreenDisplay.setTitle("§d§l5 genios", { subtitle: "§fCinco Claudes con IQ 1000 te están buscando...",
          fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 15 });
        soundAt(jugador.dimension, jugador.location, "ambient.weather.thunder", 0.6, 0.5);
      } catch {
        // Sin título.
      }
    }
    // Los cinco más cercanos; cada uno conserva su lugar en el círculo (orden fijo).
    const grupo = [...genios].sort((a, b) => distancia(a.location, punto) - distancia(b.location, punto)).slice(0, FUSION.cantidad)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    let listos = 0;
    grupo.forEach((n, i) => {
      const s = estados.get(n.id);
      const a = (i / FUSION.cantidad) * Math.PI * 2;
      const slot = { x: punto.x + Math.cos(a) * 3, y: punto.y, z: punto.z + Math.sin(a) * 3 };
      s.reunion = slot;
      s.reunionDesde ??= now();
      if (Math.hypot(n.location.x - slot.x, n.location.z - slot.z) < 2.4) listos++;
    });
    // Los genios de sobra miran desde un poco más lejos.
    for (const n of genios) {
      if (grupo.includes(n)) continue;
      const s = estados.get(n.id);
      if (s) s.reunion = { x: punto.x + (Math.random() - 0.5) * 12, y: punto.y, z: punto.z + (Math.random() - 0.5) * 12 };
    }
    if (listos >= FUSION.cantidad && distancia(jugador.location, punto) < 16) {
      busqueda = undefined;
      liberar(genios);
      iniciar(grupo, punto);
      return;
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

function iniciar(grupo, punto) {
  const dimension = grupo[0].dimension;
  const c = punto ?? promedio(grupo);
  const centro = { x: c.x, y: punto ? punto.y : Math.min(...grupo.map((n) => n.location.y)), z: c.z };
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
    p.onScreenDisplay.setActionBar("§d¡Cinco Claudes con IQ 1000 se están reuniendo...!");
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

// Bloques de luz invisibles alrededor de la esfera: la escena brilla de verdad.
function encenderLuces(f) {
  f.luces = [];
  const puntos = [{ x: 0, y: 1, z: 0 }, { x: 0, y: 4, z: 0 }];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    puntos.push({ x: Math.cos(a) * 4, y: 1, z: Math.sin(a) * 4 }, { x: Math.cos(a) * 3, y: 5, z: Math.sin(a) * 3 });
  }
  for (const d of puntos) {
    const pos = { x: Math.floor(f.centro.x + d.x), y: Math.floor(f.centro.y + d.y), z: Math.floor(f.centro.z + d.z) };
    try {
      const b = f.dimension.getBlock(pos);
      if (!b?.isAir) continue;
      b.setType("minecraft:light_block_15");
      f.luces.push(pos);
    } catch {
      // Fuera del mundo cargado.
    }
  }
}

function apagarLuces(f) {
  for (const pos of f.luces ?? []) {
    try {
      const b = f.dimension.getBlock(pos);
      if (b?.typeId === "minecraft:light_block_15") b.setType("minecraft:air");
    } catch {
      // Chunk descargado.
    }
  }
  f.luces = [];
}

function terminar(exito) {
  const f = activa;
  if (!f) return;
  system.clearRun(f.id);
  activa = undefined;
  apagarLuces(f);
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
      encenderLuces(f);
      f.aura = f.dimension.spawnEntity(AURA, f.centro);
      soundAt(f.dimension, f.centro, "beacon.activate", 0.6);
      soundAt(f.dimension, f.centro, "ambient.weather.thunder", 1.5, 0.5);
      particleAt(f.dimension, PARTICLES.fusionDestello, { x: f.centro.x, y: f.centro.y + 2, z: f.centro.z });
      for (const m of f.miembros) animate(m.npc, ANIM.fusion);
    }
    if (t > 220 && t < 412 && t % 3 === 0) {
      // Chispas doradas que recorren la superficie de la esfera.
      for (let k = 0; k < 4; k++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.acos(2 * Math.random() - 1);
        particleAt(f.dimension, PARTICLES.auraDorada, {
          x: f.centro.x + Math.sin(v) * Math.cos(u) * 5, y: f.centro.y + 2.5 + Math.cos(v) * 5, z: f.centro.z + Math.sin(v) * Math.sin(u) * 5 });
      }
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
          p.onScreenDisplay.setTitle("§6§lFUSIÓN", { subtitle: "§eIQ 1000 × 5", fadeInDuration: 10, stayDuration: 40, fadeOutDuration: 10 });
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
      registrarGolden(golden, 70); // empieza a pelear cuando termina la cinemática
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
