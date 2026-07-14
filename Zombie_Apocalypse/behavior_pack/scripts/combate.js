// combate.js — efectos al golpear, habilidades al morir y contadores de kills.
//
// Aquí viven las mecánicas que Bedrock no permite declarar en el JSON de la
// entidad con precisión (amplificadores de efecto, explosión al morir,
// "tótem" del Chamán, bloqueo del Espadachín, knockback del Mutante).
import { world } from "@minecraft/server";
import { registrarKill, castigoMuerte } from "./desesperacion.js";
import { msg, jugadores, distancia } from "./util.js";

function esJugador(e) {
  return e !== undefined && e.typeId === "minecraft:player";
}

export function initCombate() {

  // ------------------------------------------------------------------
  // Al recibir daño
  // ------------------------------------------------------------------
  world.afterEvents.entityHurt.subscribe(ev => {
    const victima = ev.hurtEntity;
    const atacante = ev.damageSource?.damagingEntity;
    if (!victima) return;

    try {
      // Efectos de los zombies "de estado" sobre el jugador.
      if (esJugador(victima) && atacante) {
        switch (atacante.typeId) {
          case "za:zombie_congelador":
            // Lentitud II 5 s (el JSON de entidad solo permite amplificador 0).
            victima.addEffect("slowness", 100, { amplifier: 1 });
            break;
          case "za:zombie_toxico":
            victima.addEffect("poison", 140, { amplifier: 0 });
            break;
          case "za:zombie_incendiario":
            victima.setOnFire(5, true);
            break;
          case "za:zombie_mutante": {
            // Knockback masivo en el golpe directo.
            const dx = victima.location.x - atacante.location.x;
            const dz = victima.location.z - atacante.location.z;
            const len = Math.max(0.01, Math.sqrt(dx * dx + dz * dz));
            try {
              victima.applyKnockback({ x: (dx / len) * 4, z: (dz / len) * 4 }, 0.7);
            } catch {
              // Firma antigua (1.x) por si el server resuelve otro módulo.
              victima.applyKnockback(dx / len, dz / len, 4, 0.7);
            }
            break;
          }
        }
      }

      // Espadachín: 25% de las veces "bloquea" (recupera la mitad del daño).
      if (atacante && esJugador(atacante) && victima.typeId === "za:zombie_espadachin") {
        if (Math.random() < 0.25) {
          const salud = victima.getComponent("minecraft:health");
          if (salud) {
            salud.setCurrentValue(Math.min(salud.effectiveMax, salud.currentValue + Math.ceil(ev.damage / 2)));
            victima.dimension.playSound("item.shield.block", victima.location);
          }
        }
      }
    } catch { }
  });

  // ------------------------------------------------------------------
  // Al morir
  // ------------------------------------------------------------------
  world.afterEvents.entityDie.subscribe(ev => {
    const muerto = ev.deadEntity;
    const asesino = ev.damageSource?.damagingEntity;
    if (!muerto) return;

    try {
      // Jugador muerto: única forma de bajar la Desesperación.
      if (esJugador(muerto)) {
        castigoMuerte(muerto);
        return;
      }

      const tipo = muerto.typeId;
      if (!tipo.startsWith("za:zombie_")) return;

      // Contador de kills del jugador (cada 10 → +1 Desesperación).
      if (asesino && esJugador(asesino)) registrarKill(asesino);

      const dim = muerto.dimension;
      const loc = muerto.location;

      switch (tipo) {
        case "za:zombie_explosivo":
          // Esa es la gracia: SÍ rompe bloques. Radio pequeño (2.5).
          dim.createExplosion(loc, 2.5, { breaksBlocks: true, causesFire: false });
          break;

        case "za:zombie_chaman": {
          // "Tótem" = flag booleano: la 1ª muerte lo revive con 50% de vida.
          let yaRevivio = false;
          try { yaRevivio = muerto.getDynamicProperty("za:revivido") === true; } catch { yaRevivio = true; }
          if (!yaRevivio) {
            const nuevo = dim.spawnEntity("za:zombie_chaman", loc);
            nuevo.setDynamicProperty("za:revivido", true);
            const salud = nuevo.getComponent("minecraft:health");
            if (salud) salud.setCurrentValue(Math.ceil(salud.effectiveMax / 2));
            try { nuevo.setProperty("za:accion", 3); } catch { }
            dim.playSound("random.totem", loc);
            dim.spawnParticle("minecraft:totem_particle", { x: loc.x, y: loc.y + 1, z: loc.z });
            for (const p of jugadores()) {
              if (p.dimension.id === dim.id && distancia(p.location, loc) < 32) {
                msg(p, "za.msg.chaman_revive");
              }
            }
          }
          break;
        }

        case "za:zombie_general":
          // La horda cercana pierde la coordinación al caer el General.
          for (const e of dim.getEntities({ location: loc, maxDistance: 24, families: ["za_zombie"] })) {
            try { e.triggerEvent("za:descoordinar"); } catch { }
          }
          if (asesino && esJugador(asesino)) msg(asesino, "za.msg.general_muerto");
          break;
      }
    } catch { }
  });
}
