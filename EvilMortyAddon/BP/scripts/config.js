import { EntityDamageCause } from "@minecraft/server";

// Ajustes e identificadores compartidos. Deben coincidir con docs/ASSET_REGISTRY.md.

export const ITEMS = {
  parche: "evilmorty:parche",
  manoLaser: "evilmorty:mano_laser",
};

// Gestos del parche (el menú va integrado en el parche, sin ítem aparte):
//   agacharse mirando hacia arriba = menú; dos veces seguidas = escudo on/off.
export const GESTO = {
  pitchArriba: -55,
  ventanaDoble: 8,
};

// Comando de respaldo para abrir el menú: /evilmorty:parche
export const COMANDO_MENU = "evilmorty:parche";

export const ENTITIES = {
  domo: "evilmorty:escudo_domo",
  rayo: "evilmorty:rayo_laser",
};

export const PARTICLES = {
  prediccionPunto: "evilmorty:prediccion_punto",
  prediccionFin: "evilmorty:prediccion_fin",
  escudoActivar: "evilmorty:escudo_activar",
  escudoImpacto: "evilmorty:escudo_impacto",
  proyectilDestruido: "evilmorty:proyectil_destruido",
  proyectilReflejado: "evilmorty:proyectil_reflejado",
  escudoHumo: "evilmorty:escudo_humo",
  laserDestello: "evilmorty:laser_destello",
  laserImpacto: "evilmorty:laser_impacto",
  laserChispas: "evilmorty:laser_chispas",
  laserEstela: "evilmorty:laser_estela",
  mejora: "evilmorty:mejora",
  parcheDestello: "evilmorty:parche_destello",
  parcheActivar: "evilmorty:parche_activar",
};

export const ANIMATIONS = {
  laserDisparo: "animation.evilmorty.player.laser_disparo",
  escudoActivar: "animation.evilmorty.player.escudo_activar",
  mejora: "animation.evilmorty.player.mejora",
};

// Sonidos de relleno tomados de Minecraft (no se incluye ningún archivo de audio).
// Para usar los tuyos, decláralos en RP/sounds/sound_definitions.json y cambia el id;
// con id "" ese sonido queda en silencio.
export const SOUNDS = {
  escudoOn: { id: "beacon.activate", pitch: 1.4 },
  escudoOff: { id: "beacon.deactivate", pitch: 1.4 },
  escudoImpacto: { id: "item.shield.block", pitch: 1.2 },
  proyectilDestruido: { id: "random.fizz", pitch: 1.6, volume: 0.7 },
  proyectilReflejado: { id: "item.shield.block", pitch: 1.7 },
  laser: { id: "mob.blaze.shoot", pitch: 1.8, volume: 0.8 },
  mejora: { id: "random.levelup", pitch: 1.2 },
  ojoOn: { id: "beacon.power", pitch: 1.8, volume: 0.6 },
  menu: { id: "random.click", pitch: 1.3, volume: 0.6 },
  guardar: { id: "random.orb", pitch: 1.4, volume: 0.6 },
  alerta: { id: "note.pling", pitch: 1.8, volume: 0.5 },
};

// Tiempos en ticks (20 ticks = 1 segundo).
export const TICKS = {
  pasiva: 10,
  escudoSeguir: 1,
  escudoProyectiles: 2,
  limpiezaDomos: 100,
  ojoReafirmar: 200,
  mensaje: 40,
  laserCooldown: 12,
  rayoVida: 6,
  nocturna: 300,
  nocturnaRenovar: 220,
};

export const PREDICCION = {
  radio: 24,
  maxObjetivos: 6,
  segundos: 1,
  puntos: 4,
  velocidadMinima: 0.03,
  alcanceFicha: 32,
  // Alerta de amenaza: criatura hostil o jugador que viene hacia ti.
  alertaDistancia: 12,
  alertaSegundos: 3,
};

export const ESCUDO = {
  radioProyectiles: 2.6,
  velocidadReflejo: 1.6,
  // Causas que el escudo bloquea: todo ataque de entidades o proyectiles,
  // explosiones, magia y rayos. Caídas, fuego, ahogo, lava y hambre no.
  causasBloqueadas: [
    EntityDamageCause.entityAttack,
    EntityDamageCause.projectile,
    EntityDamageCause.entityExplosion,
    EntityDamageCause.blockExplosion,
    EntityDamageCause.magic,
    EntityDamageCause.sonicBoom,
    EntityDamageCause.lightning,
    EntityDamageCause.fireworks,
    EntityDamageCause.maceSmash,
    EntityDamageCause.ramAttack,
  ],
};

// Nivel 0 = base; cada bloque de diamante sube un nivel.
export const LASER_NIVELES = [
  { dano: 6, alcance: 24 },
  { dano: 9, alcance: 32 },
  { dano: 13, alcance: 40 },
  { dano: 18, alcance: 48 },
];

export const PROPS = {
  nivelLaser: "evilmorty:nivel",
  longitudRayo: "evilmorty:longitud",
  nivelRayo: "evilmorty:nivel",
  yawRayo: "evilmorty:yaw",
  pitchRayo: "evilmorty:pitch",
  duenoDomo: "evilmorty:dueno",
};

// Texto del título que activa la interfaz del ojo (RP/ui/hud_screen.json).
export const OJO_MARCA_ON = "evilmorty:ojo_on";
export const OJO_MARCA_OFF = "evilmorty:ojo_off";
