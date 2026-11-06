import { EntityDamageCause, ItemStack, Player, system, TimeOfDay, WeatherType, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, ESPEJISMO, GOLDEN, GOLDEN_CFG, MODIFICA_MUNDO, PARTICLES, PROP } from "../config.js";
import { animate, blockAt, burst, distancia, now, particleAt, piso, rand, sortear, sound, soundAt } from "../util.js";
import { danar, empujar, estallido, goldens, historial, objetivos } from "./comun.js";
import { PODERES } from "./poderes/index.js";
import { cerebroFinal, despuesDelGolpe, finalInterrumpido, golpeFatal, intocable, reanudarFinal, revisarUmbral } from "./final/index.js";
import { alSensor, etiqueta, EVENTO, TAG } from "../dano.js";
import { limitar } from "./final/arena.js";

// Claude Golden: nace de la fusión de cinco Claudes con IQ 1000 y es un jefe HOSTIL.
// Vuela en órbita a tu alrededor, se lanza a golpearte con la palma dorada, te devuelve
// las flechas y usa poderes creativos (cada uno en golden/poderes). Con la mitad de
// vida entra en fase 2: piensa al 200%, usa poderes más seguido y su ojo derecho brilla
// todavía más. Con menos de 100 de vida empieza su fase final (golden/final): cinemática
// del corazón dorado, arena dorada, 1000 de vida con barra de jefe y poderes nuevos.

const LUZ = "minecraft:light_block_15";


// --- Nombre: sin etiqueta sobre la cabeza. El nombre de su barra de jefe ("Claude Golden")
// está en su entidad (minecraft:boss) y con él la interfaz del paquete dibuja su barra dorada.

// --- Registro y luz ------------------------------------------------------------------

// "espera": ticks de calma al nacer (para que termine la cinemática de la fusión).
export function registrarGolden(entidad, espera = 0) {
  if (goldens.has(entidad.id)) return;
  goldens.set(entidad.id, {
    entidad, frame: 0, angulo: Math.random() * 360, ancla: { ...entidad.location },
    cd: { poder: now() + espera + 100, embestida: now() + espera + 160 }, calmaHasta: now() + espera,
    luz: undefined, fase: 1, ocupadoHasta: 0, quietoHasta: 0, aturdidoHasta: 0, ultimo: undefined, presentado: false,
  });
  try {
    entidad.nameTag = "";
    entidad.setProperty(PROP.furia, false);
  } catch {
    // Paquete antiguo.
  }
  // Si el mundo se cerró en plena batalla final, sigue en la batalla.
  reanudarFinal(goldens.get(entidad.id));
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

function quitarEspejismos(g, efecto = true) {
  for (const m of g.espejismos ?? []) {
    try {
      if (!m.isValid) continue;
      if (efecto) estallido(m.dimension, { x: m.location.x, y: m.location.y + 1, z: m.location.z });
      m.remove();
    } catch {
      // Ya no existe.
    }
  }
  g.espejismos = undefined;
}

function vida(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return { actual: h?.currentValue ?? 0, max: h?.effectiveMax ?? 300 };
  } catch {
    return { actual: 0, max: 300 };
  }
}

// --- Presentación, fase 2, golpe dorado y poderes -------------------------------------

function presentarse(g, jugador) {
  g.presentado = true;
  const e = g.entidad;
  animate(e, ANIM.goldenChasquido);
  system.runTimeout(() => {
    if (!e.isValid) return;
    if (e.dimension.id === "minecraft:overworld") {
      world.setTimeOfDay(TimeOfDay.Night);
      e.dimension.setWeather(WeatherType.Clear);
    }
    burst(e, PARTICLES.fusionDestello, { x: 0, y: 1.5, z: 0 });
    sound(e, "ambient.weather.thunder", 1.4, 0.6);
  }, 8);
  g.cd.poder = now() + 60;
}

