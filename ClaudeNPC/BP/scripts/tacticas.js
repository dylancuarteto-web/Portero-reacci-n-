import { EntityDamageCause, system } from "@minecraft/server";
import { ANIM, ARMAS, PARTICLES } from "./config.js";
import { ponerElytra, quitarElytra, sostener } from "./equipo.js";
import { nivel } from "./iq.js";
import { alturaSuelo, animate, blockAt, burst, flat, impulse, mirarA, now, sound } from "./util.js";

export function armaActual(state) {
  return ARMAS[Math.max(0, state.arma)];
}

function volverAlArma(npc, state) {
  if (npc.isValid) sostener(npc, armaActual(state));
}

export function golpear(npc, jugador, dano, empuje, alto) {
  try {
    const dir = flat(npc.location, jugador.location);
    jugador.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: npc });
    jugador.applyKnockback({ x: dir.x * empuje, z: dir.z * empuje }, alto);
    return true;
  } catch {
    return false;
  }
}

// Arco: tensa con animación y dispara apuntando adonde estará el jugador.
// Con más IQ predice mejor el movimiento y compensa la caída de la flecha.
export function arco(npc, state, jugador) {
  state.ocupadoHasta = now() + 34;
  sostener(npc, "minecraft:bow");
  mirarA(npc, jugador.getHeadLocation());
  animate(npc, ANIM.arco);
  sound(npc, "random.bow", 0.6);
  system.runTimeout(() => {
    if (!npc.isValid || !jugador.isValid) return;
    const n = nivel(state);
    const head = npc.getHeadLocation();
    const objetivo = jugador.location;
    const h = Math.hypot(objetivo.x - head.x, objetivo.z - head.z);
    const rapidez = 2.6;
    const tiempo = h / rapidez;
    const v = jugador.getVelocity();
    const lead = 0.3 + n * 0.7;
    const px = objetivo.x + v.x * tiempo * lead;
    const pz = objetivo.z + v.z * tiempo * lead;
    const py = objetivo.y + 1.1 + 0.5 * 0.05 * tiempo * tiempo;
    const error = (1 - n) * 0.12;
    const dx = px - head.x + (Math.random() - 0.5) * error * h;
    const dy = py - head.y;
    const dz = pz - head.z + (Math.random() - 0.5) * error * h;
    const len = Math.hypot(dx, dy, dz) || 1;
    try {
      const flecha = npc.dimension.spawnEntity("minecraft:arrow",
        { x: head.x + (dx / len) * 0.8, y: head.y, z: head.z + (dz / len) * 0.8 });
      const proj = flecha.getComponent("minecraft:projectile");
      if (proj) {
        proj.owner = npc;
        proj.shoot({ x: (dx / len) * rapidez, y: (dy / len) * rapidez, z: (dz / len) * rapidez });
      }
      sound(npc, "random.bow", 1.1);
    } catch {
      // Sin flecha.
    }
    system.runTimeout(() => volverAlArma(npc, state), 8);
  }, 24);
}

// Perla de ender: la lanza y aparece junto al jugador (a su espalda con IQ alto).
export function perla(npc, state, jugador) {
  state.ocupadoHasta = now() + 24;
  sostener(npc, "minecraft:ender_pearl");
  mirarA(npc, jugador.location);
  animate(npc, ANIM.lanzar);
  const dir = flat(npc.location, jugador.location);
  try {
    const head = npc.getHeadLocation();
    const p = npc.dimension.spawnEntity("minecraft:ender_pearl", { x: head.x + dir.x, y: head.y, z: head.z + dir.z });
    p.getComponent("minecraft:projectile")?.shoot({ x: dir.x * 1.4, y: 0.5, z: dir.z * 1.4 });
    system.runTimeout(() => { if (p.isValid) p.remove(); }, 18);
  } catch {
    // Sin perla visual.
  }
  system.runTimeout(() => {
    if (!npc.isValid || !jugador.isValid) return;
    burst(npc, PARTICLES.teletransporte);
    const lado = nivel(state) > 0.4 ? -1 : 1; // con IQ alto aparece detrás del jugador
    const d = flat(jugador.location, npc.location);
    try {
      npc.teleport({ x: jugador.location.x + d.x * 2.5 * lado, y: jugador.location.y, z: jugador.location.z + d.z * 2.5 * lado },
        { facingLocation: jugador.location, checkForBlocks: true });
    } catch {
      return;
    }
    burst(npc, PARTICLES.teletransporte);
    sound(npc, "mob.endermen.portal");
    volverAlArma(npc, state);
  }, 18);
}

function impactoMaza(npc, state, caida) {
  burst(npc, PARTICLES.onda, { x: 0, y: 0.1, z: 0 });
  sound(npc, "mace.heavy_smash_ground", 1);
  const dano = Math.min(30, 6 + caida * 1.6);
  let acerto = false;
  for (const p of npc.dimension.getPlayers({ location: npc.location, maxDistance: 3.5 })) {
    acerto = golpear(npc, p, dano, 1.2, 0.5) || acerto;
  }
  return acerto;
}

// Salto con maza: salta como un jugador y golpea al caer.
export function martillazo(npc, state, jugador) {
  state.ocupadoHasta = now() + 22;
  sostener(npc, "minecraft:mace");
  const d = flat(npc.location, jugador.location);
  const y0 = npc.location.y;
  animate(npc, ANIM.martillazo);
  impulse(npc, { x: d.x * 0.22, y: 0.62, z: d.z * 0.22 });
  system.runTimeout(() => {
    if (!npc.isValid) return;
    impactoMaza(npc, state, Math.max(0, y0 + 2 - npc.location.y));
    system.runTimeout(() => volverAlArma(npc, state), 10);
  }, 18);
}

