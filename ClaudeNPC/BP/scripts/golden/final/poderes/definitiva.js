import { system } from "@minecraft/server";
import { ANIM, PARTICLES, SONIDO } from "../../../config.js";
import { now, particleAt, soundAt } from "../../../util.js";
import { animar, detalle, pose, punto, yawHacia } from "../comun.js";
import { lanzarOrbe } from "../orbes.js";

// Orbe definitiva (solo si no apagaste los 4 relojes): alza los dos brazos con una orbe
// amarilla en la derecha y una azul en la izquierda, junta las manos y las une en una orbe
// grande que carga con sonidos sónicos alrededor; después te la arroja. Si te toca, mueres
// de un golpe... salvo que la esquives, la devuelvas con 3 golpes, te cubras con escudo
// (agachado y mirándola) o tengas un tótem.

export function lanzarDefinitiva(g, j) {
  const e = g.entidad;
  const f = g.final;
  const dim = e.dimension;
  if (f.definitiva) return;
  const c = f.arena ? { x: f.arena.centro.x + 0.5, y: f.arena.centro.y + 2.2, z: f.arena.centro.z + 0.5 } : { ...e.location };
  f.definitiva = { t: 0, objetivo: j, orbe: undefined, inicio: { ...e.location } };
  g.vueloPropio = true;
  pose(g, 8);
  detalle(g, 2); // orbe amarilla en la derecha y azul en la izquierda
  soundAt(dim, e.location, "beacon.power", 1.2, 1.4);
  const id = system.runInterval(() => {
    const D = f.definitiva;
    try {
      if (!D || !e.isValid || f.etapa !== "pelea") {
        system.clearRun(id);
        if (D?.orbe?.e?.isValid) D.orbe.e.remove();
        f.definitiva = undefined;
        g.vueloPropio = false;
        return;
      }
      const t = ++D.t;
      const obj = D.objetivo?.isValid ? D.objetivo : undefined;
      const yaw = obj ? yawHacia(e.location, obj.location) : e.getRotation().y;
      // Vuela al centro de la arena mirando al jugador.
      if (t <= 20) {
        const k = t / 20;
        const p = { x: D.inicio.x + (c.x - D.inicio.x) * k, y: D.inicio.y + (c.y - D.inicio.y) * k, z: D.inicio.z + (c.z - D.inicio.z) * k };
        e.teleport(p, { rotation: { x: 0, y: yaw }, keepVelocity: false });
      } else if (t < 96) {
        e.teleport(c, { rotation: { x: 0, y: yaw }, keepVelocity: false });
      }
      if (t === 22) pose(g, 9); // junta las manos
      if (t === 30) {
        detalle(g, 0);
        D.orbe = lanzarOrbe(dim, { tipo: 2, desde: punto(c, yaw, 1.0, 1.3, 0), quieta: true, objetivo: obj, dueno: e,
          contra: "jugadores", vida: 260, radio: 1.2 });
        particleAt(dim, PARTICLES.fusionDestello, punto(c, yaw, 1.0, 1.3, 0));
        soundAt(dim, c, "mob.warden.sonic_charge", 1, 1.4);
        soundAt(dim, c, SONIDO.carga, 1, 1.2);
      }
      if (D.orbe && t > 30 && t < 96) {
        const tam = 0.3 + 2.1 * Math.min(1, (t - 30) / 66); // crece igual que el modelo (3,3 s)
        D.orbe.pos = punto(c, yaw, 1.1 + tam * 0.45, 1.3, 0);
        D.orbe.radio = 0.6 + tam * 0.45;
        if (t % 12 === 0) soundAt(dim, D.orbe.pos, "mob.warden.sonic_boom", 1.6, 0.5);
        if (t % 8 === 0) particleAt(dim, PARTICLES.converge, D.orbe.pos);
      }
      if (t === 90) animar(e, ANIM.goldenLanzarOrbe);
      if (t === 96 && D.orbe) {
        // ¡La arroja!
        pose(g, 0);
        const o = D.orbe;
        const destino = obj ? { x: obj.location.x, y: obj.location.y + 1, z: obj.location.z } : punto(c, yaw, 10, 0, 0);
        const d = { x: destino.x - o.pos.x, y: destino.y - o.pos.y, z: destino.z - o.pos.z };
        const l = Math.hypot(d.x, d.y, d.z) || 1;
        o.rapidez = 0.34;
        o.vel = { x: (d.x / l) * 0.34, y: (d.y / l) * 0.34, z: (d.z / l) * 0.34 };
        o.guiado = 0.06;
        o.guiadoHasta = o.t + 70;
        o.quieta = false;
        soundAt(dim, o.pos, "mob.warden.sonic_boom", 0.8, 1.6);
        soundAt(dim, o.pos, "random.explode", 1.4, 0.6);
      }
      if (t >= 110) {
        system.clearRun(id);
        f.definitiva = undefined;
        g.vueloPropio = false;
        g.quietoHasta = now() + 20;
      }
    } catch {
      system.clearRun(id);
      f.definitiva = undefined;
      g.vueloPropio = false;
    }
  }, 1);
  f.ocupadoHasta = now() + 120;
  f.cd.poder = now() + 160;
}
