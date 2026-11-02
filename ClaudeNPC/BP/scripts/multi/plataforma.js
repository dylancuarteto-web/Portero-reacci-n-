import { system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, MULTI_CFG, NPC, PARTICLES, PLATAFORMA } from "../config.js";
import { golpeBasico } from "../duelo.js";
import { estados } from "../estado.js";
import { ponerHaciendo } from "../iq.js";
import { saltando, saltoGuiado } from "../movimiento.js";
import { hostil, sentarse } from "../postura.js";
import { animate, avisar, blockAt, distancia, now, particleAt, reemplazable, sound, soundAt } from "../util.js";
import { protegido } from "../estructuras.js";
import { sePuedeQuitar, sueloBajo, sueloEn } from "./combinaciones.js";

// Plataforma voladora del Robot multi. Sirve cuando te subes alto y te pones techo (o la
// rampa no bastó): el robot construye una plataforma de 3 x 3, la agarra con la pinza,
// suben 3 Claudes que se sientan y vuela con ellos hasta tu lado. Lo que estorba en el
// camino (pared, techo o suelo) lo pican los Claudes sentados y el taladro del robot. Al
// llegar: si junto a ti hay suelo, les conviene bajarse y se bajan de un salto a pelear;
// si no (estás sobre un pilar), te pelean sentados desde la plataforma; si hay una pared
// entre ustedes, la pican primero.

const ASIENTOS = [{ x: -0.85, z: -0.55 }, { x: 0.85, z: -0.55 }, { x: 0, z: 0.85 }];
const GROSOR = 0.19;
const PASO = 0.22; // bloques por tick volando
const activas = new Set();

const piso = (l) => ({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });

function libre(b) {
  return !b || b.isAir || b.isLiquid || reemplazable(b);
}

function solido(b) {
  return !!b && !b.isAir && !b.isLiquid && !reemplazable(b);
}

// ¿Tienes techo (algo sólido de 2 a 4 bloques sobre tus pies)?
export function techoSobre(dim, jugador) {
  const l = jugador.location;
  for (let h = 2; h <= 4; h++) if (solido(blockAt(dim, { x: l.x, y: l.y + h, z: l.z }))) return true;
  return false;
}

// Sitio llano de 3 x 3, libre hasta 3 bloques arriba, cerca de los Claudes.
function sitio(dim, centro) {
  for (const [ox, oz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [-3, -3], [3, -3], [-3, 3]]) {
    const cx = Math.floor(centro.x) + ox;
    const cz = Math.floor(centro.z) + oz;
    const y = sueloEn(dim, cx, centro.y, cz);
    let ok = true;
    for (let dx = -1; dx <= 1 && ok; dx++) {
      for (let dz = -1; dz <= 1 && ok; dz++) {
        if (!solido(blockAt(dim, { x: cx + dx, y: y - 1, z: cz + dz })) || protegido({ x: cx + dx, y, z: cz + dz })) ok = false;
        for (let h = 0; h <= 3 && ok; h++) if (!libre(blockAt(dim, { x: cx + dx, y: y + h, z: cz + dz }))) ok = false;
      }
    }
    if (ok) return { x: cx, y, z: cz };
  }
  return undefined;
}

/** Plan: los 9 bloques de la plataforma (esquinas de hierro, centro de cobre, tablas). */
export function planPlataforma(dim, claudes, jugador) {
  if (!claudes.length) return undefined;
  const c = claudes.reduce((a, n) => ({ x: a.x + n.location.x / claudes.length, y: Math.min(a.y, n.location.y), z: a.z + n.location.z / claudes.length }),
    { x: 0, y: Infinity, z: 0 });
  const s = sitio(dim, c);
  if (!s) return undefined;
  const acciones = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const bloque = dx && dz ? "minecraft:iron_block" : !dx && !dz ? "minecraft:copper_block" : "minecraft:spruce_planks";
      acciones.push({ tipo: "poner", pos: { x: s.x + dx, y: s.y, z: s.z + dz }, bloque });
    }
  }
  return { nombre: "plataforma voladora", acciones, plataforma: { sitio: s, jugador } };
}

