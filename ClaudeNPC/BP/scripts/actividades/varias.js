import { BlockPermutation, system } from "@minecraft/server";
import { ANIM, CRAFTEO, MODIFICA_MUNDO, PARTICLES, PICOS } from "../config.js";
import { buscarAgua, subirABote } from "../bote.js";
import { simularCrafteo } from "../crafteo.js";
import { pico, sostener, vestir } from "../equipo.js";
import { ocupado } from "../estructuras.js";
import { aprender } from "../iq.js";
import { caminarA, caminando, detener, seAtasco, velocidad } from "../movimiento.js";
import { buscarTronco, talarPaso } from "../obras/casa.js";
import { sentarse } from "../postura.js";
import {
  animate, blockAt, burst, colocar, distancia2D, esAgua, flat, mirarA, now, particleAt, rand, reemplazable,
  romperDestruyendo, sortear, sound, superficie,
} from "../util.js";

// Actividades libres de cada Claude. Cada una: nombre (lo que se ve sobre su
// cabeza), puede(npc, s), duracion(s), iniciar(npc, s, a), tick(npc, s, a) → true
// al terminar, y fin(npc, s, a) para dejarlo todo en orden si se interrumpe.

const perm = (id, estados) => BlockPermutation.resolve(id, estados);
const punto = (top) => ({ x: top.location.x + 0.5, y: top.location.y + 1, z: top.location.z + 0.5 });
const ANIMALES = new Set(["minecraft:cow", "minecraft:pig", "minecraft:sheep", "minecraft:chicken", "minecraft:rabbit",
  "minecraft:horse", "minecraft:fox", "minecraft:wolf", "minecraft:cat", "minecraft:parrot", "minecraft:llama",
  "minecraft:goat", "minecraft:frog", "minecraft:turtle", "minecraft:armadillo", "minecraft:bee"]);

function sueloFirme(dimension, x, z) {
  const top = superficie(dimension, x, z);
  if (!top || top.isLiquid || esAgua(top) || top.typeId.endsWith("_leaves")) return undefined;
  return top;
}

// --- Talar ---------------------------------------------------------------------

export const talar = {
  nombre: "talando",
  puede: () => MODIFICA_MUNDO,
  duracion: () => 1600,
  iniciar(npc, s, a) {
    a.meta = rand(1, 3);
    a.hechos = 0;
    a.evitar = new Set();
    const base = buscarTronco(npc, 12);
    if (!base) return false;
    a.t = { tronco: base };
    return true;
  },
  tick(npc, s, a) {
    if (caminando(npc)) return false;
    if (talarPaso(npc, s, a.t) !== "listo") return false;
    a.hechos++;
    a.evitar.add(`${a.t.tronco.x},${a.t.tronco.z}`);
    if (a.hechos >= a.meta) return true;
    const base = buscarTronco(npc, 12, a.evitar);
    if (!base) return true;
    a.t = { tronco: base };
    return false;
  },
};

// --- Explorar ------------------------------------------------------------------

function nuevoDestino(npc, s, a) {
  for (let k = 0; k < 4; k++) {
    const ang = (a.rumbo ?? Math.random() * Math.PI * 2) + (Math.random() - 0.5) * 1.6;
    const r = rand(12, 28);
    const top = sueloFirme(npc.dimension, npc.location.x + Math.cos(ang) * r, npc.location.z + Math.sin(ang) * r);
    if (!top) continue;
    a.rumbo = ang;
    a.destino = punto(top);
    caminarA(npc, a.destino, s.pers?.paso ?? 0.21);
    return true;
  }
  return false;
}

export const explorar = {
  nombre: "explorando",
  puede: () => true,
  duracion: () => rand(900, 1700),
  iniciar(npc, s, a) {
    a.quedan = rand(2, 4);
    return nuevoDestino(npc, s, a);
  },
  tick(npc, s, a) {
    if (caminando(npc)) return false;
    if (distancia2D(npc.location, a.destino) < 2.5 || seAtasco(npc)) {
      // Llegó (o algo le cierra el paso): mira el paisaje y sigue por otro lado.
      animate(npc, ANIM.mirarAlrededor);
      if (npc.location.y > a.destino.y + 6 || Math.random() < 0.2) burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
      aprender(npc, s, 0.1);
      s.ocupadoHasta = now() + rand(40, 80);
      if (--a.quedan <= 0) return true;
      if (seAtasco(npc)) a.rumbo = (a.rumbo ?? 0) + Math.PI / 2;
    }
    return !nuevoDestino(npc, s, a);
  },
};

