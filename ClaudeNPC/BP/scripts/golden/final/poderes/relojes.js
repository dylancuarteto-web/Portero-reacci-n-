import { Player, system, world } from "@minecraft/server";
import { ANIM, FINAL, GOLDEN_FINAL, PARTICLES, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { goldens } from "../../comun.js";
import { pedestales } from "../arena.js";
import { animar, pose } from "../comun.js";
import { lanzarDefinitiva } from "./definitiva.js";

// Requisito RELOJ: Claude Golden chasquea los dedos y aparecen 4 relojes 3D sobre los
// pedestales de la arena. Hay que apagarlos (2 golpes o flechazos cada uno) antes de que
// se acabe el tiempo. Si los apagas, Golden queda aturdido; si no, lanza la orbe definitiva.
// En la barra de acción solo se ven íconos: relojes encendidos/apagados y el tiempo.

const ICONO = { on: "\uE907", off: "\uE908", lleno: "\uE909", vacio: "\uE90A" };

function evento(e, nombre) {
  try {
    if (e.isValid) e.triggerEvent(nombre);
  } catch {
    // Reloj no disponible.
  }
}

export default {
  id: "relojes",
  cd: 1100,
  si: (c) => !!c.g.final?.arena,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const f = g.final;
    const dim = e.dimension;
    pose(g, 0);
    animar(e, ANIM.goldenChasquidoDer);
    g.quietoHasta = now() + 20;
    f.relojes = { t: 0, lista: [], limite: GOLDEN_FINAL.relojes.tiempo, objetivo: j };
    system.runTimeout(() => {
      if (!e.isValid || !f.relojes) return;
      soundAt(dim, e.location, SONIDO.chasquido, 1, 1.4);
      const c = f.arena.centro;
      for (const p of pedestales(f.arena.R)) {
        const pos = { x: c.x + p.x + 0.5, y: c.y + 2.4, z: c.z + p.z + 0.5 };
        try {
          const r = dim.spawnEntity(FINAL.reloj, pos);
          f.relojes.lista.push({ e: r, pos, golpes: 0, apagado: false });
          particleAt(dim, PARTICLES.fusionDestello, { x: pos.x, y: pos.y + 0.6, z: pos.z });
          soundAt(dim, pos, "block.bell.hit", 1.3, 0.8);
        } catch {
          // No se pudo poner este reloj.
        }
      }
    }, 6);
    return 30;
  },
};

function quitarRelojes(f, efecto = true) {
  for (const r of f.relojes?.lista ?? []) {
    try {
      if (efecto && r.e.isValid) {
        particleAt(r.e.dimension, PARTICLES.estallido, { x: r.pos.x, y: r.pos.y + 0.6, z: r.pos.z });
        soundAt(r.e.dimension, r.pos, "random.glass", 0.8, 0.7);
      }
      if (r.e.isValid) r.e.remove();
    } catch {
      // Ya no existe.
    }
  }
}

export function cancelarRelojes(g) {
  if (!g.final?.relojes) return;
  quitarRelojes(g.final, false);
  g.final.relojes = undefined;
}

export function tickRelojes(g, jugadores) {
  const f = g.final;
  const R = f.relojes;
  if (!R) return;
  R.t++;
  const e = g.entidad;
  const dim = e.dimension;
  const encendidos = R.lista.filter((r) => !r.apagado && r.e.isValid);
  const alarma = R.t > R.limite * 0.72;
  const cada = alarma ? 5 : 10;
  if (R.t % cada === 0) {
    for (const r of encendidos) {
      soundAt(dim, r.pos, SONIDO.tictac, (R.t / cada) % 2 ? 1.0 : 0.8, 1);
      if (alarma && !r.alarma) {
        r.alarma = true;
        evento(r.e, "claudenpc:alarma");
      }
    }
  }
  if (R.lista.length) {
    // Íconos para la barra de la pelea (relojes encendidos/apagados y el tiempo que queda).
    const iconos = R.lista.map((r) => (r.apagado ? ICONO.off : ICONO.on)).join("");
    const llenos = Math.max(0, Math.ceil(10 * (1 - R.t / R.limite)));
    R.hud = `${iconos}  ${ICONO.lleno.repeat(llenos)}${ICONO.vacio.repeat(10 - llenos)}`;
  }
  if (R.t > 8 && R.lista.length && !encendidos.length) {
    // ¡Los apagaron todos! Golden queda aturdido un rato.
    quitarRelojes(f);
    f.relojes = undefined;
    g.aturdidoHasta = now() + 120;
    animar(e, ANIM.goldenAturdido);
    soundAt(dim, e.location, "beacon.deactivate", 0.7, 1.4);
    return;
  }
  if (R.t >= R.limite) {
    for (const r of encendidos) soundAt(dim, r.pos, "block.bell.hit", 0.6, 1.4);
    quitarRelojes(f);
    f.relojes = undefined;
    const j = R.objetivo?.isValid ? R.objetivo : jugadores.find((p) => p.isValid);
    if (j) lanzarDefinitiva(g, j);
  }
}

// Golpes a un reloj (espada, puño o flecha): con 2 se apaga.
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  if (hurtEntity.typeId !== FINAL.reloj) return;
  try {
    hurtEntity.getComponent("minecraft:health")?.resetToMaxValue();
  } catch {
    // Sin vida.
  }
  const quien = damageSource.damagingEntity;
  if (!(quien instanceof Player)) return;
  for (const g of goldens.values()) {
    const r = g.final?.relojes?.lista.find((x) => x.e.id === hurtEntity.id);
    if (!r || r.apagado) continue;
    r.golpes++;
    soundAt(hurtEntity.dimension, r.pos, "random.anvil_land", 1.6, 0.5);
    if (r.golpes >= GOLDEN_FINAL.relojes.golpes) {
      r.apagado = true;
      evento(r.e, "claudenpc:apagado");
      soundAt(hurtEntity.dimension, r.pos, "random.fizz", 0.8, 1);
      soundAt(hurtEntity.dimension, r.pos, "beacon.deactivate", 1.4, 0.8);
    }
  }
});