export function golpeEscudo(npc, state, jugador) {
  state.ocupadoHasta = now() + 14;
  sostener(npc, "minecraft:shield");
  animate(npc, ANIM.escudo);
  sound(npc, "item.shield.block", 0.8);
  golpear(npc, jugador, 6, 1.8, 0.4);
  system.runTimeout(() => volverAlArma(npc, state), 14);
}

// Elytra + maza: despega con un cohete, planea hacia el jugador y cae en picada
// con la maza. El daño depende de la altura de la caída, como la maza real.
export function elytraMartillo(npc, state, jugador) {
  state.ocupadoHasta = now() + 240;
  state.sinCaidaHasta = now() + 300;
  ponerElytra(npc);
  sostener(npc, "minecraft:firework_rocket");
  sound(npc, "firework.launch", 1);
  burst(npc, PARTICLES.cohete, { x: 0, y: 0.3, z: 0 });
  impulse(npc, { x: 0, y: 1.25, z: 0 });
  let fase = "subir";
  let t = 0;
  let alturaPicada = 0;
  const fin = () => {
    system.clearRun(id);
    if (!npc.isValid) return;
    quitarElytra(npc, state);
    state.ocupadoHasta = now() + 10;
    volverAlArma(npc, state);
  };
  const id = system.runInterval(() => {
    if (!npc.isValid || !jugador.isValid || ++t > 220) return fin();
    const d = flat(npc.location, jugador.location);
    const v = npc.getVelocity();
    if (fase === "subir") {
      if (t > 12) {
        fase = "planear";
        sostener(npc, "minecraft:mace");
        animate(npc, ANIM.planeo);
      }
      return;
    }
    if (fase === "planear") {
      // Contrarresta casi toda la gravedad y avanza hacia el jugador.
      impulse(npc, { x: d.x * 0.06 - v.x * 0.04, y: 0.07 - Math.min(0, v.y) * 0.08, z: d.z * 0.06 - v.z * 0.04 });
      if (t % 30 === 0 && d.d > 10) {
        impulse(npc, { x: d.x * 0.45, y: 0.25, z: d.z * 0.45 });
        burst(npc, PARTICLES.cohete, { x: 0, y: 0.3, z: 0 });
        sound(npc, "firework.launch", 1.2);
      }
      if (t % 20 === 0) animate(npc, ANIM.planeo);
      if (d.d < 3 && npc.location.y - jugador.location.y > 2.5) {
        fase = "picada";
        alturaPicada = npc.location.y;
        animate(npc, ANIM.martillazo);
      } else if (alturaSuelo(npc) < 1 && t > 40) {
        return fin();
      }
      return;
    }
    impulse(npc, { x: d.x * 0.08, y: -0.4, z: d.z * 0.08 });
    if (npc.isOnGround || alturaSuelo(npc) < 0.5 || npc.location.y <= jugador.location.y + 0.3) {
      impactoMaza(npc, state, Math.max(0, alturaPicada - npc.location.y));
      fin();
    }
  }, 1);
}

// Salta al vacío hacia el jugador; el "water drop" evita el daño al caer.
export function saltarAlVacio(npc, state, jugador) {
  const d = flat(npc.location, jugador.location);
  state.ocupadoHasta = now() + 30;
  mirarA(npc, jugador.location);
  impulse(npc, { x: d.x * 0.32, y: 0.3, z: d.z * 0.32 });
}

export function hayBorde(npc, jugador) {
  const d = flat(npc.location, jugador.location);
  const delante = blockAt(npc.dimension, { x: npc.location.x + d.x * 1.2, y: npc.location.y - 1, z: npc.location.z + d.z * 1.2 });
  return !!delante?.isAir;
}

// Water drop (MLG): mientras cae desde altura, saca el cubo, coloca agua justo
// antes de tocar el suelo y luego la recoge.
export function vigilarCaida(npc, state) {
  if (state.aguaActiva || npc.isOnGround) return;
  const v = npc.getVelocity();
  if (v.y > -0.45 || alturaSuelo(npc) < 5) return;
  state.aguaActiva = true;
  sostener(npc, "minecraft:water_bucket");
  animate(npc, ANIM.cubeta);
  let colocada;
  let t = 0;
  const id = system.runInterval(() => {
    if (!npc.isValid || ++t > 120) {
      system.clearRun(id);
      state.aguaActiva = false;
      return;
    }
    if (!colocada && alturaSuelo(npc) <= 2.4) {
      const suelo = npc.dimension.getBlockFromRay(npc.location, { x: 0, y: -1, z: 0 }, { maxDistance: 4 });
      const pos = suelo && blockAt(npc.dimension, { x: suelo.block.location.x, y: suelo.block.location.y + 1, z: suelo.block.location.z });
      if (pos?.isAir) {
        try {
          pos.setType("minecraft:water");
          colocada = { ...pos.location };
          state.sinCaidaHasta = now() + 40;
          sound(npc, "bucket.empty_water", 1);
          sostener(npc, "minecraft:bucket");
        } catch {
          // No se pudo colocar.
        }
      }
    }
    if (npc.isOnGround || npc.isInWater) {
      system.clearRun(id);
      system.runTimeout(() => {
        state.aguaActiva = false;
        if (!colocada || !npc.isValid) return;
        const b = blockAt(npc.dimension, colocada);
        try {
          if (b?.typeId === "minecraft:water") b.setType("minecraft:air");
          sound(npc, "bucket.fill_water", 1);
          sostener(npc, "minecraft:water_bucket");
          system.runTimeout(() => volverAlArma(npc, state), 10);
        } catch {
          // El agua ya no está.
        }
      }, 12);
    }
  }, 1);
}
