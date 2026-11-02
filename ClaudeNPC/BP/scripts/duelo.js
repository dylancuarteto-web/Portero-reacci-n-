import { system } from "@minecraft/server";
import { ANIM, ARMAS, DUELO, PARTICLES } from "./config.js";
import { sostener } from "./equipo.js";
import { subirEscudo } from "./escudo.js";
import { nivelHab } from "./habilidades.js";
import { nivel } from "./iq.js";
import { deslizar, saltando, saltoGuiado } from "./movimiento.js";
import { golpear } from "./tacticas.js";
import { animate, flat, now, particleAt, rand, sortear, sound } from "./util.js";

// Pelea de cerca más variada (antes casi solo daba espadazos y caía rápido):
//   bloquear   levanta el escudo cuando lo vas a golpear; si para el golpe, contraataca
//   esquivar   paso rápido de lado o hacia atrás
//   embestida  se lanza hacia ti y golpea
//   critico    salta y golpea al caer (daño crítico)
//   combo      dos golpes seguidos
//   curarse    con poca vida se aparta y come una manzana dorada
// Cuanto más IQ, más a menudo los usa y mejor los elige. Todo con pasos guiados (sin
// pelearse con la IA del juego, que es lo que lo hacía temblar).

function vida(npc) {
  try {
    const h = npc.getComponent("minecraft:health");
    return h ? h.currentValue / h.effectiveMax : 1;
  } catch {
    return 1;
  }
}

function danoArma(s) {
  const a = ARMAS[s.arma] ?? ARMAS[0];
  return (a.dano ?? 6) * (0.7 + nivel(s) * 0.4);
}

function animarAtaque(npc, s) {
  const tipo = (ARMAS[s.arma] ?? ARMAS[0]).tipo;
  s.reves = !s.reves;
  animate(npc, tipo === "hacha" ? ANIM.hachazo : tipo === "tridente" ? ANIM.estocada : s.reves ? ANIM.espadazo2 : ANIM.espadazo);
  sound(npc, "game.player.attack.strong", 0.9 + Math.random() * 0.2, 0.7);
}

// Golpe del duelo: solo si de verdad estás al alcance en ese momento.
function golpe(npc, s, jugador, mult = 1, empuje = 0.4) {
  if (!npc.isValid || !jugador.isValid) return false;
  const d = Math.hypot(jugador.location.x - npc.location.x, jugador.location.z - npc.location.z);
  if (d > DUELO.alcance || Math.abs(jugador.location.y - npc.location.y) > 2) return false;
  animarAtaque(npc, s);
  return golpear(npc, jugador, danoArma(s) * mult, empuje, 0.28);
}

// Golpe normal de respaldo: si la IA del juego no está golpeando (por ejemplo, porque no
// te tiene como objetivo), el Claude te pega igual cuando estás a su alcance.
export function golpeBasico(npc, s, jugador) {
  return golpe(npc, s, jugador, 1, 0.4);
}

// ¿Lo estás mirando (a punto de golpearlo)?
function teMira(jugador, npc) {
  try {
    const v = jugador.getViewDirection();
    const d = flat(jugador.location, npc.location);
    return v.x * d.x + v.z * d.z > 0.75;
  } catch {
    return false;
  }
}

