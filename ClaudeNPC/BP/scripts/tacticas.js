import { EntityDamageCause, system } from "@minecraft/server";
import { ANIM, ARMAS, CONSTRUCCION, MODIFICA_MUNDO, PARTICLES } from "./config.js";
import { ponerElytra, quitarElytra, sostener } from "./equipo.js";
import { estados } from "./estado.js";
import { nivelHab, practicar } from "./habilidades.js";
import { estallidoDeViento, iniciarDuo } from "./habilidades/vuelo.js";
import { velocidad } from "./movimiento.js";
import { nivel } from "./iq.js";
import { alturaSuelo, animate, blockAt, burst, colocar, flat, impulse, mirarA, now, sound } from "./util.js";

export function armaActual(state) {
  return (ARMAS[state.arma] ?? ARMAS[0]).id;
}

export function bloquePropio(state) {
  return state.pers?.bloque ?? CONSTRUCCION.bloque;
}

function volverAlArma(npc, state) {
  if (npc.isValid) sostener(npc, armaActual(state));
}

export function golpear(npc, jugador, dano, empuje, alto) {
  try {
    const s = estados.get(npc.id);
    if (s) s.ultimoGolpe = now(); // la táctica ya tiene su propia animación
    const dir = flat(npc.location, jugador.location);
    jugador.applyDamage(dano, { cause: EntityDamageCause.entityAttack, damagingEntity: npc });
    jugador.applyKnockback({ x: dir.x * empuje, z: dir.z * empuje }, alto);
    return true;
  } catch {
    return false;
  }
}

function dispararFlecha(npc, desde, dir, rapidez, fuego) {
  try {
    const flecha = npc.dimension.spawnEntity("minecraft:arrow", { x: desde.x + dir.x * 0.8, y: desde.y, z: desde.z + dir.z * 0.8 });
    const proj = flecha.getComponent("minecraft:projectile");
    if (proj) {
      proj.owner = npc;
      proj.shoot({ x: dir.x * rapidez, y: dir.y * rapidez, z: dir.z * rapidez });
    }
    if (fuego) flecha.setOnFire(8, false);
    return true;
  } catch {
    return false;
  }
}

// Lluvia de flechas (Arco nivel 5): ocho flechas caen del cielo sobre el jugador.
function lluvia(npc, jugador) {
  const c = { ...jugador.location };
  for (let k = 0; k < 8; k++) {
    system.runTimeout(() => {
      if (!npc.isValid) return;
      const p = { x: c.x + (Math.random() - 0.5) * 5, y: c.y + 14, z: c.z + (Math.random() - 0.5) * 5 };
      dispararFlecha(npc, p, { x: 0, y: -1, z: 0 }, 1.6, false);
    }, 14 + k * 2);
  }
  sound(npc, "random.bow", 0.5, 1);
}

