import { system } from "@minecraft/server";
import { buscarCamino } from "./camino.js";
import { ANIM, ESCUDO, VELOCIDAD } from "./config.js";
import { estructuraEn, mismaEstructura, puertaDe } from "./estructuras.js";
import { nivel } from "./iq.js";
import { abrirPaso, esPorton, esPuerta } from "./puertas.js";
import {
  animate, blockAt, esAgua, flat, impulse, now, rand, reemplazable, superficie, yawHacia,
} from "./util.js";

// Movimiento parecido al de un jugador: camina cerca, corre si el jugador corre o
// se aleja, salta mientras corre (sprint-jump) y, con más IQ, se mueve de lado
// y retrocede tras golpear (w-tap). Con el escudo arriba va despacio.

export function velocidad(npc, valor) {
  try {
    npc.getComponent("minecraft:movement")?.setCurrentValue(valor);
  } catch {
    // Componente no disponible.
  }
}

export function ritmo(npc, state, jugador, dist) {
  if (state.escudoArriba) {
    velocidad(npc, ESCUDO.lento);
    return;
  }
  const v = jugador.getVelocity();
  const jugadorCorre = Math.hypot(v.x, v.z) > 0.2;
  const corre = jugadorCorre || dist > 6;
  velocidad(npc, corre ? VELOCIDAD.correr : VELOCIDAD.caminar);
  if (!npc.isOnGround) return;
  const d = flat(npc.location, jugador.location);

  if (corre && dist > 7 && now() >= (state.cd.salto ?? 0) && Math.random() < 0.6) {
    state.cd.salto = now() + rand(12, 18);
    impulse(npc, { x: d.x * 0.08, y: 0.42, z: d.z * 0.08 });
    return;
  }
  // A media distancia, de vez en cuando rodea al jugador con un paso lateral suave
  // (nunca justo después de golpear ni con tirones).
  const n = nivel(state);
  if (dist > 2.6 && dist < 6 && now() >= (state.cd.lateral ?? 0) && now() - (state.ultimoGolpe ?? -100) > 14) {
    state.cd.lateral = now() + rand(40, 70);
    if (Math.random() < 0.15 + n * 0.3) {
      if (Math.random() < 0.4) state.lado = -(state.lado ?? 1);
      esquivar(npc, jugador, state.lado ?? 1);
    }
  }
}

// Paso lateral suave alrededor del jugador: acelera y frena poco a poco.
const esquivas = new Map();

export function esquivar(npc, objetivo, lado, ticks = 20, fuerza = 0.04) {
  esquivas.set(npc.id, { npc, objetivo, lado, desde: now(), ticks, fuerza });
}

system.runInterval(() => {
  for (const [id, e] of esquivas) {
    const t = now() - e.desde;
    if (!e.npc.isValid || !e.objetivo.isValid || t > e.ticks) {
      esquivas.delete(id);
      continue;
    }
    try {
      const d = flat(e.npc.location, e.objetivo.location);
      const k = Math.sin((t / e.ticks) * Math.PI) * e.fuerza * e.lado;
      impulse(e.npc, { x: -d.z * k, y: 0, z: d.x * k });
    } catch {
      esquivas.delete(id);
    }
  }
}, 1);

// --- Salto guiado ---------------------------------------------------------------------
// Lleva a la entidad en arco (un teletransporte suave por tick) desde donde está hasta
// "destino". El motor de físicas a veces frena a los mobs contra el borde de un
// bloque y el salto con impulso no alcanza; así el salto siempre se completa.
//   alto: cuánto sube por encima del punto más alto; retraso: parte del salto en la
//   que solo sube (para no chocar con el borde); enTick(j, pos) y alTerminar(j).

const saltos = new Map();