const MOVIMIENTOS = {
  bloquear(npc, s, jugador) {
    if (!subirEscudo(npc, s, jugador, DUELO.bloqueo)) return 0;
    animate(npc, ANIM.bloqueo);
    s.parada = now() + DUELO.bloqueo; // ventana en la que para golpes cuerpo a cuerpo de frente
    return 6;
  },
  esquivar(npc, s, jugador) {
    const d = flat(npc.location, jugador.location);
    s.lado = Math.random() < 0.5 ? -(s.lado ?? 1) : (s.lado ?? 1);
    const atras = Math.random() < 0.35;
    const k = atras ? 1.6 : 1.8;
    const dir = atras ? { x: -d.x, z: -d.z } : { x: -d.z * s.lado, z: d.x * s.lado };
    const l = npc.location;
    deslizar(npc, { x: l.x + dir.x * k, y: l.y, z: l.z + dir.z * k }, 4);
    sound(npc, "mob.player.step", 1.4, 0.5);
    return 6;
  },
  embestida(npc, s, jugador) {
    const d = flat(npc.location, jugador.location);
    const lejos = Math.max(0, d.d - 1.3);
    const l = npc.location;
    animate(npc, ANIM.lanzar);
    deslizar(npc, { x: l.x + d.x * lejos, y: l.y, z: l.z + d.z * lejos }, 4);
    system.runTimeout(() => golpe(npc, s, jugador, 1.1, 0.6), 4);
    return 10;
  },
  critico(npc, s, jugador) {
    const d = flat(npc.location, jugador.location);
    const lejos = Math.max(0, d.d - 1.2);
    const l = npc.location;
    animate(npc, ANIM.torre);
    saltoGuiado(npc, { x: l.x + d.x * lejos, y: l.y, z: l.z + d.z * lejos }, {
      ticks: 9, alto: 1.0, retraso: 0,
      alTerminar() {
        if (golpe(npc, s, jugador, 1.5, 0.5)) {
          particleAt(npc.dimension, "minecraft:critical_hit_emitter", { x: jugador.location.x, y: jugador.location.y + 1, z: jugador.location.z });
          sound(npc, "game.player.attack.strong", 0.7, 1);
        }
      },
    });
    return 12;
  },
  combo(npc, s, jugador) {
    golpe(npc, s, jugador, 0.9, 0.15);
    system.runTimeout(() => golpe(npc, s, jugador, 0.9, 0.5), 6);
    return 10;
  },
  curarse(npc, s, jugador) {
    s.cd.curar = now() + DUELO.curarCada;
    const d = flat(npc.location, jugador.location);
    const l = npc.location;
    deslizar(npc, { x: l.x - d.x * 2.6, y: l.y, z: l.z - d.z * 2.6 }, 6);
    sostener(npc, "minecraft:golden_apple");
    for (let t = 6; t <= 30; t += 6) {
      system.runTimeout(() => {
        if (!npc.isValid) return;
        animate(npc, ANIM.beber);
        sound(npc, "random.eat", 0.9 + Math.random() * 0.3, 0.8);
      }, t);
    }
    system.runTimeout(() => {
      if (!npc.isValid) return;
      try {
        const h = npc.getComponent("minecraft:health");
        if (h) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + DUELO.cura));
        npc.addEffect("regeneration", 100, { amplifier: 1, showParticles: true });
        npc.addEffect("absorption", 1200, { amplifier: 1, showParticles: false });
      } catch {
        // Sin efectos.
      }
      sound(npc, "random.burp", 1, 0.8);
      particleAt(npc.dimension, PARTICLES.idea, { x: npc.location.x, y: npc.location.y + 2.1, z: npc.location.z });
      sostener(npc, (ARMAS[s.arma] ?? ARMAS[0]).id);
    }, 34);
    return 36;
  },
};

/**
 * Elige y hace un movimiento de pelea cercana. Devuelve true si ocupó el turno.
 * @param {import("@minecraft/server").Entity} npc
 * @param {any} s
 * @param {import("@minecraft/server").Player} jugador
 * @param {{dist:number, alto:number}} c
 */
export function duelo(npc, s, jugador, c) {
  if (c.dist > DUELO.desde || Math.abs(c.alto) > 1.6 || saltando(npc) || now() < (s.cd.duelo ?? 0)) return false;
  const n = nivel(s);
  const opciones = [];
  const v = vida(npc);
  if (v < DUELO.curarCon && now() >= (s.cd.curar ?? 0)) opciones.push({ id: "curarse", p: 8 });
  const escudo = nivelHab(npc, s, "escudo");
  if (c.dist < 3.6 && teMira(jugador, npc) && now() >= (s.cd.escudo ?? 0)) opciones.push({ id: "bloquear", p: 2 + n * 3 + escudo });
  if (c.dist < 3.2) opciones.push({ id: "esquivar", p: 1 + n * 2 + nivelHab(npc, s, "reflejos") * 0.5 });
  if (c.dist > 2.6) opciones.push({ id: "embestida", p: 2.5 + n * 1.5 });
  if (c.dist > 1.8 && c.dist < 4.2 && npc.isOnGround) opciones.push({ id: "critico", p: 1.5 + n * 2.5 });
  if (c.dist < 2.7) opciones.push({ id: "combo", p: 1.5 + n * 2 });
  // Muchas veces lo mejor es seguir peleando normal (la IA del juego golpea sola).
  opciones.push({ id: null, p: 5 - n * 2 });
  const elegido = sortear(opciones);
  // Reacción: con IQ bajo cada ~1,2 s, con IQ alto cada ~0,5 s.
  s.cd.duelo = now() + Math.round(rand(...DUELO.cada) * (1 - n * 0.45));
  if (!elegido.id) return false;
  const dur = MOVIMIENTOS[elegido.id](npc, s, jugador);
  if (!dur) return false;
  s.ultima = elegido.id;
  s.ocupadoHasta = Math.max(s.ocupadoHasta ?? 0, now() + dur);
  return true;
}

// Paró tu golpe con el escudo: chispas, sonido y, a veces, contraataque inmediato.
export function paradaCuerpo(npc, s, jugador) {
  if (!npc.isValid) return;
  animate(npc, ANIM.bloqueo);
  sound(npc, "item.shield.block", 0.9 + Math.random() * 0.2, 1);
  particleAt(npc.dimension, PARTICLES.bloqueo, { x: npc.location.x, y: npc.location.y + 1.2, z: npc.location.z });
  if (!jugador?.isValid) return;
  try {
    const d = flat(npc.location, jugador.location);
    jugador.applyKnockback({ x: d.x * 0.35, z: d.z * 0.35 }, 0.15);
  } catch {
    // Sin empujón.
  }
  if (Math.random() < 0.35 + nivel(s) * 0.45) {
    system.runTimeout(() => {
      if (!npc.isValid || !jugador.isValid) return;
      s.parada = 0;
      MOVIMIENTOS.embestida(npc, s, jugador);
    }, 5);
  }
}
