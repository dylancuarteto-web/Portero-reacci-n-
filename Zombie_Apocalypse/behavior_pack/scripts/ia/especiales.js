// ia/especiales.js — habilidades activas: Chamán, Invocador, Enderman, Domador.
//
// Todos los bucles corren espaciados (60-120 ticks) y acotados por distancia
// al jugador. Nada corre cada tick.
import { world, system } from "@minecraft/server";
import { CAP_ZOMBIES, entidadesCercaDeJugadores, jugadorMasCercano, zombiesActivos, esValido } from "../util.js";

// ---------------------------------------------------------------------------
// CHAMÁN — buffea Velocidad + Fuerza a los zombies cercanos (pose de ritual).
// Su "tótem" (revivir una vez) vive en combate.js, en el evento de muerte.
// ---------------------------------------------------------------------------
function pasadaChaman() {
  const chamanes = entidadesCercaDeJugadores(40)
    .filter(e => e.typeId === "za:zombie_chaman");

  for (const ch of chamanes) {
    if (!esValido(ch)) continue;
    try {
      const aliados = ch.dimension.getEntities({
        location: ch.location, maxDistance: 12, families: ["za_zombie"]
      });
      let buffeados = 0;
      for (const z of aliados) {
        if (z.id === ch.id) continue;
        try {
          z.addEffect("speed", 160, { amplifier: 0, showParticles: true });
          z.addEffect("strength", 160, { amplifier: 0, showParticles: true });
          buffeados++;
        } catch { }
      }
      if (buffeados > 0) {
        ch.setProperty("za:accion", 3); // pose ritual (brazos arriba)
        ch.dimension.playSound("mob.evocation_illager.cast_spell", ch.location);
        system.runTimeout(() => {
          try { if (esValido(ch)) ch.setProperty("za:accion", 0); } catch { }
        }, 25);
      }
    } catch { }
  }
}

// ---------------------------------------------------------------------------
// INVOCADOR — invoca zombies normales durante el combate.
// Límite: 6 invocaciones por Invocador y respeta el CAP global.
// ---------------------------------------------------------------------------
function pasadaInvocador() {
  const invocadores = entidadesCercaDeJugadores(32)
    .filter(e => e.typeId === "za:zombie_invocador");
  if (invocadores.length === 0) return;

  let activos = zombiesActivos().length;

  for (const inv of invocadores) {
    if (!esValido(inv) || activos >= CAP_ZOMBIES) break;
    try {
      const cerca = jugadorMasCercano(inv.location, inv.dimension, 24);
      if (!cerca) continue;
      const invocados = Number(inv.getDynamicProperty("za:invocados") ?? 0);
      if (invocados >= 6) continue;

      const ang = Math.random() * Math.PI * 2;
      const pos = {
        x: inv.location.x + Math.cos(ang) * 2,
        y: inv.location.y,
        z: inv.location.z + Math.sin(ang) * 2
      };
      inv.dimension.spawnEntity("za:zombie_normal", pos);
      inv.setDynamicProperty("za:invocados", invocados + 1);
      activos++;
      inv.dimension.playSound("mob.evocation_illager.prepare_summon", inv.location);
    } catch { }
  }
}

// ---------------------------------------------------------------------------
// ENDERMAN — cada cierto tiempo se teletransporta DETRÁS del jugador.
// Cooldown obligatorio de 8 s por entidad o sería injugable.
// ---------------------------------------------------------------------------
const cdTeleport = new Map(); // entity.id -> tick disponible

function pasadaEnderman() {
  const ahora = system.currentTick;
  const endermen = entidadesCercaDeJugadores(40)
    .filter(e => e.typeId === "za:zombie_enderman");

  for (const en of endermen) {
    if (!esValido(en)) continue;
    if ((cdTeleport.get(en.id) ?? 0) > ahora) continue;
    try {
      const cerca = jugadorMasCercano(en.location, en.dimension, 32);
      if (!cerca || cerca.dist <= 8) continue; // solo si está lejos

      const p = cerca.jugador;
      const vista = p.getViewDirection();
      // "Detrás" = posición del jugador menos su dirección de vista.
      const destino = {
        x: p.location.x - vista.x * 2,
        y: p.location.y,
        z: p.location.z - vista.z * 2
      };
      // Comprobar que hay 2 bloques de aire (pies + cabeza) en el destino.
      const pies = en.dimension.getBlock({ x: Math.floor(destino.x), y: Math.floor(destino.y), z: Math.floor(destino.z) });
      const cabeza = en.dimension.getBlock({ x: Math.floor(destino.x), y: Math.floor(destino.y) + 1, z: Math.floor(destino.z) });
      if (!pies || !cabeza || !pies.isAir || !cabeza.isAir) continue;

      en.setProperty("za:accion", 4); // animación de "lanzar pearl"
      en.dimension.playSound("mob.endermen.portal", en.location);
      en.teleport(destino, { facingLocation: p.location });
      en.dimension.playSound("mob.endermen.portal", destino);
      cdTeleport.set(en.id, ahora + 160); // 8 s de cooldown
      system.runTimeout(() => {
        try { if (esValido(en)) en.setProperty("za:accion", 0); } catch { }
      }, 16);
    } catch { }
  }

  if (cdTeleport.size > 64) {
    const vivos = new Set(endermen.map(e => e.id));
    for (const id of cdTeleport.keys()) if (!vivos.has(id)) cdTeleport.delete(id);
  }
}

// ---------------------------------------------------------------------------
// DOMADOR — al aparecer trae su jauría de lobos.
// Limitación honesta: usamos lobos VANILLA y les disparamos su evento de ira
// (probamos los dos nombres conocidos). Si Mojang los renombrara, los lobos
// aparecen igual aunque tarden en agredir.
// ---------------------------------------------------------------------------
function initDomador() {
  world.afterEvents.entitySpawn.subscribe(ev => {
    const e = ev.entity;
    try {
      if (!e || e.typeId !== "za:zombie_domador") return;
      if (ev.cause === "Loaded") return; // no duplicar jauría al cargar chunks
      if (e.getDynamicProperty("za:jauria") === true) return;
      e.setDynamicProperty("za:jauria", true);

      for (let i = 0; i < 3; i++) {
        const ang = (Math.PI * 2 * i) / 3;
        const lobo = e.dimension.spawnEntity("minecraft:wolf", {
          x: e.location.x + Math.cos(ang) * 1.5,
          y: e.location.y,
          z: e.location.z + Math.sin(ang) * 1.5
        });
        try { lobo.triggerEvent("minecraft:on_anger"); }
        catch { try { lobo.triggerEvent("minecraft:become_angry"); } catch { } }
      }
    } catch { }
  });
}

export function initEspeciales() {
  system.runInterval(pasadaChaman, 60);
  system.runInterval(pasadaInvocador, 120);
  system.runInterval(pasadaEnderman, 40);
  initDomador();
}
