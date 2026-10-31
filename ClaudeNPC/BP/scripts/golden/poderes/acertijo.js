import { ItemStack, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, burst, now, rand, sound } from "../../util.js";
import { anunciar, avisarJugador } from "../comun.js";

// Duelo de IQ: se detiene y te hace una pregunta. Si aciertas, queda aturdido unos
// segundos y recibe el doble de daño; si fallas (o cierras la pregunta), te cae un rayo.
const PREGUNTAS = [
  { q: "¿Cuánto es 7 × 8?", ok: "56", malas: ["54", "64"] },
  { q: "¿Cuántos lingotes lleva una pechera?", ok: "8", malas: ["5", "6"] },
  { q: "¿Qué criatura explota al acercarse?", ok: "Creeper", malas: ["Zombi", "Araña"] },
  { q: "Si 3 Claudes tienen IQ 300, ¿cuánto suman?", ok: "900", malas: ["600", "1200"] },
  { q: "¿Mínimo de obsidiana para un portal al Nether?", ok: "10", malas: ["12", "14"] },
  { q: "¿Qué herramienta rompe más rápido la tierra?", ok: "Pala", malas: ["Pico", "Hacha"] },
  { q: "¿Cuántos bloques mide un chunk de lado?", ok: "16", malas: ["8", "32"] },
  { q: "¿Cuántos ticks tiene un segundo?", ok: "20", malas: ["10", "60"] },
  { q: "¿Qué se necesita para hacer una cama?", ok: "Lana y madera", malas: ["Hierro", "Piedra"] },
];

export const acertijo = {
  id: "acertijo",
  nombre: "Duelo de IQ",
  cd: 1300,
  peso: () => 0.8,
  si: (c) => c.dist < 14 && !c.preguntando,
  usar(g, jugador) {
    const e = g.entidad;
    const p = PREGUNTAS[rand(0, PREGUNTAS.length - 1)];
    const opciones = [p.ok, ...p.malas].sort(() => Math.random() - 0.5);
    g.preguntando = true;
    g.quietoHasta = now() + 400;
    anunciar(g, "Duelo de IQ", "§b");
    animate(e, ANIM.goldenPensar);
    sound(e, "random.orb", 1.8);
    const form = new ActionFormData().title("§6§lDuelo de IQ").body(`§fClaude Golden pregunta:\n\n§e${p.q}`);
    for (const o of opciones) form.button(o);
    system.run(() => {
      form.show(jugador).then((r) => {
        g.preguntando = false;
        g.quietoHasta = 0;
        g.ocupadoHasta = now() + 20;
        if (!jugador.isValid || !e.isValid) return;
        if (!r.canceled && r.selection !== undefined && opciones[r.selection] === p.ok) {
          g.aturdidoHasta = now() + 120;
          animate(e, ANIM.goldenAturdido);
          burst(e, PARTICLES.zzz, { x: 0, y: 2.4, z: 0 });
          sound(e, "random.anvil_land", 1.6, 0.6);
          avisarJugador(jugador, "§a¡Correcto! Claude Golden queda aturdido: ahora recibe el doble de daño");
          try {
            jugador.dimension.spawnItem(new ItemStack("minecraft:golden_carrot", 1), jugador.location);
          } catch {
            // Sin premio.
          }
        } else {
          avisarJugador(jugador, `§cIncorrecto: era "${p.ok}"`);
          try {
            jugador.dimension.spawnEntity("minecraft:lightning_bolt", jugador.location);
          } catch {
            // Sin rayo.
          }
          animate(e, ANIM.goldenRisa);
        }
      }).catch(() => {
        g.preguntando = false;
        g.quietoHasta = 0;
      });
    });
    return 400;
  },
};
