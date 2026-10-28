// Configuración central de La Cobra Ultimate.
// Todos los valores de equilibrio están aquí: tiempos en segundos salvo que se indique.

export const TPS = 20;

export const CONFIG = {
  energia: {
    max: 100,
    inicial: 100,
    regenPorSegundo: 2,
    bonusArmaduraCompleta: 2,
    bonusAmuleto: 1,
    porGolpeEspada: 1,
    porGolBalon: 3,
  },

  habilidades: {
    instinto: { coste: 15, cooldown: 12, duracion: 8, nivelVelocidad: 1, bonusDanio: 3 },
    remate: { coste: 25, cooldown: 6, carga: 1.2, velocidad: 2.2, danio: 14, radio: 3.5 },
    veneno: { coste: 20, cooldown: 8, duracion: 6, alcance: 24, danio: 6, velocidad: 0.6 },
    dominio: { coste: 40, cooldown: 30, duracion: 10, radio: 8, danioRayo: 2, danioFinal: 6 },
    suprema: { coste: 100, cooldown: 90, radio: 12, danio: 28 },
  },

  objetos: {
    totem: { cooldown: 60, duracion: 15, radioGuardiana: 6, danioGuardiana: 4 },
    guantes: { coste: 15, cooldown: 20, radio: 6, duracionAtajada: 3, reduccionProyectiles: 0.4 },
    espada: { probVeneno: 0.2 },
    balon: { radioImpacto: 1.5, danio: 5 },
  },

  jefe: {
    radioJugadores: 40,
    maxEsbirros: 4,
    intervaloAtaque: { 1: 8, 2: 6, 3: 5 },
    danioOnda: 10,
    radioOnda: 7,
    danioRayo: 8,
    danioEscupitajo: 6,
    distanciaInvocacion: 96,
  },

  limites: {
    maxTareas: 160,
    maxObjetivosArea: 14,
    maxSerpientesPorJugador: 3,
  },

  hud: {
    // muestra la barra solo cuando el jugador lleva un objeto de La Cobra o hay algo activo
    intervaloTicks: 10,
  },
};

export const HABILIDADES = ["instinto", "remate", "veneno", "dominio", "suprema"];

export const NOMBRES = {
  instinto: "Instinto de la Cobra",
  remate: "Remate Legendario",
  veneno: "Veneno Serpentino",
  dominio: "Dominio Absoluto",
  suprema: "La Cobra Suprema",
};

export const ABREV = {
  instinto: "INS",
  remate: "REM",
  veneno: "VEN",
  dominio: "DOM",
  suprema: "SUP",
};
