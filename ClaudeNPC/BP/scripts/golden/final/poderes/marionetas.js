import { EntityDamageCause, GameMode, system, world } from "@minecraft/server";
import { FINAL, GOLDEN_FINAL, PARTICLES, PROP, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { danar, estallido } from "../../comun.js";
import { pose, prop, punto, tira } from "../comun.js";

// Marionetas: alza el brazo y de su mano salen hilos amarillos que se enredan en el corazón
// blanco 3D de varios mobs (cualquiera menos el warden). Les cambian los ojos a dorados, se
// vuelven un poco más fuertes y te atacan. Duran 2 minutos o hasta que mueren (se deshacen
// en polvo dorado, sin soltar objetos).

const TAG = "claudenpc_marioneta";
const TIPOS = [
  { id: "minecraft:zombie", frente: 0.18 }, { id: "minecraft:skeleton", frente: 0.16 }, { id: "minecraft:creeper", frente: 0.18 },
  { id: "minecraft:enderman", frente: 0.14, enojar: true }, { id: "minecraft:pillager", frente: 0.24 },
  { id: "minecraft:villager_v2", frente: 0.26, empujar: true }, { id: "minecraft:husk", frente: 0.18 },
  { id: "minecraft:stray", frente: 0.16 }, { id: "minecraft:vindicator", frente: 0.24 }, { id: "minecraft:witch", frente: 0.26 },
  { id: "minecraft:zombie_villager_v2", frente: 0.24 },
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
    g.quietoHasta = now() + 50;
    pose(g, 10);
    soundAt(dim, e.location, "beacon.power", 0.8, 1.2);
    const elegidos = mezclar(TIPOS).slice(0, GOLDEN_FINAL.marionetas.cantidad).filter((t) => !NUNCA.test(t.id));
    elegidos.forEach((tipo, k) => {
      system.runTimeout(() => {
        if (!e.isValid || !j.isValid || f.etapa !== "pelea") return;
        const a = (k / elegidos.length) * Math.PI * 2 + Math.random() * 0.5;
        const r = 4.5 + Math.random() * 2.5;
        const lugar = { x: j.location.x + Math.cos(a) * r, y: j.location.y + 0.1, z: j.location.z + Math.sin(a) * r };
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
        let hilos;
        try {
          hilos = dim.spawnEntity(FINAL.marioneta, lugar);
          const ojos = m.getHeadLocation().y - m.location.y;
          prop(hilos, PROP.ojos, Math.max(0.3, Math.min(3.5, ojos)));
          prop(hilos, PROP.pecho, Math.max(0.3, Math.min(3, ojos * (tipo.id.includes("enderman") ? 0.7 : 0.62))));
          prop(hilos, PROP.frente, tipo.frente);
        } catch {
          // Sin hilos.
        }
        if (tipo.enojar) {
          try {
            m.applyDamage(1, { cause: EntityDamageCause.entityAttack, damagingEntity: j });
          } catch {
            // No se enojó.
          }
        }
        f.marionetas.push({ m, hilos, tipo, hasta: now() + GOLDEN_FINAL.marionetas.duran, objetivo: j, golpe: 0 });
        particleAt(dim, PARTICLES.fusionDestello, { x: lugar.x, y: lugar.y + 1, z: lugar.z });
        particleAt(dim, PARTICLES.curacion, lugar);
        soundAt(dim, lugar, "mob.evocation_illager.prepare_summon", 1.2, 0.8);
        soundAt(dim, lugar, SONIDO.latido, 1.4, 0.6);
      }, 10 + k * 5);
    });
    system.runTimeout(() => e.isValid && pose(g, 0), 50);
    return 52;
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

// Cada tick: los hilos siguen al mob, se dibujan desde la mano de Golden y se cortan al
// pasar los 2 minutos. Los aldeanos (que no atacan) los arrastra con los hilos.
export function tickMarionetas(g, jugadores) {
  const f = g.final;
  if (!f.marionetas?.length) return;
  const e = g.entidad;
  const dim = e.dimension;
  const yaw = e.getRotation().y;
  const mano = punto(e.location, yaw, 0.25, 2.3, 0.4);
  f.marionetas = f.marionetas.filter((x) => {
    if (!x.m.isValid || now() > x.hasta) {
      deshacer(x, x.m.isValid);
      return false;
    }
    try {
      const rot = x.m.getRotation();
      if (x.hilos?.isValid) x.hilos.teleport(x.m.location, { rotation: { x: 0, y: rot.y }, keepVelocity: false });
      if (now() % 3 === 0) {
        const ojos = x.m.getHeadLocation().y - x.m.location.y;
        const r = (rot.y * Math.PI) / 180;
        const corazon = { x: x.m.location.x - Math.sin(r) * x.tipo.frente, y: x.m.location.y + ojos * 0.62, z: x.m.location.z + Math.cos(r) * x.tipo.frente };
        tira(dim, PARTICLES.hilo, mano, corazon);
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

// Por si el mundo se cerró: marionetas o hilos sueltos se deshacen.
export function limpiarMarionetasHuerfanas(dim, vigentes) {
  try {
    for (const m of dim.getEntities({ tags: [TAG] })) if (!vigentes.has(m.id)) m.remove();
    for (const h of dim.getEntities({ type: FINAL.marioneta })) if (!vigentes.has(h.id)) h.remove();
  } catch {
    // Dimensión sin cargar.
  }
}

