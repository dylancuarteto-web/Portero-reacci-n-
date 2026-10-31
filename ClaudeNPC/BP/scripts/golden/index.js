import { EntityDamageCause, ItemStack, Player, system, TimeOfDay, WeatherType, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, ESPEJISMO, GOLDEN, GOLDEN_CFG, MODIFICA_MUNDO, PARTICLES, PROP } from "../config.js";
import { animate, blockAt, burst, distancia, now, particleAt, piso, rand, sortear, sound, soundAt } from "../util.js";
import { danar, empujar, estallido, goldens, historial, objetivos } from "./comun.js";
import { PODERES } from "./poderes/index.js";

// Claude Golden: nace de la fusión de cinco Claudes con IQ 300 y es un jefe HOSTIL.
// Vuela en órbita a tu alrededor, se lanza a golpearte con la palma dorada, te devuelve
// las flechas y usa poderes creativos (cada uno en golden/poderes). Con la mitad de
// vida entra en fase 2: piensa al 200%, usa poderes más seguido y su ojo derecho brilla
// todavía más. Si lo vences, se disuelve en luz y deja regalos.

const LUZ = "minecraft:light_block_15";
const COLORES = ["§c", "§6", "§e", "§a", "§b", "§9", "§d"];
const LETRAS = ["I", "Q", ":", " ", "?", "?", "?"];

// --- Nombre: "IQ: ???" con letras que rebotan y cambian de color -----------------

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
    entidad.setProperty(PROP.furia, false);
  } catch {
    // Paquete antiguo.
  }
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
    for (const p of objetivos(e.dimension, e.location, 48)) {
      try {
        p.onScreenDisplay.setTitle("§6§lCLAUDE GOLDEN", { subtitle: "§e¡Que empiece la función!", fadeInDuration: 8, stayDuration: 40, fadeOutDuration: 12 });
      } catch {
        // Sin título.
      }
    }
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
  for (const p of objetivos(e.dimension, e.location, 48)) {
    try {
      p.onScreenDisplay.setTitle("§6§l¡IQ AL 200%!", { subtitle: "§eClaude Golden se lo toma en serio", fadeInDuration: 6, stayDuration: 34, fadeOutDuration: 10 });
    } catch {
      // Sin título.
    }
  }
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
    if (g.vueloPropio) continue; // un poder lo está moviendo
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
        volarHacia(e, objetivo, mirar, g.fase === 2 ? 0.55 : 0.45);
      } else {
        const r = j ? (g.fase === 2 ? 4.5 : 5.5) + Math.sin(now() / 40) * 1.2 : 2;
        objetivo = { x: base.x + Math.cos(a) * r, y: base.y + (j ? 2 : 1.4) + Math.sin(now() / 18) * 0.5, z: base.z + Math.sin(a) * r };
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
      const nombre = etiqueta(g.frame);
      e.nameTag = nombre;
      for (const m of g.espejismos ?? []) if (m.isValid) m.nameTag = nombre;
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
      const { actual, max } = vida(e);
      if (g.fase === 1 && actual <= max / 2) faseDos(g);
      if (now() >= (g.anuncioHasta ?? 0) && g.frame % 5 === 0) {
        try {
          j.onScreenDisplay.setActionBar(`§6§lClaude Golden §r§7- §c${Math.ceil(actual)}§7/§c${max}${g.fase === 2 ? " §6§l(IQ 200%)" : ""}`);
        } catch {
          // Sin pantalla.
        }
      }
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
        const dueno = [...goldens.values()].some((g) => g.espejismos?.includes(m));
        if (!dueno) m.remove();
      }
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 100);

// --- Golpes y flechas --------------------------------------------------------------------

world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  const atacante = damageSource.damagingEntity;
  if (hurtEntity.typeId === ESPEJISMO && atacante instanceof Player) {
    // Era un espejismo: se deshace y te deja ciego un momento.
    try {
      estallido(hurtEntity.dimension, { x: hurtEntity.location.x, y: hurtEntity.location.y + 1, z: hurtEntity.location.z });
      soundAt(hurtEntity.dimension, hurtEntity.location, "random.pop", 0.8, 1);
      atacante.addEffect("blindness", 30, { amplifier: 0, showParticles: false });
      atacante.onScreenDisplay.setActionBar("§d¡Ese no era! Era un espejismo");
      hurtEntity.remove();
    } catch {
      // Ya no existe.
    }
    return;
  }
  if (hurtEntity.typeId !== GOLDEN) return;
  const g = goldens.get(hurtEntity.id);
  if (!g) return;
  if (g.espejismos?.length && atacante instanceof Player) {
    quitarEspejismos(g);
    try {
      atacante.onScreenDisplay.setActionBar("§6¡Me encontraste!");
    } catch {
      // Sin pantalla.
    }
  }
});

// Devuelve la mayoría de las flechas (dorada, hacia quien la tiró); aturdido recibe el doble.
world.beforeEvents.entityHurt.subscribe((event) => {
  const g = goldens.get(event.hurtEntity.id);
  if (g && now() < g.aturdidoHasta) event.damage *= 2;
  if (event.damageSource.cause !== EntityDamageCause.projectile) return;
  if (Math.random() > GOLDEN_CFG.reflejo[(g?.fase ?? 1) - 1]) return;
  event.cancel = true;
  const e = event.hurtEntity;
  const tirador = event.damageSource.damagingEntity;
  system.run(() => {
    if (!e.isValid) return;
    burst(e, PARTICLES.midas, { x: 0, y: 1, z: 0 });
    sound(e, "item.shield.block", 1.4);
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
}, { entityFilter: { type: GOLDEN } });

world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (deadEntity.typeId !== GOLDEN) return;
  const g = goldens.get(deadEntity.id);
  if (g) {
    limpiarLuz(g);
    quitarEspejismos(g);
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