// Arco: tensa con animación y dispara apuntando adonde estará el jugador.
// Con más IQ predice mejor el movimiento y compensa la caída de la flecha.
// Habilidad Arco: 1 puntería · 2 flechas de fuego · 3 tres flechas · 4 tiro perfecto
// · 5 lluvia de flechas. Con Cálculo 2 predice tu movimiento a la perfección.
export function arco(npc, state, jugador) {
  const nv = nivelHab(npc, state, "arco");
  const opciones = ["normal"];
  if (nv >= 3) opciones.push("tres");
  if (nv >= 4) opciones.push("perfecto");
  if (nv >= 5) opciones.push("lluvia");
  const especial = opciones[Math.floor(Math.random() * opciones.length)];
  const prediccion = nivelHab(npc, state, "calculo") >= 2;
  state.ocupadoHasta = now() + 34;
  sostener(npc, "minecraft:bow");
  mirarA(npc, jugador.getHeadLocation());
  animate(npc, ANIM.arco);
  sound(npc, "random.bow", 0.6);
  // Como un jugador: al tensar el arco camina despacio y no te quita la vista de encima.
  velocidad(npc, 0.07);
  for (const t of [6, 12, 18]) system.runTimeout(() => npc.isValid && jugador.isValid && mirarA(npc, jugador.getHeadLocation()), t);
  system.runTimeout(() => {
    if (!npc.isValid || !jugador.isValid) return;
    const n = nivel(state);
    const head = npc.getHeadLocation();
    const objetivo = jugador.location;
    const h = Math.hypot(objetivo.x - head.x, objetivo.z - head.z);
    const rapidez = especial === "perfecto" ? 3.3 : 2.6;
    const tiempo = h / rapidez;
    const v = jugador.getVelocity();
    const lead = prediccion ? 1 : 0.3 + n * 0.7;
    const px = objetivo.x + v.x * tiempo * lead;
    const pz = objetivo.z + v.z * tiempo * lead;
    const py = objetivo.y + 1.1 + 0.5 * 0.05 * tiempo * tiempo;
    let error = (1 - n) * 0.12 * (nv >= 1 ? 0.4 : 1);
    if (especial === "perfecto") error = 0;
    const dx = px - head.x + (Math.random() - 0.5) * error * h;
    const dy = py - head.y;
    const dz = pz - head.z + (Math.random() - 0.5) * error * h;
    const len = Math.hypot(dx, dy, dz) || 1;
    const fuego = nv >= 2 && Math.random() < 0.6;
    const dir = { x: dx / len, y: dy / len, z: dz / len };
    dispararFlecha(npc, head, dir, rapidez, fuego);
    if (especial === "tres") {
      for (const a of [-0.12, 0.12]) {
        const c = Math.cos(a);
        const s = Math.sin(a);
        dispararFlecha(npc, head, { x: dir.x * c - dir.z * s, y: dir.y, z: dir.x * s + dir.z * c }, rapidez, fuego);
      }
    }
    if (especial === "lluvia") lluvia(npc, jugador);
    sound(npc, "random.bow", 1.1);
    practicar(npc, state, "arco", 0.04);
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
    const nv = nivelHab(npc, state, "perlas");
    const lado = nivel(state) > 0.4 || nv >= 2 ? -1 : 1; // con IQ alto (o Perlas 2) aparece detrás del jugador
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
    // Perlas 4: perla y golpe, en cuanto aparece.
    if (nv >= 4) {
      system.runTimeout(() => {
        if (!npc.isValid || !jugador.isValid) return;
        animate(npc, ANIM.espadazo);
        golpear(npc, jugador, 6, 0.8, 0.35);
      }, 4);
    }
    // Perlas 3: doble perla, otra vez al lado contrario para confundirte.
    if (nv >= 3 && Math.random() < 0.6) {
      system.runTimeout(() => {
        if (!npc.isValid || !jugador.isValid) return;
        const d2 = flat(jugador.location, npc.location);
        burst(npc, PARTICLES.teletransporte);
        try {
          npc.teleport({ x: jugador.location.x - d2.z * 2.5, y: jugador.location.y, z: jugador.location.z + d2.x * 2.5 },
            { facingLocation: jugador.location, checkForBlocks: true });
          burst(npc, PARTICLES.teletransporte);
          sound(npc, "mob.endermen.portal", 1.3);
        } catch {
          // Sin sitio.
        }
      }, 16);
    }
    practicar(npc, state, "perlas", 0.05);
  }, 18);
}

// Lanza una perla y aparece en "destino" (para llegar a tiempo a clase o a la fusión).
export function perlaHasta(npc, destino) {
  sostener(npc, "minecraft:ender_pearl");
  animate(npc, ANIM.lanzar);
  burst(npc, PARTICLES.teletransporte);
  try {
    npc.teleport({ x: destino.x, y: destino.y, z: destino.z }, { checkForBlocks: false });
  } catch {
    return;
  }
  burst(npc, PARTICLES.teletransporte);
  sound(npc, "mob.endermen.portal", 1.2, 0.7);
}

