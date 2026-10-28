// La Cobra Ultimate Addon — punto de entrada del Script API (@minecraft/server 2.10.0 estable).
import { world, system } from "@minecraft/server";
import { CONFIG } from "./config.js";
import { startScheduler, cancelOwner } from "./core/scheduler.js";
import { getState, saveState, dropState, addEnergy, now } from "./core/state.js";
import { removeOwnerFx } from "./core/fx.js";
import { updateHud } from "./core/hud.js";
import { isApplyingAbilityDamage } from "./core/targets.js";
import { cast } from "./abilities/index.js";
import { instintoHit } from "./abilities/instinto.js";
import { remateImpact, pruneShots } from "./abilities/remate.js";
import {
  espadaComponent, balonComponent, guantesComponent, balonImpact, projectileShield, passiveTick,
} from "./items/equipo.js";
import { totemComponent, activateTotem, holdsTotem, totemReady } from "./items/totem.js";
import { libroComponent } from "./items/menu.js";
import {
  BOSS, trackBoss, onBossHurt, spitImpact, onBossBite, onBossDeath, bossTick, idoloComponent, scanBosses,
} from "./boss/boss.js";
import { registerCommands } from "./commands.js";

// ---------------------------------------------------------------- registro (arranque)
system.beforeEvents.startup.subscribe((ev) => {
  const reg = ev.itemComponentRegistry;
  reg.registerCustomComponent("lacobra:espada", espadaComponent);
  reg.registerCustomComponent("lacobra:balon", balonComponent);
  reg.registerCustomComponent("lacobra:guantes", guantesComponent);
  reg.registerCustomComponent("lacobra:totem", totemComponent);
  reg.registerCustomComponent("lacobra:idolo", idoloComponent);
  reg.registerCustomComponent("lacobra:libro", libroComponent);
  reg.registerCustomComponent("lacobra:runa", {
    onUse(e, p) {
      const params = /** @type {{habilidad?: string}} */ (p.params);
      if (params && typeof params.habilidad === "string") cast(e.source, params.habilidad, "runa");
    },
  });
  registerCommands(ev.customCommandRegistry);
});

// ---------------------------------------------------------------- carga del mundo
world.afterEvents.worldLoad.subscribe(() => {
  // elimina efectos huérfanos que quedaran de una sesión anterior
  for (const id of ["overworld", "nether", "the_end"]) {
    try {
      for (const e of world.getDimension(id).getEntities({ families: ["lacobra_fx"] })) e.remove();
    } catch {
      // dimensión no cargada
    }
  }
  scanBosses();
  startScheduler();
  system.runInterval(slowLoop, CONFIG.hud.intervaloTicks);
});

// ---------------------------------------------------------------- bucle lento (cada 10 ticks)
function slowLoop() {
  const tick = now();
  const everySecond = tick % 20 < CONFIG.hud.intervaloTicks;
  for (const player of world.getAllPlayers()) {
    if (!player.isValid) continue;
    const s = getState(player);
    if (everySecond) {
      passiveTick(player, s, tick);
      let regen = CONFIG.energia.regenPorSegundo;
      if (s.armorPieces === 4) regen += CONFIG.energia.bonusArmaduraCompleta;
      if (s.hasAmulet) regen += CONFIG.energia.bonusAmuleto;
      addEnergy(player, s, regen);
    }
    if (tick % 200 < CONFIG.hud.intervaloTicks) saveState(player, s);
    updateHud(player, s);
  }
  bossTick(tick);
  if (tick % 100 < CONFIG.hud.intervaloTicks) pruneShots();
}

// ---------------------------------------------------------------- combate
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const a = ev.damagingEntity;
  if (!a || !a.isValid) return;
  if (a.typeId === "minecraft:player") {
    if (isApplyingAbilityDamage()) return;
    instintoHit(a, getState(/** @type {import("@minecraft/server").Player} */ (a)), ev.hitEntity);
  } else if (a.typeId === BOSS) {
    onBossBite(a);
  }
});

world.afterEvents.entityHurt.subscribe(
  (ev) => {
    if (ev.hurtEntity.isValid) onBossHurt(ev.hurtEntity);
  },
  { entityTypes: [BOSS] }
);

// protección contra proyectiles (guantes) y salvación automática del Tótem
world.beforeEvents.entityHurt.subscribe(
  (ev) => {
    const player = /** @type {import("@minecraft/server").Player} */ (ev.hurtEntity);
    const s = getState(player);
    projectileShield(player, s, ev);
    if (ev.cancel) return;
    let hp = 20;
    try {
      hp = player.getComponent("minecraft:health").currentValue;
    } catch {
      return;
    }
    if (ev.damage >= hp && holdsTotem(player) && totemReady(player)) {
      ev.cancel = true;
      system.run(() => {
        if (player.isValid) activateTotem(player, true);
      });
    }
  },
  { entityFilter: { type: "minecraft:player" } }
);

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const type = safeType(ev.projectile);
  const hit = ev.getEntityHit()?.entity;
  if (type === "lacobra:esfera_remate") remateImpact(ev.projectile, ev.location, ev.dimension);
  else if (type === "lacobra:balon_proyectil") balonImpact(ev.projectile, ev.location, ev.dimension, hit, ev.source);
  else if (type === "lacobra:escupitajo") spitImpact(ev.location, ev.dimension, hit, ev.source);
});

world.afterEvents.projectileHitBlock.subscribe((ev) => {
  const type = safeType(ev.projectile);
  if (type === "lacobra:esfera_remate") remateImpact(ev.projectile, ev.location, ev.dimension);
  else if (type === "lacobra:balon_proyectil") balonImpact(ev.projectile, ev.location, ev.dimension, undefined, ev.source);
  else if (type === "lacobra:escupitajo") spitImpact(ev.location, ev.dimension, undefined, ev.source);
});

function safeType(e) {
  try {
    return e.typeId;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------- ciclo de vida
world.afterEvents.entitySpawn.subscribe((ev) => {
  if (ev.entity.isValid && ev.entity.typeId === BOSS) trackBoss(ev.entity);
});

world.afterEvents.entityLoad.subscribe((ev) => {
  if (ev.entity.isValid && ev.entity.typeId === BOSS) trackBoss(ev.entity);
});

world.afterEvents.entityDie.subscribe((ev) => {
  const e = ev.deadEntity;
  if (e.typeId === BOSS) {
    onBossDeath(e);
  } else if (e.typeId === "minecraft:player") {
    cancelOwner(e.id);
    removeOwnerFx(e.id);
    const s = getState(/** @type {import("@minecraft/server").Player} */ (e));
    s.busy = null;
    s.instintoUntil = s.dominioUntil = s.totemUntil = s.atajadaUntil = 0;
  }
});

world.beforeEvents.playerLeave.subscribe((ev) => {
  const p = ev.player;
  saveState(p, getState(p));
});

world.afterEvents.playerLeave.subscribe((ev) => {
  cancelOwner(ev.playerId);
  removeOwnerFx(ev.playerId);
  dropState(ev.playerId);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  let seen = false;
  try {
    seen = p.getDynamicProperty("lacobra:bienvenida") === true;
    if (!seen) p.setDynamicProperty("lacobra:bienvenida", true);
  } catch {
    seen = true;
  }
  if (!seen) {
    p.sendMessage(
      "§6§lLa Cobra Ultimate§r §7instalado. Fabrica §eEscamas de Cobra§7 (oro + tinta + amatista + cuero), " +
        "luego un §eNúcleo de Energía§7 y tus primeras §6Runas§7. Usa el §5Libro Táctico§7 para el menú de jugadas."
    );
  }
});
