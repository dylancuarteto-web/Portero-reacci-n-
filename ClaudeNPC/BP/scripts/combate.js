import { EntityDamageCause, system } from "@minecraft/server";
import { ANIM, ARMAS, COMBATE, MODIFICA_MUNDO, PARTICLES } from "./config.js";
import { cavar, pilar, puente, torreta, trampa } from "./construccion.js";
import { sostener } from "./equipo.js";
import { animate, burst, flat, now, rand, sound } from "./util.js";

const listo = (state, key) => now() >= (state.cd[key] ?? 0);
const esperar = (state, key, ticks) => { state.cd[key] = now() + ticks; };

function cambiarArma(npc, state) {
  state.arma = (state.arma + 1) % ARMAS.length;
  sostener(npc, ARMAS[state.arma]);
  // Escudo en la otra mano salvo cuando el escudo es el arma principal.
  sostener(npc, ARMAS[state.arma] === "minecraft:shield" ? "minecraft:totem_of_undying" : "minecraft:shield",
    "slot.weapon.offhand");
  esperar(state, "arma", rand(...COMBATE.cambioArma));
}

function golpear(npc, jugador, dano, empuje, alto) {
  try {
    const dir = flat(npc.location, jugador.location);
    jugador.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: npc });
    jugador.applyKnockback({ x: dir.x * empuje, z: dir.z * empuje }, alto);
  } catch {
    // Jugador fuera de alcance o invulnerable.
  }
}

// Se mueve en distintas direcciones: de lado, hacia atrás, embestida y saltos.
function moverse(npc, jugador, dist) {
  const dir = flat(npc.location, jugador.location);
  const lado = Math.random() < 0.5 ? 1 : -1;
  const salto = Math.random() < 0.35 ? 0.42 : 0;
  let impulso;
  if (dist < 2.5) impulso = { x: -dir.x * 0.5, y: salto, z: -dir.z * 0.5 };
  else if (dist < 6 && Math.random() < 0.4) {
    impulso = { x: dir.x * 0.7, y: 0.3, z: dir.z * 0.7 };
    animate(npc, ANIM.golpe);
  } else impulso = { x: -dir.z * lado * 0.45, y: salto, z: dir.x * lado * 0.45 };
  try {
    npc.applyImpulse(impulso);
  } catch {
    // Entidad descargada.
  }
}

function martillazo(npc, jugador) {
  const dir = flat(npc.location, jugador.location);
  animate(npc, ANIM.martillazo);
  try {
    npc.applyImpulse({ x: dir.x * 0.5, y: 0.95, z: dir.z * 0.5 });
  } catch {
    return;
  }
  system.runTimeout(() => {
    if (!npc.isValid) return;
    burst(npc, PARTICLES.onda, { x: 0, y: 0.1, z: 0 });
    sound(npc, "mace.heavy_smash_ground", 1);
    for (const p of npc.dimension.getPlayers({ location: npc.location, maxDistance: 3.5 })) golpear(npc, p, 9, 1.4, 0.6);
  }, 16);
}

function golpeEscudo(npc, jugador) {
  animate(npc, ANIM.escudo);
  sound(npc, "item.shield.block", 0.8);
  golpear(npc, jugador, 6, 1.8, 0.4);
}

// Lanza una perla de ender y aparece junto al jugador.
function perla(npc, state, jugador) {
  sostener(npc, "minecraft:ender_pearl");
  animate(npc, ANIM.lanzar);
  const dir = flat(npc.location, jugador.location);
  try {
    const head = npc.getHeadLocation();
    const pearl = npc.dimension.spawnEntity("minecraft:ender_pearl", { x: head.x + dir.x, y: head.y, z: head.z + dir.z });
    pearl.getComponent("minecraft:projectile")?.shoot({ x: dir.x * 1.4, y: 0.5, z: dir.z * 1.4 });
    system.runTimeout(() => { if (pearl.isValid) pearl.remove(); }, 18);
  } catch {
    // Sin perla visual, el teletransporte sigue.
  }
  system.runTimeout(() => {
    if (!npc.isValid || !jugador.isValid) return;
    burst(npc, PARTICLES.teletransporte);
    const d = flat(jugador.location, npc.location);
    try {
      npc.teleport({ x: jugador.location.x + d.x * 2.5, y: jugador.location.y, z: jugador.location.z + d.z * 2.5 },
        { facingLocation: jugador.location, checkForBlocks: true });
    } catch {
      return;
    }
    burst(npc, PARTICLES.teletransporte);
    sound(npc, "mob.endermen.portal");
    sostener(npc, ARMAS[state.arma]);
  }, 18);
}

export function tickCombate(npc, state, jugador) {
  const dist = Math.hypot(jugador.location.x - npc.location.x, jugador.location.z - npc.location.z);
  const alto = jugador.location.y - npc.location.y;
  const arma = ARMAS[state.arma];

  if (listo(state, "arma")) cambiarArma(npc, state);

  if (dist > COMBATE.perlaDistancia && listo(state, "perla")) {
    esperar(state, "perla", COMBATE.perlaCooldown);
    perla(npc, state, jugador);
    return;
  }
  if (arma === "minecraft:mace" && dist < 7 && listo(state, "martillo")) {
    esperar(state, "martillo", COMBATE.martilloCooldown);
    martillazo(npc, jugador);
    return;
  }
  if (arma === "minecraft:shield" && dist < 3.2 && listo(state, "escudo")) {
    esperar(state, "escudo", COMBATE.escudoCooldown);
    golpeEscudo(npc, jugador);
    return;
  }
  if (MODIFICA_MUNDO) {
    if (alto > 2 && dist < 5 && listo(state, "obra")) {
      esperar(state, "obra", 12);
      pilar(npc);
      return;
    }
    if (alto < -3 && dist < 4 && listo(state, "obra")) {
      esperar(state, "obra", 14);
      cavar(npc, state);
      return;
    }
    if (dist > 6 && dist < 16 && listo(state, "torreta") && torreta(npc, jugador)) {
      esperar(state, "torreta", COMBATE.torretaCooldown);
      return;
    }
    if (dist > 4 && dist < 12 && listo(state, "trampa") && trampa(npc, jugador)) {
      esperar(state, "trampa", COMBATE.trampaCooldown);
      return;
    }
    if (listo(state, "puente") && puente(npc, jugador)) esperar(state, "puente", 10);
  }
  if (listo(state, "mover")) {
    esperar(state, "mover", COMBATE.movimiento);
    moverse(npc, jugador, dist);
  }
}
