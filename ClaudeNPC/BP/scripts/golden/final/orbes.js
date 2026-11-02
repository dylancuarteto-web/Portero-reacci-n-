import { EntityDamageCause, EquipmentSlot, GameMode, Player, system, world } from "@minecraft/server";
import { FINAL, GOLDEN, GOLDEN_FINAL, PARTICLES, PROP, SONIDO } from "../../config.js";
import { blockAt, particleAt, soundAt } from "../../util.js";
import { prop } from "./comun.js";

// Orbes 3D: amarilla y azul (3 corazones de daño) y la definitiva (grande, mata de un
// toque). Vuelan movidas por el script (un poco guiadas), chocan con bloques y con sus
// objetivos. Se pueden golpear: una orbe normal vuelve hacia quien la tiró; la definitiva
// necesita 3 golpes y entonces vuela de vuelta contra Claude Golden.
//
// Para no morir con la definitiva: apagar los 4 relojes a tiempo (no la lanza), esquivarla
// (es lenta), devolverla con 3 golpes, cubrirse con un escudo (agachado, mirándola: queda
// con medio corazón) o llevar un tótem de la inmortalidad.

export const orbes = new Map();
let pausadas = false;
const EVENTO = ["claudenpc:amarilla", "claudenpc:azul", "claudenpc:definitiva"];
const EXPLOSION = [PARTICLES.explosionDorada, PARTICLES.explosionAzul, PARTICLES.explosionDefinitiva];

export function pausarOrbes(valor) {
  pausadas = valor;
}

