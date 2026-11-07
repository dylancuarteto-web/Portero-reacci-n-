import { alturaSuelo, blockAt, flat, now, reemplazable, sound } from "../util.js";
import { gesto } from "./animacion.js";
import { equipar } from "./armas.js";
import { INFINITO_CFG } from "./config.js";
import { ganar } from "./determinacion.js";
import { puede } from "./fases.js";
import { quitarAhora, temporal } from "./rendimiento.js";

// BucketController (fase 11+): water clutch / MLG, agua para frenar al rival, lava para
// cortarle el paso y agua para apagarse. Todo lo que coloca lo recoge (o se quita solo con
// el registro de temporales). Nunca en el Nether (el agua se evapora) y nunca lava cerca
// de algo que se pueda quemar.

const INFLAMABLE = /(log|_wood|planks|leaves|wool|carpet|hay_block|bookshelf|fence|_stairs|_slab|scaffolding|vine|short_grass|tall_grass|fern|bush|flower|sapling|crafting_table|chest|barrel|door|trapdoor|beehive|bee_nest|tnt|lectern|composter)/;

const sePuede = (e) => INFINITO_CFG.modificaMundo && e.dimension.id !== "minecraft:nether";

export function ponerTemporal(e, s, pos, tipo, ticks) {
  return poner(e, s, pos, tipo, ticks);
}

function poner(e, s, pos, tipo, ticks) {
  const b = blockAt(e.dimension, pos);
  if (!b || !(b.isAir || reemplazable(b))) return undefined;
  const abajo = blockAt(e.dimension, { x: pos.x, y: pos.y - 1, z: pos.z });
  if (!abajo || abajo.isAir || abajo.isLiquid) return undefined;
  try {
    b.setType(tipo);
  } catch {
    return undefined;
  }
  return temporal(e.dimension, pos, tipo, ticks, s.id);
}

// Cada tick mientras está en el aire: si va a caer desde alto, pone agua justo antes de
// tocar el suelo (MLG) y la recoge al aterrizar.
export function tickCaida(e, s) {
  try {
    if (e.isOnGround || e.isInWater) {
      if (s.clutch && now() >= s.clutch.recoger) {
        gesto(e, s, "cubeta");
        sound(e, "bucket.fill_water", 1, 0.8);
        quitarAhora(s.clutch.t);
        s.clutch = undefined;
        s.volverArma = now() + 4;
      }
      if (e.isOnGround) s.alturaMax = e.location.y;
      return;
    }
    if (e.location.y > (s.alturaMax ?? e.location.y)) s.alturaMax = e.location.y;
    // Una caída a propósito (la maza) ya está protegida: no saca la cubeta.
    if (s.clutch || now() < (s.sinCaidaHasta ?? 0) || !puede(s, "aguaClutch") || !sePuede(e)) return;
    const v = e.getVelocity();
    if (v.y > -0.35) return;
    const h = alturaSuelo(e, 32);
    if (!Number.isFinite(h) || h > 3.4 || h < 0.3) return;
    const caida = (s.alturaMax ?? e.location.y) - e.location.y + h;
    if (caida < 4) return;
    const pos = { x: Math.floor(e.location.x), y: Math.floor(e.location.y - h + 0.01), z: Math.floor(e.location.z) };
    equipar(e, s, "cubeta", { urgente: true });
    const t = poner(e, s, pos, "minecraft:water", 60);
    if (!t) return;
    gesto(e, s, "cubeta", true);
    sound(e, "bucket.empty_water", 1, 0.9);
    s.sinCaidaHasta = now() + 30;
    s.clutch = { t, recoger: now() + 10 };
    ganar(e, s, "esquiva");
  } catch {
    // Sin suelo cargado.
  }
}

// Agua a los pies del rival (lo frena y le corta el sprint). Fase 11+.
export function aguaTactica(e, s, obj) {
  if (!puede(s, "aguaTactica") || !sePuede(e)) return false;
  const pos = { x: Math.floor(obj.location.x), y: Math.floor(obj.location.y), z: Math.floor(obj.location.z) };
  equipar(e, s, "cubeta", { urgente: true });
  const t = poner(e, s, pos, "minecraft:water", 30);
  if (!t) return false;
  gesto(e, s, "cubeta", true);
  sound(e, "bucket.empty_water", 1, 0.9);
  s.volverArma = now() + 6;
  return true;
}

function hayInflamable(e, c) {
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -2; dz <= 2; dz++) {
        const b = blockAt(e.dimension, { x: c.x + dx, y: c.y + dy, z: c.z + dz });
        if (b && !b.isAir && INFLAMABLE.test(b.typeId)) return true;
      }
    }
  }
  return false;
}

// Lava entre él y el rival, para cortarle el paso. Fase 11+, si no hay nada que se queme.
export function lavaControl(e, s, obj) {
  if (!puede(s, "lava") || !INFINITO_CFG.lava || !INFINITO_CFG.modificaMundo) return false;
  const d = flat(obj.location, e.location);
  if (d.d < 3) return false;
  const pos = { x: Math.floor(obj.location.x + d.x * 1.5), y: Math.floor(obj.location.y), z: Math.floor(obj.location.z + d.z * 1.5) };
  if (Math.hypot(pos.x + 0.5 - e.location.x, pos.z + 0.5 - e.location.z) < 2.5) return false;
  if (hayInflamable(e, pos)) return false;
  equipar(e, s, "lava", { urgente: true });
  const t = poner(e, s, pos, "minecraft:lava", 30);
  if (!t) return false;
  gesto(e, s, "cubeta", true);
  sound(e, "bucket.empty_lava", 1, 0.9);
  s.volverArma = now() + 6;
  return true;
}

// Se está quemando (o pisa lava): agua a los pies (fase 11+). Antes, solo sale corriendo.
export function apagarse(e, s) {
  try {
    const fuego = e.getComponent("minecraft:onfire");
    if (!fuego || !puede(s, "aguaClutch") || !sePuede(e) || now() < (s.cd.apagar ?? 0)) return false;
    s.cd.apagar = now() + 60;
    const pos = { x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z) };
    equipar(e, s, "cubeta", { urgente: true });
    const t = poner(e, s, pos, "minecraft:water", 14);
    if (!t) return false;
    gesto(e, s, "cubeta", true);
    sound(e, "bucket.empty_water", 1, 0.9);
    s.volverArma = now() + 8;
    return true;
  } catch {
    return false;
  }
}