// --- Vuelo ---------------------------------------------------------------------------------

// Bloques sólidos que ocupa la plataforma en "pos" (la capa de la plataforma y el sitio de
// los Claudes sentados encima).
function ocupadas(dim, pos, jugador) {
  const out = [];
  const visto = new Set();
  for (const ox of [-1.4, -0.45, 0.45, 1.4]) {
    for (const oz of [-1.4, -0.45, 0.45, 1.4]) {
      for (const oy of [-0.1, 0.4, 1.3]) {
        const c = piso({ x: pos.x + ox, y: pos.y + oy, z: pos.z + oz });
        const k = `${c.x},${c.y},${c.z}`;
        if (visto.has(k)) continue;
        visto.add(k);
        if (jugador && c.x === Math.floor(jugador.location.x) && c.z === Math.floor(jugador.location.z)) continue;
        if (solido(blockAt(dim, c))) out.push(c);
      }
    }
  }
  return out;
}

// Un paso hacia la meta. Si algo cierra el paso, prueba a subir; si tampoco, avisa qué
// bloques estorban (los pican).
function avanzar(P) {
  const meta = P.meta;
  if (!meta) return;
  const dx = meta.x - P.pos.x;
  const dy = meta.y - P.pos.y;
  const dz = meta.z - P.pos.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.05) {
    P.llego = true;
    P.bloqueo = undefined;
    return;
  }
  P.llego = false;
  const paso = Math.min(PASO, d);
  const sig = { x: P.pos.x + (dx / d) * paso, y: P.pos.y + (dy / d) * paso, z: P.pos.z + (dz / d) * paso };
  const estorba = ocupadas(P.dim, sig, P.jugador);
  if (!estorba.length) {
    P.pos = sig;
    P.bloqueo = undefined;
    return;
  }
  // Lejos del destino rodea por arriba (un cerro, un árbol); cerca, pica lo que estorba.
  const arriba = { x: P.pos.x, y: P.pos.y + paso, z: P.pos.z };
  if (Math.abs(dy) < 0.5 && P.subidas < 6 && (P.lejosDestino ?? 99) > 4 && !ocupadas(P.dim, arriba, P.jugador).length) {
    P.pos = arriba;
    P.subidas += paso;
    return;
  }
  P.bloqueo = estorba;
}

// Coloca la plataforma, los Claudes sentados y el robot que la sostiene.
function colocar(P) {
  const r = P.r;
  const mira = P.jugador?.isValid ? P.jugador.location : { x: P.pos.x, y: P.pos.y, z: P.pos.z + 1 };
  try {
    if (P.ent?.isValid) P.ent.teleport({ x: P.pos.x, y: P.pos.y - GROSOR, z: P.pos.z }, { keepVelocity: false });
  } catch {
    // Sin teletransporte.
  }
  for (const x of P.pasajeros) {
    if (!x.sentado || !x.n.isValid) continue;
    const a = ASIENTOS[x.k];
    try {
      x.n.teleport({ x: P.pos.x + a.x, y: P.pos.y, z: P.pos.z + a.z }, { keepVelocity: false, facingLocation: { x: mira.x, y: P.pos.y + 1.2, z: mira.z } });
    } catch {
      // Claude no disponible.
    }
  }
  if (P.sujeta && r.e.isValid) {
    try {
      r.e.teleport({ x: P.pos.x, y: P.pos.y + 2.4, z: P.pos.z }, { keepVelocity: false, facingLocation: { x: mira.x, y: P.pos.y + 3.6, z: mira.z } });
    } catch {
      // Sin teletransporte.
    }
  }
}

