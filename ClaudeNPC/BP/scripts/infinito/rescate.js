import { system, world } from "@minecraft/server";
import { ANIM, NPC, PARTICLES } from "../config.js";
import { ponerVida, vida } from "../dano.js";
import { estados, obtenerEstado } from "../estado.js";
import { caminarA, caminando, detener, seAtasco, velocidad } from "../movimiento.js";
import { perlaHasta } from "../tacticas.js";
import { alturaSuelo, animate, avisar, burst, flat, mirarA, now, piso, sound, superficie } from "../util.js";
import { gesto, pose } from "./animacion.js";
import { bajarEscudo } from "./armas.js";
import { terminarCombo } from "./combos.js";
import { INFINITO_CFG, NOMBRE_INFINITO, PROP_INF, PROP_SELLADOS, SELLO } from "./config.js";
import { ganar } from "./determinacion.js";
import { pararTodo } from "./movimiento.js";
import { actualizarNombre, decir } from "./personalidad.js";
import { guardar, infinitos } from "./registro.js";
import { limpiarDe } from "./rendimiento.js";
import { vfxAlma, vfxCura, vfxEvolucion, vfxMarcas, vfxSello } from "./vfx.js";

// Derribo, rescate y sello.
//   - DERRIBADO: el golpe que lo mataría no se aplica (sensor de daño). Queda de rodillas,
//     intocable, con su alma roja flotando y las marcas del sello en el suelo.
//   - SELLO: cuatro pilares de obsidiana (o llorosa) de 2 bloques en las esquinas, a 2 bloques
//     en diagonal de sus pies, y encima de cada pilar una antorcha, linterna o fogata de
//     almas. Si se completa mientras está derribado (o recuperándose sentado), desaparece
//     para siempre.
//   - RESCATE: a los 12 s, el Claude más cercano (o uno que llega corriendo si no hay
//     ninguno a 48 bloques) lo carga al hombro y lo lleva a su casa o a un sitio lejos de los
//     jugadores. Si golpeas fuerte al rescatista, lo suelta y vuelve a correr el tiempo.
//   - RECUPERACIÓN: sentado 30 s, vuelve con toda la vida y +25 de determinación.

const TAG_SELLADO = "claudenpc_sellado";

function titulo(e, t, sub, radio = 32) {
  try {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: radio })) {
      p.onScreenDisplay.setTitle(t, { subtitle: sub, fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
    }
  } catch {
    // Sin jugadores.
  }
}

// Bloque de los pies apoyado en el suelo (aunque esté un poco en el aire).
function basePies(e) {
  const h = alturaSuelo(e, 8);
  const y = Number.isFinite(h) ? e.location.y - h : e.location.y;
  return { x: Math.floor(e.location.x), y: Math.floor(y + 0.01), z: Math.floor(e.location.z) };
}

function inseguro(e) {
  try {
    const b = e.dimension.getBlock(piso(e.location));
    return e.location.y < e.dimension.heightRange.min + 4 || !!b?.typeId.includes("lava");
  } catch {
    return true;
  }
}

// --- Sello -----------------------------------------------------------------------------
export function faltanDelSello(dim, base) {
  const faltan = [];
  for (const [dx, dz] of SELLO.esquinas) {
    const x = base.x + dx;
    const z = base.z + dz;
    for (let h = 0; h < 2; h++) {
      let b;
      try {
        b = dim.getBlock({ x, y: base.y + h, z });
      } catch {
        b = undefined;
      }
      if (!b || !SELLO.pilar.includes(b.typeId)) faltan.push({ x, y: base.y + h, z });
    }
    let top;
    try {
      top = dim.getBlock({ x, y: base.y + 2, z });
    } catch {
      top = undefined;
    }
    if (!top || !SELLO.llama.includes(top.typeId)) faltan.push({ x, y: base.y + 2, z });
  }
  return faltan;
}

function liberarRescatista(id) {
  for (const rs of estados.values()) {
    if (rs.rescate?.infinitoId !== id) continue;
    rs.rescate = undefined;
    try {
      if (rs.npc?.isValid) detener(rs.npc);
    } catch {
      // Claude descargado.
    }
  }
}

export function sellar(e, s) {
  s.etapa = "sellado";
  try {
    e.addTag(TAG_SELLADO);
  } catch {
    // Sin etiqueta.
  }
  vfxSello(e, s);
  sound(e, "mob.wither.death", 0.8, 0.7);
  sound(e, "beacon.deactivate", 0.6, 1);
  titulo(e, "§5§lSELLADO", `§7${NOMBRE_INFINITO} no volverá`, 48);
  try {
    world.setDynamicProperty(PROP_SELLADOS, (Number(world.getDynamicProperty(PROP_SELLADOS)) || 0) + 1);
  } catch {
    // Sin contador.
  }
  limpiarDe(s.id);
  liberarRescatista(e.id);
  infinitos.delete(e.id);
  try {
    e.setDynamicProperty(PROP_INF, undefined);
  } catch {
    // Sin propiedad.
  }
  system.runTimeout(() => {
    try {
      if (e.isValid) e.remove();
    } catch {
      // Ya no existe.
    }
  }, 12);
}

