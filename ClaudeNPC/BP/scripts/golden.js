import { EntityDamageCause, GameMode, ItemStack, Player, system, TimeOfDay, WeatherType, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ANIM, DIMENSIONES, ECO, GOLDEN, MODIFICA_MUNDO, PARTICLES } from "./config.js";
import { animate, blockAt, burst, distancia, now, particleAt, piso, rand, reemplazable, sound, soundAt, superficie } from "./util.js";

// Claude Golden: nace de la fusión de cinco Claudes con IQ 300. No ataca como un
// mob normal: juega con el jugador usando poderes creativos.

const goldens = new Map();
const historial = new Map(); // jugador → posiciones de los últimos segundos (para rebobinar)
const ecos = new Map();
const LUZ = "minecraft:light_block_15";

// --- Nombre: "IQ: ???" con letras que rebotan y cambian de color -----------------

const COLORES = ["§c", "§6", "§e", "§a", "§b", "§9", "§d"];
const LETRAS = ["I", "Q", ":", " ", "?", "?", "?"];

function etiqueta(frame) {
  let arriba = "";
  let abajo = "";
  LETRAS.forEach((ch, i) => {
    if (ch === " ") {
      arriba += "  ";
      abajo += "  ";
      return;
    }
    const color = COLORES[(i + frame) % COLORES.length];
    const hueco = ch === ":" || ch === "I" ? " " : "  ";
    if (Math.sin(frame * 0.8 + i * 0.9) > 0) {
      arriba += `${color}§l${ch}§r`;
      abajo += hueco;
    } else {
      abajo += `${color}§l${ch}§r`;
      arriba += hueco;
    }
  });
  return `${arriba}\n${abajo}\n§6§lClaude Golden`;
}

// --- Registro ------------------------------------------------------------------------

export function registrarGolden(entidad) {
  if (goldens.has(entidad.id)) return;
  goldens.set(entidad.id, {
    entidad, frame: 0, angulo: Math.random() * 360, ancla: { ...entidad.location },
    cd: { poder: now() + 160 }, luz: undefined, golpeadoHasta: 0, quietoHasta: 0,
  });
}

function limpiarLuz(g) {
  if (!g.luz) return;
  try {
    const b = blockAt(g.dimension ?? g.entidad.dimension, g.luz);
    if (b?.typeId === LUZ) b.setType("minecraft:air");
  } catch {
    // Chunk descargado.
  }
  g.luz = undefined;
}

// Luz real: un bloque de luz invisible que lo sigue.
function moverLuz(g) {
  const e = g.entidad;
  const pos = piso(e.getHeadLocation());
  if (g.luz && (g.luz.x !== pos.x || g.luz.y !== pos.y || g.luz.z !== pos.z)) limpiarLuz(g);
  if (g.luz) return;
  const b = blockAt(e.dimension, pos);
  if (!b?.isAir) return;
  try {
    b.setType(LUZ);
    g.luz = pos;
    g.dimension = e.dimension;
  } catch {
    // Bloque de luz no disponible.
  }
}

function jugadorCercano(e, radio = 40) {
  try {
    return e.dimension.getPlayers({ location: e.location, maxDistance: radio, closest: 1,
      excludeGameModes: [GameMode.Spectator] })[0];
  } catch {
    return undefined;
  }
}

function avisar(e, texto, radio = 40) {
  try {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: radio })) {
      p.onScreenDisplay.setActionBar(texto);
    }
  } catch {
    // Sin jugadores.
  }
}

// --- Poderes ---------------------------------------------------------------------------

