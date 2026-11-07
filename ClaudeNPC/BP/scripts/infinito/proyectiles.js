import { system, world } from "@minecraft/server";
import { blockAt, flat, impulse, now, reemplazable, sound, superficie } from "../util.js";
import { ponerVida, vida } from "../dano.js";
import { gesto } from "./animacion.js";
import { equipar } from "./armas.js";
import { INFINITO, INFINITO_CFG, TAG_INF } from "./config.js";
import { niveles } from "./determinacion.js";
import { fase, puede } from "./fases.js";
import { olvidarProyectil, proyectil, temporal } from "./rendimiento.js";
import { vfxCura, vfxPerla } from "./vfx.js";

// ProjectileController: arco, ballesta y tridente con predicción del movimiento (apunta a
// donde vas a estar y compensa la caída de la flecha); perlas de verdad (al caer, el
// script lo lleva al punto de impacto); pociones arrojadizas de verdad (el efecto lo pone
// el script al reventar); TNT y cristal con explosiones que NUNCA rompen bloques ni
// prenden fuego. También la comida (curarse).

const RADIO_CRISTAL = 2.5;
const explosivos = new Set(); // ids de su TNT y sus cristales
const vuelo = new Map(); // perlas y pociones en el aire: id → { ent, t0, max, ultima, golpe, alCaer }

// --- Puntería ---------------------------------------------------------------------------
export function apuntar(e, s, obj, rapidez, gravedad = 0.05) {
  const o = e.getHeadLocation();
  const p = obj.location;
  let v = { x: 0, y: 0, z: 0 };
  try {
    v = obj.getVelocity();
  } catch {
    // Sin velocidad.
  }
  const h = Math.hypot(p.x - o.x, p.z - o.z);
  const t = h / rapidez;
  const lead = puede(s, "prediccion") ? 1 : 0.25 + niveles(s).precision * 0.5;
  const err = fase(s.fase).precision * (h / 10) * 0.6;
  const px = p.x + v.x * t * lead + (Math.random() - 0.5) * 2 * err;
  const pz = p.z + v.z * t * lead + (Math.random() - 0.5) * 2 * err;
  const py = p.y + 1.1 + 0.5 * gravedad * t * t;
  const dx = px - o.x;
  const dy = py - o.y;
  const dz = pz - o.z;
  const l = Math.hypot(dx, dy, dz) || 1;
  return { o, dir: { x: dx / l, y: dy / l, z: dz / l } };
}

// ¿Lo ve sin bloques en medio? (no dispara contra una pared)
export function hayVista(e, obj) {
  try {
    const o = e.getHeadLocation();
    const t = obj.getHeadLocation();
    const dx = t.x - o.x;
    const dy = t.y - o.y;
    const dz = t.z - o.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    return !e.dimension.getBlockFromRay(o, { x: dx / d, y: dy / d, z: dz / d },
      { maxDistance: d, includeLiquidBlocks: false, includePassableBlocks: false });
  } catch {
    return true;
  }
}

function lanzarEntidad(e, tipo, o, dir, rapidez, dueno = true) {
  const ent = e.dimension.spawnEntity(tipo, { x: o.x + dir.x * 0.8, y: o.y + dir.y * 0.8, z: o.z + dir.z * 0.8 });
  const proj = ent.getComponent("minecraft:projectile");
  if (proj) {
    if (dueno) proj.owner = e;
    proj.shoot({ x: dir.x * rapidez, y: dir.y * rapidez, z: dir.z * rapidez });
  }
  return ent;
}

// Ticks que tarda en tensar el arco (o cargar la ballesta).
export function carga(s, arma) {
  if (arma === "ballesta") return s.ballestaCargada ? 2 : Math.round(25 - 8 * niveles(s).armas);
  return Math.round(22 - 10 * niveles(s).armas);
}

export function disparar(e, s, obj, arma = "arco") {
  const rapidez = arma === "ballesta" ? 3.15 : 2.7;
  try {
    const { o, dir } = apuntar(e, s, obj, rapidez);
    proyectil(lanzarEntidad(e, "minecraft:arrow", o, dir, rapidez), 100);
    sound(e, arma === "ballesta" ? "crossbow.shoot" : "random.bow", 1, 0.9);
    if (arma === "ballesta") s.ballestaCargada = false;
    return true;
  } catch {
    return false;
  }
}

