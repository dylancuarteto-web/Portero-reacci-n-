import { EntityDamageCause, Player, system, world } from "@minecraft/server";
import { ANIM, ESCUDO, NPC, PARTICLES } from "./config.js";
import { estados } from "./estado.js";
import { aprender, nivel } from "./iq.js";
import { poseEscudo } from "./postura.js";
import { animate, burst, now, sound } from "./util.js";

// Escudo contra flechas, como un jugador: cuando ve que le apuntas con un arco,
// ballesta o tridente (o ve venir un proyectil) levanta el escudo, camina despacio
// y te mira de frente. Las flechas que llegan por delante rebotan. Nunca golpea
// con el escudo: para atacar lo baja y usa la espada.

const ARMAS_DISTANCIA = new Set(["minecraft:bow", "minecraft:crossbow", "minecraft:trident"]);
const PROYECTILES = new Set(["minecraft:arrow", "minecraft:thrown_trident", "minecraft:snowball", "minecraft:egg",
  "minecraft:splash_potion", "minecraft:lingering_potion", "minecraft:small_fireball", "minecraft:fireball",
  "minecraft:wind_charge_projectile"]);

function puedeCubrirse(s) {
  return !s.fusion && !s.clase && !s.bote && !s.sentado && !s.obra && !s.aguaActiva && !s.robot && now() >= (s.cd.escudo ?? 0);
}

export function subirEscudo(npc, s, amenaza, ticks) {
  if (!puedeCubrirse(s)) return false;
  const hasta = now() + ticks;
  if (s.escudoArriba) {
    s.escudo.hasta = Math.max(s.escudo.hasta, hasta);
    if (amenaza) s.escudo.amenaza = amenaza;
    return true;
  }
  s.escudoArriba = true;
  s.escudo = { hasta, desde: now(), amenaza };
  poseEscudo(npc, true);
  sound(npc, "armor.equip_generic", 0.8, 0.7);
  return true;
}

export function bajarEscudo(npc, s, enfriar = 0) {
  if (enfriar) s.cd.escudo = now() + enfriar;
  if (!s.escudoArriba) return;
  s.escudoArriba = false;
  s.escudo = undefined;
  poseEscudo(npc, false);
}

// ¿Lo ve? (nada sólido entre su cabeza y la del jugador).
function ve(npc, jugador) {
  try {
    const a = npc.getHeadLocation();
    const b = jugador.getHeadLocation();
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d < 1) return true;
    const hit = npc.dimension.getBlockFromRay(a, { x: (b.x - a.x) / d, y: (b.y - a.y) / d, z: (b.z - a.z) / d }, { maxDistance: d });
    return !hit;
  } catch {
    return false;
  }
}

// Reacciona con algo de retraso: menos cuanto más IQ y más flechas ha recibido.
function reaccionar(npc, s, amenaza, ticks) {
  const n = nivel(s);
  const base = ESCUDO.reaccion[0] - (ESCUDO.reaccion[0] - ESCUDO.reaccion[1]) * n;
  const demora = Math.max(2, Math.round(base - Math.min(5, s.memoria.arco * 0.7)));
  system.runTimeout(() => {
    if (npc.isValid && amenaza.isValid) subirEscudo(npc, s, amenaza, ticks);
  }, demora);
}

function claudesCerca(jugador, radio) {
  try {
    return jugador.dimension.getEntities({ type: NPC, location: jugador.location, maxDistance: radio });
  } catch {
    return [];
  }
}

world.afterEvents.itemStartUse.subscribe(({ source, itemStack }) => {
  if (!ARMAS_DISTANCIA.has(itemStack?.typeId)) return;
  for (const npc of claudesCerca(source, ESCUDO.vista)) {
    const s = estados.get(npc.id);
    if (s && ve(npc, source)) reaccionar(npc, s, source, ESCUDO.duracion);
  }
});