// --- Descansar -------------------------------------------------------------------

export const descansar = {
  nombre: "descansando",
  puede: (npc) => npc.isOnGround && !npc.isInWater,
  duracion: (s) => (s.pers?.id === "dormilon" ? rand(600, 1100) : rand(300, 700)),
  iniciar(npc, s, a) {
    detener(npc);
    velocidad(npc, 0);
    sostener(npc, "minecraft:air");
    sentarse(npc, s, true);
    a.dormir = s.pers?.id === "dormilon" || a.enCasa;
    return true;
  },
  tick(npc, s, a) {
    if (a.dormir && Math.random() < 0.5) {
      burst(npc, PARTICLES.zzz, { x: 0, y: 1.4, z: 0 });
    } else {
      const ang = Math.random() * Math.PI * 2;
      mirarA(npc, { x: npc.location.x + Math.cos(ang) * 6, y: npc.location.y + rand(0, 3), z: npc.location.z + Math.sin(ang) * 6 });
    }
    s.ocupadoHasta = now() + rand(50, 90);
    return false;
  },
  fin(npc, s) {
    sentarse(npc, s, false);
    sostener(npc, pico(s));
  },
};

// --- Observar (animales o el paisaje) ------------------------------------------

export const observar = {
  nombre: "observando",
  puede: () => true,
  duracion: () => rand(400, 800),
  iniciar(npc, s, a) {
    try {
      a.animal = npc.dimension.getEntities({ location: npc.location, maxDistance: 18 })
        .find((e) => ANIMALES.has(e.typeId));
    } catch {
      a.animal = undefined;
    }
    sostener(npc, "minecraft:air");
    return true;
  },
  tick(npc, s, a) {
    const animal = a.animal;
    if (animal?.isValid) {
      const d = distancia2D(npc.location, animal.location);
      if (d > 3.5) {
        if (!caminando(npc)) {
          const f = flat(animal.location, npc.location);
          caminarA(npc, { x: animal.location.x + f.x * 2.5, y: animal.location.y, z: animal.location.z + f.z * 2.5 }, (s.pers?.paso ?? 0.2) * 0.8);
        }
        return seAtasco(npc);
      }
      detener(npc);
      mirarA(npc, { x: animal.location.x, y: animal.location.y + 0.6, z: animal.location.z });
      if (Math.random() < 0.3) {
        burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
        aprender(npc, s, 0.1);
      }
      s.ocupadoHasta = now() + rand(20, 40);
      return false;
    }
    // Sin animales: mira las nubes y el horizonte.
    const ang = Math.random() * Math.PI * 2;
    mirarA(npc, { x: npc.location.x + Math.cos(ang) * 10, y: npc.location.y + rand(3, 9), z: npc.location.z + Math.sin(ang) * 10 });
    animate(npc, ANIM.mirarAlrededor);
    s.ocupadoHasta = now() + rand(40, 70);
    return false;
  },
  fin(npc, s) {
    sostener(npc, pico(s));
  },
};

// --- Craftear (mejora pico y armadura con lo minado) ------------------------------

const EXTRAS = ["minecraft:torch", "minecraft:bread", "minecraft:arrow", "minecraft:bow", "minecraft:ladder",
  "minecraft:compass", "minecraft:lantern", "minecraft:bucket", "minecraft:shield", "minecraft:fishing_rod",
  "minecraft:book", "minecraft:clock", "minecraft:map"];

