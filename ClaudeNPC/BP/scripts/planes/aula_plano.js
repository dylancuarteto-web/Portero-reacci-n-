// Plano del aula de Claude Maestro (sin dependencias del juego: "perm(id, estados)"
// crea una permutación de bloque). Así se puede revisar fuera de Minecraft.
//
// Ejes: "a" va de la pizarra (a = -6) a la puerta (a = +6); "b" de izquierda a
// derecha mirando hacia la puerta. "frente" es hacia donde da la puerta.
// Interior: a -5..5, b -4..4. Techo plano a 5 bloques con luces. El terreno se
// aplana antes con obras/terreno.js (por eso el plano ya no trae la limpieza).
//
//   pizarra negra con marco y tres carteles (lección, tema y apuntes)
//   mesa del maestro con campana, atril para leer y estantes de libros
//   3 filas x 4 pupitres (losa alta) con su silla (escalón), pasillo con alfombra
//   puerta al fondo entre estanterías, cartel "AULA", camino y dos faroles

const FRENTES = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };
const OPUESTO = { north: "south", south: "north", west: "east", east: "west" };
const FACING = { north: 2, south: 3, west: 4, east: 5 };
const ESCALON = { east: 0, west: 1, south: 2, north: 3 };

export const AULA = { a: 6, b: 5 };
const FILAS = [-1, 1, 3];     // pupitres; la silla va en a + 1
const COLUMNAS = [-3, -1, 1, 3];
const pasilloDe = (b) => (Math.abs(b) === 1 ? 0 : Math.sign(b) * 2);

