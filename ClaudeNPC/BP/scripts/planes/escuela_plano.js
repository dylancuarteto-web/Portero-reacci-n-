// Plano de la escuela de los Claudes (sin dependencias del juego: "perm(id, estados)"
// crea una permutación de bloque). Así se puede revisar fuera de Minecraft.
//
// Cuando se juntan maestros, cada uno construye su aula al lado de la primera (sobre
// el eje "b" del aula principal, cada 11 bloques) y el último en llegar construye
// la fachada que las une:
//   2 maestros: ESCUELA (o PREPARATORIA si uno es un genio): pórtico blanco con
//               columnas de cuarzo, techo de losa, plaza y gran letrero con los profes.
//   3 maestros: UNIVERSIDAD DE LOS CLAUDES: pórtico a lo largo de las tres aulas,
//               plaza más grande con bancas y un campanario de 12 bloques con campana.

const FRENTES = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };
const FACING = { north: 2, south: 3, west: 4, east: 5 };
const ESCALON = { east: 0, west: 1, south: 2, north: 3 };
const OPUESTO = { north: "south", south: "north", west: "east", east: "west" };

export const SEPARACION = 11;
export const LUGARES = [0, SEPARACION, -SEPARACION]; // "b" del aula principal, la segunda y la tercera

// Centro del aula número k del complejo (k = 0 es la principal).
export function centroAula(c, frente, k) {
  const f = FRENTES[frente];
  const b = LUGARES[k] ?? 0;
  return { x: c.x - f.z * b, y: c.y, z: c.z + f.x * b };
}

// Lados del aula k que tienen vecina (para no limpiar ni poner alero encima de ella).
export function ladosAula(k, total) {
  const usados = LUGARES.slice(0, total);
  const b = LUGARES[k];
  return { izq: usados.includes(b - SEPARACION), der: usados.includes(b + SEPARACION) };
}

export function nombreEscuela(total, hayGenio) {
  if (total >= 3) return "UNIVERSIDAD";
  return hayGenio ? "PREPARATORIA" : "ESCUELA";
}

