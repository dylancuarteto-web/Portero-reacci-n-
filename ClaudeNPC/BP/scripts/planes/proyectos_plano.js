// Obras especiales que cada Claude construye cerca de su casa a medida que sube su
// habilidad de Construcción (sin dependencias del juego: "perm(id, estados)" crea una
// permutación). Nivel 2: jardín · 3: torre vigía · 4: estatua de Claude · 5: fuente.
// "c" es el bloque del suelo en el centro; "frente" hacia dónde mira la obra.

const FRENTES = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };
const FACING = { north: 2, south: 3, west: 4, east: 5 };

export const PROYECTOS = {
  jardin: { nivel: 2, nombre: "un jardín", radio: 4 },
  torre: { nivel: 3, nombre: "una torre vigía", radio: 4 },
  estatua: { nivel: 4, nombre: "una estatua de Claude", radio: 3 },
  fuente: { nivel: 5, nombre: "una fuente", radio: 4 },
};

function base(c, frente) {
  const f = FRENTES[frente];
  // a: hacia el frente; b: a la derecha.
  const P = (a, h, b) => ({ x: c.x + f.x * a - f.z * b, y: c.y + h, z: c.z + f.z * a + f.x * b });
  const pasos = [];
  const add = (p) => pasos.push(p);
  const limpiar = (r, alto) => {
    for (let h = alto; h >= 1; h--) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) add({ tipo: "quitar", pos: P(a, h, b) });
  };
  return { P, pasos, add, limpiar };
}

const FLORES = ["minecraft:poppy", "minecraft:dandelion", "minecraft:cornflower", "minecraft:allium", "minecraft:oxeye_daisy",
  "minecraft:azure_bluet", "minecraft:lily_of_the_valley", "minecraft:blue_orchid"];

// Jardín 7x7: cerca con portón, caminos en cruz, flores de colores, azalea en el
// centro y faroles en las esquinas.
export function planJardin(c, frente, perm) {
  const { P, pasos, add, limpiar } = base(c, frente);
  limpiar(3, 3);
  let k = 0;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const camino = (a === 0 || b === 0) && !(a === 0 && b === 0);
    if (camino) {
      add({ tipo: "colocar", pos: P(a, 0, b), bloque: "minecraft:grass_block", forzar: true });
      add({ tipo: "camino", pos: P(a, 0, b) });
    } else {
      add({ tipo: "colocar", pos: P(a, 0, b), bloque: "minecraft:grass_block", forzar: true });
      add({ tipo: "colocar", pos: P(a, 1, b), bloque: a === 0 && b === 0 ? "minecraft:flowering_azalea" : FLORES[k++ % FLORES.length] });
    }
  }
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    if (Math.max(Math.abs(a), Math.abs(b)) !== 3) continue;
    if (a === 3 && b === 0) {
      add({ tipo: "colocar", pos: P(a, 1, b), bloque: perm("minecraft:fence_gate", { "minecraft:cardinal_direction": frente, open_bit: false, in_wall_bit: false }) });
      continue;
    }
    add({ tipo: "colocar", pos: P(a, 1, b), bloque: "minecraft:oak_fence" });
    if (Math.abs(a) === 3 && Math.abs(b) === 3) add({ tipo: "colocar", pos: P(a, 2, b), bloque: perm("minecraft:lantern", { hanging: false }) });
  }
  add({ tipo: "camino", pos: P(3, 0, 0) });
  add({ tipo: "camino", pos: P(4, 0, 0) });
  add({ tipo: "celebrar", pos: P(5, 1, 0), mira: P(0, 1, 0) });
  return pasos;
}

// Torre vigía: torre de piedra con esquinas de tronco, mirador de 5x5 con baranda,
// farol arriba y escalera de mano por fuera.
export function planTorre(c, frente, perm) {
  const { P, pasos, add, limpiar } = base(c, frente);
  limpiar(3, 10);
  const tronco = perm("minecraft:spruce_log", { pillar_axis: "y" });
  const muro = (a, b, h) => (Math.abs(a) === 1 && Math.abs(b) === 1 ? tronco : h % 3 === 0 && (a === 0 || b === 0) ? "minecraft:mossy_stone_bricks" : "minecraft:stone_bricks");
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) add({ tipo: "colocar", pos: P(a, 0, b), bloque: "minecraft:cobblestone", forzar: true });
  for (let h = 1; h <= 5; h++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    add({ tipo: "colocar", pos: P(a, h, b), desde: P(3, 1, 0), bloque: muro(a, b, h) });
  }
  // La parte alta, desde un andamio de tierra al lado (después lo quita).
  add({ tipo: "ir", pos: P(3, 1, 1) });
  add({ tipo: "andamio", hasta: c.y + 7 });
  for (let h = 6; h <= 7; h++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) add({ tipo: "colocar", pos: P(a, h, b), bloque: muro(a, b, h), techo: true });
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    if (a === 2 && b === 0) continue; // hueco de la escalera
    add({ tipo: "colocar", pos: P(a, 8, b), bloque: "minecraft:spruce_planks", techo: true });
  }
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    if (Math.max(Math.abs(a), Math.abs(b)) === 2 && !(a === 2 && b === 0)) add({ tipo: "colocar", pos: P(a, 9, b), bloque: "minecraft:spruce_fence", techo: true });
  }
  add({ tipo: "colocar", pos: P(0, 9, 0), bloque: perm("minecraft:lantern", { hanging: false }), techo: true });
  add({ tipo: "bajar", veces: 8 });
  // Escalera por fuera, del suelo al mirador.
  for (let h = 1; h <= 8; h++) add({ tipo: "colocar", pos: P(2, h, 0), desde: P(3, 1, 1), bloque: perm("minecraft:ladder", { facing_direction: FACING[frente] }) });
  add({ tipo: "celebrar", pos: P(4, 1, 2), mira: P(0, 8, 0) });
  return pasos;
}