function rebobinar(g, jugador) {
  const h = historial.get(jugador.id) ?? [];
  const objetivo = h.find((p) => now() - p.t >= 90 && now() - p.t <= 130 && p.dim === jugador.dimension.id);
  if (!objetivo) return false;
  animate(g.entidad, ANIM.goldenPoder);
  for (let k = 0; k < 30; k += 5) system.runTimeout(() => jugador.isValid && burst(jugador, PARTICLES.reloj), k);
  sound(jugador, "beacon.deactivate", 0.5);
  system.runTimeout(() => {
    if (!jugador.isValid) return;
    try {
      jugador.camera.fade({ fadeColor: { red: 0.55, green: 0.85, blue: 1 },
        fadeTime: { fadeInTime: 0.25, holdTime: 0.15, fadeOutTime: 0.6 } });
      jugador.teleport(objetivo.loc, { dimension: jugador.dimension });
      const vida = jugador.getComponent("minecraft:health");
      if (vida && objetivo.vida > vida.currentValue) vida.setCurrentValue(objetivo.vida);
    } catch {
      // No se pudo rebobinar.
    }
    burst(jugador, PARTICLES.reloj);
    avisar(g.entidad, "§bClaude Golden rebobinó el tiempo 5 segundos");
  }, 30);
  return true;
}

function gravedad(g) {
  const e = g.entidad;
  animate(e, ANIM.goldenPoder);
  avisar(e, "§dLa gravedad se invierte...");
  sound(e, "mob.shulker.bullet.hit", 0.6);
  const afectados = e.dimension.getEntities({ location: e.location, maxDistance: 9, excludeTypes: [GOLDEN],
    excludeFamilies: ["inanimate"] });
  let t = 0;
  const id = system.runInterval(() => {
    t += 5;
    if (t > 70 || !e.isValid) {
      system.clearRun(id);
      for (const a of afectados) {
        try {
          if (a.isValid) a.addEffect("slow_falling", 140, { amplifier: 0, showParticles: false });
        } catch {
          // Sin efecto.
        }
      }
      return;
    }
    burst(e, PARTICLES.gravedad, { x: 0, y: 0.2, z: 0 });
    for (const a of afectados) {
      try {
        if (!a.isValid) continue;
        if (a instanceof Player) a.applyKnockback({ x: 0.001, z: 0.001 }, 0.3);
        else a.applyImpulse({ x: 0, y: 0.14, z: 0 });
      } catch {
        // Entidad descargada.
      }
    }
  }, 5);
  return true;
}

function arena(g, jugador) {
  if (!MODIFICA_MUNDO) return false;
  const e = g.entidad;
  const c = piso(jugador.location);
  const puestos = [];
  const posiciones = [];
  for (let dx = -8; dx <= 8; dx++) {
    for (let dz = -8; dz <= 8; dz++) {
      const r = Math.hypot(dx, dz);
      if (r < 6.6 || r > 7.5) continue;
      const ang = Math.atan2(dz, dx);
      const poste = Math.abs(((ang * 180) / Math.PI + 360) % 45) < 6;
      for (let h = 0; h <= (poste ? 4 : 2); h++) {
        const bloque = poste ? (h === 4 ? "minecraft:sea_lantern" : "minecraft:gold_block")
          : (h === 1 ? "minecraft:glass" : "minecraft:gold_block");
        posiciones.push({ p: { x: c.x + dx, y: c.y + h, z: c.z + dz }, bloque, ang });
      }
    }
  }
  posiciones.sort((a, b) => a.ang - b.ang);
  animate(e, ANIM.goldenPoder);
  avisar(e, "§6Claude Golden levanta una arena dorada");
  sound(e, "beacon.power", 0.8);
  let k = 0;
  const id = system.runInterval(() => {
    for (let n = 0; n < 8 && k < posiciones.length; n++, k++) {
      const { p, bloque } = posiciones[k];
      const b = blockAt(e.dimension, p);
      if (!reemplazable(b)) continue;
      try {
        b.setType(bloque);
        puestos.push({ p, bloque });
        if (k % 6 === 0) particleAt(e.dimension, PARTICLES.midas, { x: p.x + 0.5, y: p.y + 1, z: p.z + 0.5 });
      } catch {
        // Sin colocar.
      }
    }
    if (k >= posiciones.length) system.clearRun(id);
  }, 1);
  // Se desarma sola, en orden inverso.
  system.runTimeout(() => {
    let j = puestos.length - 1;
    const quitar = system.runInterval(() => {
      for (let n = 0; n < 10 && j >= 0; n++, j--) {
        const { p, bloque } = puestos[j];
        const b = blockAt(e.dimension, p);
        try {
          if (b?.typeId === bloque) b.setType("minecraft:air");
        } catch {
          // Chunk descargado.
        }
      }
      if (j < 0) system.clearRun(quitar);
    }, 1);
  }, 600);
  return true;
}