/**
 * @param {import("@minecraft/server").Entity} npc
 * @param {{x:number,y:number,z:number}} destino
 * @param {{ticks?:number, alto?:number, retraso?:number, mirar?:{x:number,y:number},
 *   enTick?:(j:any, pos:{x:number,y:number,z:number})=>void, alTerminar?:(j:any)=>void}} [opciones]
 */
export function saltoGuiado(npc, destino, opciones = {}) {
  const { ticks = 7, alto = 0.25, retraso = 0.3, mirar, enTick, alTerminar } = opciones;
  const desde = { ...npc.location };
  saltos.set(npc.id, {
    npc, desde, destino: { ...destino }, ticks, retraso, t: 0, mirar, enTick, alTerminar,
    cima: Math.max(desde.y, destino.y) + alto,
  });
}

export function saltando(npc) {
  return saltos.has(npc.id);
}

function alturaSalto(j, f) {
  const fc = 0.6; // momento de la cima
  if (f <= fc) {
    const u = 1 - f / fc;
    return j.desde.y + (j.cima - j.desde.y) * (1 - u * u);
  }
  const u = (f - fc) / (1 - fc);
  return j.cima + (j.destino.y - j.cima) * u * u;
}

system.runInterval(() => {
  for (const [id, j] of saltos) {
    const npc = j.npc;
    if (!npc.isValid) {
      saltos.delete(id);
      continue;
    }
    try {
      j.t++;
      const f = Math.min(1, j.t / j.ticks);
      const hf = Math.max(0, Math.min(1, (f - j.retraso) / (1 - j.retraso)));
      const s = hf * hf * (3 - 2 * hf);
      const pos = {
        x: j.desde.x + (j.destino.x - j.desde.x) * s,
        y: alturaSalto(j, f),
        z: j.desde.z + (j.destino.z - j.desde.z) * s,
      };
      npc.teleport(pos, { keepVelocity: false, rotation: j.mirar ?? npc.getRotation() });
      j.enTick?.(j, pos);
      if (f >= 1) {
        saltos.delete(id);
        j.alTerminar?.(j);
      }
    } catch {
      saltos.delete(id);
    }
  }
}, 1);

// --- Motor de pasos: camina (o nada) hasta un punto con control por tick ---
// Si está dentro de una casa o un aula (o va hacia una) pasa por la puerta en vez de
// chocar con la pared. Abre puertas y portones a su paso. Sube escalones con un salto
// guiado. Si algo le cierra el paso, busca un camino alrededor (A*) antes de rendirse;
// si está en un pozo sin salida, avisa para que haga una torre y salga.

const motores = new Map();
const atascos = new Map();
const pozos = new Map();

function rutaPorPuertas(npc, destino) {
  const ruta = [];
  try {
    const a = estructuraEn(npc.location);
    const b = estructuraEn(destino);
    if (mismaEstructura(a, b)) return ruta;
    const enHueco = (p) => Math.hypot(npc.location.x - (p.pos.x + 0.5), npc.location.z - (p.pos.z + 0.5)) < 1.1;
    if (a) {
      const p = puertaDe(npc.dimension, a);
      if (p) ruta.push(...(enHueco(p) ? [p.fuera] : [p.dentro, p.fuera]));
    }
    if (b) {
      const p = puertaDe(npc.dimension, b);
      if (p) ruta.push(...(enHueco(p) && !a ? [p.dentro] : [p.fuera, p.dentro]));
    }
  } catch {
    // Sin registro de obras.
  }
  return ruta;
}

export function caminarA(npc, destino, rapidez = 0.2) {
  const previo = motores.get(npc.id);
  // Si ya va al mismo sitio con un rodeo calculado (o buscándolo), solo actualiza la meta.
  if (previo && (previo.rodeo || previo.buscando)
    && Math.hypot(previo.destino.x - destino.x, previo.destino.z - destino.z) < 1.2) {
    previo.destino = { ...destino };
    previo.rapidez = rapidez;
    return;
  }
  motores.set(npc.id, {
    npc, destino: { ...destino }, rapidez, desde: now(), control: { ...npc.location }, revision: now(),
    ruta: rutaPorPuertas(npc, destino), busquedas: 0, extra: 0, tic: 0,
  });
  atascos.delete(npc.id);
}