// lados: { izq, der } si hay otra aula pegada a ese lado (escuela): no limpia encima de
// ella ni le pone alero, y une los techos.
export function planAula(c, frente, perm, titulo = "Claude Maestro", iq = 280, lados = {}) {
  const f = FRENTES[frente];
  const der = { x: -f.z, z: f.x };
  const P = (a, h, b) => ({ x: c.x + f.x * a + der.x * b, y: c.y + h, z: c.z + f.z * a + der.z * b });
  const atras = OPUESTO[frente];
  const pasos = [];
  const add = (p) => pasos.push(p);
  const desdePasillo = (a) => P(Math.max(-4, Math.min(5, a)), 1, 0); // se para en el pasillo central

  const pilar = (a, b) => Math.abs(b) === AULA.b && (Math.abs(a) === AULA.a || a === -3 || a === 0 || a === 3);
  const esquina = (a, b) => Math.abs(a) === AULA.a && Math.abs(b) === AULA.b;

  // 1. El terreno ya lo aplanaron antes (obras/terreno.js: pican lo que sobra y rellenan
  //    los huecos). Del lado de un aula vecina no se pone alero.
  const bMin = lados.izq ? -AULA.b : -AULA.b - 1;
  const bMax = lados.der ? AULA.b : AULA.b + 1;

  // 2. Cimiento y piso en zigzag: borde de ladrillo de piedra, piso de abedul.
  for (let a = -AULA.a; a <= AULA.a; a++) {
    const fila = [];
    for (let b = -AULA.b; b <= AULA.b; b++) fila.push(b);
    if (a % 2) fila.reverse();
    for (const b of fila) {
      add({ tipo: "rellenar", pos: P(a, -1, b), bloque: "minecraft:cobblestone" });
      const borde = Math.abs(a) === AULA.a || Math.abs(b) === AULA.b;
      add({ tipo: "colocar", pos: P(a, 0, b), bloque: borde ? "minecraft:stone_bricks" : "minecraft:birch_planks", forzar: true });
    }
  }

  // 3. Pilares de roble en las esquinas y en las paredes laterales.
  for (let a = -AULA.a; a <= AULA.a; a++) for (const b of [-AULA.b, AULA.b]) {
    if (!pilar(a, b)) continue;
    for (let h = 1; h <= 4; h++) add({ tipo: "colocar", pos: P(a, h, b), bloque: perm("minecraft:oak_log", { pillar_axis: "y" }) });
  }

  // 4. Paredes por hileras, dando la vuelta: blancas, con ventanales a los lados,
  //    la pizarra al frente y la puerta entre estanterías al fondo.
  const vuelta = [];
  for (let b = -4; b <= 4; b++) vuelta.push([-AULA.a, b]);
  for (let a = -5; a <= 5; a++) vuelta.push([a, AULA.b]);
  for (let b = 4; b >= -4; b--) vuelta.push([AULA.a, b]);
  for (let a = 5; a >= -5; a--) vuelta.push([a, -AULA.b]);
  const muro = (a, b, h) => {
    if (a === -AULA.a) { // pared de la pizarra
      if (Math.abs(b) <= 2 && (h === 2 || h === 3)) return "minecraft:black_concrete";
      if (Math.abs(b) <= 3 && (h === 1 || h === 4 || Math.abs(b) === 3)) return "minecraft:dark_oak_planks";
      return "minecraft:white_concrete";
    }
    if (a === AULA.a) { // pared de la puerta
      if (b === 0 && h <= 2) return null;
      if (Math.abs(b) >= 2 && h <= 2) return "minecraft:bookshelf";
      if (Math.abs(b) === 3 && h === 3) return "minecraft:glass_pane";
      return "minecraft:white_concrete";
    }
    if (h === 2 || h === 3) return "minecraft:glass_pane"; // ventanales laterales
    return "minecraft:white_concrete";
  };
  for (let h = 1; h <= 4; h++) {
    for (const [a, b] of vuelta) {
      if (pilar(a, b) || esquina(a, b)) continue;
      const bloque = muro(a, b, h);
      if (bloque) add({ tipo: "colocar", pos: P(a, h, b), bloque });
    }
  }
  add({ tipo: "colocar", pos: P(AULA.a, 1, 0), bloque: perm("minecraft:wooden_door", {
    "minecraft:cardinal_direction": frente, upper_block_bit: false, open_bit: false, door_hinge_bit: false }) });
  add({ tipo: "colocar", pos: P(AULA.a, 2, 0), bloque: perm("minecraft:wooden_door", {
    "minecraft:cardinal_direction": frente, upper_block_bit: true, open_bit: false, door_hinge_bit: false }) });

  // 5. Techo plano de roble oscuro con luces, desde dentro, por anillos.
  const luces = new Set(["-3,-2", "-3,2", "1,-2", "1,2", "4,0", "-1,0"]);
  for (let r = 0; r <= AULA.a; r++) {
    for (let a = -AULA.a; a <= AULA.a; a++) for (let b = -AULA.b; b <= AULA.b; b++) {
      if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
      const luz = luces.has(`${a},${b}`);
      const union = (lados.izq && b === -AULA.b) || (lados.der && b === AULA.b); // une el techo con el de la vecina
      add({ tipo: "colocar", pos: P(a, 5, b), bloque: luz ? "minecraft:glowstone" : "minecraft:dark_oak_planks", techo: true, forzar: union });
    }
  }
  for (let a = -AULA.a - 1; a <= AULA.a + 1; a++) for (let b = -AULA.b - 1; b <= AULA.b + 1; b++) {
    if (Math.abs(a) !== AULA.a + 1 && Math.abs(b) !== AULA.b + 1) continue;
    if (b < bMin || b > bMax) continue; // ese lado es la pared de la vecina
    add({ tipo: "colocar", pos: P(a, 5, b), bloque: perm("minecraft:dark_oak_slab", { "minecraft:vertical_half": "bottom" }), techo: true });
  }

  // 6. Carteles de la pizarra (el maestro escribe en ellos durante la clase).
  const [nombre1, ...resto] = titulo.split(" ");
  const textos = [`§lLección§r\n\n${nombre1}\n${resto.join(" ")}`, `§l¡Bienvenidos!§r\n\nIQ ${iq}`, "Apuntes:\n\n"];
  [-1, 0, 1].forEach((b, k) => add({ tipo: "letrero", pos: P(-5, 3, b), desde: P(-3, 1, 0),
    bloque: perm("minecraft:darkoak_wall_sign", { facing_direction: FACING[frente] }), texto: textos[k] }));

  // 7. Mesa del maestro (escalones invertidos) con campana, atril y estantes.
  for (const b of [2, 3]) {
    add({ tipo: "colocar", pos: P(-3, 1, b), desde: desdePasillo(-3), bloque: perm("minecraft:dark_oak_stairs",
      { weirdo_direction: ESCALON[frente], upside_down_bit: true }) });
  }
  add({ tipo: "colocar", pos: P(-3, 2, 3), desde: desdePasillo(-3), bloque: perm("minecraft:bell", { attachment: "standing", direction: 0, toggle_bit: false }) });
  add({ tipo: "colocar", pos: P(-3, 1, -3), desde: desdePasillo(-3), bloque: perm("minecraft:lectern", { "minecraft:cardinal_direction": atras, powered_bit: false }) });
  for (const b of [-4, 4]) for (const h of [1, 2]) add({ tipo: "colocar", pos: P(-5, h, b), desde: desdePasillo(-4), bloque: "minecraft:bookshelf" });

  // 8. Pupitres y sillas, de la primera fila a la última.
  for (const fila of FILAS) {
    for (const b of COLUMNAS) {
      add({ tipo: "colocar", pos: P(fila, 1, b), desde: desdePasillo(fila), bloque: perm("minecraft:birch_slab", { "minecraft:vertical_half": "top" }) });
      add({ tipo: "colocar", pos: P(fila + 1, 1, b), desde: desdePasillo(fila + 1), bloque: perm("minecraft:oak_stairs",
        { weirdo_direction: ESCALON[frente], upside_down_bit: false }) });
    }
  }
  for (let a = -2; a <= 5; a++) add({ tipo: "colocar", pos: P(a, 1, 0), desde: desdePasillo(a), bloque: "minecraft:light_blue_carpet" });

  // 9. Sale, cierra la puerta, cartel, camino y faroles.
  add({ tipo: "ir", pos: P(5, 1, 0) });
  add({ tipo: "puerta", pos: P(AULA.a, 1, 0), abrir: true });
  add({ tipo: "ir", pos: P(AULA.a + 2, 1, 0) });
  add({ tipo: "puerta", pos: P(AULA.a, 1, 0), abrir: false });
  add({ tipo: "letrero", pos: P(AULA.a + 1, 3, 0), desde: P(AULA.a + 3, 1, 0), blanco: false,
    bloque: perm("minecraft:darkoak_wall_sign", { facing_direction: FACING[frente] }), texto: `§lAULA§r\n${titulo}\n\nClases de IQ` });
  for (let a = AULA.a + 1; a <= AULA.a + 4; a++) add({ tipo: "camino", pos: P(a, 0, 0), desde: P(a, 1, 1) });
  for (const b of [-2, 2]) {
    const desde = P(AULA.a + 3, 1, 0);
    add({ tipo: "colocar", pos: P(AULA.a + 2, 1, b), desde, bloque: "minecraft:oak_fence" });
    add({ tipo: "colocar", pos: P(AULA.a + 2, 2, b), desde, bloque: "minecraft:oak_fence" });
    add({ tipo: "colocar", pos: P(AULA.a + 2, 3, b), desde, bloque: perm("minecraft:lantern", { hanging: false }) });
  }
  add({ tipo: "celebrar", pos: P(AULA.a + 4, 1, 0), mira: P(0, 3, 0) });

  // Puntos que usan el maestro y los alumnos.
  const asientos = [];
  for (const fila of FILAS) {
    for (const b of [-1, 1, -3, 3]) {
      const a = fila + 1;
      const pasillo = pasilloDe(b);
      asientos.push({
        silla: P(a, 1, b),
        ruta: [P(AULA.a + 2, 1, 0), P(5, 1, 0), P(5, 1, pasillo), P(a, 1, pasillo)],
      });
    }
  }
  for (const b of [-3, -1, 1, 3]) asientos.push({ dePie: P(5, 1, b), ruta: [P(AULA.a + 2, 1, 0), P(5, 1, 0)] });
  return {
    pasos,
    puntos: {
      asientos,
      pizarra: P(-5, 1, 0),
      explicar: P(-4, 1, 0),
      campana: P(-4, 1, 3),
      campanaBloque: P(-3, 2, 3),
      atril: P(-4, 1, -3),
      letreros: [P(-5, 3, -1), P(-5, 3, 0), P(-5, 3, 1)],
      tablero: P(-AULA.a, 3, 0),
      puertaFuera: P(AULA.a + 2, 1, 0),
      puertaDentro: P(5, 1, 0),
      centro: P(0, 1, 0),
      haciaAlumnos: frente,
      haciaPizarra: atras,
    },
  };
}