export const craftear = {
  nombre: "crafteando",
  puede: () => MODIFICA_MUNDO,
  duracion: () => 500,
  iniciar(npc, s, a) {
    return simularCrafteo(npc, s, () => {
      if (s.minados >= CRAFTEO.picoCuesta && s.nivelPico < PICOS.length - 1) {
        s.minados -= CRAFTEO.picoCuesta;
        s.nivelPico++;
        return pico(s);
      }
      if (s.minados >= CRAFTEO.armaduraCuesta && s.nivelArmadura < 4) {
        s.minados -= CRAFTEO.armaduraCuesta;
        s.nivelArmadura++;
        vestir(npc, s.nivelArmadura);
        return "minecraft:anvil";
      }
      return EXTRAS[rand(0, EXTRAS.length - 1)];
    }, Math.round(CRAFTEO.duracion * (s.pers?.ritmo ?? 1)), () => {
      a.listo = true;
      sostener(npc, pico(s));
    });
  },
  tick: (npc, s, a) => !!a.listo,
};

// --- Pescar ----------------------------------------------------------------------

// Punto seco en la orilla, entre el agua y el Claude.
function orillaHacia(dimension, agua, desde) {
  const d = flat(agua, desde);
  for (let k = 1; k <= 8; k++) {
    const top = superficie(dimension, agua.x + d.x * k, agua.z + d.z * k);
    if (top && !esAgua(top) && !top.isLiquid) return punto(top);
  }
  return undefined;
}

const PECES = [{ id: "minecraft:cod", p: 60 }, { id: "minecraft:salmon", p: 25 }, { id: "minecraft:tropical_fish", p: 6 },
  { id: "minecraft:pufferfish", p: 4 }, { id: "minecraft:stick", p: 2 }, { id: "minecraft:leather", p: 2 },
  { id: "minecraft:name_tag", p: 1 }];

export const pescar = {
  nombre: "pescando",
  puede: () => true,
  duracion: () => rand(800, 1400),
  iniciar(npc, s, a) {
    a.agua = buscarAgua(npc.dimension, npc.location, 2, 16);
    if (!a.agua) return false;
    a.orilla = orillaHacia(npc.dimension, a.agua, npc.location);
    if (!a.orilla) return false;
    a.fase = "ir";
    a.peces = 0;
    a.meta = rand(2, 4);
    caminarA(npc, a.orilla, s.pers?.paso ?? 0.2);
    return true;
  },
  tick(npc, s, a) {
    if (caminando(npc)) return false;
    switch (a.fase) {
      case "ir":
        if (distancia2D(npc.location, a.orilla) > 2) {
          a.intentos = (a.intentos ?? 0) + 1;
          if (a.intentos > 5 || seAtasco(npc)) return true;
          caminarA(npc, a.orilla, s.pers?.paso ?? 0.2);
          return false;
        }
        a.fase = "lanzar";
        return false;
      case "lanzar":
        detener(npc);
        sostener(npc, "minecraft:fishing_rod");
        mirarA(npc, a.agua);
        animate(npc, ANIM.pescar);
        sound(npc, "random.bow", 0.7, 0.5);
        system.runTimeout(() => {
          particleAt(npc.dimension, PARTICLES.remo, a.agua);
          sound(npc, "random.splash", 1.6, 0.3);
        }, 10);
        a.pique = now() + rand(80, 260);
        a.animado = now();
        a.fase = "esperar";
        s.ocupadoHasta = now() + 14;
        return false;
      case "esperar":
        if (now() < a.pique) {
          if (now() - a.animado > 100) {
            a.animado = now();
            animate(npc, ANIM.pescarEspera); // sigue con la caña al frente
          }
          if (Math.random() < 0.35) particleAt(npc.dimension, PARTICLES.remo, a.agua);
          s.ocupadoHasta = now() + 20;
          return false;
        }
        // ¡Pica! Tira de la caña.
        for (let k = 0; k < 3; k++) particleAt(npc.dimension, PARTICLES.remo, a.agua);
        sound(npc, "random.splash", 1.2, 0.6);
        animate(npc, ANIM.recoger);
        a.fase = "sacar";
        s.ocupadoHasta = now() + 12;
        return false;
      case "sacar": {
        const pez = sortear(PECES).id;
        sostener(npc, pez);
        sound(npc, "random.pop", 1.1);
        burst(npc, PARTICLES.cambio, { x: 0, y: 1.6, z: 0 });
        aprender(npc, s, 0.15);
        a.peces++;
        a.fase = a.peces >= a.meta ? "fin" : "lanzar";
        s.ocupadoHasta = now() + 40;
        return false;
      }
      default:
        return true;
    }
  },
  fin(npc, s) {
    sostener(npc, pico(s));
  },
};

