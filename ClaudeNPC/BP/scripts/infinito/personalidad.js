import { vida } from "../dano.js";
import { avisar, now } from "../util.js";
import { INFINITO_CFG, NOMBRE_INFINITO } from "./config.js";

// Personalidad: observa antes de atacar, celebra un buen combo, cambia de actitud cuando va
// perdiendo, muestra confianza y se vuelve más serio y callado cuanto más alta es su fase.
// Encima de su cabeza solo se ve la DETERMINACIÓN; sus frases cortas salen en la barra de
// acción de los jugadores cercanos.

const FRASES = {
  observar: [["Hola... ¿peleamos?", "A ver qué haces."], ["Te estoy mirando.", "Muéstrame qué sabes."], ["Analizando.", "..."]],
  combo: [["¡Eso!", "¡Me salió!"], ["Limpio.", "Combo."], ["Perfecto.", ""]],
  bloqueo: [["¡Lo paré!", "¡Escudo!"], ["Bloqueado.", "No pasa."], ["No.", ""]],
  patron: [["¡Siempre haces eso!", "Ya entendí."], ["Ya vi tu patrón.", "Te leí."], ["Predecible.", "Otra vez lo mismo."]],
  perdiendo: [["¡Ay! ¡Espera!", "¡Ya verás!"], ["Todavía no.", "Aguanta..."], ["Aprendo.", "Sigo."]],
  ganando: [["¡Voy ganando!", "¡Jaja!"], ["¿Eso es todo?", "Sigue."], ["", "..."]],
  retirada: [["¡Un momento!", "¡Pausa!"], ["Reagrupando.", "Ahora vuelvo."], ["", ""]],
  evolucion: [["¡Soy más fuerte!", "¡Subí!"], ["Siguiente nivel.", "Más fuerte."], ["Determinación.", "Más."]],
  victoria: [["¡GANÉ!", "¡GG!"], ["GG.", "Buena pelea."], ["GG.", ""]],
  derribado: [["No... todavía no...", "..."], ["No... me rindo...", "..."], ["...", "..."]],
  levantarse: [["¡Volví!", "¡Otra vez!"], ["Mi determinación no se rompe.", "Volví."], ["Otra vez.", "Sigo aquí."]],
  sellado: [["...", "..."], ["...", "..."], ["...", "..."]],
};

const banda = (n) => (n >= 16 ? 2 : n >= 6 ? 1 : 0);

export function decir(e, s, situacion, forzar = false) {
  if (!INFINITO_CFG.frases) return;
  if (!forzar && now() < (s.cd.frase ?? 0)) return;
  // Más callado cuanto más alta la fase (las frases importantes salen siempre).
  if (!forzar && Math.random() < (s.fase - 1) * 0.025) return;
  const lista = FRASES[situacion]?.[banda(s.fase)];
  if (!lista) return;
  const txt = lista[Math.floor(Math.random() * lista.length)];
  if (!txt) return;
  s.frase = txt;
  s.fraseHasta = now() + 50;
  s.cd.frase = now() + (forzar ? 20 : 80);
  // Las frases salen abajo, en la barra de acción de los que están cerca (no encima de él).
  avisar(e.dimension, e.location, `§c${NOMBRE_INFINITO}: §f${txt}`, 16);
}

// Actitud según cómo va la pelea.
export function actitud(e, s) {
  const { actual, max } = vida(e);
  const salud = actual / Math.max(1, max);
  const dados = s.combate?.danoDado ?? 0;
  const recibidos = s.combate?.danoRecibido ?? 0;
  let a = "confiado";
  if (s.fase >= 20) a = "leyenda";
  else if (salud < 0.35) a = "determinado";
  else if (recibidos > dados + 6) a = "frustrado";
  else if (s.fase >= 16) a = "serio";
  else if (dados > recibidos + 6) a = "confiado";
  else a = "concentrado";
  if (a !== s.actitud) {
    const antes = s.actitud;
    s.actitud = a;
    if (a === "frustrado" || (a === "determinado" && antes !== "determinado")) decir(e, s, "perdiendo");
    else if (a === "confiado" && antes === "concentrado" && dados > 10) decir(e, s, "ganando");
  }
  return a;
}

// Encima de la cabeza solo se ve su DETERMINACIÓN (nada más).
export function actualizarNombre(e, s, ya = false) {
  if (!ya && now() < (s.cd.nombre ?? 0)) return;
  s.cd.nombre = now() + 10;
  const texto = `§c§lDETERMINACIÓN §r§e${Math.floor(s.determinacion)}`;
  if (texto === s.nombre) return;
  s.nombre = texto;
  try {
    e.nameTag = texto;
  } catch {
    // Entidad descargada.
  }
}