function norm(v) {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function centroDe(e) {
  try {
    if (e instanceof Player) return { x: e.location.x, y: e.location.y + 1.0, z: e.location.z };
    const h = e.getHeadLocation();
    return { x: e.location.x, y: (e.location.y + h.y) / 2, z: e.location.z };
  } catch {
    return undefined;
  }
}

// Lanza una orbe. Opciones: tipo (0 amarilla, 1 azul, 2 definitiva), desde, vel, objetivo,
// dueno, contra ("jugadores", "mobs" o "golden"), dano, guiado, guiadoHasta, vida, radio,
// tam, quieta y alTocar.
export function lanzarOrbe(dim, o) {
  let e;
  try {
    e = dim.spawnEntity(FINAL.orbe, o.desde, { spawnEvent: EVENTO[o.tipo] ?? EVENTO[0] });
  } catch {
    return undefined;
  }
  const orbe = { e, dim, pos: { ...o.desde }, vel: o.vel ?? { x: 0, y: 0, z: 0 }, tipo: o.tipo ?? 0, objetivo: o.objetivo,
    dueno: o.dueno, contra: o.contra ?? "jugadores", dano: o.dano ?? GOLDEN_FINAL.danoOrbe, guiado: o.guiado ?? 0.05,
    guiadoHasta: o.guiadoHasta ?? 40, vida: o.vida ?? 120, radio: o.radio ?? 0.7, t: 0, golpes: 0, quieta: !!o.quieta,
    alTocar: o.alTocar, rapidez: Math.hypot(o.vel?.x ?? 0, o.vel?.y ?? 0, o.vel?.z ?? 0) || 0.5 };
  if (o.tam !== undefined) prop(e, PROP.tam, o.tam);
  orbes.set(e.id, orbe);
  return orbe;
}

export function explotar(orbe, conDano = false) {
  orbes.delete(orbe.e.id);
  const p = orbe.pos;
  particleAt(orbe.dim, EXPLOSION[orbe.tipo] ?? EXPLOSION[0], p);
  if (orbe.tipo === 2) {
    soundAt(orbe.dim, p, "mob.warden.sonic_boom", 1, 1.2);
    soundAt(orbe.dim, p, "random.explode", 0.7, 1);
    particleAt(orbe.dim, PARTICLES.fusionDestello, p);
    if (conDano) {
      // La onda de la definitiva lastima un poco alrededor (sin romper bloques).
      for (const j of victimas(orbe, 3.2)) danarCon(j, 8, orbe);
    }
  } else {
    soundAt(orbe.dim, p, "random.explode", 1.6, 0.5);
    soundAt(orbe.dim, p, "random.orb", 0.6, 0.6);
  }
  try {
    if (orbe.e.isValid) orbe.e.remove();
  } catch {
    // Ya no existe.
  }
}

export function quitarOrbes(filtro = (_o) => true) {
  for (const o of [...orbes.values()]) {
    if (!filtro(o)) continue;
    orbes.delete(o.e.id);
    try {
      if (o.e.isValid) o.e.remove();
    } catch {
      // Ya no existe.
    }
  }
}

function victimas(orbe, radio) {
  const lista = [];
  try {
    if (orbe.contra === "jugadores") {
      for (const p of orbe.dim.getPlayers({ location: orbe.pos, maxDistance: radio + 1.2, excludeGameModes: [GameMode.Creative, GameMode.Spectator] })) {
        const c = centroDe(p);
        if (c && Math.hypot(c.x - orbe.pos.x, (c.y - orbe.pos.y) * 0.8, c.z - orbe.pos.z) <= radio + 0.5) lista.push(p);
      }
    } else if (orbe.contra === "golden") {
      for (const g of orbe.dim.getEntities({ type: GOLDEN, location: orbe.pos, maxDistance: radio + 1.5 })) lista.push(g);
    } else {
      for (const m of orbe.dim.getEntities({ location: orbe.pos, maxDistance: radio + 1.2, families: ["monster"] })) {
        if (m.id !== orbe.dueno?.id) lista.push(m);
      }
      for (const m of orbe.dim.getEntities({ location: orbe.pos, maxDistance: radio + 1.5, families: ["claudenpc_golden"] })) lista.push(m);
    }
  } catch {
    // Sin entidades.
  }
  return lista;
}

function danarCon(victima, cantidad, orbe) {
  try {
    const dueno = orbe.dueno?.isValid ? orbe.dueno : undefined;
    victima.applyDamage(cantidad, dueno ? { cause: EntityDamageCause.magic, damagingEntity: dueno } : { cause: EntityDamageCause.magic });
  } catch {
    // No se pudo.
  }
}

function sostieneEscudo(p) {
  try {
    const eq = p.getComponent("minecraft:equippable");
    return [EquipmentSlot.Mainhand, EquipmentSlot.Offhand].some((s) => eq?.getEquipment(s)?.typeId === "minecraft:shield");
  } catch {
    return false;
  }
}

// Toque de la orbe definitiva: mata de un golpe, salvo escudo (agachado y mirándola) o tótem.
export function toqueDefinitivo(p, orbe) {
  let vida = 20;
  try {
    vida = p.getComponent("minecraft:health")?.currentValue ?? 20;
  } catch {
    // Vida por defecto.
  }
  const v = p.getViewDirection();
  const hacia = norm({ x: orbe.pos.x - p.location.x, y: 0, z: orbe.pos.z - p.location.z });
  const mira = v.x * hacia.x + v.z * hacia.z > 0.25;
  if (p.isSneaking && sostieneEscudo(p) && mira) {
    danarCon(p, Math.max(0, vida - 1), orbe);
    soundAt(orbe.dim, p.location, "item.shield.block", 0.6, 1);
    try {
      p.applyKnockback({ x: -hacia.x * 2.2, z: -hacia.z * 2.2 }, 0.6);
    } catch {
      // Sin empuje.
    }
    return "escudo";
  }
  danarCon(p, vida + 200, orbe);
  return "golpe";
}

function chocaConBloque(dim, p) {
  const b = blockAt(dim, p);
  return !!b && !b.isAir && !b.isLiquid && !/(grass|fern|flower|torch|candle|snow_layer|carpet|vine|bush|sapling)/.test(b.typeId);
}

system.runInterval(() => {
  for (const [id, o] of orbes) {
    try {
      if (!o.e.isValid) {
        orbes.delete(id);
        continue;
      }
      if (pausadas || o.quieta) {
        o.e.teleport(o.pos, { keepVelocity: false });
        continue;
      }
      o.t++;
      if (o.objetivo?.isValid && o.t < o.guiadoHasta) {
        const c = centroDe(o.objetivo);
        if (c) {
          const d = norm({ x: c.x - o.pos.x, y: c.y - o.pos.y, z: c.z - o.pos.z });
          const v = norm({ x: o.vel.x + (d.x * o.rapidez - o.vel.x) * o.guiado, y: o.vel.y + (d.y * o.rapidez - o.vel.y) * o.guiado,
            z: o.vel.z + (d.z * o.rapidez - o.vel.z) * o.guiado });
          o.vel = { x: v.x * o.rapidez, y: v.y * o.rapidez, z: v.z * o.rapidez };
        }
      }
      o.pos = { x: o.pos.x + o.vel.x, y: o.pos.y + o.vel.y, z: o.pos.z + o.vel.z };
      if (o.t > 2 && chocaConBloque(o.dim, o.pos)) {
        explotar(o, true);
        continue;
      }
      const tocados = victimas(o, o.radio);
      if (tocados.length) {
        let onda = o.tipo === 2;
        for (const v of tocados) {
          if (o.alTocar) o.alTocar(o, v);
          else if (o.tipo === 2 && v instanceof Player && o.contra === "jugadores") {
            if (toqueDefinitivo(v, o) === "escudo") onda = false;
          } else danarCon(v, o.dano, o);
        }
        explotar(o, onda && o.contra === "jugadores");
        continue;
      }
      if (o.t > o.vida) {
        explotar(o);
        continue;
      }
      o.e.teleport(o.pos, { keepVelocity: false });
    } catch {
      orbes.delete(id);
    }
  }
}, 1);

// Golpear una orbe: la normal se devuelve; la definitiva necesita 3 golpes.
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  if (hurtEntity.typeId !== FINAL.orbe) return;
  const o = orbes.get(hurtEntity.id);
  try {
    hurtEntity.getComponent("minecraft:health")?.resetToMaxValue();
  } catch {
    // Sin vida.
  }
  const quien = damageSource.damagingEntity;
  if (!o || !(quien instanceof Player) || o.contra !== "jugadores") return;
  o.golpes++;
  soundAt(o.dim, o.pos, "random.anvil_land", 1.8, 0.6);
  particleAt(o.dim, PARTICLES.estallido, o.pos);
  const necesita = o.tipo === 2 ? 3 : 1;
  const v = quien.getViewDirection();
  if (o.golpes < necesita) {
    // La empuja un poco hacia atrás.
    o.vel = { x: v.x * o.rapidez * 0.6, y: 0.05, z: v.z * o.rapidez * 0.6 };
    o.guiadoHasta = o.t + 25;
    return;
  }
  // ¡Devuelta! Ahora vuela contra Claude Golden.
  const golden = o.dueno?.isValid ? o.dueno : undefined;
  o.contra = "golden";
  o.dueno = quien;
  o.objetivo = golden;
  o.rapidez = Math.max(0.6, o.rapidez * 1.6);
  const c = golden ? centroDe(golden) : undefined;
  const d = c ? norm({ x: c.x - o.pos.x, y: c.y - o.pos.y, z: c.z - o.pos.z }) : v;
  o.vel = { x: d.x * o.rapidez, y: d.y * o.rapidez, z: d.z * o.rapidez };
  o.guiado = 0.25;
  o.guiadoHasta = o.t + 80;
  o.vida = o.t + 100;
  o.dano = o.tipo === 2 ? 120 : GOLDEN_FINAL.danoOrbe * 2;
  soundAt(o.dim, o.pos, "item.trident.return", 1.2, 1);
});