// --- Granja (3x3 con agua en el centro y trigo) ---------------------------------

const PROP_GRANJA = "claudenpc:granja";

function cargarGranja(npc) {
  try {
    const raw = npc.getDynamicProperty(PROP_GRANJA);
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function guardarGranja(npc, g) {
  try {
    npc.setDynamicProperty(PROP_GRANJA, JSON.stringify(g));
  } catch {
    // No se pudo guardar.
  }
}

function sitioGranja(npc, s) {
  const base = s.hogar ?? npc.location;
  for (let k = 0; k < 14; k++) {
    const ang = Math.random() * Math.PI * 2;
    const r = s.hogar ? rand(7, 11) : rand(2, 8);
    const cx = Math.floor(base.x + Math.cos(ang) * r);
    const cz = Math.floor(base.z + Math.sin(ang) * r);
    if (ocupado(cx, cz, 2)) continue;
    let y;
    let bien = true;
    for (let i = -1; i <= 1 && bien; i++) {
      for (let j = -1; j <= 1 && bien; j++) {
        const top = superficie(npc.dimension, cx + i, cz + j);
        const ok = top && /grass_block|dirt/.test(top.typeId);
        if (!ok || (y !== undefined && top.location.y !== y)) bien = false;
        else y = top.location.y;
      }
    }
    if (bien && y !== undefined) return { x: cx, y, z: cz };
  }
  return undefined;
}

export const granja = {
  nombre: "cultivando",
  puede: () => MODIFICA_MUNDO,
  duracion: () => 1400,
  iniciar(npc, s, a) {
    s.granja ??= cargarGranja(npc);
    if (!s.granja) {
      const c = sitioGranja(npc, s);
      if (!c) return false;
      s.granja = { ...c, hecha: false };
      guardarGranja(npc, s.granja);
    }
    const g = s.granja;
    a.cola = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) a.cola.push({ x: g.x + i, y: g.y, z: g.z + j, centro: !i && !j });
    a.cola.sort(() => Math.random() - 0.5);
    a.cola.sort((p, q) => Number(q.centro) - Number(p.centro)); // primero el agua
    caminarA(npc, { x: g.x + 0.5, y: g.y + 1, z: g.z + 2.5 }, s.pers?.paso ?? 0.2);
    return true;
  },
  tick(npc, s, a) {
    if (caminando(npc)) return false;
    const g = s.granja;
    const p = a.cola.shift();
    if (!p) {
      g.hecha = true;
      guardarGranja(npc, g);
      return true;
    }
    if (Math.hypot(npc.location.x - (p.x + 0.5), npc.location.z - (p.z + 0.5)) > 4) {
      caminarA(npc, { x: p.x + 0.5, y: p.y + 1, z: p.z + 1.8 }, s.pers?.paso ?? 0.2);
      a.cola.unshift(p);
      a.intentos = (a.intentos ?? 0) + 1;
      return a.intentos > 8;
    }
    const suelo = blockAt(npc.dimension, p);
    const arriba = blockAt(npc.dimension, { x: p.x, y: p.y + 1, z: p.z });
    if (!suelo) return false;
    mirarA(npc, { x: p.x + 0.5, y: p.y + 1, z: p.z + 0.5 });
    if (p.centro) {
      if (suelo.typeId !== "minecraft:water") {
        sostener(npc, "minecraft:water_bucket");
        animate(npc, ANIM.colocarAbajo);
        colocar(npc.dimension, p, "minecraft:water", true);
        sound(npc, "bucket.empty_water", 1);
        system.runTimeout(() => npc.isValid && sostener(npc, "minecraft:bucket"), 8);
      }
      s.ocupadoHasta = now() + 16;
      return false;
    }
    // Arar.
    if (/grass_block|dirt/.test(suelo.typeId) && reemplazable(arriba)) {
      sostener(npc, "minecraft:stone_hoe");
      animate(npc, ANIM.colocarAbajo);
      if (arriba && !arriba.isAir) colocar(npc.dimension, arriba.location, "minecraft:air", true);
      colocar(npc.dimension, p, perm("minecraft:farmland", { moisturized_amount: 7 }), true);
      sound(npc, "dig.grass", 1);
      a.cola.push(p); // luego vuelve a sembrar
      s.ocupadoHasta = now() + rand(8, 12);
      return false;
    }
    if (suelo.typeId !== "minecraft:farmland") return false;
    if (arriba?.typeId === "minecraft:wheat") {
      const crecimiento = arriba.permutation.getState("growth") ?? 0;
      if (crecimiento >= 7) {
        // Cosecha y vuelve a sembrar.
        sostener(npc, "minecraft:air");
        animate(npc, ANIM.golpe);
        romperDestruyendo(npc.dimension, arriba.location);
        aprender(npc, s, 0.2);
        system.runTimeout(() => {
          if (!npc.isValid) return;
          sostener(npc, "minecraft:wheat_seeds");
          colocar(npc.dimension, { x: p.x, y: p.y + 1, z: p.z }, perm("minecraft:wheat", { growth: 0 }));
          sound(npc, "dig.grass", 1.2);
        }, 10);
        s.ocupadoHasta = now() + 20;
        return false;
      }
      if (s.pers?.id === "granjero" && Math.random() < 0.5) {
        // Polvo de hueso: el trigo crece un poco.
        sostener(npc, "minecraft:bone_meal");
        animate(npc, ANIM.colocarAbajo);
        try {
          arriba.setPermutation(arriba.permutation.withState("growth", Math.min(7, crecimiento + rand(1, 3))));
        } catch {
          // Sin cambio.
        }
        particleAt(npc.dimension, "minecraft:crop_growth_emitter", { x: p.x + 0.5, y: p.y + 1.3, z: p.z + 0.5 });
        sound(npc, "item.bone_meal.use", 1);
        s.ocupadoHasta = now() + 14;
      }
      return false;
    }
    if (reemplazable(arriba)) {
      sostener(npc, "minecraft:wheat_seeds");
      animate(npc, ANIM.colocarAbajo);
      colocar(npc.dimension, { x: p.x, y: p.y + 1, z: p.z }, perm("minecraft:wheat", { growth: 0 }));
      sound(npc, "dig.grass", 1.2);
      s.ocupadoHasta = now() + rand(6, 10);
    }
    return false;
  },
  fin(npc, s) {
    sostener(npc, pico(s));
  },
};

// --- Decorar (farol, flores o un banco cerca de su casa) ------------------------

const FLORES = ["minecraft:poppy", "minecraft:dandelion", "minecraft:cornflower", "minecraft:oxeye_daisy",
  "minecraft:azure_bluet", "minecraft:allium"];

function planDecoracion(npc, s) {
  const base = s.hogar ?? npc.location;
  const tipo = sortear([{ t: "farol", p: 2 }, { t: "flores", p: 3 }, { t: "banco", p: 1.5 }]).t;
  for (let k = 0; k < 10; k++) {
    const ang = Math.random() * Math.PI * 2;
    const r = rand(5, 9);
    const top = superficie(npc.dimension, base.x + Math.cos(ang) * r, base.z + Math.sin(ang) * r);
    if (!top || !/grass_block|dirt/.test(top.typeId)) continue;
    const p = { x: top.location.x, y: top.location.y + 1, z: top.location.z };
    if (!reemplazable(blockAt(npc.dimension, p)) || ocupado(p.x, p.z, 0)) continue;
    if (tipo === "farol") {
      return [{ pos: p, bloque: "minecraft:oak_fence" }, { pos: { ...p, y: p.y + 1 }, bloque: "minecraft:oak_fence" },
        { pos: { ...p, y: p.y + 2 }, bloque: perm("minecraft:lantern", { hanging: false }) }];
    }
    if (tipo === "banco") {
      // Dos escalones que miran hacia la casa.
      const dx = base.x - p.x;
      const dz = base.z - p.z;
      const dir = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 0) : (dz > 0 ? 3 : 2); // respaldo opuesto a la casa
      const lado = Math.abs(dx) > Math.abs(dz) ? { x: 0, z: 1 } : { x: 1, z: 0 };
      const escalon = perm("minecraft:oak_stairs", { weirdo_direction: dir, upside_down_bit: false });
      return [{ pos: p, bloque: escalon }, { pos: { x: p.x + lado.x, y: p.y, z: p.z + lado.z }, bloque: escalon }];
    }
    const lista = [];
    for (let n = 0; n < rand(3, 6); n++) {
      const q = { x: p.x + rand(-2, 2), z: p.z + rand(-2, 2) };
      const t2 = superficie(npc.dimension, q.x, q.z);
      if (t2 && /grass_block/.test(t2.typeId)) lista.push({ pos: { x: q.x, y: t2.location.y + 1, z: q.z }, bloque: FLORES[rand(0, FLORES.length - 1)] });
    }
    if (lista.length) return lista;
  }
  return [];
}

