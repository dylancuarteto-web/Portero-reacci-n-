import { ActionFormData } from "@minecraft/server-ui";
import { ITEMS } from "../config.js";
import { t } from "../core/feedback.js";
import { heldItem, wearsPatch } from "../core/patch.js";
import { getState, savePrefs } from "../core/state.js";
import { alternarEscudo, cambiarModo } from "../abilities/escudo.js";
import { nivelDe } from "../abilities/laser.js";
import { healthOf, intentOf, nameOf, nearbyTargets, weaponsOf } from "../abilities/prediccion.js";

// Menú del Control del Parche. Bedrock no permite botones táctiles fijos en
// el HUD con la API estable, así que las acciones viven en este panel.

const ICON = (name) => `textures/ui/evilmorty/${name}`;
const onOff = (value) => t(value ? "evilmorty.ui.on" : "evilmorty.ui.off");

function laserLevel(player) {
  const item = heldItem(player);
  return item?.typeId === ITEMS.manoLaser ? String(nivelDe(item)) : "-";
}

export async function abrirMenu(player) {
  const state = getState(player);
  const form = new ActionFormData()
    .title(t("evilmorty.ui.titulo"))
    .body({
      rawtext: [
        t("evilmorty.ui.estado_parche"), { text: " " }, onOff(wearsPatch(player)), { text: "\n" },
        t("evilmorty.ui.estado_escudo"), { text: " " }, onOff(state.escudo), { text: " (" },
        t(`evilmorty.modo.${state.modoEscudo}`), { text: ")\n" },
        t("evilmorty.ui.estado_vision"), { text: " " }, onOff(state.vision), { text: "\n" },
        t("evilmorty.ui.estado_laser"), { text: " " + laserLevel(player) },
      ],
    })
    .button(t(state.escudo ? "evilmorty.ui.escudo_off" : "evilmorty.ui.escudo_on"), ICON("escudo"))
    .button(t("evilmorty.ui.modo"), ICON("modo"))
    .button(t(state.vision ? "evilmorty.ui.vision_off" : "evilmorty.ui.vision_on"), ICON("vision"))
    .button(t("evilmorty.ui.archivos"), ICON("archivos"))
    .button(t(state.ojo ? "evilmorty.ui.ojo_off" : "evilmorty.ui.ojo_on"), ICON("ojo"))
    .button(t("evilmorty.ui.cerrar"), ICON("cerrar"));

  const response = await form.show(player);
  if (response.canceled || !player.isValid) return;
  switch (response.selection) {
    case 0:
      alternarEscudo(player);
      break;
    case 1:
      cambiarModo(player);
      break;
    case 2:
      state.vision = !state.vision;
      savePrefs(player, state);
      break;
    case 3:
      await abrirArchivos(player);
      break;
    case 4:
      state.ojo = !state.ojo;
      savePrefs(player, state);
      break;
  }
}

// Archivos: una carpeta por objetivo cercano (máximo 9), cada una con su ficha.
async function abrirArchivos(player) {
  const targets = nearbyTargets(player, 32, 9);
  const form = new ActionFormData().title(t("evilmorty.ui.archivos"));
  if (!targets.length) form.body(t("evilmorty.ui.sin_archivos"));
  else form.body(t("evilmorty.ui.archivos_info", targets.length));
  for (const entity of targets) form.button({ rawtext: [nameOf(entity)] }, ICON("carpeta"));
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
  const distance = Math.hypot(
    entity.location.x - player.location.x,
    entity.location.y - player.location.y,
    entity.location.z - player.location.z,
  ).toFixed(1);
  const form = new ActionFormData()
    .title({ rawtext: [nameOf(entity)] })
    .body({
      rawtext: [
        t("evilmorty.ficha.tipo"), { text: ` §7${entity.typeId}§r\n` },
        t("evilmorty.ficha.vida"), { text: ` §c${healthOf(entity)}§r\n` },
        t("evilmorty.ficha.arma"), { text: " §e" }, weapons.principal, { text: "§r\n" },
        t("evilmorty.ficha.otra_mano"), { text: " §e" }, weapons.secundaria ?? t("evilmorty.ficha.sin_arma"),
        { text: "§r\n" },
        t("evilmorty.ficha.distancia"), { text: ` §b${distance}§r\n` },
        t("evilmorty.ficha.prediccion"), { text: " §b" }, intentOf(entity, player),
      ],
    })
    .button(t("evilmorty.ui.volver"), ICON("volver"));
  await form.show(player);
}
