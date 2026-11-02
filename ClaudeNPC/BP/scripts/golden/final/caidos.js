import { GameMode, Player, system, world } from "@minecraft/server";
import { GOLDEN_FINAL } from "../../config.js";

// En la batalla final, si mueres ya no vuelves a aparecer: quedas como espectador mirando la
// pelea. Al terminar la batalla vuelves a jugar donde fue la pelea (se puede cambiar en
// config.js: GOLDEN_FINAL.revivirAlTerminar = false para quedarte como espectador).

const CLAVE = "claudenpc:caido";
/** @type {(p: any) => (string | undefined)} */
let batallaActiva = (_p) => undefined; // jugador → batalla en la que participa, si sigue
/** @type {(batalla: string) => any} */
let lugarDeBatalla = (_b) => undefined;

export function configurarCaidos(buscarBatalla, lugar) {
  batallaActiva = buscarBatalla;
  lugarDeBatalla = lugar;
}

export function estaCaido(p) {
  try {
    return !!p.getDynamicProperty(CLAVE);
  } catch {
    return false;
  }
}

export function revivir(p, lugar) {
  let datos;
  try {
    datos = JSON.parse(String(p.getDynamicProperty(CLAVE) ?? "null"));
  } catch {
    datos = null;
  }
  if (!datos) return false;
  try {
    p.setDynamicProperty(CLAVE, undefined);
    p.setGameMode(datos.modo ?? GameMode.Survival);
    if (lugar) p.teleport({ x: lugar.x, y: lugar.y, z: lugar.z }, { dimension: lugar.dim ?? p.dimension, keepVelocity: false });
    p.onScreenDisplay.setTitle("§a§lVUELVES", { subtitle: "§7La batalla terminó", fadeInDuration: 5, stayDuration: 40, fadeOutDuration: 15 });
  } catch {
    return false;
  }
  return true;
}

// Si mueres en la batalla: al reaparecer quedas como espectador en la arena (el tótem salva como siempre).
world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
  if (!(deadEntity instanceof Player)) return;
  const batalla = batallaActiva(deadEntity);
  if (!batalla) return;
  try {
    deadEntity.setDynamicProperty(CLAVE, JSON.stringify({ batalla, modo: GameMode.Survival, murio: true }));
  } catch {
    // Sin propiedades.
  }
});

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  system.runTimeout(() => {
    if (!player.isValid || !estaCaido(player)) return;
    let datos;
    try {
      datos = JSON.parse(String(player.getDynamicProperty(CLAVE)));
    } catch {
      datos = undefined;
    }
    const lugar = datos ? lugarDeBatalla(datos.batalla) : undefined;
    if (!lugar) {
      // La batalla ya terminó (o el mundo se reinició): vuelve a jugar.
      if (GOLDEN_FINAL.revivirAlTerminar || !datos) revivir(player);
      return;
    }
    try {
      player.setGameMode(GameMode.Spectator);
      if (!initialSpawn || datos.murio) player.teleport({ x: lugar.x, y: lugar.y + 6, z: lugar.z }, { dimension: lugar.dim, keepVelocity: false });
      player.onScreenDisplay.setTitle("§4§lHAS CAÍDO", { subtitle: "§7No reaparecerás hasta que termine la batalla", fadeInDuration: 5, stayDuration: 60, fadeOutDuration: 20 });
    } catch {
      // Jugador no disponible.
    }
  }, 5);
});

export function revivirCaidos(batalla, lugar) {
  if (!GOLDEN_FINAL.revivirAlTerminar) return;
  for (const p of world.getAllPlayers()) {
    let datos;
    try {
      datos = JSON.parse(String(p.getDynamicProperty(CLAVE) ?? "null"));
    } catch {
      datos = null;
    }
    if (datos && (!batalla || datos.batalla === batalla)) revivir(p, lugar);
  }
}