function faseDos(g) {
  g.fase = 2;
  const e = g.entidad;
  try {
    e.setProperty(PROP.furia, true);
  } catch {
    // Paquete antiguo.
  }
  animate(e, ANIM.goldenPoder);
  particleAt(e.dimension, PARTICLES.fusionDestello, { x: e.location.x, y: e.location.y + 1.5, z: e.location.z });
  particleAt(e.dimension, PARTICLES.fusionAnillo, e.location);
  sound(e, "mob.wither.spawn", 1.4, 0.6);
}

function golpeDorado(g, jugador) {
  const e = g.entidad;
  g.cd.golpe = now() + GOLDEN_CFG.golpe.cada;
  animate(e, ANIM.goldenGolpe);
  system.runTimeout(() => {
    if (!e.isValid || !jugador.isValid || distancia(e.location, jugador.location) > GOLDEN_CFG.golpe.alcance + 0.8) return;
    danar(jugador, GOLDEN_CFG.golpe.dano[g.fase - 1], e, EntityDamageCause.entityAttack);
    empujar(jugador, e.location, 1.0, 0.4);
    estallido(e.dimension, { x: jugador.location.x, y: jugador.location.y + 1, z: jugador.location.z });
    sound(jugador, "random.orb", 0.6, 1);
    sound(jugador, "random.explode", 2, 0.3);
  }, 6);
}

function contexto(g, jugador) {
  const e = g.entidad;
  let cielo = true;
  let expuesto = true;
  try {
    cielo = !e.dimension.getBlockFromRay(e.getHeadLocation(), { x: 0, y: 1, z: 0 }, { maxDistance: 10 });
    expuesto = !jugador.dimension.getBlockFromRay(jugador.getHeadLocation(), { x: 0, y: 1, z: 0 }, { maxDistance: 24 });
  } catch {
    // Sin rayos.
  }
  return {
    dist: distancia(e.location, jugador.location), fase: g.fase, mundo: MODIFICA_MUNDO, cielo, expuesto,
    jugador, jugadorEnSuelo: jugador.isOnGround, espejismos: !!g.espejismos?.length, preguntando: !!g.preguntando,
  };
}

function usarPoder(g, jugador) {
  const c = contexto(g, jugador);
  const lista = [];
  for (const poder of PODERES) {
    if (now() < (g.cd[poder.id] ?? 0) || poder.id === g.ultimo) continue;
    try {
      if (poder.si(c)) lista.push({ p: poder.peso(c), poder });
    } catch {
      // Poder no disponible ahora.
    }
  }
  if (!lista.length) return;
  const { poder } = sortear(lista);
  let duracion = 0;
  try {
    duracion = poder.usar(g, jugador) || 0;
  } catch {
    duracion = 0;
  }
  if (!duracion) {
    g.cd[poder.id] = now() + 100;
    return;
  }
  g.ultimo = poder.id;
  g.cd[poder.id] = now() + Math.round(poder.cd * (g.fase === 2 ? 0.7 : 1));
  g.ocupadoHasta = now() + Math.min(duracion, 80);
  g.cd.poder = now() + duracion + rand(...GOLDEN_CFG.poderCada[g.fase - 1]);
}

// --- Vuelo: órbita alrededor del jugador, embestidas y espejismos ----------------------

function volarHacia(e, objetivo, mirar, maxPaso) {
  const dx = objetivo.x - e.location.x;
  const dy = objetivo.y - e.location.y;
  const dz = objetivo.z - e.location.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  const paso = Math.min(maxPaso, d * 0.12);
  e.teleport({ x: e.location.x + (dx / d) * paso, y: e.location.y + (dy / d) * paso, z: e.location.z + (dz / d) * paso },
    { facingLocation: mirar, keepVelocity: false });
}

