// Identificadores y ajustes compartidos. Deben coincidir con docs/ASSET_REGISTRY.md.

export const ITEM_PARCHE = "estr:parche";
export const ITEM_TRANSMISOR = "estr:transmisor";

export const PARTICLES = {
  portalRing: "estr:portal_ring",
  portalSpiral: "estr:portal_spiral",
  mindWave: "estr:mind_wave",
  mindLink: "estr:mind_link",
  stealthSmoke: "estr:stealth_smoke",
  patchGlint: "estr:patch_glint",
};

export const ANIMATIONS = {
  portal: "animation.estr.player.portal_cast",
  signal: "animation.estr.player.signal_cast",
  escape: "animation.estr.player.escape_cast",
  stealth: "animation.estr.player.stealth_cast",
};

// Sonidos opcionales: deja "" hasta que añadas tus propios archivos y
// los declares en RP/sounds/sound_definitions.json con estos nombres.
export const SOUNDS = {
  portal: "",
  signal: "",
  escape: "",
  stealth: "",
};

// Tiempos en ticks (20 ticks = 1 segundo).
export const COOLDOWNS = {
  portal: 60,
  signal: 400,
  escape: 600,
  stealth: 800,
};

export const PORTAL_RANGE = 32;
export const PORTAL_OPEN_DELAY = 6;
export const ESCAPE_DELAY = 20;
export const SIGNAL_RADIUS = 12;
export const SIGNAL_MAX_TARGETS = 16;
export const SIGNAL_DURATION = 120;
export const STEALTH_DURATION = 400;

export const PASSIVE_INTERVAL = 40;
export const NIGHT_VISION_DURATION = 300;

export const ABILITY_PROPERTY = "estr:ability";
