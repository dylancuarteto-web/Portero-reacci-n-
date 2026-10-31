import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { protegido } from "../../estructuras.js";
import { animate, blockAt, particleAt, reemplazable, sound, soundAt, superficie } from "../../util.js";
import { anunciar, avisarJugador, danar, estallido, objetivos } from "../comun.js";

// Jaque: el suelo a tu alrededor se vuelve un tablero de oro y negro. Claude Golden
// anuncia un color, esas casillas brillan y luego estallan: ponte en el otro color
// (o salta en el momento justo). Al final el suelo vuelve a ser como era.
const NATURALES = /grass_block|^minecraft:dirt$|coarse_dirt|podzol|mycelium|^minecraft:stone$|sand$|gravel|andesite|diorite|granite|deepslate$|snow$|grass_path|moss_block|^minecraft:mud$|terracotta$|netherrack|end_stone/;
const ORO = "minecraft:gold_block";
const NEGRO = "minecraft:black_concrete";

export const tablero = {
  id: "tablero",
  nombre: "Jaque",
  cd: 900,
  peso: () => 1,
  si: (c) => c.mundo && c.dist < 16 && c.jugadorEnSuelo,
  usar(g, jugador) {
    const e = g.entidad;
    const dim = jugador.dimension;
    const cx = Math.floor(jugador.location.x);
    const cz = Math.floor(jugador.location.z);
    const cy = Math.floor(jugador.location.y) - 1;
    const casillas = [];
    for (let dx = -5; dx <= 5; dx++) {
      for (let dz = -5; dz <= 5; dz++) {
        const top = superficie(dim, cx + dx, cz + dz);
        if (!top || Math.abs(top.location.y - cy) > 2 || !NATURALES.test(top.typeId) || protegido(top.location)) continue;
        if (!reemplazable(blockAt(dim, { x: top.location.x, y: top.location.y + 1, z: top.location.z }))) continue;
        casillas.push({ pos: { ...top.location }, original: top.permutation, tipo: (dx + dz) % 2 === 0 ? ORO : NEGRO });
      }
    }
    if (casillas.length < 40) return 0;
    anunciar(g, "Jaque", "§6");
    animate(e, ANIM.goldenChasquido);
    sound(e, "beacon.activate", 1.2);
    casillas.forEach((k, i) => {
      system.runTimeout(() => {
        const b = blockAt(dim, k.pos);
        try {
          if (b && b.typeId === k.original.type.id) b.setType(k.tipo);
        } catch {
          // Sin cambio.
        }
      }, Math.floor(i / 12));
    });
    const rondas = g.fase === 2 ? 4 : 3;
    for (let r = 0; r < rondas; r++) {
      const base = 20 + r * 44;
      const color = Math.random() < 0.5 ? ORO : NEGRO;
      const marcadas = casillas.filter((k) => k.tipo === color);
      system.runTimeout(() => {
        for (const j of objetivos(dim, jugador.location, 24)) {
          avisarJugador(j, `§c¡Jaque a las casillas ${color === ORO ? "§6doradas" : "§8negras"}§c! Cámbiate de color`);
        }
        soundAt(dim, jugador.location, "note.pling", color === ORO ? 1.6 : 0.8, 1);
      }, base);
      for (const t of [6, 14, 22, 30]) {
        system.runTimeout(() => {
          for (const k of marcadas) particleAt(dim, PARTICLES.aviso, { x: k.pos.x + 0.5, y: k.pos.y + 1.06, z: k.pos.z + 0.5 });
        }, base + t);
      }
      system.runTimeout(() => {
        for (const j of objetivos(dim, jugador.location, 24)) {
          const bajo = blockAt(dim, { x: j.location.x, y: j.location.y - 0.2, z: j.location.z });
          if (j.isOnGround && bajo?.typeId === color) {
            danar(j, g.fase === 2 ? 7 : 6, e);
            j.applyKnockback({ x: 0, z: 0 }, 0.8);
          }
        }
        marcadas.forEach((k, i) => i % 3 === 0 && estallido(dim, { x: k.pos.x + 0.5, y: k.pos.y + 1.2, z: k.pos.z + 0.5 }));
        soundAt(dim, jugador.location, "random.explode", 1.4, 0.6);
      }, base + 34);
    }
    // Todo vuelve a ser como era.
    system.runTimeout(() => {
      casillas.forEach((k, i) => {
        system.runTimeout(() => {
          const b = blockAt(dim, k.pos);
          try {
            if (b && (b.typeId === ORO || b.typeId === NEGRO)) b.setPermutation(k.original);
          } catch {
            // Chunk descargado.
          }
        }, Math.floor(i / 12));
      });
    }, 20 + rondas * 44 + 10);
    return 20 + rondas * 44 + 20;
  },
};