export const decorar = {
  nombre: "decorando",
  puede: () => MODIFICA_MUNDO,
  duracion: () => 900,
  iniciar(npc, s, a) {
    a.cola = planDecoracion(npc, s);
    return a.cola.length > 0;
  },
  tick(npc, s, a) {
    if (caminando(npc)) return false;
    const p = a.cola[0];
    if (!p) return true;
    if (Math.hypot(npc.location.x - (p.pos.x + 0.5), npc.location.y + 1.6 - (p.pos.y + 0.5), npc.location.z - (p.pos.z + 0.5)) > 4.2) {
      const f = flat(p.pos, npc.location);
      caminarA(npc, { x: p.pos.x + 0.5 + f.x * 1.6, y: p.pos.y, z: p.pos.z + 0.5 + f.z * 1.6 }, s.pers?.paso ?? 0.2);
      a.intentos = (a.intentos ?? 0) + 1;
      if (a.intentos > 6) a.cola.shift();
      return false;
    }
    const id = typeof p.bloque === "string" ? p.bloque : p.bloque.type.id;
    sostener(npc, id === "minecraft:oak_fence" ? "minecraft:oak_fence" : id);
    mirarA(npc, { x: p.pos.x + 0.5, y: p.pos.y + 0.5, z: p.pos.z + 0.5 });
    animate(npc, p.pos.y < npc.location.y + 0.5 ? ANIM.colocarAbajo : ANIM.colocar);
    if (colocar(npc.dimension, p.pos, p.bloque)) sound(npc, /fence|stairs/.test(id) ? "use.wood" : "use.grass", 1);
    a.cola.shift();
    s.ocupadoHasta = now() + rand(6, 12);
    if (!a.cola.length) {
      aprender(npc, s, 0.3);
      burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
    }
    return false;
  },
  fin(npc, s) {
    sostener(npc, pico(s));
  },
};

// --- Paseo en bote ----------------------------------------------------------------

export const paseoBote = {
  nombre: "paseando en bote",
  puede: () => MODIFICA_MUNDO,
  duracion: () => 2400,
  iniciar(npc, s, a) {
    a.agua = buscarAgua(npc.dimension, npc.location, 3, 16);
    if (!a.agua) return false;
    caminarA(npc, a.agua, s.pers?.paso ?? 0.2);
    return true;
  },
  tick(npc, s, a) {
    if (s.bote) return false;
    if (a.subio) return true; // ya volvió a tierra
    if (caminando(npc)) return false;
    if (distancia2D(npc.location, a.agua) > 1.8) {
      a.intentos = (a.intentos ?? 0) + 1;
      if (a.intentos > 6 || seAtasco(npc)) return true;
      caminarA(npc, a.agua, s.pers?.paso ?? 0.2);
      return false;
    }
    const lejos = buscarAgua(npc.dimension, a.agua, 10, 26) ?? a.agua;
    a.subio = true;
    return !subirABote(npc, s, lejos, true);
  },
};
