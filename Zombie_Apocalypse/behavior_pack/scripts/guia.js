// guia.js — la "Guía de Supervivencia" (el papel).
//
// - Se entrega al entrar por primera vez (también se craftea: papel + carne podrida).
// - No se consume al usarse; abre formularios de @minecraft/server-ui.
// - Sistema de descubrimiento: cada zombie visto de cerca (12 bloques) se marca
//   con una dynamic property por jugador; los no vistos aparecen como "???".
// - TODOS los textos salen de texts/*.lang vía rawtext/translate. Nada aquí.
import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ZOMBIES } from "./zombies_data.js";
import { jugadores, esValido, msg } from "./util.js";
import { getDesesperacion } from "./desesperacion.js";

const ID_GUIA = "za:guia_supervivencia";

// Texto traducible para formularios.
function t(clave, args) {
  const parte = { translate: clave };
  if (args !== undefined) parte.with = args;
  return { rawtext: [parte] };
}

function haVisto(p, key) {
  try { return p.getDynamicProperty("za:visto_" + key) === true; } catch { return false; }
}

// ---------------------------------------------------------------------------
// Menú principal
// ---------------------------------------------------------------------------
function abrirMenu(p) {
  new ActionFormData()
    .title(t("za.guia.titulo"))
    .body(t("za.guia.intro"))
    .button(t("za.guia.btn.quepasa"))
    .button(t("za.guia.btn.desesperacion"))
    .button(t("za.guia.btn.zombies"))
    .button(t("za.guia.btn.consejos"))
    .show(p)
    .then(r => {
      if (r.canceled) return;
      switch (r.selection) {
        case 0: return paginaSimple(p, "za.guia.btn.quepasa", "za.guia.quepasa");
        case 1: return paginaDesesperacion(p);
        case 2: return listaZombies(p);
        case 3: return paginaSimple(p, "za.guia.btn.consejos", "za.guia.consejos");
      }
    })
    .catch(() => { });
}

// Página de texto con botón "< Volver" al menú principal.
function paginaSimple(p, claveTitulo, claveCuerpo) {
  new ActionFormData()
    .title(t(claveTitulo))
    .body(t(claveCuerpo))
    .button(t("za.guia.btn.volver"))
    .show(p)
    .then(r => { if (!r.canceled) abrirMenu(p); })
    .catch(() => { });
}

// La página de Desesperación añade el valor actual del jugador.
function paginaDesesperacion(p) {
  new ActionFormData()
    .title(t("za.guia.btn.desesperacion"))
    .body({
      rawtext: [
        { translate: "za.guia.desp" },
        { text: "\n\n" },
        { translate: "za.guia.desp.actual", with: [String(getDesesperacion(p))] }
      ]
    })
    .button(t("za.guia.btn.volver"))
    .show(p)
    .then(r => { if (!r.canceled) abrirMenu(p); })
    .catch(() => { });
}

// ---------------------------------------------------------------------------
// Submenú "Tipos de Zombie": un botón por zombie; "???" si no se ha visto.
// ---------------------------------------------------------------------------
function listaZombies(p) {
  const form = new ActionFormData()
    .title(t("za.guia.zombies.titulo"))
    .body(t("za.guia.zombies.intro"));

  for (const z of ZOMBIES) {
    form.button(haVisto(p, z.key) ? t("entity." + z.id + ".name") : t("za.guia.desconocido"));
  }
  form.button(t("za.guia.btn.volver"));

  form.show(p)
    .then(r => {
      if (r.canceled) return;
      if (r.selection === ZOMBIES.length) return abrirMenu(p); // "< Volver"
      fichaZombie(p, ZOMBIES[r.selection]);
    })
    .catch(() => { });
}

function fichaZombie(p, z) {
  const visto = haVisto(p, z.key);
  new ActionFormData()
    .title(visto ? t("entity." + z.id + ".name") : t("za.guia.desconocido"))
    .body(visto ? t("za.guia.ficha." + z.key) : t("za.guia.ficha.desconocida"))
    .button(t("za.guia.btn.volver"))
    .show(p)
    .then(r => { if (!r.canceled) listaZombies(p); })
    .catch(() => { });
}

// ---------------------------------------------------------------------------
// Registro y descubrimiento
// ---------------------------------------------------------------------------
export function initGuia() {
  // Entregar la guía en el primer spawn del jugador.
  world.afterEvents.playerSpawn.subscribe(ev => {
    if (!ev.initialSpawn) return;
    const p = ev.player;
    try {
      if (p.getDynamicProperty("za:guia_entregada") === true) return;
      const inv = p.getComponent("minecraft:inventory");
      if (inv?.container) {
        inv.container.addItem(new ItemStack(ID_GUIA, 1));
        p.setDynamicProperty("za:guia_entregada", true);
        msg(p, "za.msg.bienvenida");
        msg(p, "za.msg.guia_recibida");
      }
    } catch { }
  });

  // Abrir la guía al usar el papel (no se consume: max_stack 1, sin food).
  world.afterEvents.itemUse.subscribe(ev => {
    if (ev.itemStack?.typeId !== ID_GUIA) return;
    const p = ev.source;
    if (!p || p.typeId !== "minecraft:player") return;
    system.run(() => abrirMenu(p));
  });

  // Descubrimiento: cada 4 s, los zombies a <12 bloques quedan registrados.
  // Ver un tipo nuevo es un momento: avisamos con el nombre en el chat.
  system.runInterval(() => {
    for (const p of jugadores()) {
      let cerca = [];
      try {
        cerca = p.dimension.getEntities({
          location: p.location, maxDistance: 12, families: ["za_zombie"]
        });
      } catch { continue; }
      for (const e of cerca) {
        if (!esValido(e)) continue;
        const key = e.typeId.replace("za:", "");
        try {
          if (p.getDynamicProperty("za:visto_" + key) !== true) {
            p.setDynamicProperty("za:visto_" + key, true);
            p.sendMessage({
              rawtext: [{
                translate: "za.msg.descubierto",
                with: { rawtext: [{ translate: "entity." + e.typeId + ".name" }] }
              }]
            });
            try { p.playSound("random.orb", { volume: 0.5, pitch: 1.4 }); } catch { }
          }
        } catch { }
      }
    }
  }, 80);
}