function propiedad(P, v) {
  try {
    if (P.ent?.isValid && P.volando !== v) {
      P.volando = v;
      P.ent.setProperty("claudenpc:volando", v);
    }
  } catch {
    // Sin propiedad.
  }
}

// Cadenas (líneas de chispas) de la pinza del robot a las esquinas de la plataforma.
function cadenas(P) {
  const o = { x: P.pos.x, y: P.pos.y + 3.3, z: P.pos.z };
  for (const [ex, ez] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
    for (let k = 1; k <= 4; k++) {
      const f = k / 5;
      particleAt(P.dim, PARTICLES.laser, { x: o.x + ex * f, y: o.y + (P.pos.y + 0.6 - o.y) * f, z: o.z + ez * f });
    }
  }
}

// Dónde parar: a tu lado, lo más cerca posible sin meterse en tu construcción (si tienes
// paredes o un cuarto, se queda fuera y pican solo la pared que los separa).
function destinoLibre(P, jp, lado) {
  for (const k of [2, 3, 4, 5, 6]) {
    const d = { x: jp.x + 0.5 + lado.x * k, y: jp.y, z: jp.z + 0.5 + lado.z * k };
    if (!ocupadas(P.dim, d, P.jugador).length) return d;
  }
  return { x: jp.x + 0.5 + lado.x * 2, y: jp.y, z: jp.z + 0.5 + lado.z * 2 };
}

// --- Pasajeros -----------------------------------------------------------------------------

function puedeSubir(s) {
  return !!s && !s.fusion && !s.robot && !s.robotObra && !s.multiObra && !s.reparacion && !s.plataforma && !s.clase && !s.bote && !s.obra;
}

function elegirPasajeros(P) {
  let lista = [];
  try {
    lista = P.dim.getEntities({ type: NPC, location: P.pos, maxDistance: 20 });
  } catch {
    lista = [];
  }
  const j = P.jugador;
  const candidatos = lista.filter((n) => {
    const s = estados.get(n.id);
    // Solo los que siguen abajo (los que ya te alcanzaron no se suben otra vez).
    return puedeSubir(s) && s.objetivo?.id === j.id && now() <= (s.combateHasta ?? 0) + 100 && j.location.y - n.location.y > 2;
  }).sort((a, b) => {
    const sa = estados.get(a.id);
    const sb = estados.get(b.id);
    return ((sb.sinAlcanceDesde ? 1 : 0) - (sa.sinAlcanceDesde ? 1 : 0)) || distancia(a.location, P.pos) - distancia(b.location, P.pos);
  });
  candidatos.slice(0, 3).forEach((n, k) => {
    const s = estados.get(n.id);
    const x = { n, k, sentado: false };
    s.plataforma = x;
    s.sinCaidaHasta = now() + 2400;
    P.pasajeros.push(x);
    ponerHaciendo(n, s, "§b¡a la plataforma!");
    const a = ASIENTOS[k];
    const dest = { x: P.pos.x + a.x, y: P.pos.y, z: P.pos.z + a.z };
    const d = distancia(n.location, dest);
    saltoGuiado(n, dest, { ticks: Math.max(10, Math.round(d * 1.6)), alto: Math.min(2.5, 0.8 + d * 0.12), retraso: 0.15 });
  });
}

// Se baja de la plataforma: de un salto a "destino" (o al suelo debajo de su asiento).
function bajar(P, x, destino) {
  const n = x.n;
  const s = estados.get(n.id);
  P.pasajeros = P.pasajeros.filter((y) => y !== x);
  if (!n.isValid || !s) return;
  if (s.sentado) sentarse(n, s, false);
  s.plataforma = undefined;
  s.sinCaidaHasta = now() + 80;
  s.provocadoHasta = now() + 600;
  hostil(n, s, true);
  ponerHaciendo(n, s, "§c¡a pelear!");
  const meta = destino ?? { x: n.location.x, y: sueloBajo(P.dim, Math.floor(n.location.x), n.location.y + 0.5, Math.floor(n.location.z)), z: n.location.z };
  const d = distancia(n.location, meta);
  saltoGuiado(n, meta, { ticks: Math.max(8, Math.round(d * 2)), alto: 0.6, retraso: 0 });
}