system.runInterval(() => {
  for (const [id, g] of goldens) {
    const e = g.entidad;
    if (!e.isValid) {
      limpiarLuz(g);
      quitarEspejismos(g, false);
      goldens.delete(id);
      continue;
    }
    if (g.vueloPropio || g.final?.control) continue; // un poder o una cinemática lo está moviendo
    try {
      const j = g.jugador?.isValid ? g.jugador : undefined;
      const mirar = j ? j.getHeadLocation() : { x: g.ancla.x, y: g.ancla.y + 1, z: g.ancla.z };
      if (now() < g.aturdidoHasta) {
        // Aturdido: baja despacio, tambaleándose.
        e.teleport({ x: e.location.x, y: e.location.y - 0.01, z: e.location.z }, { facingLocation: mirar });
        continue;
      }
      if (now() < g.quietoHasta) {
        e.teleport({ x: e.location.x, y: e.location.y + Math.sin(now() / 6) * 0.01, z: e.location.z }, { facingLocation: mirar });
        continue;
      }
      g.angulo += j ? (g.fase === 2 ? 1.6 : 1.1) : 0.3;
      const a = (g.angulo * Math.PI) / 180;
      const base = j ? j.location : g.ancla;
      let objetivo;
      if (j && now() < (g.embestidaHasta ?? 0)) {
        // Embestida: se pega a ti para golpearte (y ahí puedes devolverle el golpe).
        const dx = e.location.x - j.location.x;
        const dz = e.location.z - j.location.z;
        const d = Math.hypot(dx, dz) || 1;
        objetivo = { x: j.location.x + (dx / d) * 1.5, y: j.location.y + 0.4, z: j.location.z + (dz / d) * 1.5 };
        if (g.final?.arena?.puesta) objetivo = limitar(g.final.arena, objetivo, 1.8); // no sale de su arena cerrada
        volarHacia(e, objetivo, mirar, g.fase === 2 ? 0.55 : 0.45);
      } else {
        const r = j ? (g.fase === 2 ? 4.5 : 5.5) + Math.sin(now() / 40) * 1.2 : 2;
        objetivo = { x: base.x + Math.cos(a) * r, y: base.y + (j ? 2 : 1.4) + Math.sin(now() / 18) * 0.5, z: base.z + Math.sin(a) * r };
        if (g.final?.arena?.puesta) objetivo = limitar(g.final.arena, objetivo, 2.5); // no sale de su arena cerrada
        volarHacia(e, objetivo, mirar, g.fase === 2 ? 0.34 : 0.26);
      }
      // Espejismos: vuelan en la misma órbita, a 120° y 240°, y copian su nombre.
      if (g.espejismos?.length) {
        g.espejismos.forEach((m, i) => {
          if (!m.isValid) return;
          const am = a + ((i + 1) * Math.PI * 2) / 3;
          const r = j ? 5 : 2;
          volarEspejismo(m, { x: base.x + Math.cos(am) * r, y: base.y + 2 + Math.sin(now() / 18 + i) * 0.5, z: base.z + Math.sin(am) * r }, mirar);
        });
      }
    } catch {
      // Descargado.
    }
  }
}, 1);

function volarEspejismo(m, objetivo, mirar) {
  try {
    volarHacia(m, objetivo, mirar, 0.3);
  } catch {
    // Ya no existe.
  }
}

// Cambia de lugar con un espejismo en un destello (para confundirte).
function barajar(g) {
  const vivos = (g.espejismos ?? []).filter((m) => m.isValid);
  if (!vivos.length) return;
  const m = vivos[rand(0, vivos.length - 1)];
  const a = { ...g.entidad.location };
  const b = { ...m.location };
  try {
    g.entidad.teleport(b);
    m.teleport(a);
  } catch {
    return;
  }
  estallido(g.entidad.dimension, { x: a.x, y: a.y + 1, z: a.z });
  estallido(g.entidad.dimension, { x: b.x, y: b.y + 1, z: b.z });
  g.angulo += 120;
  sound(g.entidad, "mob.endermen.portal", 1.6, 0.6);
}

// --- Cerebro: nombre, aura, luz, objetivo, poderes, golpes ------------------------------