// ¿Su última caminata terminó porque algo le cerraba el paso?
export function seAtasco(npc) {
  return now() - (atascos.get(npc.id) ?? -1000) < 60;
}

// Si quedó en un pozo o una cueva sin salida caminando, la altura a la que quiere
// subir (una sola vez por aviso).
export function salidaDePozo(npc) {
  const p = pozos.get(npc.id);
  if (!p) return undefined;
  pozos.delete(npc.id);
  return now() - p.t < 40 ? p.y : undefined;
}

export function detener(npc) {
  motores.delete(npc.id);
}

export function caminando(npc) {
  return motores.has(npc.id);
}

export function destinoActual(npc) {
  return motores.get(npc.id)?.destino;
}

function delante(npc, d, alto, lejos = 0.7) {
  return blockAt(npc.dimension, { x: npc.location.x + d.x * lejos, y: npc.location.y + alto, z: npc.location.z + d.z * lejos });
}

// ¿Se puede estar de pie en ese hueco? (aire, plantas, puertas y portones abiertos o no)
function libre(b) {
  return !b || reemplazable(b) || esPuerta(b) || esPorton(b) || /(carpet|torch|_sign|rail|_button|pressure_plate)$/.test(b.typeId);
}

// ¿Es un escalón al que se puede subir? (no vallas, muros ni puertas)
function escalon(b) {
  if (!b || reemplazable(b) || b.isLiquid || libre(b)) return false;
  return !/(fence|_wall|_pane|iron_bars|magma|cactus|campfire|fire)$/.test(b.typeId) && !b.typeId.includes("lava");
}

// Sube un escalón de un bloque con un salto guiado hasta el centro del bloque.
export function escalar(npc, d) {
  const x = Math.floor(npc.location.x + d.x * 0.7);
  const z = Math.floor(npc.location.z + d.z * 0.7);
  const y = Math.floor(npc.location.y + 0.3) + 1;
  const techo = blockAt(npc.dimension, { x: npc.location.x, y: npc.location.y + 2.2, z: npc.location.z });
  const bajo = !libre(techo);
  saltoGuiado(npc, { x: x + 0.5, y, z: z + 0.5 }, { ticks: bajo ? 6 : 7, alto: bajo ? 0.04 : 0.22, retraso: 0.3 });
}

function abrirPuertas(npc, d) {
  for (const [lejos, alto] of [[0, 0.3], [0.45, 0.3], [0.9, 0.3], [0.45, 1.3]]) {
    if (abrirPaso(npc.dimension, delante(npc, d, alto, lejos))) {
      animate(npc, ANIM.colocar);
      return true;
    }
  }
  return false;
}

function bajoTierra(npc) {
  const top = superficie(npc.dimension, npc.location.x, npc.location.z);
  return !!top && top.location.y > npc.location.y + 1.5;
}

// Algo le cierra el paso: busca un rodeo. Si no hay, se rinde (y si está en un pozo,
// lo avisa para que haga una torre).
function buscarRodeo(id, m) {
  const meta = m.ruta[0] ?? m.destino;
  m.busquedas++;
  m.buscando = true;
  const pedido = buscarCamino(m.npc, meta, (camino) => {
    m.buscando = false;
    if (motores.get(id) !== m || !m.npc.isValid) return;
    if (!camino?.puntos.length) {
      motores.delete(id);
      atascos.set(id, now());
      const sube = meta.y - m.npc.location.y;
      if (!camino && sube > 1.5 && sube < 40 && bajoTierra(m.npc)) pozos.set(id, { y: meta.y, t: now() });
      return;
    }
    m.ruta = m.ruta.length ? [...camino.puntos, ...m.ruta.slice(1)] : camino.puntos;
    m.rodeo = true;
    m.extra += 240;
    m.control = { ...m.npc.location };
    m.revision = now();
  });
  if (!pedido) {
    m.buscando = false;
    return false;
  }
  return true;
}