// Al soltar la flecha (o dejar de tensar) aún la espera un momento con el escudo.
function soltar(source) {
  for (const npc of claudesCerca(source, ESCUDO.vista)) {
    const s = estados.get(npc.id);
    if (s?.escudoArriba && s.escudo.amenaza === source) s.escudo.hasta = now() + 16;
  }
}
world.afterEvents.itemReleaseUse.subscribe(({ source }) => soltar(source));
world.afterEvents.itemStopUse.subscribe(({ source }) => soltar(source));

function dueno(p) {
  try {
    return p.getComponent("minecraft:projectile")?.owner;
  } catch {
    return undefined;
  }
}

// Cada 2 ticks, para los Claudes que están peleando: baja el escudo cuando ya no
// hace falta y busca proyectiles que vengan hacia él.
system.runInterval(() => {
  for (const s of estados.values()) {
    const npc = s.npc;
    if (!npc?.isValid || now() > (s.combateHasta ?? 0)) {
      if (s.escudoArriba && npc?.isValid) bajarEscudo(npc, s);
      continue;
    }
    try {
      if (s.escudoArriba) {
        const n = nivel(s);
        // Con IQ alto no se queda quieto tras el escudo para siempre: lo baja y contraataca.
        if (now() > s.escudo.hasta || (n > 0.3 && now() - s.escudo.desde > 90)) {
          bajarEscudo(npc, s, 30);
          continue;
        }
      }
      if (!puedeCubrirse(s) && !s.escudoArriba) continue;
      const centro = { x: npc.location.x, y: npc.location.y + 1, z: npc.location.z };
      for (const p of npc.dimension.getEntities({ location: centro, maxDistance: 14 })) {
        if (!PROYECTILES.has(p.typeId)) continue;
        const owner = dueno(p);
        if (owner?.typeId === NPC) continue;
        s.vistos ??= new Set();
        if (s.vistos.has(p.id)) continue;
        const v = p.getVelocity();
        const rapidez = Math.hypot(v.x, v.y, v.z);
        if (rapidez < 0.3) continue;
        const dx = centro.x - p.location.x;
        const dy = centro.y - p.location.y;
        const dz = centro.z - p.location.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        if ((v.x * dx + v.y * dy + v.z * dz) / (rapidez * d) < 0.9) continue; // no viene hacia él
        s.vistos.add(p.id);
        if (s.vistos.size > 40) s.vistos.clear();
        if (Math.random() < 0.35 + nivel(s) * 0.6) subirEscudo(npc, s, owner instanceof Player ? owner : p, 24);
      }
    } catch {
      // Entidad descargada.
    }
  }
}, 2);

// Se usa dentro de beforeEvents.entityHurt (solo lectura): ¿la flecha llega por delante
// con el escudo levantado?
export function bloqueaProyectil(npc, s, damageSource) {
  if (!s.escudoArriba || damageSource.cause !== EntityDamageCause.projectile) return false;
  const origen = damageSource.damagingEntity ?? damageSource.damagingProjectile;
  if (!origen) return true;
  const v = npc.getViewDirection();
  const dx = origen.location.x - npc.location.x;
  const dz = origen.location.z - npc.location.z;
  const d = Math.hypot(dx, dz);
  const h = Math.hypot(v.x, v.z);
  if (d < 0.01 || h < 0.01) return true;
  return (v.x * dx + v.z * dz) / (d * h) > -0.15; // unos 100° a cada lado
}

export function efectoBloqueo(npc, s) {
  if (!npc.isValid) return;
  animate(npc, ANIM.bloqueo);
  sound(npc, "item.shield.block", 1);
  burst(npc, PARTICLES.bloqueo, { x: 0, y: 1.2, z: 0 });
  s.memoria.bloqueos++;
  aprender(npc, s, 0.2);
  if (s.escudo) s.escudo.hasta = Math.max(s.escudo.hasta, now() + 20);
}
