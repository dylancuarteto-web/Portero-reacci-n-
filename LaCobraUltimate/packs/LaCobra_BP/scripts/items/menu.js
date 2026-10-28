// Libro Táctico de La Cobra: menú de habilidades táctil (server-ui, compatible con Android).
import { system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { CONFIG, HABILIDADES, NOMBRES } from "../config.js";
import { getState, cooldownLeft, saveState, flash } from "../core/state.js";
import { playerSound } from "../core/fx.js";
import { cast, hasRune } from "../abilities/index.js";
import { energyBar } from "../core/hud.js";

const ICON = (sk) => "textures/items/runa_" + sk;
const open = new Set();

export const libroComponent = {
  onUse(ev) {
    const player = ev.source;
    // fuera del evento: los formularios no pueden abrirse en contexto restringido
    system.run(() => showMain(player));
  },
};

function skillLine(player, s, sk) {
  const cfg = CONFIG.habilidades[sk];
  if (!hasRune(player, sk)) return `§8${NOMBRES[sk]}\n§8Bloqueada: falta la runa`;
  const cd = Math.ceil(cooldownLeft(s, sk) / 20);
  const state = cd > 0 ? `§c${cd}s` : s.energy >= cfg.coste ? "§2LISTA" : "§6sin energía";
  return `§l${NOMBRES[sk]}§r\n§1${cfg.coste} energía §8| ${state}`;
}

/** @param {import("@minecraft/server").Player} player */
async function showMain(player) {
  if (!player.isValid || open.has(player.id)) return;
  open.add(player.id);
  try {
    const s = getState(player);
    playerSound(player, "menu", 0.7);
    const form = new ActionFormData()
      .title("§6§lJugadas de La Cobra")
      .body(
        `Energía: ${energyBar(s.energy, 20)} §f${Math.floor(s.energy)}§7/${CONFIG.energia.max}\n` +
          `§7Habilidad de la espada: §e${NOMBRES[s.selected]}\n§7Toca una jugada para lanzarla.`
      );
    for (const sk of HABILIDADES) form.button(skillLine(player, s, sk), ICON(sk));
    form.button("§l§5Habilidad de la Espada§r\n§8Elegir qué lanza la espada", "textures/items/espada_cobra");
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined || !player.isValid) return;
    if (res.selection < HABILIDADES.length) {
      cast(player, HABILIDADES[res.selection], "libro");
      return;
    }
    open.delete(player.id);
    await chooseSword(player);
  } catch {
    // el jugador cerró el juego o el formulario
  } finally {
    open.delete(player.id);
  }
}

async function chooseSword(player) {
  const s = getState(player);
  const form = new ActionFormData().title("§5Habilidad de la Espada").body("§7Al usar la Espada de La Cobra se lanzará:");
  for (const sk of HABILIDADES) form.button((s.selected === sk ? "§2» " : "") + NOMBRES[sk], ICON(sk));
  const res = await form.show(player);
  if (res.canceled || res.selection === undefined || !player.isValid) return;
  const sk = HABILIDADES[res.selection];
  if (!hasRune(player, sk)) {
    flash(s, `§cPrimero consigue la Runa de ${NOMBRES[sk]}`);
    return;
  }
  s.selected = sk;
  saveState(player, s);
  flash(s, `§5Espada: §e${NOMBRES[sk]}`);
  playerSound(player, "listo", 0.7);
}