// ¿Junto a quién se puede bajar? Un sitio libre (pies y cabeza) al lado tuyo con suelo.
function sitioJunto(dim, jugador, desde) {
  const j = piso(jugador.location);
  const opciones = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]
    .map(([dx, dz]) => ({ x: j.x + dx, y: j.y, z: j.z + dz }))
    .sort((a, b) => distancia(a, desde) - distancia(b, desde));
  return opciones.find((c) => libre(blockAt(dim, c)) && libre(blockAt(dim, { x: c.x, y: c.y + 1, z: c.z }))
    && solido(blockAt(dim, { x: c.x, y: c.y - 1, z: c.z })));
}

// Bloques sólidos entre el pasajero y tú (a la altura de los pies y de la cabeza).
function celdasEntre(dim, desde, jugador) {
  const out = [];
  const visto = new Set();
  const j = jugador.location;
  const jp = piso(j);
  const d = Math.hypot(j.x - desde.x, j.z - desde.z);
  const pasos = Math.max(1, Math.ceil(d / 0.3));
  for (let k = 1; k < pasos; k++) {
    const f = k / pasos;
    for (const dy of [0.5, 1.5]) {
      const c = piso({ x: desde.x + (j.x - desde.x) * f, y: j.y + dy, z: desde.z + (j.z - desde.z) * f });
      const key = `${c.x},${c.y},${c.z}`;
      if (visto.has(key) || (c.x === jp.x && c.z === jp.z)) continue;
      visto.add(key);
      if (solido(blockAt(dim, c))) out.push(c);
    }
  }
  return out;
}

// --- Picar sentados ------------------------------------------------------------------------

// Los Claudes sentados (y el taladro del robot) pican lo que estorba: hasta 2 a la vez.
function picar(P, celdas) {
  const r = P.r;
  for (const c of celdas.slice(0, 2)) {
    const k = `${c.x},${c.y},${c.z}`;
    if (P.picando.has(k)) continue;
    const b = blockAt(P.dim, c);
    if (!b || !solido(b)) continue;
    if (!sePuedeQuitar(b, c)) {
      P.duros++;
      continue;
    }
    P.picando.set(k, now() + 8);
    const centro = { x: c.x + 0.5, y: c.y + 0.5, z: c.z + 0.5 };
    // El pasajero más cercano lo pica sentado; si no hay, el robot con el taladro.
    const x = P.pasajeros.filter((y) => y.sentado && y.n.isValid).sort((a, b2) => distancia(a.n.location, centro) - distancia(b2.n.location, centro))[0];
    if (x) {
      animate(x.n, ANIM.minar);
      system.runTimeout(() => x.n.isValid && animate(x.n, ANIM.minar), 4);
    } else animate(r.e, ANIM.multiTaladrar);
    soundAt(P.dim, centro, /dirt|grass|sand|gravel/.test(b.typeId) ? "dig.gravel" : /log|wood|planks/.test(b.typeId) ? "dig.wood" : "dig.stone", 1, 0.8);
    system.runTimeout(() => {
      P.picando.delete(k);
      const bb = blockAt(P.dim, c);
      if (!bb || !solido(bb) || !sePuedeQuitar(bb, c)) return;
      try {
        bb.setType("minecraft:air");
        particleAt(P.dim, PARTICLES.polvo, centro);
        r.bateria -= MULTI_CFG.costoBloque;
      } catch {
        // No se pudo.
      }
    }, 8);
  }
}

// --- Máquina de estados ----------------------------------------------------------------------

