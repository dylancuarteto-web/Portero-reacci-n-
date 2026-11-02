import { Player, system, world } from "@minecraft/server";
import { FINAL, ITEM_CORAZON, PARTICLES } from "./config.js";
import { lanzarOrbe } from "./golden/final/orbes.js";
import { now, particleAt, soundAt } from "./util.js";

// Corazón dorado (lo deja Claude Golden al morir). Al usarlo aparecen 3 ilusiones del
// jugador (figuras doradas con su nombre) que lo acompañan 15 segundos y lanzan bolas
// amarillas y azules a los monstruos cercanos. Se recarga en 25 segundos. Eso nomás.

const CATEGORIA = "claudenpc_corazon";
const DURA = 300;
const RECARGA = 500;
const activos = new Map(); // jugador → { lista, hasta, t }
const ultimoUso = new Map();

function quitar(a) {
  for (const x of a.lista) {
    try {
      if (x.isValid) {
        particleAt(x.dimension, PARTICLES.estallido, { x: x.location.x, y: x.location.y + 1, z: x.location.z });
        x.remove();
      }
    } catch {
      // Ya no existe.
    }
  }
}

world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
  if (itemStack?.typeId !== ITEM_CORAZON || !(source instanceof Player)) return;
  if (activos.has(source.id) || now() - (ultimoUso.get(source.id) ?? -RECARGA) < RECARGA) return;
  ultimoUso.set(source.id, now());
  try {
    source.startItemCooldown(CATEGORIA, RECARGA);
  } catch {
    // Sin recarga visible.
  }
  const dim = source.dimension;
  const lista = [];
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3;
    const pos = { x: source.location.x + Math.cos(a) * 2.2, y: source.location.y + 0.3, z: source.location.z + Math.sin(a) * 2.2 };
    try {
      const il = dim.spawnEntity(FINAL.ilusion, pos);
      il.nameTag = `§e${source.name}`;
      lista.push(il);
      particleAt(dim, PARTICLES.fusionDestello, { x: pos.x, y: pos.y + 1, z: pos.z });
    } catch {
      // No se pudo.
    }
  }
  soundAt(dim, source.location, "mob.endermen.portal", 1.4, 1);
  soundAt(dim, source.location, "random.levelup", 1.6, 0.6);
  activos.set(source.id, { jugador: source, lista, hasta: now() + DURA, t: 0 });
});

function objetivo(j) {
  try {
    const cerca = j.dimension.getEntities({ location: j.location, maxDistance: 16, families: ["monster"] })
      .concat(j.dimension.getEntities({ location: j.location, maxDistance: 18, families: ["claudenpc_golden"] }));
    cerca.sort((a, b) => Math.hypot(a.location.x - j.location.x, a.location.z - j.location.z)
      - Math.hypot(b.location.x - j.location.x, b.location.z - j.location.z));
    return cerca[0];
  } catch {
    return undefined;
  }
}

system.runInterval(() => {
  for (const [id, a] of activos) {
    const j = a.jugador;
    if (!j.isValid || now() > a.hasta) {
      quitar(a);
      activos.delete(id);
      continue;
    }
    a.t++;
    const blanco = a.t % 4 === 0 ? (a.blanco = objetivo(j)) : a.blanco?.isValid ? a.blanco : undefined;
    a.lista.forEach((il, k) => {
      try {
        if (!il.isValid) return;
        const ang = (k * Math.PI * 2) / 3 + a.t * 0.03;
        const pos = { x: j.location.x + Math.cos(ang) * 2.2, y: j.location.y + 0.35 + Math.sin(a.t / 9 + k) * 0.1, z: j.location.z + Math.sin(ang) * 2.2 };
        const mira = blanco ? blanco.location : { x: j.location.x + j.getViewDirection().x * 8, y: j.location.y + 1, z: j.location.z + j.getViewDirection().z * 8 };
        il.teleport(pos, { facingLocation: { x: mira.x, y: pos.y + 1, z: mira.z }, keepVelocity: false });
        if (blanco && (a.t + k * 8) % 24 === 0) {
          try {
            il.playAnimation("animation.claudenpc.lanzar", { blendOutTime: 0.1 });
          } catch {
            // Sin animación.
          }
          const desde = { x: pos.x, y: pos.y + 1.4, z: pos.z };
          const c = { x: blanco.location.x, y: blanco.location.y + 1, z: blanco.location.z };
          const d = { x: c.x - desde.x, y: c.y - desde.y, z: c.z - desde.z };
          const l = Math.hypot(d.x, d.y, d.z) || 1;
          const tipo = (a.t / 24 + k) % 2 < 1 ? 0 : 1;
          lanzarOrbe(il.dimension, { tipo, desde, vel: { x: (d.x / l) * 0.6, y: (d.y / l) * 0.6, z: (d.z / l) * 0.6 }, objetivo: blanco,
            dueno: j, contra: "mobs", dano: 6, guiado: 0.1, guiadoHasta: 40, vida: 70, radio: 0.6 });
          soundAt(il.dimension, desde, tipo === 0 ? "mob.blaze.shoot" : "mob.shulker.shoot", 1.6, 0.6);
        }
      } catch {
        // Ilusión no disponible.
      }
    });
  }
}, 1);

// Ilusiones que quedaron sueltas (por ejemplo, si el mundo se cerró).
system.runInterval(() => {
  const vivas = new Set([...activos.values()].flatMap((a) => a.lista.map((x) => x.id)));
  for (const p of world.getAllPlayers()) {
    try {
      for (const il of p.dimension.getEntities({ type: FINAL.ilusion, location: p.location, maxDistance: 96 })) {
        if (!vivas.has(il.id)) il.remove();
      }
    } catch {
      // Sin entidades.
    }
  }
}, 200);