function crearEcos(g, jugador) {
  const e = g.entidad;
  animate(e, ANIM.goldenChasquido);
  avisar(e, "§eEcos de luz: atrápalos para recibir un regalo");
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pos = { x: jugador.location.x + Math.cos(a) * 4, y: jugador.location.y + 0.2, z: jugador.location.z + Math.sin(a) * 4 };
    try {
      const eco = e.dimension.spawnEntity(ECO, pos);
      eco.nameTag = "§eEco";
      ecos.set(eco.id, { eco, hasta: now() + 320, jugador });
      particleAt(e.dimension, PARTICLES.confeti, { x: pos.x, y: pos.y + 1, z: pos.z });
    } catch {
      // No se pudo crear.
    }
  }
  sound(e, "random.orb", 1.4);
  return true;
}

function deshacerEco(id, regalo, quien) {
  const datos = ecos.get(id);
  ecos.delete(id);
  if (!datos?.eco.isValid) return;
  const loc = { ...datos.eco.location };
  particleAt(datos.eco.dimension, PARTICLES.confeti, { x: loc.x, y: loc.y + 1, z: loc.z });
  soundAt(datos.eco.dimension, loc, "random.pop", 1.3);
  if (regalo) {
    try {
      datos.eco.dimension.spawnItem(new ItemStack("minecraft:golden_carrot", 1), loc);
      quien?.onScreenDisplay.setActionBar("§a¡Atrapaste un eco! Te dejó una zanahoria dorada");
    } catch {
      // Sin regalo.
    }
  }
  try {
    datos.eco.remove();
  } catch {
    // Ya no existe.
  }
}

const NATURALES = /grass_block|^minecraft:dirt$|coarse_dirt|podzol|mycelium|^minecraft:stone$|sand$|gravel|andesite|diorite|granite|deepslate$|snow$/;

function midas(g) {
  if (!MODIFICA_MUNDO) return false;
  const e = g.entidad;
  animate(e, ANIM.goldenChasquido);
  avisar(e, "§6Toque de Midas: el suelo se vuelve oro");
  sound(e, "random.orb", 0.8);
  const cambiados = [];
  for (let r = 1; r <= 7; r++) {
    system.runTimeout(() => {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          const d = Math.hypot(dx, dz);
          if (d < r - 0.5 || d >= r + 0.5) continue;
          const top = superficie(e.dimension, e.location.x + dx, e.location.z + dz);
          if (!top || Math.abs(top.location.y - e.location.y) > 6 || !NATURALES.test(top.typeId)) continue;
          try {
            const original = top.permutation;
            const oro = (dx + dz) % 2 === 0 ? "minecraft:gold_block" : "minecraft:raw_gold_block";
            top.setType(oro);
            cambiados.push({ p: { ...top.location }, original, oro });
            if ((dx + dz) % 3 === 0) particleAt(e.dimension, PARTICLES.midas, { x: top.location.x + 0.5, y: top.location.y + 1.1, z: top.location.z + 0.5 });
          } catch {
            // Sin cambio.
          }
        }
      }
    }, r * 4);
  }
  // Vuelve todo a la normalidad.
  system.runTimeout(() => {
    for (const c of cambiados.reverse()) {
      const b = blockAt(e.dimension, c.p);
      try {
        if (b?.typeId === c.oro) b.setPermutation(c.original);
      } catch {
        // Chunk descargado.
      }
    }
  }, 260);
  return true;
}

