import { vida } from "../dano.js";
import { now } from "../util.js";
import { INFINITO_CFG, NOMBRE_INFINITO } from "./config.js";
import { progreso } from "./determinacion.js";
import { fase, tramo } from "./fases.js";

// Personalidad: observa antes de atacar, celebra un buen combo, cambia de actitud cuando va
// perdiendo, muestra confianza y se vuelve más serio y callado cuanto más alta es su fase.
// Habla con frases cortas encima de la cabeza, donde también se ven su fase y su
// determinación.

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
const COLOR_TRAMO = ["§f", "§e", "§6", "§c", "§4§l"];

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
  actualizarNombre(e, s, true);
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

function barra(p) {
  const n = Math.round(p * 8);
  return `§6${"|".repeat(n)}§8${"|".repeat(8 - n)}`;
}

// Nombre de 2 o 3 líneas: (frase) / nombre / fase y determinación.
export function actualizarNombre(e, s, ya = false) {
  if (!ya && now() < (s.cd.nombre ?? 0)) return;
  s.cd.nombre = now() + 10;
  const f = fase(s.fase);
  const t = tramo(s.fase);
  const det = Math.floor(s.determinacion);
  const lineaFase = s.fase >= 20
    ? `§4§lINFINITE DETERMINATION §r§c${det}`
    : `§7F${s.fase} §f${f.nombre} §8· §6DET ${det} ${barra(progreso(s))}`;
  const estado = s.etapa === "derribado" ? "\n§c§lDERRIBADO §r§7(¡séllalo!)"
    : s.etapa === "cargado" ? "\n§7lo llevan a recuperarse"
      : s.etapa === "recuperando" ? "\n§7recuperándose..." : "";
  const frase = now() < s.fraseHasta && s.frase ? `§f«${s.frase}»\n` : "";
  const texto = `${frase}${COLOR_TRAMO[t]}${NOMBRE_INFINITO}§r\n${lineaFase}${estado}`;
  if (texto === s.nombre) return;
  s.nombre = texto;
  try {
    e.nameTag = texto;
  } catch {
    // Entidad descargada.
  }
}