// --- Derribo ----------------------------------------------------------------------------
export function derribar(e, s) {
  if (s.etapa !== "pelea") return;
  if (s.combo) terminarCombo(e, s, false);
  bajarEscudo(e, s);
  s.comiendo = false;
  s.tensando = false;
  s.atacar = false;
  s.estado = "IDLE";
  s.estadoDesde = now();
  pararTodo(e, s);
  if (inseguro(e) && s.ultimoSuelo) {
    try {
      e.teleport(s.ultimoSuelo, { keepVelocity: false });
    } catch {
      // Sin sitio.
    }
  }
  s.etapa = "derribado";
  s.derribo = { t0: now(), base: basePies(e), rescatistaId: undefined, llamado: false };
  ponerVida(e, Math.max(1, Math.min(vida(e).actual, 2)));
  limpiarDe(s.id, "minecraft:water");
  limpiarDe(s.id, "minecraft:lava");
  pose(e, s, "derrota");
  sound(e, "beacon.deactivate", 1.3, 0.8);
  decir(e, s, "derribado", true);
  titulo(e, "§c§lDERRIBADO", "§7Séllalo: 4 pilares de obsidiana de 2 bloques en las esquinas y fuego de almas encima");
  actualizarNombre(e, s, true);
  guardar(s);
}

// Cada 10 ticks mientras no está peleando (derribado o recuperándose).
export function tickEtapa(e, s) {
  if (s.etapa === "derribado") {
    const d = s.derribo;
    if (d.recalcular && e.isOnGround) {
      d.base = basePies(e);
      d.recalcular = false;
    }
    const t = now() - d.t0;
    vfxAlma(e, s);
    const faltan = faltanDelSello(e.dimension, d.base);
    if (!faltan.length) return sellar(e, s);
    if (t % 20 < 10) vfxMarcas(s, e.dimension, faltan);
    if (!d.llamado && t >= INFINITO_CFG.rescateA) {
      d.llamado = true;
      llamarRescatista(e, s);
    }
    // Nadie pudo venir (o no llega): se recupera ahí mismo.
    const tope = d.rescatistaId ? INFINITO_CFG.ventanaSello + 400 : INFINITO_CFG.ventanaSello;
    if (t >= tope) empezarRecuperacion(e, s, d.base);
    return;
  }
  if (s.etapa === "recuperando") {
    const r = s.recuperacion;
    const t = now() - r.t0;
    const { max } = vida(e);
    ponerVida(e, Math.min(max, 2 + (max - 2) * Math.min(1, t / INFINITO_CFG.recuperacion)));
    if (t % 20 < 10) vfxCura(e, s);
    const faltan = faltanDelSello(e.dimension, r.base);
    if (!faltan.length) return sellar(e, s);
    if (t % 40 < 10) vfxMarcas(s, e.dimension, faltan);
    if (t >= INFINITO_CFG.recuperacion) levantarse(e, s);
  }
}

function empezarRecuperacion(e, s, base) {
  s.etapa = "recuperando";
  s.recuperacion = { t0: now(), base: base ?? basePies(e) };
  s.derribo = undefined;
  s.carga = undefined;
  pose(e, s, "recuperar");
  actualizarNombre(e, s, true);
  guardar(s);
}

export function levantarse(e, s) {
  s.etapa = "pelea";
  s.recuperacion = undefined;
  s.derribo = undefined;
  s.carga = undefined;
  s.estado = "IDLE";
  s.estadoDesde = now();
  s.proximaDecision = now() + 10;
  ponerVida(e, vida(e).max);
  ganar(e, s, "levantarse");
  pose(e, s, "ninguna");
  gesto(e, s, "evolucion", true);
  vfxEvolucion(e, s, 1);
  sound(e, "random.totem", 1, 0.8);
  decir(e, s, "levantarse", true);
  titulo(e, "§c§lSE LEVANTÓ", `§7La determinación de ${NOMBRE_INFINITO} no se rompe`);
  liberarRescatista(e.id);
  actualizarNombre(e, s, true);
  guardar(s);
}

// --- Rescatista ----------------------------------------------------------------------------
function libre(npc) {
  const s = estados.get(npc.id);
  return !s || !(s.fusion || s.robot || s.clase || s.multiObra || s.reparacion || s.plataforma || s.robotObra || s.rescate || s.bote);
}