const PREGUNTAS = [
  { q: "¿Cuánto es 7 × 8?", ok: "56", malas: ["54", "64"] },
  { q: "¿Cuántos lingotes lleva una pechera?", ok: "8", malas: ["5", "6"] },
  { q: "¿Qué criatura explota al acercarse?", ok: "Creeper", malas: ["Zombi", "Araña"] },
  { q: "Si 3 Claudes tienen IQ 300, ¿cuánto suman?", ok: "900", malas: ["600", "1200"] },
  { q: "¿Mínimo de obsidiana para un portal al Nether?", ok: "10", malas: ["12", "14"] },
  { q: "¿Qué necesitas para dormir por la noche?", ok: "Una cama", malas: ["Una mesa", "Un horno"] },
  { q: "¿Qué herramienta rompe más rápido la tierra?", ok: "Pala", malas: ["Pico", "Hacha"] },
];

function acertijo(g, jugador) {
  if (g.preguntando) return false;
  const e = g.entidad;
  const p = PREGUNTAS[rand(0, PREGUNTAS.length - 1)];
  const opciones = [p.ok, ...p.malas].sort(() => Math.random() - 0.5);
  g.preguntando = true;
  g.quietoHasta = now() + 200;
  animate(e, ANIM.goldenPensar);
  sound(e, "random.orb", 1.8);
  const form = new ActionFormData().title("§6§lAcertijo de Claude Golden").body(`§f${p.q}`);
  for (const o of opciones) form.button(o);
  form.show(jugador).then((r) => {
    g.preguntando = false;
    g.quietoHasta = 0;
    if (!jugador.isValid || r.canceled || r.selection === undefined) return;
    if (opciones[r.selection] === p.ok) {
      try {
        jugador.dimension.spawnItem(new ItemStack("minecraft:golden_apple", 1), jugador.location);
      } catch {
        // Sin premio.
      }
      burst(jugador, PARTICLES.confeti, { x: 0, y: 2, z: 0 });
      sound(jugador, "random.levelup", 1.4);
      jugador.onScreenDisplay.setActionBar("§a¡Correcto! Claude Golden te regala una manzana dorada");
    } else {
      try {
        jugador.addEffect("levitation", 50, { amplifier: 0, showParticles: false });
        jugador.addEffect("slow_falling", 160, { amplifier: 0, showParticles: false });
      } catch {
        // Sin efecto.
      }
      jugador.onScreenDisplay.setActionBar(`§cIncorrecto: era "${p.ok}". Claude Golden te da una lección flotante`);
    }
  }).catch(() => {
    g.preguntando = false;
  });
  return true;
}

// Melodía original (arpegios simples) mientras dirige; hipnotiza a los monstruos.
const MELODIA = [1.0, 1.26, 1.5, 2.0, 1.5, 1.26, 1.0, 0.84, 1.0, 1.26, 1.5, 1.68, 2.0, 1.68, 1.5, 2.0];

function concierto(g) {
  const e = g.entidad;
  g.quietoHasta = now() + 80;
  animate(e, ANIM.goldenDirigir);
  avisar(e, "§eClaude Golden dirige una sinfonía: los monstruos quedan hipnotizados");
  MELODIA.forEach((pitch, i) => {
    system.runTimeout(() => {
      if (!e.isValid) return;
      sound(e, i % 2 ? "note.bell" : "note.harp", pitch, 1);
      if (i % 2 === 0) burst(e, PARTICLES.notas, { x: 0, y: 2, z: 0 });
    }, i * 5);
  });
  try {
    for (const m of e.dimension.getEntities({ location: e.location, maxDistance: 12, families: ["monster"] })) {
      m.addEffect("slowness", 240, { amplifier: 4, showParticles: true });
      m.addEffect("weakness", 240, { amplifier: 1, showParticles: false });
    }
  } catch {
    // Sin monstruos.
  }
  return true;
}