// Tridente: lo lanza y "vuelve" (como con Lealtad) a los 2,5 s.
export function lanzarTridente(e, s, obj) {
  try {
    const rapidez = 2.5;
    const { o, dir } = apuntar(e, s, obj, rapidez);
    proyectil(lanzarEntidad(e, "minecraft:thrown_trident", o, dir, rapidez), 60);
    sound(e, "item.trident.throw", 1, 0.9);
    gesto(e, s, "lanzar", true);
    s.cd.tridente = now() + 50;
    return true;
  } catch {
    return false;
  }
}

// Velocidad para que un objeto con gravedad "g" llegue a "destino" (sin contar el rozamiento).
function tiro(o, destino, g, maxH = 1.5) {
  const dx = destino.x - o.x;
  const dz = destino.z - o.z;
  const h = Math.hypot(dx, dz) || 0.01;
  const vh = Math.min(maxH, Math.max(0.35, h / 14));
  const t = h / vh;
  const vy = (destino.y - o.y + 0.5 * g * t * t) / t;
  return { x: (dx / h) * vh, y: vy, z: (dz / h) * vh };
}

function lanzarConArco(e, tipo, destino, g) {
  const o = e.getHeadLocation();
  const v = tiro(o, destino, g);
  const l = Math.hypot(v.x, v.z) || 1;
  const ent = e.dimension.spawnEntity(tipo, { x: o.x + (v.x / l) * 0.6, y: o.y, z: o.z + (v.z / l) * 0.6 });
  ent.getComponent("minecraft:projectile")?.shoot(v);
  return ent;
}

// --- Perlas -----------------------------------------------------------------------------
// Sitio donde se puede estar de pie cerca del impacto.
function sitioLibre(dim, p) {
  const x = Math.floor(p.x);
  const z = Math.floor(p.z);
  for (let y = Math.floor(p.y); y <= Math.floor(p.y) + 3; y++) {
    const pie = blockAt(dim, { x, y, z });
    const cabeza = blockAt(dim, { x, y: y + 1, z });
    const piso = blockAt(dim, { x, y: y - 1, z });
    if (pie && cabeza && (pie.isAir || reemplazable(pie)) && (cabeza.isAir || reemplazable(cabeza)) && piso && !piso.isAir) {
      return { x: x + 0.5, y, z: z + 0.5 };
    }
  }
  const top = superficie(dim, p.x, p.z);
  return top ? { x: x + 0.5, y: top.location.y + 1, z: z + 0.5 } : undefined;
}

export function lanzarPerla(e, s, destino) {
  if (!puede(s, "perla") || s.perlaEnVuelo) return false;
  try {
    equipar(e, s, "perla", { urgente: true });
    const ent = lanzarConArco(e, "minecraft:ender_pearl", destino, 0.03);
    gesto(e, s, "lanzar", true);
    sound(e, "random.bow", 0.5, 0.6);
    s.perlaEnVuelo = ent.id;
    proyectil(ent, 80);
    vuelo.set(ent.id, {
      ent, t0: now(), max: 70,
      alCaer: (loc) => {
        s.perlaEnVuelo = undefined;
        s.volverArma = now() + 2;
        if (!e.isValid || s.etapa !== "pelea" || !loc) return;
        const dest = sitioLibre(e.dimension, loc);
        if (!dest) return;
        vfxPerla(e, s);
        try {
          e.teleport(dest, { keepVelocity: false, checkForBlocks: false });
        } catch {
          return;
        }
        vfxPerla(e, s);
        sound(e, "mob.endermen.portal", 1.1, 0.8);
        s.perlaLlego = now();
      },
      alFallar: () => {
        s.perlaEnVuelo = undefined;
        s.volverArma = now() + 2;
      },
    });
    return true;
  } catch {
    s.perlaEnVuelo = undefined;
    return false;
  }
}