export function tickPlataforma(r, h) {
  const P = r.plataforma;
  const j = P.jugador;
  P.t += 2;
  P.total = (P.total ?? 0) + 2;
  if (!j?.isValid || j.dimension.id !== r.e.dimension.id || distancia(j.location, r.e.location) > 64) return soltar(r, "el jugador se fue");
  // Se acaba el tiempo solo si no están peleando contigo (mientras te pegan, sigue).
  if (P.total > MULTI_CFG.plataformaMax && P.fase !== "soltar" && now() - (P.ultimoGolpe ?? -1000) > 200) return soltar(r, "se acabó el tiempo");
  switch (P.fase) {
    case "construir": {
      r.texto = "construyendo una plataforma voladora";
      if (r.cola.length) {
        h.trabajar(r);
        return;
      }
      P.fase = "agarrar";
      P.t = 0;
      return;
    }
    case "agarrar": {
      r.texto = "agarrando la plataforma";
      const encima = { x: P.sitio.x + 0.5, y: P.sitio.y + 3.4, z: P.sitio.z + 0.5 };
      if (!h.volar(r, encima, 0.35) && P.t < 80) return;
      // Quita los 9 bloques y la plataforma "se levanta": la agarra con la pinza.
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const c = { x: P.sitio.x + dx, y: P.sitio.y, z: P.sitio.z + dz };
          try {
            const b = blockAt(P.dim, c);
            if (b && /iron_block|copper_block|spruce_planks/.test(b.typeId)) b.setType("minecraft:air");
          } catch {
            // Chunk descargado.
          }
          particleAt(P.dim, PARTICLES.construir, { x: c.x + 0.5, y: c.y + 0.6, z: c.z + 0.5 });
        }
      }
      P.pos = { x: P.sitio.x + 0.5, y: P.sitio.y + 1, z: P.sitio.z + 0.5 };
      try {
        P.ent = P.dim.spawnEntity(PLATAFORMA, { x: P.pos.x, y: P.pos.y - GROSOR, z: P.pos.z });
      } catch {
        return soltar(r, "no pude agarrarla");
      }
      P.sujeta = true;
      activas.add(P);
      animate(r.e, ANIM.multiColocar);
      soundAt(P.dim, P.pos, "random.anvil_use", 1.4, 1);
      soundAt(P.dim, P.pos, "mob.irongolem.repair", 1.2, 1);
      avisar(P.dim, P.pos, "§bRobot multi:§r ¡plataforma lista! Suban, Claudes.", 40);
      P.fase = "cargar";
      P.t = 0;
      return;
    }
    case "cargar": {
      r.texto = "subiendo Claudes a la plataforma";
      if (P.t === 2) {
        elegirPasajeros(P);
        if (!P.pasajeros.length) {
          // Nadie puede subir ahora: se queda en el suelo esperando a que un Claude pueda.
          P.fase = "esperar";
          P.t = 0;
          P.esperaDesde ??= now();
          r.texto = "esperando Claudes para subir";
          return;
        }
      }
      for (const x of P.pasajeros) {
        if (x.sentado || !x.n.isValid || saltando(x.n)) continue;
        const s = estados.get(x.n.id);
        x.sentado = true;
        if (s) sentarse(x.n, s, true);
        sound(x.n, "random.pop", 1.2, 0.6);
      }
      P.pasajeros = P.pasajeros.filter((x) => x.n.isValid);
      if (P.pasajeros.every((x) => x.sentado) || P.t > 100) {
        if (!P.pasajeros.some((x) => x.sentado)) {
          for (const x of [...P.pasajeros]) bajar(P, x);
          P.fase = "esperar";
          P.t = 0;
          P.esperaDesde ??= now();
          return;
        }
        for (const x of P.pasajeros.filter((y) => !y.sentado)) bajar(P, x);
        P.fase = "volar";
        P.t = 0;
        P.subidas = 0;
        propiedad(P, true);
        soundAt(P.dim, P.pos, "firework.launch", 0.6, 1);
        avisar(P.dim, j.location, `§bRobot multi:§r ¡despegamos! Llevo ${P.pasajeros.length} Claudes hacia ti.`, 48);
      }
      return;
    }
    case "volar": {
      r.texto = `llevando ${P.pasajeros.length} Claudes`;
      P.pasajeros = P.pasajeros.filter((x) => x.n.isValid);
      if (!P.pasajeros.length) {
        // Se quedó sin pasajeros en el aire: baja y espera en el suelo a otros.
        P.fase = "aterrizar";
        P.t = 0;
        return;
      }
      if (P.t % 10 === 2) {
        // Meta: a tu lado (por el lado de donde viene), a la altura de tus pies. Primero sube
        // a tu altura, después cruza y al final se ajusta.
        const jp = piso(j.location);
        const dx = P.pos.x - (jp.x + 0.5);
        const dz = P.pos.z - (jp.z + 0.5);
        const lado = Math.abs(dx) >= Math.abs(dz) ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
        const destino = destinoLibre(P, jp, lado);
        P.destino = destino;
        const crucero = Math.max(destino.y, P.pos.y);
        const lejos = Math.hypot(destino.x - P.pos.x, destino.z - P.pos.z);
        if (P.pos.y < crucero - 0.3 && lejos > 1) P.meta = { x: P.pos.x, y: crucero, z: P.pos.z };
        else if (lejos > 0.3) P.meta = { x: destino.x, y: crucero, z: destino.z };
        else P.meta = destino;
      }
      // Lo que estorba al volar (pared, techo o suelo) lo pican sentados.
      if (P.bloqueo?.length) picar(P, P.bloqueo);
      if (P.duros > 30) return soltar(r, "hay algo que no puedo romper");
      const cerca = Math.hypot(j.location.x - P.pos.x, j.location.z - P.pos.z);
      const D = P.destino;
      P.lejosDestino = D ? Math.hypot(D.x - P.pos.x, D.z - P.pos.z) : 99;
      const enDestino = !!D && P.lejosDestino < 0.4 && Math.abs(D.y - P.pos.y) < 0.4;
      const llegaron = enDestino || (cerca < 3.6 && Math.abs(j.location.y - P.pos.y) < 1.6);
      if (!llegaron) return;
      if (!P.avisoLlegada) {
        P.avisoLlegada = true;
        avisar(P.dim, j.location, "§bRobot multi:§r ¡llegamos!", 40);
      }
      // Cada pasajero, por turnos: se baja si junto a ti hay suelo; si hay pared entre
      // ustedes, la pica; si no, te pelea sentado desde la plataforma.
      if (P.t % 6 !== 2) return;
      P.turno = ((P.turno ?? -1) + 1) % P.pasajeros.length;
      const x = P.pasajeros[P.turno];
      const s = estados.get(x.n.id);
      const sitioLibre = sitioJunto(P.dim, j, x.n.location);
      if (sitioLibre) {
        bajar(P, x, { x: sitioLibre.x + 0.5, y: sitioLibre.y, z: sitioLibre.z + 0.5 });
        sound(x.n, "mob.player.step", 1, 0.6);
        if (!P.pasajeros.length) soltar(r);
        return;
      }
      const pared = celdasEntre(P.dim, x.n.location, j);
      if (pared.length) {
        picar(P, pared);
        return;
      }
      if (s && now() >= (s.cd.golpePlataforma ?? 0)) {
        s.cd.golpePlataforma = now() + 24;
        if (golpeBasico(x.n, s, j)) P.ultimoGolpe = now(); // te pega sentado (si te alcanza)
      }
      return;
    }
    case "aterrizar": {
      // Baja hasta el suelo y ahí espera a que un Claude pueda subirse.
      r.texto = "bajando a buscar Claudes";
      propiedad(P, true);
      P.meta = { x: P.pos.x, y: sueloBajo(P.dim, Math.floor(P.pos.x), P.pos.y + 0.5, Math.floor(P.pos.z)), z: P.pos.z };
      if (P.llego || P.bloqueo || P.t > 300) {
        P.fase = "esperar";
        P.t = 0;
        P.esperaDesde = now();
        propiedad(P, false);
      }
      return;
    }
    case "esperar": {
      // En el suelo: cada 2 s mira si ya hay Claudes que puedan subir; si en 60 s no hay
      // ninguno, la desarma.
      r.texto = "esperando Claudes para subir";
      propiedad(P, false);
      if (now() - (P.esperaDesde ?? now()) > MULTI_CFG.esperaPlataforma) return soltar(r, "nadie vino a subirse");
      if (P.t % 40 === 0) {
        P.fase = "cargar";
        P.t = 0;
      }
      return;
    }
    case "soltar": {
      r.texto = "bajando la plataforma";
      const y = sueloBajo(P.dim, Math.floor(P.pos.x), P.pos.y + 0.5, Math.floor(P.pos.z));
      P.meta = { x: P.pos.x, y, z: P.pos.z };
      if (P.llego || P.bloqueo || P.t > 300) terminar(r);
      return;
    }
    default:
      soltar(r);
  }
}

