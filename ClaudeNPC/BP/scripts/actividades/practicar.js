import { system } from "@minecraft/server";
import { ANIM, MODIFICA_MUNDO, PARTICLES } from "../config.js";
import { sostener } from "../equipo.js";
import { protegido } from "../estructuras.js";
import { HABILIDADES, porPerfeccionar, practicar } from "../habilidades.js";
import { estallidoDeViento } from "../habilidades/vuelo.js";
import { reflejoDePractica } from "../habilidades/reflejos.js";
import { ponerHaciendo } from "../iq.js";
import { velocidad } from "../movimiento.js";
import { poseEscudo } from "../postura.js";
import { animate, blockAt, burst, mirarA, now, particleAt, rand, reemplazable, sound, soundAt } from "../util.js";

// Practicar: en su tiempo libre, los que todavía pueden mejorar algo lo practican
// ("trabajan en las combinaciones"). Tiro al blanco, una lámpara de redstone que
// prende y apaga, reflejos, pociones en un soporte, saltos con viento... Cada
// práctica completa sube un poco esa habilidad (más a quien tiene talento).

function delante(npc, dist) {
  const v = npc.getViewDirection();
  const h = Math.hypot(v.x, v.z) || 1;
  return { x: Math.floor(npc.location.x + (v.x / h) * dist), y: Math.floor(npc.location.y), z: Math.floor(npc.location.z + (v.z / h) * dist) };
}

function poner(npc, a, pos, bloque) {
  if (!MODIFICA_MUNDO || protegido(pos)) return false;
  const b = blockAt(npc.dimension, pos);
  const suelo = blockAt(npc.dimension, { x: pos.x, y: pos.y - 1, z: pos.z });
  if (!b || !reemplazable(b) || !suelo || reemplazable(suelo) || suelo.isLiquid) return false;
  try {
    b.setType(bloque);
    a.puestos.push({ ...pos });
    return true;
  } catch {
    return false;
  }
}

