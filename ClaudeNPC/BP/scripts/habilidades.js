import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { NPC, PARTICLES } from "./config.js";
import { obtenerEstado } from "./estado.js";
import { avisar, burst, sound } from "./util.js";

// Habilidades: lo que cada Claude aprende en clase (según el tema y el maestro) y
// perfecciona practicando. Cada tema tiene niveles y cada nivel desbloquea una
// variante nueva: otra combinación de redstone, otro tipo de reflejo, otra obra...
// No todos llegan igual de lejos: según su personalidad y su talento, unos solo
// estudian el tema (se quedan en el nivel 2 o 3) y otros lo perfeccionan (nivel 5).

export const HABILIDADES = {
  construccion: { nombre: "Construcción", niveles: ["Casa", "Jardín", "Torre vigía", "Estatua de Claude", "Fuente"] },
  redstone: { nombre: "Redstone", niveles: ["Torreta de flechas", "Torreta doble", "Torreta de TNT", "Cañón de TNT", "Bobina de Tesla"] },
  reflejos: { nombre: "Reflejos", niveles: ["Reflejo señuelo", "Dos reflejos", "Cambio de lugar", "Destello cegador", "Contraataque"] },
  escudo: { nombre: "Escudo", niveles: ["Reacción rápida", "Aguante", "Devolver flechas"] },
  vuelo: { nombre: "Vuelo", niveles: ["Elytra y maza", "Dúo de viento", "Impulso de viento", "Doble picada"] },
  arco: { nombre: "Arco", niveles: ["Puntería", "Flechas de fuego", "Tres flechas", "Tiro perfecto", "Lluvia de flechas"] },
  perlas: { nombre: "Perlas", niveles: ["Perla", "Por la espalda", "Doble perla", "Perla y golpe"] },
  torres: { nombre: "Torres y puentes", niveles: ["Torre rápida", "Puente rápido", "Sin fallar"] },
  mineria: { nombre: "Minería", niveles: ["Pico rápido", "Olfato de minerales", "Veta completa"] },
  agua: { nombre: "Agua", niveles: ["Clutch", "Nado rápido", "Respirar bajo el agua"] },
  calculo: { nombre: "Cálculo", niveles: ["Aprende más rápido", "Predice tu movimiento", "Reacción veloz"] },
  quimica: { nombre: "Química", niveles: ["Poción de velocidad", "Poción de fuerza", "Regeneración", "Poción de veneno", "Resistencia al fuego"] },
};

// Talento por personalidad (1 = normal). Lo que no aparece vale 0,8.
const TALENTO = {
  minero: { mineria: 1.45, redstone: 1.05, torres: 1, agua: 0.9 },
  constructor: { construccion: 1.45, torres: 1.3, redstone: 1.05 },
  explorador: { perlas: 1.35, vuelo: 1.35, agua: 1.1, arco: 1 },
  lenador: { construccion: 1.1, torres: 1.15, vuelo: 1, escudo: 0.95 },
  granjero: { quimica: 1.25, construccion: 1.1, agua: 1 },
  pescador: { agua: 1.45, arco: 1.1, quimica: 0.95 },
  arquero: { arco: 1.5, reflejos: 1.1, calculo: 1.05, perlas: 1 },
  inventor: { redstone: 1.5, calculo: 1.3, quimica: 1.2, construccion: 1 },
  dormilon: { quimica: 0.95, calculo: 0.9 },
  guerrero: { reflejos: 1.4, escudo: 1.35, vuelo: 1.2, perlas: 1.1, arco: 1 },
};
const PROP = "claudenpc:habilidades";