// Empieza a bajar la plataforma (los que sigan arriba se bajan al llegar al suelo).
export function soltar(r, motivo) {
  const P = r.plataforma;
  if (!P) return;
  P.alTerminar?.();
  if (motivo) avisar(r.e.dimension, r.e.location, `§bRobot multi:§r ${motivo}.`, 24);
  if (!P.ent?.isValid) return terminar(r);
  P.fase = "soltar";
  P.t = 0;
}

// Quita la plataforma: los pasajeros que queden se bajan al suelo y el robot la desarma.
export function terminar(r) {
  const P = r.plataforma;
  if (!P) return;
  r.plataforma = undefined;
  activas.delete(P);
  for (const x of [...P.pasajeros]) bajar(P, x);
  propiedad(P, false);
  try {
    if (P.ent?.isValid) {
      particleAt(P.dim, PARTICLES.construir, { x: P.pos.x, y: P.pos.y + 0.3, z: P.pos.z });
      soundAt(P.dim, P.pos, "random.anvil_land", 1.4, 0.5);
      P.ent.remove();
    }
  } catch {
    // Ya no está.
  }
}

// Empieza una plataforma con el plan elegido.
export function empezarPlataforma(r, plan) {
  r.plataforma = { r, dim: r.e.dimension, fase: "construir", t: 0, sitio: plan.plataforma.sitio, jugador: plan.plataforma.jugador,
    pasajeros: [], picando: new Map(), duros: 0, subidas: 0 };
}

// Mientras viaja en la plataforma, el Claude no hace otra cosa (lo llama el cerebro).
export function tickPasajero(npc, s) {
  hostil(npc, s, false);
}

// Cada tick: mueve la plataforma y coloca a los Claudes sentados y al robot que la sostiene.
system.runInterval(() => {
  for (const P of [...activas]) {
    try {
      if (!P.ent?.isValid || !P.r.e.isValid) {
        if (P.r.plataforma === P) terminar(P.r);
        else activas.delete(P);
        continue;
      }
      if (P.fase === "volar" || P.fase === "soltar" || P.fase === "aterrizar") avanzar(P);
      colocar(P);
      if (now() % 10 === 0) cadenas(P);
    } catch {
      activas.delete(P);
    }
  }
}, 1);

// Plataformas que quedaron sin robot (al recargar el mundo): se quitan.
system.runInterval(() => {
  const vivas = new Set([...activas].map((P) => P.ent?.id));
  for (const id of DIMENSIONES) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: PLATAFORMA })) {
        if (!vivas.has(e.id)) e.remove();
      }
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 400);