// profes: [{ nombre, materia }] en el orden de las aulas. plaza: false si delante hay
// otra obra (una casa): entonces solo hace el pórtico y el letrero.
export function planEscuela(c, frente, perm, total, profes = [], plaza = true) {
  const f = FRENTES[frente];
  const P = (a, h, b) => ({ x: c.x + f.x * a - f.z * b, y: c.y + h, z: c.z + f.z * a + f.x * b });
  const pasos = [];
  const add = (p) => pasos.push(p);
  const usados = LUGARES.slice(0, total);
  const bMin = Math.min(...usados) - 5;
  const bMax = Math.max(...usados) + 5;
  const universidad = total >= 3 && plaza;
  const hayGenio = profes.some((p) => p.genio);
  const nombre = nombreEscuela(total, hayGenio);
  const desde = (a, b) => P(a, 1, Math.max(bMin, Math.min(bMax, b)));
  const losa = perm("minecraft:smooth_stone_slab", { "minecraft:vertical_half": "top" });
  const pilar = perm("minecraft:quartz_pillar", { pillar_axis: "y" });
  const columnas = new Set();
  for (const b0 of usados) for (const b of [b0 - 5, b0 - 2, b0 + 2, b0 + 5]) columnas.add(b);

  // 1. Piso del pórtico (andesita pulida con borde de ladrillo) y plaza delante.
  const fondo = !plaza ? 9 : universidad ? 15 : 12;
  for (let a = 7; a <= fondo; a++) {
    const fila = [];
    for (let b = bMin; b <= bMax; b++) fila.push(b);
    if (a % 2) fila.reverse();
    for (const b of fila) {
      const borde = a === 9 || a === fondo || b === bMin || b === bMax;
      const camino = usados.some((b0) => b === b0);
      add({ tipo: "colocar", pos: P(a, 0, b), desde: desde(a + 1, b), forzar: true,
        bloque: a <= 9 ? (borde ? "minecraft:stone_bricks" : "minecraft:polished_andesite")
          : borde ? "minecraft:stone_bricks" : camino ? "minecraft:polished_andesite" : "minecraft:smooth_stone" });
    }
  }
  // Antes, despeja el pórtico y la plaza (sin tocar los faroles ni el cartel de cada aula).
  for (let a = 7; a <= fondo; a++) for (let b = bMin; b <= bMax; b++) for (let h = 1; h <= 4; h++) {
    const farol = a === 8 && usados.some((b0) => Math.abs(b - b0) === 2);
    const cartel = a === 7 && h === 3 && usados.includes(b);
    if (!farol && !cartel) pasos.unshift({ tipo: "quitar", pos: P(a, h, b), desde: desde(Math.min(a + 1, fondo + 1), b) });
  }

  // 2. Columnas de cuarzo en el borde del pórtico.
  for (const b of [...columnas].sort((x, y) => x - y)) {
    for (let h = 1; h <= 3; h++) add({ tipo: "colocar", pos: P(9, h, b), desde: desde(10, b), bloque: pilar });
  }

  // 3. Techo de losa del pórtico, de un extremo al otro.
  for (let b = bMin - 1; b <= bMax + 1; b++) {
    for (let a = 7; a <= 10; a++) add({ tipo: "colocar", pos: P(a, 4, b), desde: desde(8, b), bloque: losa, techo: true });
  }

  // 4. Gran letrero sobre la entrada principal: nombre arriba, profes abajo.
  for (const h of [5, 6]) for (let b = -1; b <= 1; b++) {
    add({ tipo: "colocar", pos: P(9, h, b), desde: desde(11, b), bloque: "minecraft:dark_oak_planks", techo: true });
  }
  const letrero = perm("minecraft:birch_wall_sign", { facing_direction: FACING[frente] });
  const arriba = [`§l${nombre}`, "§lDE LOS", "§lCLAUDES"];
  arriba.forEach((texto, k) => add({ tipo: "letrero", pos: P(10, 6, k - 1), desde: P(12, 1, k - 1), bloque: letrero, texto, blanco: false }));
  const abajo = [0, 1, 2].map((k) => {
    const p = profes[k];
    return p ? `Prof.\n§l${p.nombre}\n§r§o${p.materia}` : "§oIQ para\ntodos";
  });
  abajo.forEach((texto, k) => add({ tipo: "letrero", pos: P(10, 5, k - 1), desde: P(12, 1, k - 1), bloque: letrero, texto, blanco: false }));

  // 5. Bancas en la plaza (escalones con respaldo hacia las aulas) y macetas.
  const atras = OPUESTO[frente];
  const bT = bMax - 3; // centro del campanario (universidad), en la esquina de la plaza
  const libreDeTorre = (b) => !universidad || Math.abs(b - bT) > 2;
  for (const b0 of plaza ? usados : []) {
    for (const b of [b0 - 4, b0 - 3, b0 + 3, b0 + 4]) {
      if (b <= bMin || b >= bMax || !libreDeTorre(b)) continue;
      add({ tipo: "colocar", pos: P(11, 1, b), desde: P(12, 1, b0), bloque: perm("minecraft:oak_stairs",
        { weirdo_direction: ESCALON[atras], upside_down_bit: false }) });
    }
    for (const b of [b0 - 5, b0 + 5]) {
      if (b > bMin && b < bMax && libreDeTorre(b)) add({ tipo: "colocar", pos: P(11, 1, b), desde: P(12, 1, b0), bloque: "minecraft:flower_pot" });
    }
  }

  // 6. Universidad: campanario en una esquina de la plaza (así no tapa el letrero),
  //    la parte alta desde un andamio de tierra que después quita.
  if (universidad) {
    const T = (a, h, b) => P(13 + a, h, bT + b);
    const muroT = (a, b) => Math.abs(a) === 1 || Math.abs(b) === 1;
    for (let h = 1; h <= 6; h++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      if (!muroT(a, b)) continue;
      const esquina = Math.abs(a) === 1 && Math.abs(b) === 1;
      const ventana = !esquina && (h === 3 || h === 4) && a !== -1;
      add({ tipo: "colocar", pos: T(a, h, b), desde: P(11, 1, bT - 2), forzar: false,
        bloque: ventana ? "minecraft:glass_pane" : esquina ? pilar : "minecraft:stone_bricks" });
    }
    add({ tipo: "ir", pos: P(11, 1, bT) });
    add({ tipo: "andamio", hasta: c.y + 7 });
    for (let h = 7; h <= 11; h++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const esquina = Math.abs(a) === 1 && Math.abs(b) === 1;
      let bloque;
      if (h === 7) bloque = muroT(a, b) ? "minecraft:chiseled_stone_bricks" : "minecraft:stone_bricks";
      else if (h <= 9) bloque = esquina ? pilar : undefined; // campanario abierto
      else if (h === 10) bloque = "minecraft:stone_bricks";
      else bloque = a === 0 && b === 0 ? "minecraft:stone_bricks" : perm("minecraft:stone_brick_slab", { "minecraft:vertical_half": "bottom" });
      if (bloque) add({ tipo: "colocar", pos: T(a, h, b), bloque, techo: true });
    }
    add({ tipo: "colocar", pos: T(0, 9, 0), bloque: perm("minecraft:bell", { attachment: "hanging", direction: 0, toggle_bit: false }), techo: true });
    add({ tipo: "colocar", pos: T(0, 12, 0), bloque: perm("minecraft:lightning_rod", { facing_direction: 1, powered_bit: false }), techo: true });
    add({ tipo: "bajar", veces: 7 });
  }

  add({ tipo: "celebrar", pos: P(fondo, 1, 2), mira: P(4, 4, 0) });
  return { pasos, nombre: nombreEscuela(total, hayGenio) };
}
