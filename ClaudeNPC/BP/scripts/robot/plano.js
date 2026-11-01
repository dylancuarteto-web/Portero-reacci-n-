// Plano del robot que construyen los cinco Claudes con bloques antes de transformarlo
// (sin dependencias del juego). Ejes: "a" hacia el jugador (frente), "b" a la derecha.
// Piernas de hierro, cadera, torso con núcleo de redstone y placas de cobre, brazos con
// manos de observador, lanzamisiles (dispensadores) en los hombros y cabina de vidrio
// con un visor que brilla.
const FRENTES = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };
const FACING = { north: 2, south: 3, west: 4, east: 5 };

export function planRobot(c, frente, perm) {
  const f = FRENTES[frente];
  const P = (b, h, a = 0) => ({ x: c.x + f.x * a - f.z * b, y: c.y + h, z: c.z + f.z * a + f.x * b });
  const hierro = "minecraft:iron_block";
  const cobre = "minecraft:copper_block";
  const dispensador = perm("minecraft:dispenser", { facing_direction: FACING[frente] });
  const lista = [
    // Piernas
    [-1, 0, hierro], [1, 0, hierro], [-1, 1, hierro], [1, 1, hierro],
    // Cadera
    [-1, 2, hierro], [0, 2, hierro], [1, 2, hierro],
    // Torso: núcleo de redstone y placas de cobre
    [-1, 3, hierro], [0, 3, "minecraft:redstone_block"], [1, 3, hierro],
    [-1, 4, cobre], [0, 4, hierro], [1, 4, cobre],
    // Brazos y manos
    [-2, 4, hierro], [2, 4, hierro], [-2, 3, hierro], [2, 3, hierro], [-2, 2, "minecraft:observer"], [2, 2, "minecraft:observer"],
    // Hombros con lanzamisiles y cuello
    [-2, 5, dispensador], [2, 5, dispensador], [0, 5, hierro],
    // Cabeza: visor que brilla y cúpula de vidrio
    [-1, 6, hierro], [0, 6, "minecraft:sea_lantern"], [1, 6, hierro], [0, 7, "minecraft:light_blue_stained_glass"],
  ];
  return lista.map(([b, h, bloque]) => ({ pos: P(b, h), bloque }));
}

// Volumen que debe estar libre para construirlo: el plano (5 de ancho, 9 de alto) y
// el cuerpo del robot ya armado (3 x 3 de base, 6 de alto).
export function volumenRobot(c, frente) {
  const f = FRENTES[frente];
  const P = (b, h, a) => ({ x: c.x + f.x * a - f.z * b, y: c.y + h, z: c.z + f.z * a + f.x * b });
  const lista = [];
  for (let b = -2; b <= 2; b++) for (let h = 0; h <= 8; h++) lista.push(P(b, h, 0));
  for (const a of [-1, 1]) for (let b = -1; b <= 1; b++) for (let h = 0; h <= 5; h++) lista.push(P(b, h, a));
  return lista;
}
