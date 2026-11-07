import { EntityDamageCause, EquipmentSlot } from "@minecraft/server";
import { flat, mirarA, now, sound } from "../util.js";
import { gestoGolpe } from "./animacion.js";
import { danoBase } from "./armas.js";
import { INFINITO_CFG } from "./config.js";
import { ganar } from "./determinacion.js";
import { fase, puede } from "./fases.js";
import { vfxGolpe } from "./vfx.js";

// Golpe cuerpo a cuerpo del Infinito (todo el daño lo pone el script; su entidad no tiene
// ataque propio). Como en el PvP de Minecraft:
//   - alcance de 3 bloques (antes de la fase 7 se acerca más de lo necesario);
//   - el rival tiene 10 ticks de invulnerabilidad después de cada golpe: golpear más rápido
//     no sirve, así que el ritmo mínimo es de 10 ticks (las fases altas golpean justo al
//     terminar esa ventana);
//   - crítico: golpe mientras cae después de un salto, × 1,5;
//   - golpe corriendo (después de un W-tap o un sprint reset): más empuje;
//   - un jugador que se cubre con el escudo de frente para el golpe, salvo con hacha, que
//     le desactiva el escudo 5 segundos (como en Java y en Bedrock).

export function seCubre(rival, yo) {
  try {
    if (rival.typeId !== "minecraft:player" || !rival.isSneaking) return false;
    const eq = rival.getComponent("minecraft:equippable");
    const escudo = [EquipmentSlot.Offhand, EquipmentSlot.Mainhand].some((k) => eq?.getEquipment(k)?.typeId === "minecraft:shield");
    if (!escudo) return false;
    const v = rival.getViewDirection();
    const d = flat(rival.location, yo.location);
    return v.x * d.x + v.z * d.z > -0.1;
  } catch {
    return false;
  }
}

export function alcance(s) {
  return puede(s, "alcance") ? 3.05 : puede(s, "rango") ? 2.8 : 2.4;
}

export function multDano(s) {
  let m = Math.min(INFINITO_CFG.danoMax, 1 + 0.02 * s.fase);
  if (now() < (s.fuerzaHasta ?? 0)) m *= 1.3; // poción de fuerza (Pot PvP)
  return m;
}

export function cadencia(s) {
  let c = fase(s.fase).golpeCada;
  if (s.arma === "hacha") c += 8;
  else if (s.arma === "maza") c += 6;
  if (s.estilo === "1.9") c += 6;
  if (s.estilo === "1.8") c -= 2;
  return Math.max(10, c);
}

export function listoParaGolpear(s) {
  return now() >= s.proximoGolpe && now() >= s.listoEn;
}

export function distanciaA(e, obj) {
  return Math.hypot(obj.location.x - e.location.x, obj.location.z - e.location.z);
}

export function enAlcance(e, s, obj, extra = 0) {
  try {
    const dy = obj.location.y - e.location.y;
    return dy > -2.6 && dy < 2.2 && distanciaA(e, obj) <= alcance(s) + 0.3 + extra;
  } catch {
    return false;
  }
}

// Cae (después de un salto o de una altura): para los críticos y la maza.
export function cayendo(e) {
  try {
    return !e.isOnGround && !e.isInWater && e.getVelocity().y < -0.05;
  } catch {
    return false;
  }
}

// Daño de la maza según la caída (como en el juego): +4 por bloque los 3 primeros, +2 por
// bloque los 5 siguientes y +1 desde ahí, con tope (INFINITO_CFG.topeMaza).
export function danoMaza(caida) {
  const c = Math.max(0, caida - 1.5);
  const extra = Math.min(c, 3) * 4 + Math.min(Math.max(c - 3, 0), 5) * 2 + Math.max(c - 8, 0);
  return Math.min(INFINITO_CFG.topeMaza, 6 + extra);
}