function cielo(g) {
  const e = g.entidad;
  if (e.dimension.id !== "minecraft:overworld") return false;
  animate(e, ANIM.goldenChasquido);
  system.runTimeout(() => {
    if (!e.isValid) return;
    const t = world.getTimeOfDay();
    world.setTimeOfDay(t < 12000 ? TimeOfDay.Night : TimeOfDay.Day);
    e.dimension.setWeather(WeatherType.Clear);
    burst(e, PARTICLES.fusionDestello, { x: 0, y: 1.5, z: 0 });
    sound(e, "ambient.weather.thunder", 1.4, 0.4);
    avisar(e, "§9Claude Golden chasquea los dedos y cambia el cielo");
  }, 8);
  return true;
}

const PODERES = [
  { id: "rebobinar", cd: 600, peso: (c) => (c.golpeado ? 3 : 1), si: (c) => c.dist < 24, f: rebobinar },
  { id: "gravedad", cd: 500, peso: (c) => (c.golpeado ? 3 : 1.2), si: (c) => c.dist < 9, f: (g) => gravedad(g) },
  { id: "arena", cd: 1400, peso: () => 1, si: (c) => c.dist < 16, f: arena },
  { id: "ecos", cd: 900, peso: () => 1.3, si: (c) => c.dist < 20, f: crearEcos },
  { id: "midas", cd: 800, peso: () => 1, si: () => true, f: (g) => midas(g) },
  { id: "acertijo", cd: 1600, peso: () => 1, si: (c) => c.dist < 10, f: acertijo },
  { id: "concierto", cd: 900, peso: () => 1.2, si: () => true, f: (g) => concierto(g) },
  { id: "cielo", cd: 1200, peso: () => 0.7, si: () => true, f: (g) => cielo(g) },
];

function usarPoder(g, jugador) {
  const c = { dist: distancia(g.entidad.location, jugador.location), golpeado: now() < g.golpeadoHasta };
  const lista = PODERES.filter((p) => now() >= (g.cd[p.id] ?? 0) && p.si(c));
  if (!lista.length) return;
  let r = Math.random() * lista.reduce((t, p) => t + p.peso(c), 0);
  for (const p of lista) {
    r -= p.peso(c);
    if (r > 0) continue;
    if (p.f(g, jugador)) {
      g.cd[p.id] = now() + p.cd;
      g.cd.poder = now() + rand(180, 280);
    }
    return;
  }
}

// --- Bucles ------------------------------------------------------------------------------

// Vuelo: orbita alrededor del jugador flotando, siempre mirándolo.
system.runInterval(() => {
  for (const [id, g] of goldens) {
    const e = g.entidad;
    if (!e.isValid) {
      limpiarLuz(g);
      goldens.delete(id);
      continue;
    }
    try {
      if (now() < g.quietoHasta) continue;
      const j = g.jugador;
      g.angulo += j ? 0.7 : 0.3;
      const a = (g.angulo * Math.PI) / 180;
      const base = j?.isValid ? j.location : g.ancla;
      const r = j?.isValid ? 5 : 2;
      const objetivo = { x: base.x + Math.cos(a) * r, y: base.y + 1.4 + Math.sin(now() / 18) * 0.35, z: base.z + Math.sin(a) * r };
      const dx = objetivo.x - e.location.x;
      const dy = objetivo.y - e.location.y;
      const dz = objetivo.z - e.location.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const paso = Math.min(0.24, d * 0.07);
      e.teleport({ x: e.location.x + (dx / d) * paso, y: e.location.y + (dy / d) * paso, z: e.location.z + (dz / d) * paso },
        { facingLocation: j?.isValid ? j.getHeadLocation() : objetivo, keepVelocity: false });
    } catch {
      // Descargado.
    }
  }
}, 1);

