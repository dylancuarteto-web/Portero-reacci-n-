import { EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { FINAL, GOLDEN, GOLDEN_FINAL, ITEM_OJOS, PARTICLES, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { estallido } from "../../comun.js";
import { limitar } from "../arena.js";
import { ejes, pose, punto } from "../comun.js";

// Marionetas (v8.2): Golden alza el brazo y de sus dedos salen CUERDAS AMARILLAS de verdad
// (entidades con forma de cuerda, no luces) que se atan al corazón de cada mob. Los ojos
// amarillos y el corazón enredado son un "casco" (claudenpc:ojos_marioneta) que el juego pega
// a la cabeza y al pecho del mob: se mueven con él sin retraso ni parpadeo aunque corra o salte.
// Solo atacan al jugador: entre marionetas no se hacen daño (una flecha de un esqueleto a un
// zombi no cuenta), así no se pelean entre ellas. Siempre sale un ALDEANO marioneta: se ve como
// un aldeano, pero ataca (los aldeanos normales no saben atacar). Duran 2 minutos o hasta que
// mueren (se deshacen en polvo dorado, sin soltar nada).

const TAG = "claudenpc_marioneta";
// Mobs que dibujan cascos (así se les ven los ojos y el corazón). pecho: altura del corazón;
// frente: cuánto delante del centro del cuerpo; izq: hacia su izquierda (en bloques).
const HUMANO = { pecho: 19.6 / 16, frente: 4.3 / 16, izq: 1.3 / 16 };
const TIPOS = [
  { id: "minecraft:zombie", ...HUMANO },
  { id: "minecraft:husk", ...HUMANO },
  { id: "minecraft:drowned", ...HUMANO },
  { id: "minecraft:zombie_villager_v2", ...HUMANO },
  { id: "minecraft:skeleton", ...HUMANO },
  { id: "minecraft:stray", ...HUMANO },
  { id: "minecraft:bogged", ...HUMANO },
];
// El aldeano marioneta se dibuja al 93,75 % (como los aldeanos).
const ALDEANO = { id: FINAL.aldeano, propio: true, pecho: (19.6 / 16) * 0.9375, frente: (4.3 / 16) * 0.9375, izq: (1.3 / 16) * 0.9375 };
// Largo de las cuerdas: animaciones de 0,25 bloques (hasta 48).
const PASO = 0.25;
const LARGOS = 192;
// El juego dibuja a un mob que camina unos 2 ticks atrasado: la cuerda apunta ahí.
const ATRASO = 2;

function mezclar(lista) {
  return lista.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
}

function crearMob(dim, tipo, lugar) {
  for (let intento = 0; intento < 3; intento++) {
    try {
      const m = dim.spawnEntity(tipo.id, lugar);
      if (!tipo.propio && m.getComponent("minecraft:is_baby")) {
        m.remove(); // los bebés tienen la cabeza de otro tamaño: los ojos no calzarían
        continue;
      }
      return m;
    } catch {
      // Lugar no válido: otro intento.
    }
  }
  return undefined;
}

// El casco con los ojos y el corazón.
function ponerOjos(m) {
  try {
    const eq = m.getComponent("minecraft:equippable");
    if (eq) {
      eq.setEquipment(EquipmentSlot.Head, new ItemStack(ITEM_OJOS, 1));
      return true;
    }
  } catch {
    // Este mob no se deja equipar por script: con el comando.
  }
  try {
    m.runCommand(`replaceitem entity @s slot.armor.head 0 ${ITEM_OJOS}`);
    return true;
  } catch {
    return false;
  }
}

export default {
  id: "marionetas",
  cd: 1500,
  si: (c) => c.marionetas === 0,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    f.marionetas = f.marionetas ?? [];
    g.quietoHasta = now() + 56;
    pose(g, 10);
    soundAt(dim, e.location, "beacon.power", 0.8, 1.2);
    const elegidos = [ALDEANO, ...mezclar(TIPOS).slice(0, Math.max(0, GOLDEN_FINAL.marionetas.cantidad - 1))];
    elegidos.forEach((tipo, k) => {
      system.runTimeout(() => {
        if (!e.isValid || !j.isValid || f.etapa !== "pelea") return;
        const a = (k / elegidos.length) * Math.PI * 2 + Math.random() * 0.5;
        const r = 4.5 + Math.random() * 2.5;
        const lugar = limitar(f.arena, { x: j.location.x + Math.cos(a) * r, y: j.location.y + 0.1, z: j.location.z + Math.sin(a) * r }, 3);
        const m = crearMob(dim, tipo, lugar);
        if (!m) return;
        try {
          m.addTag(TAG);
          for (const [ef, amp] of [["strength", 0], ["speed", 0], ["resistance", 0], ["fire_resistance", 0]]) {
            m.addEffect(ef, GOLDEN_FINAL.marionetas.duran, { amplifier: amp, showParticles: false });
          }
        } catch {
          // Sin efectos.
        }
        ponerOjos(m);
        let cuerda;
        try {
          cuerda = dim.spawnEntity(FINAL.cuerda, manoDe(g, k));
        } catch {
          // Sin cuerda.
        }
        f.marionetas.push({ m, cuerda, tipo, hasta: now() + GOLDEN_FINAL.marionetas.duran, k, historia: [], largo: 0 });
        particleAt(dim, PARTICLES.fusionDestello, { x: lugar.x, y: lugar.y + 1, z: lugar.z });
        particleAt(dim, PARTICLES.curacion, lugar);
        soundAt(dim, lugar, "mob.evocation_illager.prepare_summon", 1.2, 0.8);
        soundAt(dim, lugar, SONIDO.latido, 1.4, 0.6);
      }, 10 + k * 5);
    });
    system.runTimeout(() => e.isValid && pose(g, 0), 56);
    return 58;
  },
};

function quitar(ent) {
  try {
    if (ent?.isValid) ent.remove();
  } catch {
    // Ya no existe.
  }
}

function deshacer(x, efecto = true) {
  try {
    if (efecto && x.m.isValid) {
      const p = { x: x.m.location.x, y: x.m.location.y + 1, z: x.m.location.z };
      estallido(x.m.dimension, p);
      particleAt(x.m.dimension, PARTICLES.fragmento, p);
      soundAt(x.m.dimension, p, "random.fizz", 1.2, 0.8);
    }
  } catch {
    // Ya no existe.
  }
  quitar(x.m);
  quitar(x.cuerda);
}

export function quitarMarionetas(g, efecto = true) {
  for (const x of g.final?.marionetas ?? []) deshacer(x, efecto);
  if (g.final) g.final.marionetas = [];
}

// La punta de los dedos de Golden (un poco separada para cada cuerda).
function manoDe(g, k = 0) {
  const e = g.entidad;
  const yaw = e.getRotation().y;
  const { adelante, derecha } = ejes(yaw);
  const base = g.pose === 10 ? punto(e.location, yaw, 0.42, 2.35, 0.15)
    : { x: e.location.x + adelante.x * 0.4 + derecha.x * 0.4, y: e.location.y + 1.0, z: e.location.z + adelante.z * 0.4 + derecha.z * 0.4 };
  return { x: base.x + derecha.x * (k - 2.5) * 0.04, y: base.y + (k % 3) * 0.03, z: base.z + derecha.z * (k - 2.5) * 0.04 };
}

// Dónde está el corazón del mob (con su posición y su mirada en ese tick).
function corazonDe(t, estado) {
  const { pos, mira } = estado;
  const lh = Math.hypot(mira.x, mira.z) || 1;
  const fx = mira.x / lh;
  const fz = mira.z / lh;
  // Su izquierda es (fz, -fx).
  return { x: pos.x + fx * t.frente + fz * t.izq, y: pos.y + t.pecho, z: pos.z + fz * t.frente - fx * t.izq };
}

// Estira la cuerda de "a" (los dedos de Golden) a "b" (el corazón): la entidad queda en "a",
// mirando a "b" (el modelo apunta como una cabeza) y con el largo de la animación más cercana.
export function atar(x, a, b) {
  const c = x.cuerda;
  if (!c?.isValid) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const horiz = Math.hypot(dx, dz);
  const largo = Math.hypot(horiz, dy);
  const yaw = (Math.atan2(-dx, dz) * 180) / Math.PI;
  const pitch = (-Math.atan2(dy, horiz) * 180) / Math.PI; // positivo: hacia abajo
  c.teleport(a, { rotation: { x: pitch, y: yaw }, keepVelocity: false });
  const n = Math.max(1, Math.min(LARGOS, Math.round(largo / PASO)));
  if (n !== x.largo) {
    x.largo = n;
    try {
      c.playAnimation(`animation.claudenpc.cuerda.largo_${n}`, { controller: "claudenpc_cuerda_largo", blendOutTime: 0 });
    } catch {
      // Sin animación.
    }
  }
}

// Cada tick: las cuerdas van de los dedos de Golden al corazón de cada marioneta. Se cortan a
// los 2 minutos o cuando la marioneta muere.
export function tickMarionetas(g, _jugadores) {
  const f = g.final;
  if (!f.marionetas?.length) return;
  f.marionetas = f.marionetas.filter((x) => {
    if (!x.m.isValid || now() > x.hasta) {
      deshacer(x, x.m.isValid);
      return false;
    }
    try {
      const ahora = { pos: { ...x.m.location }, mira: x.m.getViewDirection() };
      x.historia = [ahora, ...(x.historia ?? [])].slice(0, ATRASO + 1);
      const visto = x.historia[Math.min(ATRASO, x.historia.length - 1)];
      atar(x, manoDe(g, x.k), corazonDe(x.tipo, visto));
    } catch {
      // Mob no disponible.
    }
    return true;
  });
}

function esMarioneta(ent) {
  try {
    return !!ent?.isValid && ent.hasTag(TAG);
  } catch {
    return false;
  }
}

world.beforeEvents.entityHurt.subscribe((ev) => {
  const m = ev.hurtEntity;
  try {
    // Entre marionetas (y contra Golden) no hay daño: así no se pelean ni se vengan entre
    // ellas, y solo van por el jugador.
    const atacante = ev.damageSource.damagingEntity;
    if (esMarioneta(atacante) && (esMarioneta(m) || m.typeId === GOLDEN)) {
      ev.cancel = true;
      return;
    }
    if (!m.hasTag(TAG)) return;
    // Al morir no sueltan nada: se deshacen en polvo dorado.
    const vida = m.getComponent("minecraft:health")?.currentValue ?? 0;
    if (ev.damage < vida) return;
    ev.cancel = true;
    system.run(() => {
      try {
        if (!m.isValid) return;
        const p = { x: m.location.x, y: m.location.y + 1, z: m.location.z };
        estallido(m.dimension, p);
        particleAt(m.dimension, PARTICLES.fragmento, p);
        soundAt(m.dimension, p, "random.fizz", 1.2, 0.8);
        m.remove();
      } catch {
        // Ya no existe.
      }
    });
  } catch {
    // Sin etiquetas.
  }
});

// Las marionetas no rompen bloques con explosiones.
world.beforeEvents.explosion.subscribe((ev) => {
  try {
    if (ev.source?.hasTag(TAG)) ev.setImpactedBlocks([]);
  } catch {
    // Sin fuente.
  }
});

// Por si el mundo se cerró: marionetas, cuerdas o corazones (de la v8.1) sueltos se deshacen.
export function limpiarMarionetasHuerfanas(dim, vigentes) {
  try {
    for (const m of dim.getEntities({ tags: [TAG] })) if (!vigentes.has(m.id)) m.remove();
    for (const h of dim.getEntities({ type: FINAL.marioneta })) if (!vigentes.has(h.id)) h.remove();
    for (const c of dim.getEntities({ type: FINAL.cuerda })) if (!vigentes.has(c.id)) c.remove();
  } catch {
    // Dimensión sin cargar.
  }
}