system.runInterval(() => {
  for (const g of goldens.values()) {
    const e = g.entidad;
    if (!e.isValid) continue;
    try {
      g.frame++;
      if (g.frame % 2 === 0) burst(e, PARTICLES.auraDorada, { x: 0, y: 1, z: 0 });
      if (g.frame % 3 === 0) {
        moverLuz(g);
        const [j] = objetivos(e.dimension, e.location, GOLDEN_CFG.vista).sort((x, y) => distancia(x.location, e.location) - distancia(y.location, e.location));
        g.jugador = j;
      }
      const j = g.jugador;
      // Espejismos: duran unos segundos y de vez en cuando cambia de lugar con uno.
      if (g.espejismos) {
        if (now() > (g.espejismosHasta ?? 0) || !g.espejismos.some((m) => m.isValid)) quitarEspejismos(g);
        else if (g.frame % 12 === 0) barajar(g);
      }
      if (!j?.isValid || now() < g.calmaHasta) continue;
      if (!g.presentado) presentarse(g, j);
      if (g.final) {
        // Fase final: golpe dorado, embestidas y los poderes nuevos (golden/final).
        if (g.final.etapa !== "pelea" || g.final.curando || now() < g.aturdidoHasta || g.vueloPropio) continue;
        const dist = distancia(e.location, j.location);
        if (dist < GOLDEN_CFG.golpe.alcance && now() >= (g.cd.golpe ?? 0)) golpeDorado(g, j);
        if (now() >= g.cd.embestida && now() >= g.ocupadoHasta && dist < 14) {
          g.embestidaHasta = now() + 45;
          g.cd.embestida = now() + rand(70, 110);
          animate(e, ANIM.goldenPicada);
        }
        if (now() >= (g.embestidaHasta ?? 0)) cerebroFinal(g, j);
        continue;
      }
      if (revisarUmbral(g, j, (x) => quitarEspejismos(x))) continue;
      const { actual, max } = vida(e);
      if (g.fase === 1 && actual <= max / 2) faseDos(g);

      if (now() < g.aturdidoHasta || g.preguntando) continue;
      // Golpe dorado si estás cerca; embestidas cada tanto para buscar el cuerpo a cuerpo.
      const dist = distancia(e.location, j.location);
      if (dist < GOLDEN_CFG.golpe.alcance && now() >= (g.cd.golpe ?? 0)) golpeDorado(g, j);
      if (now() >= g.cd.embestida && now() >= g.ocupadoHasta && dist < 14) {
        g.embestidaHasta = now() + 50;
        g.cd.embestida = now() + (g.fase === 2 ? rand(80, 120) : rand(120, 180));
        animate(e, ANIM.goldenPicada);
      }
      if (now() >= g.cd.poder && now() >= g.ocupadoHasta && now() >= (g.embestidaHasta ?? 0)) usarPoder(g, j);
    } catch {
      // Descargado.
    }
  }
}, 4);

// Historial de posiciones de los jugadores (para Ctrl + Z).
system.runInterval(() => {
  if (!goldens.size) return;
  for (const p of world.getAllPlayers()) {
    let h = historial.get(p.id);
    if (!h) historial.set(p.id, (h = []));
    h.unshift({ t: now(), loc: { ...p.location }, dim: p.dimension.id });
    if (h.length > 16) h.length = 16;
  }
}, 10);

