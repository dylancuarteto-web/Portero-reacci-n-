import { GameMode, InputPermissionCategory, Player, system } from "@minecraft/server";
import { ANIM, GOLDEN, GOLDEN_FINAL, PARTICLES, SONIDO } from "../../../config.js";
import { particleAt, soundAt } from "../../../util.js";
import { danar, estallido } from "../../comun.js";
import { PLOMO, animar, fundido, lerp, pose, sonar } from "../comun.js";
import { pausarOrbes } from "../orbes.js";
import { niebla } from "../../../dano.js";

// Pausa del tiempo: chasquea los dedos y la pantalla se vuelve plomo (niebla gris). Nadie
// se mueve salvo Claude Golden: se acerca, te da un combo de golpes y vuelve a chasquear;
// el tiempo sigue, recibes todo el daño junto (5 corazones) y sales volando.

const NIEBLA = "claudenpc:pausa";
const TAG = "claudenpc_pausa";
export const congelados = new Set();

function congelar(p, si) {
  try {
    p.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, !si);
    p.inputPermissions.setPermissionCategory(InputPermissionCategory.Jump, !si);
    niebla(p, NIEBLA, TAG, si);
  } catch {
    // Jugador no disponible.
  }
  if (si) congelados.add(p.id);
  else congelados.delete(p.id);
}

// Por si el mundo se cerró a la mitad: nadie se queda congelado ni con la niebla.
export function descongelarTodos(jugadores) {
  for (const p of jugadores) {
    if (!congelados.has(p.id)) {
      niebla(p, NIEBLA, TAG, false);
      continue;
    }
    congelar(p, false);
  }
}

export default {
  id: "pausa",
  cd: 760,
  si: (c) => Math.hypot(c.j.location.x - c.g.entidad.location.x, c.j.location.z - c.g.entidad.location.z) < 28,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    let afectados = [];
    const quietos = new Map(); // entidad → lugar
    const golpes = [5, 12, 20, 29, 37, 45];
    g.vueloPropio = true;
    pose(g, 11);
    animar(e, ANIM.goldenChasquidoDer);
    let t = 0;
    let desde;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea") return fin(false);
        if (t === 6) {
          // El tiempo se detiene.
          afectados = dim.getPlayers({ location: e.location, maxDistance: 32, excludeGameModes: [GameMode.Creative, GameMode.Spectator] });
          sonar(afectados, SONIDO.pausa, 1, 1);
          fundido(afectados, PLOMO, 0.15, 0.1, 0.6);
          for (const p of afectados) {
            congelar(p, true);
            quietos.set(p, { ...p.location });
            particleAt(dim, PARTICLES.ondaPausa, { x: p.location.x, y: p.location.y + 1, z: p.location.z });
          }
          for (const m of dim.getEntities({ location: e.location, maxDistance: 24, excludeTypes: [GOLDEN, "minecraft:item", "minecraft:player"] }).slice(0, 24)) {
            quietos.set(m, { ...m.location });
          }
          pausarOrbes(true);
          particleAt(dim, PARTICLES.ondaPausa, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
          pose(g, 0);
        }
        // Todos quietos (sin caer ni moverse).
        if (t >= 6) {
          for (const [x, lugar] of quietos) {
            try {
              if (x.isValid) x.teleport(lugar, { keepVelocity: false });
            } catch {
              // Ya no existe.
            }
          }
        }
        if (!j.isValid) return fin(false);
        const v = j.getViewDirection();
        const frente = { x: j.location.x + v.x * 1.7, y: j.location.y + 0.1, z: j.location.z + v.z * 1.7 };
        if (t === 10) desde = { ...e.location };
        if (t > 10 && t <= 24) {
          e.teleport(lerp(desde, frente, (t - 10) / 14), { facingLocation: j.getHeadLocation() });
          if (t % 3 === 0) particleAt(dim, PARTICLES.auraDorada, e.location);
        }
        if (t > 24 && t < 88) e.teleport(frente, { facingLocation: j.getHeadLocation() });
        if (t === 26) animar(e, ANIM.goldenCombo);
        for (const h of golpes) {
          if (t === 26 + h) {
            const p = { x: j.location.x, y: j.location.y + 1.1, z: j.location.z };
            estallido(dim, p);
            soundAt(dim, p, "game.player.attack.strong", 0.7 + Math.random() * 0.3, 1);
            soundAt(dim, p, "random.anvil_land", 1.8, 0.35);
          }
        }
        if (t === 80) animar(e, ANIM.goldenChasquidoDer);
        if (t === 86) {
          // El tiempo sigue: todo el daño de golpe y sale volando.
          sonar(afectados, SONIDO.reanudar, 1, 1);
          soundAt(dim, e.location, SONIDO.chasquido, 1, 1.2);
          fin(true);
        }
      } catch {
        fin(false);
      }
    }, 1);
    function fin(golpear) {
      system.clearRun(id);
      pausarOrbes(false);
      for (const p of afectados) congelar(p, false);
      g.vueloPropio = false;
      pose(g, 0);
      if (!golpear || !j.isValid) return;
      danar(j, GOLDEN_FINAL.danoPausa, e);
      try {
        const dx = j.location.x - e.location.x;
        const dz = j.location.z - e.location.z;
        const d = Math.hypot(dx, dz) || 1;
        j.applyKnockback({ x: (dx / d) * 3.2, z: (dz / d) * 3.2 }, 0.9);
        if (j instanceof Player) j.runCommand("camerashake add @s 0.5 0.6 positional");
      } catch {
        // Sin empuje.
      }
      estallido(dim, { x: j.location.x, y: j.location.y + 1, z: j.location.z });
      soundAt(dim, j.location, "random.explode", 1.2, 0.9);
    }
    return 100;
  },
};
