import { EntityDamageCause } from "@minecraft/server";

// Ajustes e identificadores compartidos. Deben coincidir con docs/ASSET_REGISTRY.md.

export const ITEMS = {
  parche: "evilmorty:parche",
  manoLaser: "evilmorty:mano_laser",
  control: "evilmorty:control",
};

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
  laserDestello: "evilmorty:laser_destello",
  laserImpacto: "evilmorty:laser_impacto",
  mejora: "evilmorty:mejora",
  parcheDestello: "evilmorty:parche_destello",
};

export const ANIMATIONS = {
  laserDisparo: "animation.evilmorty.player.laser_disparo",
  escudoActivar: "animation.evilmorty.player.escudo_activar",
  mejora: "animation.evilmorty.player.mejora",
};

// Sonidos opcionales: deja "" hasta que añadas tus archivos y los declares
// en RP/sounds/sound_definitions.json con estos nombres.
export const SOUNDS = {
  escudoOn: "",
  escudoOff: "",
  escudoImpacto: "",
  laser: "",
  mejora: "",
  ojoOn: "",
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
};

export const PREDICCION = {
  radio: 24,
  maxObjetivos: 6,
  segundos: 1,
  puntos: 4,
  velocidadMinima: 0.03,
  alcanceFicha: 32,
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