// Recupera los Claude Golden al recargar el mundo (y borra espejismos huérfanos).
system.runInterval(() => {
  for (const id of DIMENSIONES) {
    try {
      const dim = world.getDimension(id);
      for (const e of dim.getEntities({ type: GOLDEN })) registrarGolden(e);
      for (const m of dim.getEntities({ type: ESPEJISMO })) {
        const dueno = [...goldens.values()].some((g) => g.espejismos?.includes(m) || g.final?.ilusiones?.includes(m));
        if (!dueno) m.remove();
      }
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 100);

// --- Golpes y flechas --------------------------------------------------------------------

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
  const atacante = damageSource.damagingEntity;
  if (hurtEntity.typeId === ESPEJISMO && atacante instanceof Player) {
    // Era un espejismo: se deshace y te deja ciego un momento.
    try {
      estallido(hurtEntity.dimension, { x: hurtEntity.location.x, y: hurtEntity.location.y + 1, z: hurtEntity.location.z });
      soundAt(hurtEntity.dimension, hurtEntity.location, "random.pop", 0.8, 1);
      atacante.addEffect("blindness", 30, { amplifier: 0, showParticles: false });
      hurtEntity.remove();
    } catch {
      // Ya no existe.
    }
    return;
  }
  if (hurtEntity.typeId !== GOLDEN) return;
  const g = goldens.get(hurtEntity.id);
  if (!g) return;
  if (g.espejismos?.length && atacante instanceof Player) quitarEspejismos(g);
  // Aturdido recibe el doble; después, la fase final decide (con menos de 100 empieza, con
  // 200 el parkour...).
  despuesDelGolpe(g, now() < g.aturdidoHasta ? damage : 0, atacante, (x) => quitarEspejismos(x));
});

// Intocable en cinemáticas y curándose; devuelve la mayoría de las flechas (el sensor de
// claude_golden.entity.json lee estas etiquetas, que se sortean cada tick).
system.runInterval(() => {
  for (const g of goldens.values()) {
    const e = g.entidad;
    if (!e?.isValid) continue;
    etiqueta(e, TAG.intocable, intocable(g));
    etiqueta(e, TAG.refleja, Math.random() <= GOLDEN_CFG.reflejo[(g.fase ?? 1) - 1]);
  }
}, 1);

// Un golpe que lo mataría: nunca muere de un golpe (empieza la fase final, el parkour o su muerte).
alSensor(EVENTO.fatal, [GOLDEN], (e, golpe) => {
  const g = goldens.get(e.id);
  if (g) golpeFatal(g, golpe?.quien, (x) => quitarEspejismos(x));
});

// Flecha devuelta (dorada, hacia quien la tiró).
alSensor(EVENTO.refleja, [GOLDEN], (e, golpe) => {
  burst(e, PARTICLES.midas, { x: 0, y: 1, z: 0 });
  sound(e, "item.shield.block", 1.4);
  const tirador = golpe?.quien;
  if (!tirador?.isValid) return;
  try {
    const o = e.getHeadLocation();
    const t = tirador.getHeadLocation();
    const dx = t.x - o.x;
    const dy = t.y - o.y;
    const dz = t.z - o.z;
    const l = Math.hypot(dx, dy, dz) || 1;
    const flecha = e.dimension.spawnEntity("minecraft:arrow", { x: o.x + (dx / l) * 0.9, y: o.y, z: o.z + (dz / l) * 0.9 });
    const proj = flecha.getComponent("minecraft:projectile");
    if (proj) {
      proj.owner = e;
      proj.shoot({ x: (dx / l) * 2.4, y: (dy / l) * 2.4 + 0.08, z: (dz / l) * 2.4 });
    }
  } catch {
    // Sin flecha de vuelta.
  }
});


world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId !== GOLDEN) return;
  const g = goldens.get(deadEntity.id);
  if (g) {
    limpiarLuz(g);
    quitarEspejismos(g);
    finalInterrumpido(g);
  }
  goldens.delete(deadEntity.id);
  try {
    const loc = deadEntity.location;
    const regalos = [{ item: "minecraft:nether_star", n: 1 }, { item: "minecraft:golden_apple", n: 5 },
      { item: "minecraft:enchanted_golden_apple", n: 1 }, { item: "minecraft:experience_bottle", n: 24 }];
    for (const { item, n } of regalos) deadEntity.dimension.spawnItem(new ItemStack(item, n), loc);
    particleAt(deadEntity.dimension, PARTICLES.fusionDestello, { x: loc.x, y: loc.y + 1, z: loc.z });
    particleAt(deadEntity.dimension, PARTICLES.confeti, { x: loc.x, y: loc.y + 1, z: loc.z });
    for (const p of deadEntity.dimension.getPlayers({ location: loc, maxDistance: 48 })) {
      p.onScreenDisplay.setTitle("§6§l¡VICTORIA!", { subtitle: "§eClaude Golden se disuelve en luz... y te deja regalos", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
    }
  } catch {
    // Sin regalos.
  }
});

// Por si se usa /summon: registrar al aparecer.
world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  if (entity.typeId === GOLDEN) system.run(() => entity.isValid && registrarGolden(entity));
});