// Nombre animado, aura, luz, poderes e historial para rebobinar.
system.runInterval(() => {
  for (const g of goldens.values()) {
    const e = g.entidad;
    if (!e.isValid) continue;
    try {
      g.frame++;
      e.nameTag = etiqueta(g.frame);
      if (g.frame % 2 === 0) burst(e, PARTICLES.auraDorada, { x: 0, y: 1, z: 0 });
      if (g.frame % 3 === 0) {
        moverLuz(g);
        g.jugador = jugadorCercano(e);
      }
      if (g.jugador?.isValid && now() >= g.cd.poder && now() >= g.quietoHasta) usarPoder(g, g.jugador);
    } catch {
      // Descargado.
    }
  }
  for (const [id, datos] of ecos) {
    if (!datos.eco.isValid) {
      ecos.delete(id);
      continue;
    }
    if (now() >= datos.hasta) {
      deshacerEco(id, false);
      continue;
    }
    if (Math.random() < 0.3 && datos.eco.isOnGround) {
      try {
        datos.eco.applyImpulse({ x: (Math.random() - 0.5) * 0.5, y: 0.42, z: (Math.random() - 0.5) * 0.5 });
      } catch {
        // Descargado.
      }
    }
  }
}, 4);

system.runInterval(() => {
  if (!goldens.size) return;
  for (const p of world.getAllPlayers()) {
    let h = historial.get(p.id);
    if (!h) historial.set(p.id, (h = []));
    h.unshift({ t: now(), loc: { ...p.location }, dim: p.dimension.id,
      vida: p.getComponent("minecraft:health")?.currentValue ?? 20 });
    if (h.length > 16) h.length = 16;
  }
}, 10);

// Recupera los Claude Golden al recargar el mundo.
system.runInterval(() => {
  for (const id of DIMENSIONES) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: GOLDEN })) registrarGolden(e);
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 100);

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  if (hurtEntity.typeId === ECO && damageSource.damagingEntity instanceof Player) {
    deshacerEco(hurtEntity.id, true, damageSource.damagingEntity);
  } else if (hurtEntity.typeId === GOLDEN) {
    const g = goldens.get(hurtEntity.id);
    if (g) g.golpeadoHasta = now() + 200;
  }
});

// Absorbe la mayoría de las flechas en un destello.
world.beforeEvents.entityHurt.subscribe((event) => {
  if (event.damageSource.cause !== EntityDamageCause.projectile || Math.random() > 0.85) return;
  event.cancel = true;
  const e = event.hurtEntity;
  system.run(() => e.isValid && burst(e, PARTICLES.midas, { x: 0, y: 1, z: 0 }));
}, { entityFilter: { type: GOLDEN } });

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId !== GOLDEN) return;
  const g = goldens.get(deadEntity.id);
  if (g) limpiarLuz(g);
  goldens.delete(deadEntity.id);
  try {
    const loc = deadEntity.location;
    const regalos = [{ item: "minecraft:nether_star", n: 1 }, { item: "minecraft:golden_apple", n: 5 },
      { item: "minecraft:experience_bottle", n: 16 }];
    for (const { item, n } of regalos) deadEntity.dimension.spawnItem(new ItemStack(item, n), loc);
    particleAt(deadEntity.dimension, PARTICLES.fusionDestello, { x: loc.x, y: loc.y + 1, z: loc.z });
    particleAt(deadEntity.dimension, PARTICLES.confeti, { x: loc.x, y: loc.y + 1, z: loc.z });
    for (const p of deadEntity.dimension.getPlayers({ location: loc, maxDistance: 40 })) {
      p.onScreenDisplay.setActionBar("§6Claude Golden se disuelve en luz... y te deja regalos");
    }
  } catch {
    // Sin regalos.
  }
});