// Un Claude que llega corriendo desde lejos (lado contrario al jugador más cercano).
function traerRescatista(e) {
  let dir = { x: 1, z: 0 };
  try {
    const [p] = e.dimension.getPlayers({ location: e.location, maxDistance: 64, closest: 1 });
    if (p) dir = flat(p.location, e.location);
  } catch {
    // Sin jugadores.
  }
  for (const k of [22, 16, 10]) {
    const x = e.location.x + dir.x * k;
    const z = e.location.z + dir.z * k;
    const top = superficie(e.dimension, x, z);
    if (!top || top.isLiquid || Math.abs(top.location.y + 1 - e.location.y) > 12) continue;
    try {
      const npc = e.dimension.spawnEntity(NPC, { x: Math.floor(x) + 0.5, y: top.location.y + 1, z: Math.floor(z) + 0.5 });
      burst(npc, PARTICLES.teletransporte);
      return npc;
    } catch {
      // Sin sitio.
    }
  }
  return undefined;
}

export function llamarRescatista(e, s) {
  let mejor;
  let dmin = Infinity;
  try {
    for (const npc of e.dimension.getEntities({ type: NPC, location: e.location, maxDistance: INFINITO_CFG.radioRescatista })) {
      if (!libre(npc)) continue;
      const d = Math.hypot(npc.location.x - e.location.x, npc.location.z - e.location.z);
      if (d < dmin) {
        dmin = d;
        mejor = npc;
      }
    }
  } catch {
    mejor = undefined;
  }
  mejor ??= traerRescatista(e);
  if (!mejor) return false;
  obtenerEstado(mejor).rescate = { infinitoId: e.id, etapa: "ir", desde: now(), dano: 0 };
  s.derribo.rescatistaId = mejor.id;
  avisar(e.dimension, e.location, `§eUn Claude viene a buscar a ${NOMBRE_INFINITO}`, 48);
  return true;
}

// A dónde lo lleva: su casa si está a 64 bloques o menos; si no, lejos de los jugadores.
function lugarRecuperacion(npc, inf) {
  const casa = estados.get(npc.id)?.hogar;
  if (casa && Math.hypot(casa.x - inf.location.x, casa.z - inf.location.z) <= 64) return { ...casa };
  let dir = flat({ x: 0, z: 0 }, { x: Math.random() - 0.5, z: Math.random() - 0.5 });
  try {
    const [p] = inf.dimension.getPlayers({ location: inf.location, maxDistance: 64, closest: 1 });
    if (p) dir = flat(p.location, inf.location);
  } catch {
    // Sin jugadores.
  }
  for (const k of [24, 18, 12]) {
    const x = inf.location.x + dir.x * k;
    const z = inf.location.z + dir.z * k;
    const top = superficie(inf.dimension, x, z);
    if (top && !top.isLiquid && Math.abs(top.location.y + 1 - inf.location.y) < 16) return { x: Math.floor(x) + 0.5, y: top.location.y + 1, z: Math.floor(z) + 0.5 };
  }
  return { ...npc.location };
}

function levantarlo(npc, r, inf, s) {
  r.etapa = "llevar";
  r.desde = now();
  r.destino = lugarRecuperacion(npc, inf);
  r.control = { ...npc.location };
  r.revision = now();
  r.dano = 0;
  s.etapa = "cargado";
  s.carga = { rescatistaId: npc.id };
  s.derribo = undefined;
  pose(inf, s, "cargado");
  animate(npc, ANIM.recoger);
  sound(npc, "armor.equip_leather", 0.8, 1);
  actualizarNombre(inf, s, true);
  avisar(inf.dimension, inf.location, `§eUn Claude se lleva a ${NOMBRE_INFINITO} a recuperarse`, 48);
}

function dejarlo(npc, r, inf, s) {
  r.etapa = "cuidar";
  r.desde = now();
  detener(npc);
  try {
    const v = npc.getViewDirection();
    const top = superficie(inf.dimension, npc.location.x + v.x, npc.location.z + v.z);
    const y = top && Math.abs(top.location.y + 1 - npc.location.y) < 2 ? top.location.y + 1 : npc.location.y;
    inf.teleport({ x: Math.floor(npc.location.x + v.x) + 0.5, y, z: Math.floor(npc.location.z + v.z) + 0.5 }, { keepVelocity: false });
  } catch {
    // Lo deja donde está.
  }
  animate(npc, ANIM.colocarAbajo);
  empezarRecuperacion(inf, s);
}

