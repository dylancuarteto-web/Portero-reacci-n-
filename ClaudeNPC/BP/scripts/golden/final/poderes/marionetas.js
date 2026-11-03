import { EntityDamageCause, GameMode, system, world } from "@minecraft/server";
import { FINAL, GOLDEN_FINAL, PARTICLES, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { danar, estallido } from "../../comun.js";
import { limitar } from "../arena.js";
import { ejes, particula, pose, punto } from "../comun.js";

// Marionetas: alza el brazo y de sus dedos salen hilos amarillos (3D, ondulantes, como los de
// Error Sans) que se enredan en el corazón blanco 3D de varios mobs (cualquiera menos el
// warden). Les brillan los ojos dorados, son un poco más fuertes y te atacan. Duran 2 minutos
// o hasta que mueren (se deshacen en polvo dorado, sin soltar objetos).
//
// Los ojos y el corazón se ponen en cada tick donde están de verdad (la cabeza del mob y
// hacia dónde mira), así siempre quedan bien puestos aunque el mob gire la cabeza.

const TAG = "claudenpc_marioneta";
// cara: distancia del centro de la cabeza a la cara; sep: mitad de la separación entre los
// ojos; baja: cuánto más abajo están los ojos; pecho: altura del corazón (fracción de la de
// los ojos); cuerpo: medio grosor del pecho (el corazón queda justo delante).
const TIPOS = [
  { id: "minecraft:zombie", cara: 0.27, sep: 0.125, baja: 0.03, pecho: 0.6, cuerpo: 0.14 },
  { id: "minecraft:skeleton", cara: 0.27, sep: 0.125, baja: 0.03, pecho: 0.6, cuerpo: 0.13 },
  { id: "minecraft:creeper", cara: 0.27, sep: 0.125, baja: 0.02, pecho: 0.55, cuerpo: 0.14 },
  { id: "minecraft:enderman", cara: 0.27, sep: 0.14, baja: 0.06, pecho: 0.7, cuerpo: 0.12, enojar: true },
  { id: "minecraft:pillager", cara: 0.27, sep: 0.125, baja: 0.09, pecho: 0.6, cuerpo: 0.2 },
  { id: "minecraft:villager_v2", cara: 0.27, sep: 0.125, baja: 0.09, pecho: 0.6, cuerpo: 0.22, empujar: true },
  { id: "minecraft:husk", cara: 0.27, sep: 0.125, baja: 0.03, pecho: 0.6, cuerpo: 0.14 },
  { id: "minecraft:stray", cara: 0.27, sep: 0.125, baja: 0.03, pecho: 0.6, cuerpo: 0.13 },
  { id: "minecraft:vindicator", cara: 0.27, sep: 0.125, baja: 0.09, pecho: 0.6, cuerpo: 0.2 },
  { id: "minecraft:witch", cara: 0.27, sep: 0.125, baja: 0.09, pecho: 0.6, cuerpo: 0.22 },
  { id: "minecraft:zombie_villager_v2", cara: 0.27, sep: 0.125, baja: 0.09, pecho: 0.6, cuerpo: 0.2 },
];
const NUNCA = /warden|wither|ender_dragon|elder_guardian/;

function mezclar(lista) {
  return lista.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
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
    const elegidos = mezclar(TIPOS).slice(0, GOLDEN_FINAL.marionetas.cantidad).filter((t) => !NUNCA.test(t.id));
    elegidos.forEach((tipo, k) => {
      system.runTimeout(() => {
        if (!e.isValid || !j.isValid || f.etapa !== "pelea") return;
        const a = (k / elegidos.length) * Math.PI * 2 + Math.random() * 0.5;
        const r = 4.5 + Math.random() * 2.5;
        const lugar = limitar(f.arena, { x: j.location.x + Math.cos(a) * r, y: j.location.y + 0.1, z: j.location.z + Math.sin(a) * r }, 3);
        let m;
        try {
          m = dim.spawnEntity(tipo.id, lugar);
        } catch {
          return;
        }
        try {
          m.addTag(TAG);
          for (const [ef, amp] of [["strength", 0], ["speed", 0], ["resistance", 0], ["fire_resistance", 0]]) {
            m.addEffect(ef, GOLDEN_FINAL.marionetas.duran, { amplifier: amp, showParticles: false });
          }
        } catch {
          // Sin efectos.
        }
        let corazon;
        try {
          corazon = dim.spawnEntity(FINAL.marioneta, lugar);
        } catch {
          // Sin corazón 3D.
        }
        if (tipo.enojar) {
          try {
            m.applyDamage(1, { cause: EntityDamageCause.entityAttack, damagingEntity: j });
          } catch {
            // No se enojó.
          }
        }
        f.marionetas.push({ m, hilos: corazon, tipo, hasta: now() + GOLDEN_FINAL.marionetas.duran, objetivo: j, golpe: 0, k });
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

function deshacer(x, efecto = true) {
  try {
    if (efecto && x.m.isValid) {
      const p = { x: x.m.location.x, y: x.m.location.y + 1, z: x.m.location.z };
      estallido(x.m.dimension, p);
      particleAt(x.m.dimension, PARTICLES.fragmento, p);
      soundAt(x.m.dimension, p, "random.fizz", 1.2, 0.8);
    }
    if (x.m.isValid) x.m.remove();
  } catch {
    // Ya no existe.
  }
  try {
    if (x.hilos?.isValid) x.hilos.remove();
  } catch {
    // Ya no existe.
  }
}

export function quitarMarionetas(g, efecto = true) {
  for (const x of g.final?.marionetas ?? []) deshacer(x, efecto);
  if (g.final) g.final.marionetas = [];
}

// Dónde están los ojos y el corazón de un mob ahora mismo.
function cuerpoDe(x) {
  const m = x.m;
  const t = x.tipo;
  const cabeza = m.getHeadLocation();
  const v = m.getViewDirection();
  const lh = Math.hypot(v.x, v.z) || 1;
  const fx = v.x / lh;
  const fz = v.z / lh;
  const der = { x: -fz, z: fx }; // a su derecha
  const cara = { x: cabeza.x + v.x * t.cara, y: cabeza.y + v.y * t.cara - t.baja, z: cabeza.z + v.z * t.cara };
  const alto = cabeza.y - m.location.y;
  return {
    ojos: [{ x: cara.x + der.x * t.sep, y: cara.y, z: cara.z + der.z * t.sep }, { x: cara.x - der.x * t.sep, y: cara.y, z: cara.z - der.z * t.sep }],
    corazon: { x: m.location.x + fx * (t.cuerpo + 0.1), y: m.location.y + alto * t.pecho, z: m.location.z + fz * (t.cuerpo + 0.1) },
  };
}

// Hilo 3D ondulante (como los de Error Sans): cuentas de luz en una curva que cuelga un poco
// y se mueve como una cuerda, de la mano de Golden al corazón.
function hilo(dim, a, b, fase) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const largo = Math.hypot(dx, dy, dz);
  if (largo < 0.4 || largo > 48) return;
  const lh = Math.hypot(dx, dz) || 1;
  const perp = { x: -dz / lh, z: dx / lh };
  const n = Math.min(70, Math.ceil(largo / 0.2));
  const cuelga = Math.min(1.4, largo * 0.07);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = Math.sin(Math.PI * t);
    const onda = Math.sin(t * Math.PI * 3.2 - fase) * 0.22 * s;
    const sube = Math.cos(t * Math.PI * 2.1 - fase * 0.8) * 0.12 * s;
    particula(dim, PARTICLES.hiloPunto, { x: a.x + dx * t + perp.x * onda, y: a.y + dy * t - cuelga * s + sube, z: a.z + dz * t + perp.z * onda });
  }
}

// Cada tick: ojos dorados y corazón en su lugar; cada 2 ticks, los hilos desde los dedos de
// Golden. Se cortan al pasar los 2 minutos. A los aldeanos (que no atacan) los arrastra.
export function tickMarionetas(g, jugadores) {
  const f = g.final;
  if (!f.marionetas?.length) return;
  const e = g.entidad;
  const dim = e.dimension;
  const yaw = e.getRotation().y;
  const { adelante, derecha } = ejes(yaw);
  const arriba = g.pose === 10;
  const mano = arriba ? punto(e.location, yaw, 0.15, 2.35, 0.42)
    : { x: e.location.x + adelante.x * 0.4 + derecha.x * 0.4, y: e.location.y + 1.0, z: e.location.z + adelante.z * 0.4 + derecha.z * 0.4 };
  f.marionetas = f.marionetas.filter((x) => {
    if (!x.m.isValid || now() > x.hasta) {
      deshacer(x, x.m.isValid);
      return false;
    }
    try {
      const c = cuerpoDe(x);
      for (const o of c.ojos) particula(dim, PARTICLES.ojoDorado, o);
      if (x.hilos?.isValid) x.hilos.teleport(c.corazon, { keepVelocity: false });
      if (now() % 2 === 0) {
        // Desde la punta de los dedos (separados un poco, uno por hilo) hasta el corazón.
        const dedo = { x: mano.x + derecha.x * (x.k - 2.5) * 0.04, y: mano.y + (x.k % 3) * 0.03, z: mano.z + derecha.z * (x.k - 2.5) * 0.04 };
        hilo(dim, dedo, c.corazon, now() * 0.35 + x.k * 1.7);
      }
      let objetivo = x.objetivo?.isValid ? x.objetivo : undefined;
      if (!objetivo || objetivo.getGameMode?.() === GameMode.Spectator) objetivo = jugadores.find((p) => p.isValid);
      x.objetivo = objetivo;
      if (x.tipo.empujar && objetivo && now() % 4 === 0) {
        const dx = objetivo.location.x - x.m.location.x;
        const dz = objetivo.location.z - x.m.location.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d > 1.8) x.m.applyImpulse({ x: (dx / d) * 0.09, y: 0, z: (dz / d) * 0.09 });
        else if (now() >= x.golpe) {
          x.golpe = now() + 20;
          danar(objetivo, 3, x.m);
          soundAt(dim, x.m.location, "mob.villager.no", 0.8, 1);
        }
      }
    } catch {
      // Mob no disponible.
    }
    return true;
  });
}

// Al morir no sueltan nada: se deshacen en polvo dorado.
world.beforeEvents.entityHurt.subscribe((ev) => {
  const m = ev.hurtEntity;
  try {
    if (!m.hasTag(TAG)) return;
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

// Los creepers marioneta no rompen bloques.
world.beforeEvents.explosion.subscribe((ev) => {
  try {
    if (ev.source?.hasTag(TAG)) ev.setImpactedBlocks([]);
  } catch {
    // Sin fuente.
  }
});

// Por si el mundo se cerró: marionetas o corazones sueltos se deshacen.
export function limpiarMarionetasHuerfanas(dim, vigentes) {
  try {
    for (const m of dim.getEntities({ tags: [TAG] })) if (!vigentes.has(m.id)) m.remove();
    for (const h of dim.getEntities({ type: FINAL.marioneta })) if (!vigentes.has(h.id)) h.remove();
  } catch {
    // Dimensión sin cargar.
  }
}