// Estatua de Claude sobre un pedestal: piernas, cuerpo con su emblema, brazos y una
// cabeza grande con los dos ojos. Cobre encerado (no se oxida) del color de Claude.
export function planEstatua(c, frente, perm, placa = "Claude") {
  const { P, pasos, add, limpiar } = base(c, frente);
  limpiar(2, 9);
  const cobre = "minecraft:waxed_copper";
  for (let a = -1; a <= 1; a++) for (let b = -2; b <= 2; b++) {
    add({ tipo: "colocar", pos: P(a, 0, b), bloque: "minecraft:stone_bricks", forzar: true });
    add({ tipo: "colocar", pos: P(a, 1, b), desde: P(3, 1, b), bloque: Math.abs(b) === 2 && Math.abs(a) === 1 ? "minecraft:chiseled_stone_bricks" : "minecraft:stone_bricks" });
  }
  for (const b of [-1, 1]) for (const h of [2, 3]) add({ tipo: "colocar", pos: P(0, h, b), desde: P(3, 1, b), bloque: cobre });
  for (const h of [4, 5]) for (let b = -1; b <= 1; b++) {
    const emblema = h === 5 && b === 0;
    add({ tipo: "colocar", pos: P(0, h, b), desde: P(3, 1, b), bloque: emblema ? "minecraft:smooth_quartz" : cobre });
  }
  for (const b of [-2, 2]) for (const h of [4, 5]) add({ tipo: "colocar", pos: P(0, h, b), desde: P(3, 1, b), bloque: cobre });
  add({ tipo: "ir", pos: P(3, 1, 0) });
  add({ tipo: "andamio", hasta: c.y + 4 });
  for (let h = 6; h <= 8; h++) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const ojo = h === 7 && a === 1 && b !== 0;
    add({ tipo: "colocar", pos: P(a, h, b), bloque: ojo ? "minecraft:black_concrete" : cobre, techo: true });
  }
  add({ tipo: "bajar", veces: 4 });
  add({ tipo: "letrero", pos: P(2, 1, 0), desde: P(4, 1, 0), bloque: perm("minecraft:spruce_wall_sign", { facing_direction: FACING[frente] }),
    texto: `§l${placa}§r\n\nhecha por\nun Claude`, blanco: false });
  add({ tipo: "celebrar", pos: P(5, 1, 1), mira: P(0, 6, 0) });
  return pasos;
}

// Fuente: plaza de piedra, pileta con agua, columna central con un chorro que cae y
// faroles en las esquinas.
export function planFuente(c, frente, perm) {
  const { P, pasos, add, limpiar } = base(c, frente);
  limpiar(3, 4);
  for (let a = -3; a <= 3; a++) for (let b = -3; b <= 3; b++) {
    const borde = Math.max(Math.abs(a), Math.abs(b)) === 3;
    add({ tipo: "colocar", pos: P(a, 0, b), bloque: borde ? "minecraft:stone_bricks" : "minecraft:smooth_stone", forzar: true });
  }
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    if (Math.max(Math.abs(a), Math.abs(b)) === 2) add({ tipo: "colocar", pos: P(a, 1, b), desde: P(4, 1, b), bloque: "minecraft:stone_bricks" });
  }
  for (const h of [1, 2]) add({ tipo: "colocar", pos: P(0, h, 0), desde: P(3, 1, 0), bloque: "minecraft:chiseled_stone_bricks" });
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (a !== 0 || b !== 0) add({ tipo: "colocar", pos: P(a, 1, b), desde: P(3, 1, b), bloque: "minecraft:water" });
  }
  add({ tipo: "colocar", pos: P(0, 3, 0), desde: P(3, 1, 0), bloque: "minecraft:water" });
  for (const a of [-2, 2]) for (const b of [-2, 2]) add({ tipo: "colocar", pos: P(a, 2, b), desde: P(4, 1, b), bloque: perm("minecraft:lantern", { hanging: false }) });
  add({ tipo: "celebrar", pos: P(5, 1, 0), mira: P(0, 2, 0) });
  return pasos;
}

export const PLANES = { jardin: planJardin, torre: planTorre, estatua: planEstatua, fuente: planFuente };
