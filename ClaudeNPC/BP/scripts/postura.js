import { EVENTO, PROP } from "./config.js";

// Cambios de la entidad que hace el paquete de comportamiento con eventos:
// perseguir o no al jugador (la IA de ataque se quita y se pone) y sentarse.

function evento(npc, nombre) {
  try {
    npc.triggerEvent(nombre);
    return true;
  } catch {
    return false;
  }
}

function propiedad(npc, nombre, valor) {
  try {
    npc.setProperty(nombre, valor);
  } catch {
    // Entidad sin la propiedad (paquete antiguo) o descargada.
  }
}

// true: persigue y ataca a los jugadores; false: los ignora (por ejemplo, en clase).
export function hostil(npc, state, activo) {
  if (state.hostil === activo) return;
  state.hostil = activo;
  evento(npc, activo ? EVENTO.hostil : EVENTO.calmar);
}

// Postura sentada: caja de colisión pequeña, no se le puede empujar y piernas al frente.
export function sentarse(npc, state, activo) {
  if (state.sentado === activo) return;
  state.sentado = activo;
  evento(npc, activo ? EVENTO.sentar : EVENTO.levantar);
  propiedad(npc, PROP.sentado, activo);
}

// Brazo con el escudo levantado (lo dibuja el paquete de recursos).
export function poseEscudo(npc, activo) {
  propiedad(npc, PROP.escudo, activo);
}

// Al cargar un Claude (o tras recargar el mundo) se deja de pie y tranquilo,
// sin depender de lo que quedó guardado.
export function reiniciarPostura(npc, state) {
  state.sentado = true;
  sentarse(npc, state, false);
  poseEscudo(npc, false);
  state.hostil = undefined;
  hostil(npc, state, true);
}