// Lo suelta (golpe fuerte al rescatista, o el rescatista ya no está): vuelve a estar derribado.
function soltar(inf, s, npc) {
  try {
    const l = npc?.isValid ? npc.location : { x: inf.location.x, y: inf.location.y - 1.45, z: inf.location.z };
    inf.teleport({ x: l.x + 0.6, y: l.y, z: l.z }, { keepVelocity: false });
  } catch {
    // Sin sitio.
  }
  s.etapa = "derribado";
  s.carga = undefined;
  s.derribo = { t0: now(), base: basePies(inf), rescatistaId: npc?.isValid ? npc.id : undefined, llamado: !!npc?.isValid, recalcular: true };
  pose(inf, s, "derrota");
  sound(inf, "random.hurt", 0.8, 0.9);
  titulo(inf, "§c¡Lo soltó!", "§7Séllalo ahora, antes de que lo vuelvan a levantar");
  actualizarNombre(inf, s, true);
}

// Cada tick mientras lo cargan: va al hombro del rescatista.
export function tickCargado(e, s) {
  let npc;
  try {
    npc = s.carga ? world.getEntity(s.carga.rescatistaId) : undefined;
  } catch {
    npc = undefined;
  }
  if (!npc?.isValid) return soltar(e, s, undefined);
  try {
    const l = npc.location;
    e.teleport({ x: l.x, y: l.y + 1.45, z: l.z }, { rotation: { x: 0, y: npc.getRotation().y + 90 }, keepVelocity: false });
  } catch {
    // Sin teletransporte este tick.
  }
}

// Lo llama main.js para el Claude que tiene "rescate" (cada 4 ticks).
export function tickRescatista(npc, rs) {
  const r = rs.rescate;
  let inf;
  try {
    inf = world.getEntity(r.infinitoId);
  } catch {
    inf = undefined;
  }
  const s = inf ? infinitos.get(inf.id) : undefined;
  if (!inf?.isValid || !s || s.etapa === "pelea" || s.etapa === "sellado") {
    rs.rescate = undefined;
    detener(npc);
    return;
  }
  if (now() < (r.reintentoEn ?? 0)) {
    velocidad(npc, 0);
    return;
  }
  if (r.etapa === "ir") {
    if (s.etapa !== "derribado") {
      rs.rescate = undefined;
      return;
    }
    const d = Math.hypot(inf.location.x - npc.location.x, inf.location.z - npc.location.z);
    if (d <= 1.9) return levantarlo(npc, r, inf, s);
    if (now() - r.desde > 900) {
      // No pudo llegar: deja que otro lo intente.
      rs.rescate = undefined;
      s.derribo.rescatistaId = undefined;
      s.derribo.llamado = false;
      s.derribo.t0 = Math.min(s.derribo.t0, now() - INFINITO_CFG.rescateA + 100);
      return;
    }
    // Si no encuentra camino (o tarda demasiado), llega con una perla, como a una reunión.
    const espera = now() - r.desde;
    if (d > 3 && !r.perla && (espera > 500 || (seAtasco(npc) && espera > 80))) {
      r.perla = true;
      perlaHasta(npc, { x: inf.location.x + 0.8, y: inf.location.y, z: inf.location.z });
      return;
    }
    if (!caminando(npc) || now() - (r.ruta ?? -100) > 40) {
      r.ruta = now();
      caminarA(npc, inf.location, 0.3);
    }
    return;
  }
  if (r.etapa === "llevar") {
    const d = Math.hypot(r.destino.x - npc.location.x, r.destino.z - npc.location.z);
    // Atascado mucho tiempo: lo deja ahí.
    if (now() - r.revision >= 200) {
      const avance = Math.hypot(npc.location.x - r.control.x, npc.location.z - r.control.z);
      r.control = { ...npc.location };
      r.revision = now();
      if (avance < 2) return dejarlo(npc, r, inf, s);
    }
    if (d <= 2.2 || now() - r.desde > 1400) return dejarlo(npc, r, inf, s);
    if (!caminando(npc) || now() - (r.ruta ?? -100) > 40) {
      r.ruta = now();
      caminarA(npc, r.destino, 0.24);
    }
    return;
  }
  // "cuidar": se queda al lado mirándolo mientras se recupera.
  velocidad(npc, 0);
  detener(npc);
  mirarA(npc, inf.getHeadLocation());
  if (s.etapa !== "recuperando") rs.rescate = undefined;
}

// Golpe fuerte al rescatista mientras lo carga: lo suelta.
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
  const rs = estados.get(hurtEntity.id);
  const r = rs?.rescate;
  if (!r || r.etapa !== "llevar") return;
  r.dano = (r.dano ?? 0) + damage;
  if (damage < 5 && r.dano < 8) return;
  let inf;
  try {
    inf = world.getEntity(r.infinitoId);
  } catch {
    inf = undefined;
  }
  const s = inf ? infinitos.get(inf.id) : undefined;
  if (s?.etapa === "cargado") soltar(inf, s, hurtEntity);
  r.etapa = "ir";
  r.reintentoEn = now() + 60;
  r.desde = now();
  r.dano = 0;
  r.perla = false;
}, { entityTypes: [NPC] });