// --- Pociones (Pot PvP) y comida --------------------------------------------------------
const EFECTOS = {
  curacion: { propia: true, aplicar: (x) => x.addEffect("instant_health", 1, { amplifier: 1 }) },
  regeneracion: { propia: true, aplicar: (x) => x.addEffect("regeneration", 200, { amplifier: 1 }) },
  fuerza: { propia: true, aplicar: (x, s) => { s.fuerzaHasta = now() + 400; x.addEffect("strength", 400, { amplifier: 0 }); } },
  velocidad: { propia: true, aplicar: (x, s) => { s.velocidadHasta = now() + 400; x.addEffect("speed", 400, { amplifier: 0 }); } },
  lentitud: { propia: false, aplicar: (x) => x.addEffect("slowness", 100, { amplifier: 1 }) },
  debilidad: { propia: false, aplicar: (x) => x.addEffect("weakness", 160, { amplifier: 0 }) },
  dano: { propia: false, aplicar: (x) => x.addEffect("instant_damage", 1, { amplifier: 0 }) },
};

export function lanzarPocion(e, s, efecto, obj) {
  const ef = EFECTOS[efecto];
  if (!ef || !puede(s, "pociones")) return false;
  try {
    equipar(e, s, "pocion", { urgente: true });
    const destino = ef.propia || !obj ? { x: e.location.x, y: e.location.y, z: e.location.z } : { ...obj.location };
    const ent = ef.propia
      ? e.dimension.spawnEntity("minecraft:splash_potion", { x: e.location.x, y: e.location.y + 0.6, z: e.location.z })
      : lanzarConArco(e, "minecraft:splash_potion", destino, 0.05);
    if (ef.propia) ent.getComponent("minecraft:projectile")?.shoot({ x: 0, y: -0.3, z: 0 });
    gesto(e, s, ef.propia ? "beber" : "lanzar", true);
    sound(e, "random.bow", 0.6, 0.5);
    proyectil(ent, 60);
    vuelo.set(ent.id, {
      ent, t0: now(), max: 50,
      alCaer: (loc) => {
        s.volverArma = now() + 2;
        if (!e.isValid || !loc) return;
        sound(e, "random.glass", 1, 0.8);
        try {
          if (ef.propia) {
            if (Math.hypot(e.location.x - loc.x, e.location.z - loc.z) < 4) {
              ef.aplicar(e, s);
              if (efecto === "curacion") vfxCura(e, s);
            }
            return;
          }
          for (const p of e.dimension.getEntities({ location: loc, maxDistance: 3.5, excludeFamilies: ["claudenpc"], excludeTypes: ["minecraft:item"] })) {
            if (p.typeId === "minecraft:player" || p.matches?.({ families: ["monster"] })) ef.aplicar(p, s);
          }
        } catch {
          // Sin efecto.
        }
      },
      alFallar: () => {
        s.volverArma = now() + 2;
      },
    });
    return true;
  } catch {
    return false;
  }
}

// Come (fase 4+): carne, y desde la fase 10 manzana dorada. Tarda 1,6 s y va lento.
export function comer(e, s) {
  if (!puede(s, "comer") || s.comiendo || now() < (s.cd.comer ?? 0)) return false;
  equipar(e, s, "comida", { urgente: true });
  s.comiendo = true;
  s.cd.comer = now() + (s.fase >= 15 ? 240 : 400);
  const dorada = s.fase >= 10;
  for (const t of [0, 8, 16, 24]) {
    system.runTimeout(() => {
      if (!e.isValid || !s.comiendo) return;
      gesto(e, s, "beber", true);
      sound(e, "random.eat", 0.9 + Math.random() * 0.2, 0.7);
    }, t + 1);
  }
  system.runTimeout(() => {
    if (!e.isValid) return;
    const seguia = s.comiendo;
    s.comiendo = false;
    s.volverArma = now();
    if (!seguia) return; // lo interrumpieron (derribo, rescate...)
    try {
      ponerVida(e, vida(e).actual + (dorada ? 4 : 6));
      if (dorada) {
        e.addEffect("regeneration", 100, { amplifier: 1, showParticles: true });
        e.addEffect("absorption", 2400, { amplifier: 0, showParticles: false });
      }
    } catch {
      // Sin efecto.
    }
    sound(e, "random.burp", 1, 0.8);
    vfxCura(e, s);
  }, 32);
  return true;
}