function impactoMaza(npc, state, caida) {
  burst(npc, PARTICLES.onda, { x: 0, y: 0.1, z: 0 });
  sound(npc, "mace.heavy_smash_ground", 1);
  const dano = Math.min(40, (6 + caida * 1.6) * (state.duo ? 1.5 : 1));
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

// Elytra + maza: despega con un cohete, planea hacia el jugador y cae en picada
// con la maza. El daño depende de la altura de la caída, como la maza real.
// Habilidad Vuelo: 1 elytra y maza · 2 dúo de viento (un compañero lo impulsa con
// cargas de viento; también lo hace cualquier Claude con IQ 150+) · 3 impulso de
// viento propio al despegar · 4 doble picada.
export function elytraMartillo(npc, state, jugador) {
  const nv = nivelHab(npc, state, "vuelo");
  state.ocupadoHasta = now() + 300;
  state.sinCaidaHasta = now() + 360;
  state.volando = true;
  state.duo = undefined;
  ponerElytra(npc);
  sostener(npc, "minecraft:firework_rocket");
  sound(npc, "firework.launch", 1);
  burst(npc, PARTICLES.cohete, { x: 0, y: 0.3, z: 0 });
  impulse(npc, { x: 0, y: 1.25, z: 0 });
  iniciarDuo(npc, state, jugador);
  if (nv >= 3) system.runTimeout(() => npc.isValid && estallidoDeViento(npc, undefined, 0.8), 10);
  let fase = "subir";
  let t = 0;
  let alturaPicada = 0;
  let picadas = 0;
  const fin = () => {
    system.clearRun(id);
    state.volando = false;
    state.duo = undefined;
    if (!npc.isValid) return;
    quitarElytra(npc, state);
    state.ocupadoHasta = now() + 10;
    volverAlArma(npc, state);
    practicar(npc, state, "vuelo", 0.05);
  };
  const id = system.runInterval(() => {
    if (!npc.isValid || !jugador.isValid || ++t > 260) return fin();
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
      picadas++;
      // Vuelo 4: doble picada. Vuelve a despegar y cae otra vez.
      if (nv >= 4 && picadas < 2) {
        fase = "subir";
        t = 0;
        sostener(npc, "minecraft:firework_rocket");
        sound(npc, "firework.launch", 1.1);
        burst(npc, PARTICLES.cohete, { x: 0, y: 0.3, z: 0 });
        impulse(npc, { x: 0, y: 1.2, z: 0 });
        state.sinCaidaHasta = now() + 300;
        return;
      }
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
// Clutch: mientras cae, coloca un bloque bajo sus pies apoyado en un bloque vecino,
// como un jugador experto. Es también su forma de hacer puentes desde el aire.
function clutch(npc, state) {
  const bajo = { x: Math.floor(npc.location.x), y: Math.floor(npc.location.y) - 1, z: Math.floor(npc.location.z) };
  const b = blockAt(npc.dimension, bajo);
  if (!b?.isAir) return false;
  const vecinos = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]];
  const apoyo = vecinos.some(([dx, dy, dz]) => {
    const n = blockAt(npc.dimension, { x: bajo.x + dx, y: bajo.y + dy, z: bajo.z + dz });
    return n && !n.isAir && !n.isLiquid;
  });
  if (!apoyo) return false;
  const bloque = bloquePropio(state);
  sostener(npc, bloque);
  animate(npc, ANIM.colocarAbajo);
  if (!colocar(npc.dimension, bajo, bloque)) return false;
  state.sinCaidaHasta = now() + 20;
  sound(npc, "use.stone", 1.2);
  return true;
}

export function vigilarCaida(npc, state) {
  if (state.aguaActiva || npc.isOnGround || state.bote) return;
  const v = npc.getVelocity();
  if (v.y > -0.3) return;
  const h = alturaSuelo(npc);
  if (MODIFICA_MUNDO && h >= 2.5 && h < 12 && (state.iq >= 110 || nivelHab(npc, state, "agua") >= 1) && clutch(npc, state)) return;
  if (v.y > -0.45 || h < 5) return;
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
