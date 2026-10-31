import { Player } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { ITEMS } from "../config.js";
import { message, t, uiSound } from "../core/feedback.js";
import { heldItem, wearsPatch } from "../core/patch.js";
import { getState, savePrefs } from "../core/state.js";
import { alternarEscudo } from "../abilities/escudo.js";
import { nivelDe } from "../abilities/laser.js";
import { healthOf, intentOf, nameOf, nearbyTargets, weaponsOf } from "../abilities/prediccion.js";

// Menú integrado en el parche: se abre agachándote mientras miras hacia
// arriba (o con /evilmorty:parche). Bedrock no permite botones táctiles fijos
// en el HUD con la API estable, así que las acciones viven en este panel.
// Diseño compacto para móvil: tres botones de dos líneas, sin desplazarse.

const ICON = (name) => `textures/ui/evilmorty/${name}`;
const RADIO_ARCHIVOS = 32;

function distanceTo(player, entity) {
  const a = player.location;
  const b = entity.location;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function statusLine(player) {
  const item = heldItem(player);
  /** @type {import("@minecraft/server").RawMessage[]} */
  const parts = [t("evilmorty.ui.estado")];
  if (item?.typeId === ITEMS.manoLaser) parts.push({ text: "\n" }, t("evilmorty.ui.nivel_laser", nivelDe(item)));
  return { rawtext: parts };
}

export async function abrirMenu(player) {
  if (!wearsPatch(player)) return;
  const state = getState(player);
  const cerca = nearbyTargets(player, RADIO_ARCHIVOS, 9).length;
  uiSound(player, "menu");
  const form = new ActionFormData()
    .title(t("evilmorty.ui.titulo"))
    .body(statusLine(player))
    .button({ rawtext: [t("evilmorty.ui.b_escudo"), { text: "\n" },
      t(state.escudo ? "evilmorty.ui.activo" : "evilmorty.ui.apagado"), { text: " §8· §7" },
      t(`evilmorty.modo_corto.${state.modoEscudo}`)] }, ICON("escudo"))
    .button({ rawtext: [t("evilmorty.ui.b_archivos"), { text: "\n" }, t("evilmorty.ui.cerca", cerca)] },
      ICON("archivos"))
    .button({ rawtext: [t("evilmorty.ui.b_ajustes"), { text: "\n" }, t("evilmorty.ui.ajustes_desc")] },
      ICON("ajustes"));

  const response = await form.show(player);
  if (response.canceled || !player.isValid) return;
  if (response.selection === 0) alternarEscudo(player);
  else if (response.selection === 1) await abrirArchivos(player);
  else if (response.selection === 2) await abrirAjustes(player);
}

async function abrirAjustes(player) {
  const state = getState(player);
  const form = new ModalFormData()
    .title(t("evilmorty.ui.ajustes"))
    .dropdown(t("evilmorty.ui.modo"), [t("evilmorty.modo.reflejar"), t("evilmorty.modo.destruir")],
      { defaultValueIndex: state.modoEscudo === "destruir" ? 1 : 0 })
    .toggle(t("evilmorty.ui.vision"), { defaultValue: state.vision })
    .toggle(t("evilmorty.ui.nocturna"), { defaultValue: state.nocturna })
    .toggle(t("evilmorty.ui.ojo"), { defaultValue: state.ojo })
    .submitButton(t("evilmorty.ui.guardar"));

  const response = await form.show(player);
  if (!player.isValid) return;
  if (response.canceled || !response.formValues) return abrirMenu(player);
  const [modo, vision, nocturna, ojo] = response.formValues;
  state.modoEscudo = modo === 1 ? "destruir" : "reflejar";
  state.vision = vision === true;
  state.nocturna = nocturna === true;
  state.ojo = ojo === true;
  savePrefs(player, state);
  uiSound(player, "guardar");
  message(player, [t("evilmorty.msg.guardado")]);
}

function fileIcon(entity) {
  if (entity instanceof Player) return ICON("jugador");
  try {
    if (entity.matches({ families: ["monster"] })) return ICON("amenaza");
  } catch {
    // Sin familia conocida.
  }
  return ICON("carpeta");
}

// Archivos: una carpeta por objetivo cercano (máximo 9), cada una con su ficha.
async function abrirArchivos(player) {
  const targets = nearbyTargets(player, RADIO_ARCHIVOS, 9);
  const form = new ActionFormData().title(t("evilmorty.ui.archivos"));
  form.body(targets.length ? t("evilmorty.ui.archivos_info", targets.length) : t("evilmorty.ui.sin_archivos"));
  for (const entity of targets) {
    form.button({ rawtext: [{ text: "§l" }, nameOf(entity),
      { text: `§r\n§c${healthOf(entity)} §8· §7${distanceTo(player, entity).toFixed(1)} m` }] }, fileIcon(entity));
  }
  form.button(t("evilmorty.ui.volver"), ICON("volver"));

  const response = await form.show(player);
  if (response.canceled || !player.isValid) return;
  const entity = targets[response.selection ?? -1];
  if (!entity) return abrirMenu(player);
  await abrirFicha(player, entity);
  return abrirArchivos(player);
}

async function abrirFicha(player, entity) {
  if (!entity.isValid) return;
  const weapons = weaponsOf(entity);
  const form = new ActionFormData()
    .title({ rawtext: [{ text: "§6§l" }, nameOf(entity)] })
    .body({
      rawtext: [
        t("evilmorty.ficha.tipo"), { text: ` §7${entity.typeId}\n` },
        t("evilmorty.ficha.vida"), { text: ` §c${healthOf(entity)}\n` },
        t("evilmorty.ficha.arma"), { text: " §e" }, weapons.principal, { text: "\n" },
        t("evilmorty.ficha.otra_mano"), { text: " §e" }, weapons.secundaria ?? t("evilmorty.ficha.sin_arma"),
        { text: "\n" },
        t("evilmorty.ficha.distancia"), { text: ` §b${distanceTo(player, entity).toFixed(1)} m\n` },
        t("evilmorty.ficha.prediccion"), { text: " §b" }, intentOf(entity, player),
      ],
    })
    .button(t("evilmorty.ui.volver"), ICON("volver"));
  await form.show(player);
}