// op: { tipo: "normal" | "rapido" | "pesado" | "critico", caida (maza), empuje, alto, sinGesto }
// Devuelve { ok, bloqueado, critico, dano, fallo, lejos }.
export function golpear(e, s, obj, op = {}) {
  const r = { ok: false, bloqueado: false, critico: false, dano: 0, fallo: false, lejos: false };
  if (!obj?.isValid || !e.isValid) return r;
  if (!enAlcance(e, s, obj, op.caida ? 0.6 : 0)) {
    r.lejos = true;
    return r;
  }
  const f = fase(s.fase);
  try {
    mirarA(e, obj.getHeadLocation());
  } catch {
    // Sin giro.
  }
  const tipo = op.tipo ?? "normal";
  if (!op.sinGesto) gestoGolpe(e, s, tipo);
  const previo = s.ultimoGolpe;
  s.ultimoGolpe = now();
  s.proximoGolpe = now() + cadencia(s);
  if (s.combate) s.combate.intentos = (s.combate.intentos ?? 0) + 1;
  // Errores de las fases bajas: a veces el golpe no llega.
  if (Math.random() < f.error) {
    r.fallo = true;
    sound(e, "game.player.attack.nodamage", 1, 0.7);
    return r;
  }
  const dir = flat(e.location, obj.location);
  // Escudo del jugador.
  if (seCubre(obj, e)) {
    try {
      obj.applyKnockback({ x: dir.x * 0.25, z: dir.z * 0.25 }, 0.05);
      if (s.arma === "hacha") {
        obj.startItemCooldown("shield", 100);
        e.dimension.playSound("random.break", obj.location, { pitch: 0.9, volume: 0.8 });
        s.rompioEscudo = now();
        ganar(e, s, "estrategia", 0.5);
      } else {
        e.dimension.playSound("item.shield.block", obj.location, { pitch: 0.9 + Math.random() * 0.2, volume: 1 });
      }
    } catch {
      // Jugador no disponible.
    }
    r.bloqueado = true;
    s.sprint = false;
    if (s.combate) s.combate.bloqueados = (s.combate.bloqueados ?? 0) + 1;
    return r;
  }
  let dano = op.caida ? danoMaza(op.caida) : danoBase(s);
  dano *= multDano(s);
  if (tipo === "pesado" && now() - previo >= 20) dano *= 1.25; // golpe "cargado" (estilo 1.9)
  if (tipo === "rapido") dano *= 0.85;
  r.critico = tipo === "critico" || (puede(s, "critico") && !op.caida && cayendo(e));
  if (r.critico) dano *= 1.5;
  if (op.caida) dano = Math.min(dano, INFINITO_CFG.topeMaza);
  dano = Math.round(dano * 10) / 10;
  let empuje = op.empuje ?? 0.42;
  if (s.sprint) empuje *= 1.8;
  if (tipo === "pesado") empuje *= 1.2;
  const alto = op.alto ?? (s.sprint ? 0.38 : 0.32);
  let entro = false;
  try {
    entro = obj.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: e });
  } catch {
    entro = false;
  }
  s.sprint = false; // el golpe corriendo gasta el sprint (W-tap para recuperarlo)
  if (!entro) return r;
  try {
    obj.applyKnockback({ x: dir.x * empuje, z: dir.z * empuje }, alto);
  } catch {
    // Sin empuje.
  }
  r.ok = true;
  r.dano = dano;
  vfxGolpe(e, s, obj, r.critico);
  if (r.critico) sound(e, "game.player.attack.strong", 1.1, 0.9);
  if (s.combate) {
    s.combate.dados = (s.combate.dados ?? 0) + 1;
    s.combate.danoDado = (s.combate.danoDado ?? 0) + dano;
  }
  ganar(e, s, r.critico ? "critico" : "golpe");
  return r;
}

// Golpe de la maza al caer: también empuja a los que están cerca.
export function impactoMaza(e, s, obj, caida) {
  const r = golpear(e, s, obj, { caida, tipo: "pesado", empuje: 0.7, alto: 0.5 });
  if (!r.ok) return r;
  sound(e, "mace.heavy_smash_ground", 1, 1);
  try {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 3.5 })) {
      if (p.id === obj.id) continue;
      const d = flat(e.location, p.location);
      p.applyKnockback({ x: d.x * 0.6, z: d.z * 0.6 }, 0.4);
    }
  } catch {
    // Sin jugadores cerca.
  }
  return r;
}