// --- TNT y cristal ------------------------------------------------------------------------
export function ponerTnt(e, s, obj) {
  if (!puede(s, "tnt")) return false;
  try {
    equipar(e, s, "tnt", { urgente: true });
    const d = flat(e.location, obj.location);
    const pos = { x: obj.location.x - d.x, y: obj.location.y + 0.3, z: obj.location.z - d.z };
    const t = e.dimension.spawnEntity("minecraft:tnt", pos);
    t.addTag(TAG_INF.obj);
    explosivos.add(t.id);
    impulse(t, { x: d.x * 0.12, y: 0.18, z: d.z * 0.12 });
    proyectil(t, 140);
    gesto(e, s, "lanzar", true);
    sound(e, "random.fuse", 1, 0.9);
    s.volverArma = now() + 4;
    s.tntHasta = now() + 85;
    return true;
  } catch {
    return false;
  }
}

export function ponerCristal(e, s, obj) {
  if (!puede(s, "cristal")) return undefined;
  try {
    const d = flat(e.location, obj.location);
    const x = Math.floor(obj.location.x - d.x * 2);
    const z = Math.floor(obj.location.z - d.z * 2);
    let y = Math.floor(obj.location.y);
    // Busca el suelo cerca de la altura del rival.
    for (let k = 0; k < 3 && !(blockAt(e.dimension, { x, y: y - 1, z })?.isAir === false); k++) y--;
    const aqui = blockAt(e.dimension, { x, y, z });
    if (!aqui || !(aqui.isAir || reemplazable(aqui)) || !blockAt(e.dimension, { x, y: y + 1, z })?.isAir) return undefined;
    equipar(e, s, "cristal", { urgente: true });
    let alto = y;
    if (INFINITO_CFG.modificaMundo) {
      aqui.setType("minecraft:obsidian");
      temporal(e.dimension, { x, y, z }, "minecraft:obsidian", 120, s.id);
      alto = y + 1;
    }
    const c = e.dimension.spawnEntity("minecraft:ender_crystal", { x: x + 0.5, y: alto, z: z + 0.5 });
    c.addTag(TAG_INF.obj);
    explosivos.add(c.id);
    proyectil(c, 100);
    gesto(e, s, "lanzar", true);
    sound(e, "dig.stone", 0.9, 0.8);
    s.volverArma = now() + 8;
    return c;
  } catch {
    return undefined;
  }
}

export function detonarCristal(e, s, c) {
  if (!c?.isValid) return false;
  let pos;
  try {
    pos = { ...c.location };
    olvidarProyectil(c.id);
    explosivos.delete(c.id);
    c.remove();
  } catch {
    return false;
  }
  gesto(e, s, "rapido", true);
  try {
    return e.dimension.createExplosion(pos, RADIO_CRISTAL, { breaksBlocks: false, causesFire: false, allowUnderwater: false, source: e });
  } catch {
    return false;
  }
}

// ¿Hay TNT encendida cerca? (para alejarse)
export function tntCerca(e) {
  try {
    return e.dimension.getEntities({ type: "minecraft:tnt", location: e.location, maxDistance: 5 }).length > 0;
  } catch {
    return false;
  }
}

// Sus explosiones (TNT, cristales y las que provoca él) no rompen bloques.
world.beforeEvents.explosion.subscribe((ev) => {
  try {
    const src = ev.source;
    if (!src) return;
    if (explosivos.has(src.id) || src.typeId === INFINITO || src.hasTag(TAG_INF.obj)) ev.setImpactedBlocks([]);
  } catch {
    // Sin fuente.
  }
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => explosivos.delete(removedEntityId));

// --- Perlas y pociones en el aire -----------------------------------------------------------
function anotarImpacto(ev) {
  try {
    const v = vuelo.get(ev.projectile.id);
    if (v) v.golpe = { ...ev.location };
  } catch {
    // Proyectil ya removido.
  }
}

world.afterEvents.projectileHitBlock.subscribe(anotarImpacto);
world.afterEvents.projectileHitEntity.subscribe(anotarImpacto);

system.runInterval(() => {
  if (!vuelo.size) return;
  const t = now();
  for (const [id, v] of vuelo) {
    let valido = false;
    try {
      valido = v.ent.isValid;
      if (valido) v.ultima = { ...v.ent.location };
    } catch {
      valido = false;
    }
    if (valido && t - v.t0 <= v.max) continue;
    vuelo.delete(id);
    try {
      if (valido) {
        v.ent.remove();
        v.alFallar?.();
      } else {
        v.alCaer(v.golpe ?? v.ultima);
      }
    } catch {
      // Sin efecto.
    }
  }
}, 1);