system.runInterval(() => {
  for (const [id, m] of motores) {
    const npc = m.npc;
    if (!npc.isValid || now() - m.desde > 400 + m.extra) {
      motores.delete(id);
      continue;
    }
    if (m.buscando || saltos.has(id)) continue;
    try {
      m.tic++;
      const meta = m.ruta[0] ?? m.destino;
      const final = !m.ruta.length;
      const d = flat(npc.location, meta);
      const v = npc.getVelocity();
      if (d.d < (final ? 0.3 : 0.5)) {
        if (!final) {
          m.ruta.shift();
          continue;
        }
        motores.delete(id);
        impulse(npc, { x: -v.x * 0.7, y: 0, z: -v.z * 0.7 });
        continue;
      }
      if (m.tic % 3 === 0 && abrirPuertas(npc, d)) {
        m.control = { ...npc.location };
        m.revision = now();
      }
      const enAgua = npc.isInWater;
      // Pared de dos bloques delante (no un escalón): busca el rodeo enseguida.
      if (!enAgua && m.busquedas === 0 && m.tic > 6 && m.tic % 5 === 0 && d.d > 1.2) {
        const pie = delante(npc, d, 0.3, 0.6);
        const cabeza = delante(npc, d, 1.3, 0.6);
        if (pie && cabeza && !libre(pie) && !libre(cabeza) && !pie.isLiquid && buscarRodeo(id, m)) continue;
      }
      // Si en 1,5 s casi no avanzó, algo le cierra el paso: busca otro camino o se rinde.
      if (now() - m.revision >= 30) {
        const avance = Math.hypot(npc.location.x - m.control.x, npc.location.z - m.control.z);
        m.control = { ...npc.location };
        m.revision = now();
        if (avance < 0.4) {
          if (m.busquedas < 2 && buscarRodeo(id, m)) continue;
          motores.delete(id);
          atascos.set(id, now());
          continue;
        }
      }
      const quiero = Math.min(m.rapidez, d.d * 0.45);
      // En el suelo la fricción frena mucho: se compensa como lo haría la entrada de
      // un jugador. En el agua nada con brazadas suaves.
      const k = npc.isOnGround ? 1.8 : enAgua ? 0.9 : 0.35;
      const freno = npc.isOnGround ? 1 : enAgua ? 0.5 : 0.3;
      let vy = 0;
      if (enAgua) {
        const cabeza = blockAt(npc.dimension, { x: npc.location.x, y: npc.location.y + 1.5, z: npc.location.z });
        if (esAgua(cabeza)) vy = 0.05; // sube a respirar
        const pie = delante(npc, d, 0.3);
        if (pie && !reemplazable(pie) && !pie.isLiquid && reemplazable(delante(npc, d, 1.3)) && reemplazable(delante(npc, d, 2.1))) {
          vy = 0.34; // sale del agua a la orilla
        }
      }
      impulse(npc, { x: d.x * quiero * k - v.x * freno, y: vy, z: d.z * quiero * k - v.z * freno });
      npc.setRotation({ x: 0, y: yawHacia(npc.location, meta) });
      if (!enAgua && npc.isOnGround && now() >= (m.saltoHasta ?? 0)) {
        const pie = delante(npc, d, 0.3);
        if (escalon(pie) && libre(delante(npc, d, 1.3)) && libre(delante(npc, d, 2.3))) {
          m.saltoHasta = now() + 12;
          escalar(npc, d);
          m.control = { ...npc.location }; // el salto cuenta como avance
          m.revision = now() + 8;
        }
      }
    } catch {
      motores.delete(id);
    }
  }
}, 1);
