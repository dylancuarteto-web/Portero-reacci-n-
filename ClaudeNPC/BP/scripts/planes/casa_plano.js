// Plano de la casa de un Claude (sin dependencias del juego: "perm(id, estados)" crea
// una permutación de bloque). Así se puede revisar el plano fuera de Minecraft.
//
// Orden como lo haría un jugador: limpiar, cimiento y piso en zigzag, esquinas de
// tronco, paredes por hileras, puerta, ventanas, vigas, techo desde un andamio con
// alero y chimenea, farol, muebles, salir cerrando la puerta, camino y antorchas.

export const PALETAS = {
  roble: { piso: "minecraft:oak_planks", borde: "minecraft:cobblestone", esquina: "minecraft:oak_log",
    pared: "minecraft:oak_planks", viga: "minecraft:stripped_oak_log", techo: "minecraft:spruce_planks",
    alero: "minecraft:spruce_slab", chimenea: "minecraft:cobblestone", alfombra: "minecraft:red_carpet" },
  abeto: { piso: "minecraft:spruce_planks", borde: "minecraft:stone_bricks", esquina: "minecraft:spruce_log",
    pared: "minecraft:spruce_planks", viga: "minecraft:stripped_spruce_log", techo: "minecraft:dark_oak_planks",
    alero: "minecraft:dark_oak_slab", chimenea: "minecraft:stone_bricks", alfombra: "minecraft:green_carpet" },
  abedul: { piso: "minecraft:birch_planks", borde: "minecraft:cobblestone", esquina: "minecraft:birch_log",
    pared: "minecraft:birch_planks", viga: "minecraft:stripped_birch_log", techo: "minecraft:oak_planks",
    alero: "minecraft:oak_slab", chimenea: "minecraft:cobblestone", alfombra: "minecraft:yellow_carpet" },
  piedra: { piso: "minecraft:spruce_planks", borde: "minecraft:cobblestone", esquina: "minecraft:oak_log",
    pared: "minecraft:stone_bricks", viga: "minecraft:stripped_oak_log", techo: "minecraft:dark_oak_planks",
    alero: "minecraft:dark_oak_slab", chimenea: "minecraft:cobblestone", alfombra: "minecraft:blue_carpet" },
  ladrillo: { piso: "minecraft:oak_planks", borde: "minecraft:stone_bricks", esquina: "minecraft:spruce_log",
    pared: "minecraft:brick_block", viga: "minecraft:stripped_spruce_log", techo: "minecraft:spruce_planks",
    alero: "minecraft:spruce_slab", chimenea: "minecraft:brick_block", alfombra: "minecraft:light_blue_carpet" },
};

const FRENTES = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };

export function planCasa(c, frente, paletaId, perm) {
  const pal = PALETAS[paletaId] ?? PALETAS.roble;
  const f = FRENTES[frente];
  const der = { x: -f.z, z: f.x };
  const P = (i, h, j) => ({ x: c.x + i, y: c.y + h, z: c.z + j });
  const L = (a, b) => ({ i: f.x * a + der.x * b, j: f.z * a + der.z * b }); // a: hacia el frente, b: a la derecha
  const perimetro = (i, j) => Math.max(Math.abs(i), Math.abs(j)) === 3;
  const esquina = (i, j) => Math.abs(i) === 3 && Math.abs(j) === 3;
  const frontal = (i, j) => i * f.x + j * f.z === 3;
  const aLoLargo = (i, j) => (Math.abs(i) === 3 ? j : i);
  const puerta = (i, j) => frontal(i, j) && aLoLargo(i, j) === 0;
  const ventana = (i, j) => perimetro(i, j) && !esquina(i, j) && !frontal(i, j) && aLoLargo(i, j) === 0;
  const pasos = [];
  const add = (p) => pasos.push(p);

  // Recorrido del perímetro en orden, como quien camina alrededor de la obra.
  const vuelta = [];
  for (let k = -3; k <= 3; k++) vuelta.push([k, -3]);
  for (let k = -2; k <= 3; k++) vuelta.push([3, k]);
  for (let k = 2; k >= -3; k--) vuelta.push([k, 3]);
  for (let k = 2; k >= -2; k--) vuelta.push([-3, k]);

  for (let h = 5; h >= 1; h--) for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) add({ tipo: "quitar", pos: P(i, h, j) });
  for (let j = -3; j <= 3; j++) {
    const fila = [];
    for (let i = -3; i <= 3; i++) fila.push(i);
    if (j % 2) fila.reverse(); // en zigzag, como quien avanza fila por fila
    for (const i of fila) {
      add({ tipo: "rellenar", pos: P(i, -1, j), bloque: "minecraft:cobblestone" });
      add({ tipo: "colocar", pos: P(i, 0, j), bloque: perimetro(i, j) ? pal.borde : pal.piso, forzar: true });
    }
  }
  for (const [i, j] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) {
    for (let h = 1; h <= 4; h++) add({ tipo: "colocar", pos: P(i, h, j), bloque: perm(pal.esquina, { pillar_axis: "y" }) });
  }
  for (let h = 1; h <= 3; h++) {
    for (const [i, j] of vuelta) {
      if (esquina(i, j) || (puerta(i, j) && h <= 2) || (ventana(i, j) && h >= 2)) continue;
      add({ tipo: "colocar", pos: P(i, h, j), bloque: pal.pared });
    }
  }
  const d = L(3, 0);
  add({ tipo: "colocar", pos: P(d.i, 1, d.j), bloque: perm("minecraft:wooden_door", {
    "minecraft:cardinal_direction": frente, upper_block_bit: false, open_bit: false, door_hinge_bit: false }) });
  add({ tipo: "colocar", pos: P(d.i, 2, d.j), bloque: perm("minecraft:wooden_door", {
    "minecraft:cardinal_direction": frente, upper_block_bit: true, open_bit: false, door_hinge_bit: false }) });
  for (const [i, j] of vuelta) {
    if (ventana(i, j)) for (const h of [2, 3]) add({ tipo: "colocar", pos: P(i, h, j), bloque: "minecraft:glass_pane" });
  }
  for (const [i, j] of vuelta) {
    if (esquina(i, j)) continue;
    add({ tipo: "colocar", pos: P(i, 4, j), bloque: perm(pal.viga, { pillar_axis: Math.abs(j) === 3 ? "x" : "z" }) });
  }
  // Techo desde un andamio en el centro.
  add({ tipo: "ir", pos: P(0, 1, 0) });
  add({ tipo: "andamio", hasta: c.y + 4 });
  for (let r = 1; r <= 3; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) === r) add({ tipo: "colocar", pos: P(i, 5, j), bloque: pal.techo, techo: true });
    }
  }
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    if (Math.max(Math.abs(i), Math.abs(j)) === 4) {
      add({ tipo: "colocar", pos: P(i, 5, j), bloque: perm(pal.alero, { "minecraft:vertical_half": "bottom" }), techo: true });
    }
  }
  const ch = L(-3, 3);
  add({ tipo: "colocar", pos: P(ch.i, 6, ch.j), bloque: pal.chimenea, techo: true });
  add({ tipo: "colocar", pos: P(ch.i, 7, ch.j), bloque: "minecraft:campfire", techo: true });
  add({ tipo: "bajar", veces: 3 });
  add({ tipo: "colocar", pos: P(0, 5, 0), bloque: pal.techo });
  add({ tipo: "colocar", pos: P(0, 4, 0), bloque: perm("minecraft:lantern", { hanging: true }) });
  // Muebles contra la pared del fondo y una alfombra.
  const muebles = [{ p: L(-2, -2), b: "minecraft:crafting_table" },
    { p: L(-2, -1), b: perm("minecraft:furnace", { "minecraft:cardinal_direction": frente }) },
    { p: L(-2, 2), b: perm("minecraft:chest", { "minecraft:cardinal_direction": frente }) },
    { p: L(-2, 1), b: "minecraft:bookshelf" },
    { p: L(0, 0), b: pal.alfombra }, { p: L(1, 0), b: pal.alfombra }, { p: L(-1, 0), b: pal.alfombra }];
  for (const { p, b } of muebles) add({ tipo: "colocar", pos: P(p.i, 1, p.j), bloque: b });
  // Sale cerrando la puerta, hace un camino y pone antorchas.
  add({ tipo: "puerta", pos: P(d.i, 1, d.j), abrir: true });
  const fuera = L(5, 0);
  add({ tipo: "ir", pos: P(fuera.i, 1, fuera.j) });
  add({ tipo: "puerta", pos: P(d.i, 1, d.j), abrir: false });
  for (const a of [4, 5, 6]) {
    const p = L(a, 0);
    add({ tipo: "camino", pos: P(p.i, 0, p.j) });
  }
  for (const b of [-1, 1]) {
    const p = L(4, b);
    add({ tipo: "colocar", pos: P(p.i, 1, p.j), bloque: perm("minecraft:torch", { torch_facing_direction: "top" }) });
  }
  const mirador = L(7, 0);
  add({ tipo: "celebrar", pos: P(mirador.i, 1, mirador.j), mira: P(0, 3, 0) });
  return pasos;
}