// Número estable a partir del id (cada Claude tiene su propio talento).
function semilla(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function preparar(npc, s) {
  if (s.hab) return s.hab;
  const azar = semilla(npc.id);
  const base = TALENTO[s.pers?.id] ?? {};
  const apt = {};
  for (const id of Object.keys(HABILIDADES)) apt[id] = Math.max(0.45, Math.min(1.6, (base[id] ?? (s.pers?.id === "dormilon" ? 0.7 : 0.8)) + (azar() - 0.5) * 0.4));
  let niveles = {};
  try {
    const raw = npc.getDynamicProperty(PROP);
    if (typeof raw === "string") niveles = JSON.parse(raw) ?? {};
  } catch {
    niveles = {};
  }
  s.hab = { apt, niveles, obras: niveles._obras ?? [] };
  return s.hab;
}

function guardar(npc, s) {
  try {
    npc.setDynamicProperty(PROP, JSON.stringify({ ...s.hab.niveles, _obras: s.hab.obras }));
  } catch {
    // Entidad descargada.
  }
}

// Hasta qué nivel puede llegar en ese tema: los que tienen talento lo perfeccionan.
export function maximo(s, id) {
  const apt = s.hab?.apt?.[id] ?? 0.8;
  const tope = apt >= 1.25 ? 5 : apt >= 1 ? 4 : apt >= 0.78 ? 3 : 2;
  return Math.min(tope, HABILIDADES[id]?.niveles.length ?? 0);
}

// Nivel entero (0 = no lo sabe).
export function nivelHab(npc, s, id) {
  const h = preparar(npc, s);
  return Math.min(maximo(s, id), Math.floor(h.niveles[id] ?? 0));
}

export function sabe(npc, s, id, nivel = 1) {
  return nivelHab(npc, s, id) >= nivel;
}

// Elige una variante desbloqueada (la más nueva sale más a menudo). Devuelve el nivel.
export function variante(npc, s, id) {
  const n = nivelHab(npc, s, id);
  if (n <= 0) return 0;
  let total = 0;
  for (let k = 1; k <= n; k++) total += k;
  let r = Math.random() * total;
  for (let k = 1; k <= n; k++) {
    r -= k;
    if (r <= 0) return k;
  }
  return n;
}

function nombreDe(s) {
  return `Claude${s.pers ? ` ${s.pers.titulo}` : ""}`;
}

function subir(npc, s, id, cantidad) {
  const h = preparar(npc, s);
  const tope = maximo(s, id);
  const antes = Math.min(tope, Math.floor(h.niveles[id] ?? 0));
  if (antes >= tope) return;
  h.niveles[id] = Math.min(tope, (h.niveles[id] ?? 0) + cantidad);
  const despues = Math.floor(h.niveles[id]);
  guardar(npc, s);
  if (despues <= antes) return;
  const hab = HABILIDADES[id];
  const total = hab.niveles.length;
  burst(npc, PARTICLES.idea, { x: 0, y: 2.4, z: 0 });
  sound(npc, "random.levelup", 1.4, 0.6);
  let texto = `§b✦ ${nombreDe(s)} aprendió §l${hab.niveles[despues - 1]}§r §7(${hab.nombre} ${despues}/${total})`;
  if (despues >= tope) {
    texto = tope >= total ? `§6✦ ¡${nombreDe(s)} perfeccionó ${hab.nombre}! §7(${hab.niveles[despues - 1]})`
      : `§e✦ ${nombreDe(s)} aprendió §l${hab.niveles[despues - 1]}§r §7(${hab.nombre}: hasta aquí llega estudiando)`;
  }
  avisar(npc.dimension, npc.location, texto, 32);
}

// Al terminar una clase sobre ese tema. Con un maestro genio aprende más.
export function estudiar(npc, s, id, genio = false) {
  if (!HABILIDADES[id]) return;
  preparar(npc, s);
  subir(npc, s, id, 0.55 * s.hab.apt[id] * (genio ? 1.4 : 1));
}

// Cada vez que usa la habilidad (o la practica en su tiempo libre) mejora un poco.
export function practicar(npc, s, id, cantidad = 0.04) {
  if (!HABILIDADES[id]) return;
  preparar(npc, s);
  if ((s.hab.niveles[id] ?? 0) <= 0) return; // primero hay que estudiarla en clase
  subir(npc, s, id, cantidad * s.hab.apt[id]);
}

// Habilidad que todavía puede mejorar practicando (la de mayor talento primero).
export function porPerfeccionar(npc, s) {
  const h = preparar(npc, s);
  const lista = Object.keys(HABILIDADES).filter((id) => (h.niveles[id] ?? 0) >= 1 && Math.floor(h.niveles[id]) < maximo(s, id));
  lista.sort((a, b) => h.apt[b] - h.apt[a]);
  return lista[0];
}

// Obras especiales de construcción (jardín, torre vigía, estatua, fuente) que ya hizo.
export function obrasHechas(npc, s) {
  return preparar(npc, s).obras;
}

export function obraHecha(npc, s, tipo) {
  const h = preparar(npc, s);
  if (!h.obras.includes(tipo)) h.obras.push(tipo);
  guardar(npc, s);
}

function estrellas(n, tope, total) {
  let t = "";
  for (let k = 1; k <= total; k++) t += k <= n ? "§e★" : k <= tope ? "§7☆" : "§8·";
  return t;
}

// Tócalo (botón "Interactuar" en el celular) para ver qué sabe.
export function mostrarHabilidades(player, npc, s) {
  preparar(npc, s);
  const lineas = [];
  for (const [id, hab] of Object.entries(HABILIDADES)) {
    const n = nivelHab(npc, s, id);
    const tope = maximo(s, id);
    const total = hab.niveles.length;
    const papel = tope >= total ? "§a(lo perfecciona)" : "§7(solo lo estudia)";
    const ultimo = n ? `§f${hab.niveles[n - 1]}` : "§8sin estudiar";
    lineas.push(`§l${hab.nombre}§r ${estrellas(n, tope, total)} ${papel}\n   ${ultimo}`);
  }
  new ActionFormData()
    .title(`§l${nombreDe(s)}`)
    .body(`§dIQ ${Math.floor(s.iq)}§r\n§7Lo que aprende en clase sube de nivel y desbloquea variantes. Practicando las perfecciona.\n\n${lineas.join("\n")}`)
    .button("Cerrar")
    .show(player)
    .catch(() => {});
}

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  if (target.typeId !== NPC) return;
  const s = obtenerEstado(target);
  system.run(() => mostrarHabilidades(player, target, s));
});