function quitarPuestos(npc, a) {
  for (const p of a.puestos ?? []) {
    try {
      const b = blockAt(npc.dimension, p);
      if (b && !b.isAir) b.setType("minecraft:air");
      particleAt(npc.dimension, PARTICLES.construir, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
    } catch {
      // Chunk descargado.
    }
  }
  a.puestos = [];
}

// Un paso de práctica; devuelve true cuando terminó la sesión.
const RUTINAS = {
  arco(npc, s, a) {
    if (a.paso === 0) {
      a.blanco = delante(npc, 7);
      if (!poner(npc, a, a.blanco, "minecraft:target")) a.blanco = undefined;
    }
    const b = a.blanco ?? delante(npc, 7);
    const c = { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 };
    sostener(npc, "minecraft:bow");
    mirarA(npc, c);
    animate(npc, ANIM.arco);
    system.runTimeout(() => {
      if (!npc.isValid) return;
      try {
        const head = npc.getHeadLocation();
        const dx = c.x - head.x;
        const dy = c.y - head.y + 0.25;
        const dz = c.z - head.z;
        const d = Math.hypot(dx, dy, dz) || 1;
        const f = npc.dimension.spawnEntity("minecraft:arrow", { x: head.x + (dx / d) * 0.8, y: head.y, z: head.z + (dz / d) * 0.8 });
        const proj = f.getComponent("minecraft:projectile");
        if (proj) {
          proj.owner = npc;
          proj.shoot({ x: (dx / d) * 2.2, y: (dy / d) * 2.2, z: (dz / d) * 2.2 });
        }
        sound(npc, "random.bow", 1.1, 0.7);
      } catch {
        // Sin flecha.
      }
    }, 20);
    s.ocupadoHasta = now() + 40;
    return a.paso >= 4;
  },
  redstone(npc, s, a) {
    if (a.paso === 0) {
      a.lampara = delante(npc, 2);
      if (!poner(npc, a, a.lampara, "minecraft:redstone_lamp")) return true;
      sostener(npc, "minecraft:redstone_lamp");
      animate(npc, ANIM.colocar);
    } else {
      // Prende y apaga la lámpara con un bloque de redstone encima: prueba combinaciones.
      const arriba = { x: a.lampara.x, y: a.lampara.y + 1, z: a.lampara.z };
      const b = blockAt(npc.dimension, arriba);
      try {
        if (b?.typeId === "minecraft:redstone_block") b.setType("minecraft:air");
        else if (b && reemplazable(b)) {
          b.setType("minecraft:redstone_block");
          if (!a.puestos.some((p) => p.y === arriba.y && p.x === arriba.x && p.z === arriba.z)) a.puestos.push(arriba);
        }
      } catch {
        // Sin cambio.
      }
      sostener(npc, "minecraft:redstone_block");
      mirarA(npc, { x: a.lampara.x + 0.5, y: a.lampara.y + 1, z: a.lampara.z + 0.5 });
      animate(npc, ANIM.colocar);
      soundAt(npc.dimension, a.lampara, "random.click", 1.2, 0.6);
      if (a.paso % 2 === 0) burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
    }
    s.ocupadoHasta = now() + 24;
    return a.paso >= 7;
  },
  reflejos(npc, s, a) {
    reflejoDePractica(npc);
    s.ocupadoHasta = now() + 70;
    return a.paso >= 2;
  },
  quimica(npc, s, a) {
    if (a.paso === 0) {
      a.soporte = delante(npc, 2);
      poner(npc, a, a.soporte, "minecraft:brewing_stand");
    }
    const p = a.soporte;
    sostener(npc, "minecraft:potion");
    mirarA(npc, { x: p.x + 0.5, y: p.y + 0.6, z: p.z + 0.5 });
    animate(npc, ANIM.crafteo);
    particleAt(npc.dimension, PARTICLES.brilloVerde, { x: p.x + 0.5, y: p.y + 0.9, z: p.z + 0.5 });
    soundAt(npc.dimension, p, "random.splash", 1.6, 0.3);
    s.ocupadoHasta = now() + 30;
    return a.paso >= 5;
  },
  vuelo(npc, s, a) {
    s.sinCaidaHasta = now() + 120;
    sostener(npc, "minecraft:wind_charge");
    animate(npc, ANIM.lanzar);
    estallidoDeViento(npc, undefined, 0.6);
    s.ocupadoHasta = now() + 40;
    return a.paso >= 3;
  },
  escudo(npc, s, a) {
    poseEscudo(npc, a.paso % 2 === 0);
    if (a.paso % 2 === 0) sound(npc, "item.shield.block", 1.2, 0.5);
    s.ocupadoHasta = now() + 30;
    return a.paso >= 5;
  },
};

// Las demás (minería, cálculo, perlas, agua, torres...): repasa sus apuntes y piensa.
function repasar(npc, s, a) {
  animate(npc, a.paso % 2 ? ANIM.tomarNotas : ANIM.mirarAlrededor);
  if (a.paso % 2 === 0) burst(npc, PARTICLES.idea, { x: 0, y: 2.3, z: 0 });
  s.ocupadoHasta = now() + 40;
  return a.paso >= 4;
}

export const practica = {
  nombre: "practicando",
  puede: (npc, s) => now() >= (s.cd.practica ?? 0) && !!porPerfeccionar(npc, s),
  peso: () => 1.2,
  duracion: () => 900,
  iniciar(npc, s, a) {
    a.hab = porPerfeccionar(npc, s);
    if (!a.hab) return false;
    a.paso = 0;
    a.puestos = [];
    velocidad(npc, 0);
    ponerHaciendo(npc, s, `practicando ${HABILIDADES[a.hab].nombre.toLowerCase()}`);
    return true;
  },
  tick(npc, s, a) {
    const rutina = RUTINAS[a.hab] ?? repasar;
    let fin;
    try {
      fin = rutina(npc, s, a);
    } catch {
      fin = true;
    }
    a.paso++;
    if (!fin) return false;
    practicar(npc, s, a.hab, 0.14);
    s.cd.practica = now() + rand(1800, 3000);
    return true;
  },
  fin(npc, s, a) {
    quitarPuestos(npc, a);
    if (a.hab === "escudo") poseEscudo(npc, false);
  },
};
