// spawner.js — decide QUÉ zombie aparece y DÓNDE según la Desesperación.
//
// Rendimiento:
// - Una oleada cada 30 s (600 ticks), no cada tick.
// - Límite global CAP_ZOMBIES: si se alcanza, no spawnea nada.
// - El despawn a >64 bloques lo hace el componente minecraft:despawn de cada
//   entidad (más barato que hacerlo por script).
import { world, system } from "@minecraft/server";
import { ZOMBIES } from "./zombies_data.js";
import { CAP_ZOMBIES, jugadores, zombiesActivos, esValido } from "./util.js";
import { getDesesperacion } from "./desesperacion.js";

const ID_MUTANTE = "za:zombie_mutante";

// Elige un zombie al azar de la lista desbloqueada, ponderado por peso.
// A mayor desesperación, más peso relativo ganan los tiers altos.
function elegirZombie(desp) {
  const candidatos = ZOMBIES.filter(z => z.weight > 0 && desp >= z.desp);
  if (candidatos.length === 0) return undefined;
  let total = 0;
  const pesos = candidatos.map(z => {
    // Bonus progresivo para especialistas cuando la desesperación sube.
    const bonus = 1 + (z.desp / 100) * (desp / 50);
    const w = z.weight * bonus;
    total += w;
    return w;
  });
  let r = Math.random() * total;
  for (let i = 0; i < candidatos.length; i++) {
    r -= pesos[i];
    if (r <= 0) return candidatos[i];
  }
  return candidatos[candidatos.length - 1];
}

// Busca un punto de superficie en un anillo de 24-40 bloques del jugador.
function posicionDeSpawn(p) {
  for (let intento = 0; intento < 6; intento++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 24 + Math.random() * 16;
    const x = Math.floor(p.location.x + Math.cos(ang) * dist);
    const z = Math.floor(p.location.z + Math.sin(ang) * dist);
    try {
      const top = p.dimension.getTopmostBlock({ x, z });
      if (!top) continue; // chunk sin cargar
      const y = top.y + 1;
      // No spawnear a alturas absurdas respecto al jugador (que el Minero
      // tenga que cavar está bien; 40 bloques de montaña, no).
      if (Math.abs(y - p.location.y) > 24) continue;
      return { x: x + 0.5, y, z: z + 0.5 };
    } catch { }
  }
  return undefined;
}

function oleada() {
  const js = jugadores();
  if (js.length === 0) return;

  let activos = zombiesActivos().length;
  if (activos >= CAP_ZOMBIES) return;

  for (const p of js) {
    if (activos >= CAP_ZOMBIES) break;
    const desp = getDesesperacion(p);

    // 2 a 5 zombies por oleada según desesperación.
    let n = 2 + Math.min(3, Math.floor(desp / 25));
    n = Math.min(n, CAP_ZOMBIES - activos);

    for (let i = 0; i < n; i++) {
      const z = elegirZombie(desp);
      const pos = posicionDeSpawn(p);
      if (!z || !pos) continue;
      try {
        p.dimension.spawnEntity(z.id, pos);
        activos++;
      } catch { }
    }

    // BOSS: a 91+, tirada rara de Mutante (máximo 1 vivo a la vez).
    if (desp >= 91 && Math.random() < 0.06) {
      const hayMutante = zombiesActivos().some(e => e.typeId === ID_MUTANTE);
      if (!hayMutante) {
        const pos = posicionDeSpawn(p);
        if (pos) {
          try {
            p.dimension.spawnEntity(ID_MUTANTE, pos);
            for (const pj of js) {
              pj.sendMessage({ rawtext: [{ translate: "za.msg.mutante" }] });
              try { pj.playSound("mob.wither.spawn", { volume: 0.6, pitch: 0.7 }); } catch { }
            }
          } catch { }
        }
      }
    }
  }
}

export function initSpawner() {
  system.runInterval(oleada, 600);
}
