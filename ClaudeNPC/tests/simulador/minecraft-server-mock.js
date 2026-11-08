// Mock de @minecraft/server con FÍSICA SIMPLE (solo pruebas fuera del juego, v10):
// velocidad, gravedad, fricción, choques con bloques, caídas con daño, agua; proyectiles
// (flechas, tridentes, perlas, pociones) con gravedad e impactos; TNT con mecha; explosiones
// con el evento previo (setImpactedBlocks); rayos de bloques; sensores de daño leídos del BP.
// No reemplaza una prueba dentro del juego.
import { readFileSync, readdirSync } from "node:fs";
// Carpeta de entidades del paquete de comportamiento (la pasa correr.sh).
const BP_ENT = process.env.BP_ENT ?? new URL("../../../BP/entities", import.meta.url).pathname;
export const sensores = new Map();
export const familias = new Map([["minecraft:player", ["player", "mob"]], ["minecraft:arrow", ["arrow"]],
  ["minecraft:zombie", ["zombie", "monster", "mob"]], ["minecraft:skeleton", ["skeleton", "monster", "mob"]], ["minecraft:tnt", ["tnt", "inanimate"]]]);
for (const f of readdirSync(BP_ENT)) {
  const d = JSON.parse(readFileSync(`${BP_ENT}/${f}`, "utf8"))["minecraft:entity"];
  const c = d.components ?? {};
  familias.set(d.description.identifier, c["minecraft:type_family"]?.family ?? []);
  let tr = c["minecraft:damage_sensor"]?.triggers;
  if (tr && !Array.isArray(tr)) tr = [tr];
  if (tr) sensores.set(d.description.identifier, tr);
}
const CAUSA = { entityAttack: "entity_attack", projectile: "projectile", fall: "fall", magic: "magic", entityExplosion: "entity_explosion",
  blockExplosion: "block_explosion", fire: "fire", lava: "lava", suffocation: "suffocation", none: "none", override: "override", void: "void" };
function sujeto(subject, ctx) { return subject === "other" ? ctx.otro : subject === "damager" ? ctx.danador : ctx.yo; }
export function filtro(f, ctx) {
  if (!f) return true;
  if (Array.isArray(f)) return f.every((x) => filtro(x, ctx));
  if (f.all_of) return f.all_of.every((x) => filtro(x, ctx));
  if (f.any_of) return f.any_of.some((x) => filtro(x, ctx));
  if (f.none_of) return !f.none_of.some((x) => filtro(x, ctx));
  const s = sujeto(f.subject ?? "self", ctx);
  let r = false;
  switch (f.test) {
    case "has_tag": r = !!s?.tags?.has(f.value); break;
    case "is_family": r = !!s && (familias.get(s.typeId) ?? []).includes(f.value); break;
    case "has_damage": r = f.value === "fatal" ? ctx.dano >= ctx.yo.vida : CAUSA[ctx.causa] === f.value; break;
    case "actor_health": {
      const v = s?.vida ?? 0; const op = f.operator ?? "==";
      return op === ">" ? v > f.value : op === "<" ? v < f.value : op === ">=" ? v >= f.value : op === "<=" ? v <= f.value : v === f.value;
    }
    case "has_equipment": r = !!s?.mano && s.mano === f.value; break;
    default: r = false;
  }
  if (f.operator === "!=" || f.operator === "not" || f.operator === "<>") r = !r;
  return r;
}
export const disparados = [];
export const handlers = {};
const signal = (grupo) => new Proxy({}, { get: (_, nombre) => ({
  subscribe: (fn) => { (handlers[`${grupo}.${String(nombre)}`] ??= []).push(fn); return fn; },
  unsubscribe: () => {},
}) });
export function emitir(nombre, ev) { for (const fn of handlers[nombre] ?? []) fn(ev); return ev; }
export const timeouts = [];
export const intervals = [];
let ids = 0;
export const system = {
  currentTick: 0,
  runTimeout(fn, t = 0) { const id = ++ids; timeouts.push({ id, at: system.currentTick + Math.max(1, t), fn }); return id; },
  runInterval(fn, every = 1) { const id = ++ids; intervals.push({ id, fn, every: Math.max(1, every) }); return id; },
  clearRun(id) { const i = intervals.findIndex((x) => x.id === id); if (i >= 0) intervals.splice(i, 1); const j = timeouts.findIndex((x) => x.id === id); if (j >= 0) timeouts.splice(j, 1); },
  run(fn) { return system.runTimeout(fn, 1); },
  runJob(g) { let r; do { r = g.next(); } while (!r.done); return 0; },
  beforeEvents: signal("system.before"), afterEvents: signal("system.after"),
};
export const errores = [];
export const medida = { msScripts: 0, msFisica: 0, ticks: 0 };
export function tick() {
  system.currentTick++;
  const t0 = performance.now();
  try { fisica(); } catch (e) { errores.push(e); }
  const t1 = performance.now();
  for (const x of timeouts.filter((x) => x.at <= system.currentTick)) {
    timeouts.splice(timeouts.indexOf(x), 1);
    try { x.fn(); } catch (e) { errores.push(e); }
  }
  for (const iv of [...intervals]) if (system.currentTick % iv.every === 0) { try { iv.fn(); } catch (e) { errores.push(e); } }
  const t2 = performance.now();
  medida.msFisica += t1 - t0; medida.msScripts += t2 - t1; medida.ticks++;
}
// --- Mundo de bloques ---
export const W = new Map();
export const log = { ojos: [], sets: [], particulas: [], sonidos: [], items: [], acciones: [], titulos: [], camaras: [], fundidos: [], musica: [], niebla: [], comandos: [], eventos: [], anims: [], explosiones: [], efectos: [], mensajes: [], cooldowns: [] };
const K = (x, y, z) => `${x},${y},${z}`;
export let suelo = (x, z) => 64;
export function setSuelo(f) { suelo = f; }
function natural(x, y, z) {
  const h = suelo(x, z);
  if (y > h) return { id: "minecraft:air", s: {} };
  return { id: y === h ? "minecraft:grass_block" : y > h - 3 ? "minecraft:dirt" : "minecraft:stone", s: {} };
}
export function leer(x, y, z) { return W.get(K(x, y, z)) ?? natural(x, y, z); }
export function escribir(x, y, z, id, s = {}) { W.set(K(x, y, z), { id, s: { ...s } }); log.sets.push({ t: system.currentTick, x, y, z, id }); }
const NO_SOLIDO = new Set(["minecraft:air", "minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava",
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:soul_torch", "minecraft:torch", "minecraft:light_block_15"]);
export const esSolido = (id) => !NO_SOLIDO.has(id) && !/(_sign|carpet|flower|sapling)$/.test(id);
const solidoEn = (x, y, z) => esSolido(leer(Math.floor(x), Math.floor(y), Math.floor(z)).id);
const aguaEn = (x, y, z) => /water/.test(leer(Math.floor(x), Math.floor(y), Math.floor(z)).id);
function permDe(id, s = {}) {
  return { type: { id }, states: { ...s }, getState: (k) => s[k], withState: (k, v) => permDe(id, { ...s, [k]: v }), getAllStates: () => ({ ...s }) };
}
class Block {
  constructor(dim, x, y, z) { this.dimension = dim; this.location = { x, y, z }; }
  get _d() { return leer(this.location.x, this.location.y, this.location.z); }
  get typeId() { return this._d.id; }
  get isAir() { return this._d.id === "minecraft:air"; }
  get isLiquid() { return /water|lava/.test(this._d.id); }
  get permutation() { return permDe(this._d.id, this._d.s); }
  get isValid() { return true; }
  setType(id) { const { x, y, z } = this.location; escribir(x, y, z, id); }
  setPermutation(p) { const { x, y, z } = this.location; escribir(x, y, z, p.type.id, p.states); }
}
export const entidades = [];
export const ajustes = { bebes: 0 };
let eid = 0;
const PROYECTILES = { "minecraft:arrow": { g: 0.05, dano: 6 }, "minecraft:thrown_trident": { g: 0.05, dano: 8 }, "minecraft:ender_pearl": { g: 0.03, dano: 0 },
  "minecraft:splash_potion": { g: 0.05, dano: 0 }, "minecraft:snowball": { g: 0.03, dano: 0 } };
const VIDA_NIVEL = [40, 52, 64, 72, 80];
export class Entity {
  constructor(dim, typeId, loc) {
    this.id = `${-1000 - ++eid}`; this.typeId = typeId; this.dimension = dim; this.location = { ...loc }; this.isValid = true;
    this.nameTag = ""; this.props = {}; this.anims = []; this.rot = { x: 0, y: 0 }; this.isOnGround = true; this.isInWater = false;
    this.dyn = {}; this.tags = new Set(); this.vida = 20; this.vidaMax = 20; this.efectos = []; this.eventos = [];
    this.vel = { x: 0, y: 0, z: 0 }; this.fisica = !(typeId === "minecraft:player"); this.equipo = {}; this.isSprinting = false; this.isSneaking = false;
    this.isFalling = false; this.isClimbing = false; this.isSwimming = false; this.caidaDesde = loc.y; this.fuego = 0;
    if (PROYECTILES[typeId]) { this.proyectil = true; this.volando = false; }
    if (typeId === "minecraft:tnt") { this.mecha = 80; }
    if (typeId === "claudenpc:exponencial_infinito") { this.variant = 0; this.markVariant = 0; this.vidaMax = 40; this.vida = 40; }
    if (typeId === "claudenpc:claude") { this.vidaMax = 40; this.vida = 40; }
    entidades.push(this);
  }
  teleport(p, o = {}) {
    if (!this.isValid) throw new Error("teleport en entidad inválida");
    for (const k of ["x", "y", "z"]) if (!Number.isFinite(p[k])) throw new Error(`teleport con ${k}=${p[k]}`);
    this.location = { ...p };
    if (!o.keepVelocity) this.vel = { x: 0, y: 0, z: 0 };
    if (o.rotation) this.rot = { ...o.rotation };
    if (o.dimension) this.dimension = o.dimension;
    this.caidaDesde = p.y;
  }
  tryTeleport(p, o = {}) { if (o.checkForBlocks && solidoEn(p.x, p.y, p.z)) return false; this.teleport(p, o); return true; }
  setProperty(k, v) { if (!this.isValid) throw new Error("prop en inválida"); this.props[k] = v; }
  getProperty(k) { return this.props[k]; }
  playAnimation(a, o = {}) { this.anims.push(a); log.anims.push({ t: system.currentTick, a, quien: this.typeId, ctrl: o.controller }); }
  remove() { this.isValid = false; emitir("world.after.entityRemove", { removedEntityId: this.id, typeId: this.typeId }); }
  getComponent(k) {
    const self = this;
    if (k === "minecraft:health") return { get currentValue() { return self.vida; }, get effectiveMax() { return self.vidaMax; },
      setCurrentValue(v) { self.vida = Math.min(self.vidaMax, v); return true; }, resetToMaxValue() { self.vida = self.vidaMax; } };
    if (k === "minecraft:equippable") return {
      getEquipment: (slot) => {
        if (self.equipoObj?.[slot]) return self.equipoObj[slot];
        const id = slot === "Mainhand" ? self.mano : self.equipo[slot];
        return id && id !== "minecraft:air" ? { typeId: id } : undefined;
      },
      setEquipment: (slot, item) => {
        self.equipoObj ??= {};
        if (!item) { delete self.equipo[slot]; delete self.equipoObj[slot]; if (slot === "Mainhand") self.mano = undefined; return true; }
        self.equipo[slot] = item.typeId; self.equipoObj[slot] = item; if (slot === "Mainhand") self.mano = item.typeId;
        return true;
      },
    };
    if (k === "minecraft:inventory" && this instanceof Player) {
      self.items ??= new Array(36).fill(undefined);
      return { container: { size: 36, getItem: (i) => self.items[i], setItem: (i, it) => { self.items[i] = it ?? undefined; },
        get emptySlotsCount() { return self.items.filter((x) => !x).length; } } };
    }
    if (k === "minecraft:is_baby") return this.bebe ? {} : undefined;
    if (k === "minecraft:variant") return this.variant !== undefined ? { value: this.variant } : undefined;
    if (k === "minecraft:mark_variant") return this.markVariant !== undefined ? { value: this.markVariant } : undefined;
    if (k === "minecraft:onfire") return this.fuego > 0 ? { onFireTicksRemaining: this.fuego } : undefined;
    if (k === "minecraft:movement") return { setCurrentValue(v) { self.movimiento = v; }, get currentValue() { return self.movimiento ?? 0.3; } };
    if (k === "minecraft:projectile" && this.proyectil) return {
      get owner() { return self.dueno; }, set owner(v) { self.dueno = v; },
      shoot(v) { self.vel = { ...v }; self.volando = true; },
    };
    return undefined;
  }
  getViewDirection() { return this.mira ?? { x: 0, y: 0, z: 1 }; }
  getRotation() { return this.rot; }
  setRotation(r) { for (const k of ["x", "y"]) if (!Number.isFinite(r[k])) throw new Error(`rotación ${k}=${r[k]}`); this.rot = r; }
  applyImpulse(v) { for (const k of ["x", "y", "z"]) if (!Number.isFinite(v[k])) throw new Error(`impulso ${k}=${v[k]}`); this.vel = { x: this.vel.x + v.x, y: this.vel.y + v.y, z: this.vel.z + v.z }; }
  clearVelocity() { this.vel = { x: 0, y: 0, z: 0 }; }
  applyKnockback(h, y) { this.vel = { x: h.x, y, z: h.z }; this.empujes = (this.empujes ?? 0) + 1; this.ultimoEmpuje = Math.hypot(h.x, h.z); }
  getVelocity() { return { ...this.vel }; }
  getHeadLocation() { return { ...this.location, y: this.location.y + 1.6 }; }
  triggerEvent(ev) {
    this.eventos.push(ev); log.eventos.push(ev);
    if (ev === "claudenpc:fase_final") { this.vidaMax = 1000; this.vida = 1000; }
    const m = /^claudenpc:nivel_(\d)$/.exec(ev);
    if (m && this.typeId === "claudenpc:exponencial_infinito") { this.variant = Number(m[1]); this.vidaMax = VIDA_NIVEL[this.variant]; this.vida = this.vidaMax; }
    const a = /^claudenpc:aura_(\d)$/.exec(ev);
    if (a) this.markVariant = Number(a[1]);
  }
  addEffect(ef, dur, o = {}) {
    this.efectos.push(ef); log.efectos.push({ t: system.currentTick, quien: this.typeId, ef, dur, amp: o.amplifier ?? 0 });
    (this.activos ??= {})[ef] = { hasta: system.currentTick + dur, amp: o.amplifier ?? 0 };
    if (ef === "instant_health") this.vida = Math.min(this.vidaMax, this.vida + 4 * 2 ** (o.amplifier ?? 0));
    if (ef === "instant_damage") this.applyDamage(6 * 2 ** (o.amplifier ?? 0), { cause: "magic" });
  }
  addTag(t) { this.tags.add(t); return true; }
  hasTag(t) { return this.tags.has(t); }
  getDynamicProperty(k) { return this.dyn[k]; }
  setDynamicProperty(k, v) { if (v === undefined) delete this.dyn[k]; else this.dyn[k] = v; }
  runCommand(c) {
    log.comandos.push(c);
    const m = /^replaceitem entity @s (\S+) 0 (\S+)/.exec(c);
    if (m) { this.equipo[m[1]] = m[2]; if (m[1] === "slot.weapon.mainhand") this.mano = m[2] === "minecraft:air" ? undefined : m[2]; if (m[1] === "slot.weapon.offhand") this.equipo.Offhand = m[2]; if (m[1] === "slot.armor.chest") this.equipo.Chest = m[2]; }
    return {};
  }
  matches(o) { return cerca(this, o); }
  setOnFire(t) { this.fuego = t * 20; return true; }
  extinguishFire() { this.fuego = 0; return true; }
  applyDamage(n, o = {}) {
    if (!this.isValid) return false;
    const causa = o.cause ?? "none";
    const otro = o.damagingEntity;
    if (this.typeId === "minecraft:ender_crystal") { explotar(this.dimension, { ...this.location }, 6, true, this); this.remove(); return true; }
    if (otro && causa === "entityAttack") emitir("world.after.entityHitEntity", { damagingEntity: otro, hitEntity: this });
    if (otro && causa === "projectile" && !o.sinEvento) emitir("world.after.projectileHitEntity", { source: otro, projectile: o.projectile, dimension: this.dimension, location: { ...this.location }, getEntityHit: () => ({ entity: this }) });
    // Resistencia V (cinemáticas): no recibe daño salvo el vacío o /kill.
    const res = this.activos?.resistance;
    if (res && res.hasta > system.currentTick && res.amp >= 4 && causa !== "void" && causa !== "override") return false;
    // Invulnerabilidad de 10 ticks (como el juego): un golpe más débil en ese tiempo no entra.
    if (this.inmuneHasta !== undefined && system.currentTick < this.inmuneHasta && n <= (this.ultimoDanoRecibido ?? 0)) return false;
    const ctx = { yo: this, otro, danador: o.projectile ?? otro, dano: n, causa };
    let deals = true;
    let mult = 1;
    for (const t of sensores.get(this.typeId) ?? []) {
      const c = t.cause ?? "all";
      if (c !== "all" && c !== CAUSA[causa]) continue;
      if (!filtro(t.on_damage?.filters, ctx)) continue;
      if (t.on_damage?.event) {
        disparados.push({ t: system.currentTick, quien: this.typeId, ev: t.on_damage.event });
        emitir("world.after.dataDrivenEntityTrigger", { entity: this, eventId: t.on_damage.event, getModifiers: () => [] });
      }
      deals = !(t.deals_damage === false || t.deals_damage === "no");
      mult = t.damage_multiplier ?? 1;
      break;
    }
    if (!deals) return false;
    const dano = n * mult;
    this.dano = (this.dano ?? 0) + dano; this.golpes = (this.golpes ?? 0) + 1;
    (this.historial ??= []).push({ t: system.currentTick, dano, causa, quien: otro?.typeId });
    this.vida -= dano;
    this.inmuneHasta = system.currentTick + 10; this.ultimoDanoRecibido = n;
    emitir("world.after.entityHurt", { hurtEntity: this, damage: dano, damageSource: { cause: causa, damagingEntity: otro, damagingProjectile: o.projectile } });
    if (this.vida <= 0) {
      this.vida = 0;
      emitir("world.after.entityDie", { deadEntity: this, damageSource: { cause: causa, damagingEntity: otro } });
      if (this.typeId !== "minecraft:player") this.isValid = false;
    }
    return true;
  }
  kill() { this.vida = 0; this.isValid = false; return true; }
  removeTag(t) { return this.tags.delete(t); }
  getTags() { return [...this.tags]; }
  removeEffect(ef) { this.efectos = this.efectos.filter((x) => x !== ef); if (this.activos) delete this.activos[ef]; return true; }
}
export class Player extends Entity {
  constructor(dim, loc) {
    super(dim, "minecraft:player", loc); this.name = `Jugador${eid}`; this.modo = "Survival"; this.isSneaking = false; this.isJumping = false;
    const self = this;
    this.onScreenDisplay = { setActionBar: (t) => log.acciones.push({ t: system.currentTick, txt: t }), setTitle: (t, o) => log.titulos.push({ t: system.currentTick, txt: t, sub: o?.subtitle }),
      clearTitle() {}, setHudVisibility() {} };
    this.camera = { setCamera: (tipo, o) => log.camaras.push({ t: system.currentTick, o }), fade: (o) => log.fundidos.push({ t: system.currentTick, c: o.fadeColor }), clear() { self.camLibre = false; } };
    this.inputPermissions = { setPermissionCategory: (c, v) => { self.permisos = { ...(self.permisos ?? {}), [c]: v }; } };
  }
  runCommand(c) { log.comandos.push(c); return {}; }
  getGameMode() { return this.modo; }
  setGameMode(m) { this.modo = m; }
  playMusic(id, o) { log.musica.push({ t: system.currentTick, id, o }); }
  stopMusic() { log.musica.push({ t: system.currentTick, id: "STOP" }); }
  playSound(id) { log.sonidos.push(id); }
  sendMessage(m) { log.mensajes.push(m); }
  startItemCooldown(cat, t) { log.cooldowns.push({ t: system.currentTick, cat, dur: t }); this.cooldown = { cat, hasta: system.currentTick + t }; }
  getItemCooldown() { return 0; }
}
function cerca(e, o) {
  if (!e.isValid) return false;
  if (o.type && e.typeId !== o.type) return false;
  if (o.excludeTypes && o.excludeTypes.includes(e.typeId)) return false;
  if (o.tags && !o.tags.every((t) => e.tags.has(t))) return false;
  const fam = familias.get(e.typeId) ?? [];
  if (o.families && !o.families.every((f) => fam.includes(f))) return false;
  if (o.excludeFamilies && o.excludeFamilies.some((f) => fam.includes(f))) return false;
  if (o.excludeGameModes && e instanceof Player && o.excludeGameModes.includes(e.modo)) return false;
  if (o.location && o.maxDistance !== undefined) {
    const d = Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z);
    if (d > o.maxDistance) return false;
  }
  return true;
}
function consulta(lista, o) {
  let r = lista.filter((e) => cerca(e, o));
  if (o.closest && o.location) {
    const d = (e) => Math.hypot(e.location.x - o.location.x, e.location.y - o.location.y, e.location.z - o.location.z);
    r = r.sort((a, b) => d(a) - d(b)).slice(0, o.closest);
  }
  return r;
}
// --- Explosiones ---
export function explotar(dim, pos, radio, rompe, fuente, causesFire = false) {
  const bloques = [];
  if (rompe) {
    for (let x = Math.floor(pos.x - radio); x <= pos.x + radio; x++) for (let y = Math.floor(pos.y - radio); y <= pos.y + radio; y++)
      for (let z = Math.floor(pos.z - radio); z <= pos.z + radio; z++) {
        if (Math.hypot(x + 0.5 - pos.x, y + 0.5 - pos.y, z + 0.5 - pos.z) > radio) continue;
        if (leer(x, y, z).id !== "minecraft:air") bloques.push(new Block(dim, x, y, z));
      }
  }
  const ev = { source: fuente, dimension: dim, cancel: false, _b: bloques, getImpactedBlocks() { return this._b; }, setImpactedBlocks(b) { this._b = b; } };
  emitir("world.before.explosion", ev);
  const reg = { t: system.currentTick, pos: { ...pos }, radio, fuente: fuente?.typeId, bloquesPedidos: bloques.length, bloquesRotos: 0, danados: [], causesFire };
  log.explosiones.push(reg);
  if (ev.cancel) return false;
  for (const b of ev._b) { b.setType("minecraft:air"); reg.bloquesRotos++; }
  for (const e of [...entidades]) {
    if (!e.isValid || e.dimension !== dim || e === fuente || e.proyectil) continue;
    const d = Math.hypot(e.location.x - pos.x, e.location.y + 0.9 - pos.y, e.location.z - pos.z);
    if (d > radio * 2) continue;
    const impacto = 1 - d / (radio * 2);
    const dano = Math.round(((impacto * impacto + impacto) / 2) * 7 * radio * 2 + 1);
    if (e.applyDamage(dano, { cause: "entityExplosion", damagingEntity: fuente })) reg.danados.push({ tipo: e.typeId, dano });
  }
  return true;
}
// --- Física (cada tick, antes de los scripts) ---
function fisica() {
  for (const e of [...entidades]) {
    if (!e.isValid) continue;
    if (e.typeId === "minecraft:tnt" && --e.mecha <= 0) { e.remove(); explotar(e.dimension, { ...e.location, y: e.location.y + 0.5 }, 4, true, e); continue; }
    if (e.fuego > 0) e.fuego--;
    if (!e.fisica) continue;
    if (e.proyectil) { volar(e); continue; }
    const enAgua = aguaEn(e.location.x, e.location.y + 0.1, e.location.z);
    e.isInWater = enAgua;
    const v = e.vel;
    // Horizontal con choques (pies y cabeza).
    let nx = e.location.x + v.x;
    if (solidoEn(nx, e.location.y + 0.1, e.location.z) || solidoEn(nx, e.location.y + 1.1, e.location.z)) { nx = e.location.x; v.x = 0; }
    let nz = e.location.z + v.z;
    if (solidoEn(nx, e.location.y + 0.1, nz) || solidoEn(nx, e.location.y + 1.1, nz)) { nz = e.location.z; v.z = 0; }
    let ny = e.location.y + v.y;
    let suelo = false;
    if (v.y <= 0 && solidoEn(nx, ny, nz)) { ny = Math.floor(ny) + 1; suelo = true; }
    if (v.y > 0 && solidoEn(nx, ny + 1.8, nz)) { ny = e.location.y; v.y = 0; }
    if (!suelo && v.y <= 0 && solidoEn(nx, ny - 0.001, nz)) suelo = true;
    e.location = { x: nx, y: ny, z: nz };
    const antes = e.isOnGround;
    e.isOnGround = suelo;
    e.isFalling = !suelo && v.y < 0;
    if (!suelo) e.caidaDesde = Math.max(e.caidaDesde ?? ny, ny);
    if (suelo) {
      if (!antes) {
        const caida = (e.caidaDesde ?? ny) - ny;
        const enAguaAhora = aguaEn(nx, ny + 0.1, nz);
        if (caida > 3.2 && !enAguaAhora) e.applyDamage(Math.floor(caida - 3), { cause: "fall" });
        e.ultimaCaida = { t: system.currentTick, caida, agua: enAguaAhora };
      }
      e.caidaDesde = ny;
      v.y = 0;
      v.x *= 0.546; v.z *= 0.546;
    } else if (enAgua) {
      v.x *= 0.8; v.z *= 0.8; v.y = (v.y - 0.02) * 0.8;
      e.caidaDesde = ny;
    } else {
      // Como el juego: primero se mueve con su velocidad y después cae la gravedad.
      v.x *= 0.91; v.z *= 0.91; v.y = (v.y - 0.08) * 0.98;
    }
    if (ny < -70) { e.applyDamage(1000, { cause: "void" }); }
  }
}
function volar(e) {
  if (!e.volando) return;
  const g = PROYECTILES[e.typeId]?.g ?? 0.05;
  const v = e.vel;
  const pasos = Math.max(1, Math.ceil(Math.hypot(v.x, v.y, v.z) / 0.25));
  for (let i = 0; i < pasos; i++) {
    const p = { x: e.location.x + v.x / pasos, y: e.location.y + v.y / pasos, z: e.location.z + v.z / pasos };
    // ¿Choca con una entidad?
    for (const o of entidades) {
      if (!o.isValid || o === e || o === e.dueno || o.proyectil || o.dimension !== e.dimension || o.typeId === "minecraft:item") continue;
      if (Math.hypot(o.location.x - p.x, o.location.z - p.z) < 0.5 && p.y > o.location.y - 0.1 && p.y < o.location.y + 1.9) {
        const ev = { projectile: e, source: e.dueno, dimension: e.dimension, location: { ...p }, hitVector: { ...v }, getEntityHit: () => ({ entity: o }) };
        emitir("world.after.projectileHitEntity", ev);
        const dano = PROYECTILES[e.typeId]?.dano ?? 0;
        if (dano > 0) o.applyDamage(dano, { cause: "projectile", damagingEntity: e.dueno, projectile: e, sinEvento: true });
        e.location = p;
        e.remove();
        return;
      }
    }
    if (solidoEn(p.x, p.y, p.z)) {
      const ev = { projectile: e, source: e.dueno, dimension: e.dimension, location: { ...p }, hitVector: { ...v },
        getBlockHit: () => ({ block: new Block(e.dimension, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)), face: "Up", faceLocation: { x: 0.5, y: 1, z: 0.5 } }) };
      emitir("world.after.projectileHitBlock", ev);
      e.location = { x: p.x, y: Math.floor(p.y) + 1, z: p.z };
      if (e.typeId === "minecraft:arrow" || e.typeId === "minecraft:thrown_trident") { e.volando = false; e.vel = { x: 0, y: 0, z: 0 }; e.clavada = true; }
      else e.remove();
      return;
    }
    e.location = p;
  }
  v.x *= 0.99; v.z *= 0.99; v.y = v.y * 0.99 - g;
  if (e.location.y < -70) e.remove();
}
function rayo(dim, origen, dir, o = {}) {
  const max = o.maxDistance ?? 64;
  for (let d = 0.05; d <= max; d += 0.05) {
    const x = origen.x + dir.x * d, y = origen.y + dir.y * d, z = origen.z + dir.z * d;
    const id = leer(Math.floor(x), Math.floor(y), Math.floor(z)).id;
    const liquido = /water|lava/.test(id);
    if ((liquido && o.includeLiquidBlocks) || esSolido(id)) {
      return { block: new Block(dim, Math.floor(x), Math.floor(y), Math.floor(z)), face: "Up", faceLocation: { x: x - Math.floor(x), y: y - Math.floor(y), z: z - Math.floor(z) } };
    }
  }
  return undefined;
}
export function crearDim(id) {
  const dim = {
    id, heightRange: { min: -64, max: 320 },
    getBlock: (p) => new Block(dim, Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)),
    getTopmostBlock: (p) => { for (let y = 200; y >= -64; y--) if (leer(Math.floor(p.x), y, Math.floor(p.z)).id !== "minecraft:air") return new Block(dim, Math.floor(p.x), y, Math.floor(p.z)); return undefined; },
    spawnEntity: (type, pos, o) => {
      for (const k of ["x", "y", "z"]) if (!Number.isFinite(pos[k])) throw new Error(`spawn ${type} con ${k}=${pos[k]}`);
      const e = type === "minecraft:player" ? new Player(dim, pos) : new Entity(dim, type, pos);
      e.spawnEvent = o?.spawnEvent;
      if (ajustes.bebes > 0 && /zombie|husk|villager/.test(type)) { e.bebe = true; ajustes.bebes--; }
      emitir("world.after.entitySpawn", { entity: e, cause: "Spawned" });
      return e;
    },
    getEntities: (o = {}) => consulta(entidades.filter((e) => e.dimension === dim), o),
    getPlayers: (o = {}) => consulta(entidades.filter((e) => e instanceof Player && e.dimension === dim), { ...o, type: undefined }),
    spawnParticle: (id, pos, vars) => {
      for (const k of ["x", "y", "z"]) if (!Number.isFinite(pos[k])) throw new Error(`partícula ${id} con ${k}=${pos[k]}`);
      log.particulas.push(id);
      if (id.startsWith("claudenpc:cine_")) (log.cine ??= []).push({ t: system.currentTick, id, pos: { ...pos }, v: { ...(vars?.v ?? {}) } });
    },
    playSound: (s) => log.sonidos.push(s),
    spawnItem: (it) => log.items.push(it),
    runCommand: () => ({}),
    setWeather() {},
    getBlockFromRay: (o, d, op) => rayo(dim, o, d, op),
    createExplosion: (pos, radio, o = {}) => explotar(dim, pos, radio, o.breaksBlocks !== false, o.source, !!o.causesFire),
  };
  return dim;
}
export const overworld = crearDim("minecraft:overworld");
const otras = { "minecraft:nether": crearDim("minecraft:nether"), "minecraft:the_end": crearDim("minecraft:the_end") };
const props = new Map();
const estructuras = new Map();
class Structure {
  constructor(id, size) { this.id = id; this.size = size; this.bloques = new Map(); this.isValid = true; }
  setBlockPermutation(p, perm) { this.bloques.set(K(p.x, p.y, p.z), perm ? { id: perm.type.id, s: perm.states } : undefined); }
}
export const world = {
  beforeEvents: signal("world.before"), afterEvents: signal("world.after"),
  getDimension: (id) => (id === "minecraft:overworld" || id === "overworld" ? overworld : otras[id] ?? overworld),
  getEntity: (id) => entidades.find((e) => e.id === id && e.isValid),
  getDynamicProperty: (k) => props.get(k), setDynamicProperty: (k, v) => (v === undefined ? props.delete(k) : props.set(k, v)),
  getPlayers: () => entidades.filter((e) => e instanceof Player && e.isValid),
  getAllPlayers: () => entidades.filter((e) => e instanceof Player && e.isValid),
  setTimeOfDay() {},
  getTimeOfDay: () => 6000,
  scoreboard: { getObjective: () => undefined, addObjective: () => ({ setScore() {}, getScore: () => 0 }) },
  structureManager: {
    get: (id) => estructuras.get(id),
    delete: (s) => { const id = typeof s === "string" ? s : s.id; const st = estructuras.get(id); if (st) st.isValid = false; return estructuras.delete(id); },
    createEmpty: (id, size) => { const s = new Structure(id, size); estructuras.set(id, s); return s; },
    createFromWorld: (id, dim, a, b) => {
      const s = new Structure(id, { x: b.x - a.x + 1, y: b.y - a.y + 1, z: b.z - a.z + 1 });
      for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) for (let z = a.z; z <= b.z; z++) s.bloques.set(K(x - a.x, y - a.y, z - a.z), leer(x, y, z));
      estructuras.set(id, s); return s;
    },
    place: (s, dim, loc) => {
      const st = typeof s === "string" ? estructuras.get(s) : s;
      if (!st || !st.isValid) throw new Error("estructura inválida");
      for (const [k, b] of st.bloques) { if (!b) continue; const [x, y, z] = k.split(",").map(Number); escribir(loc.x + x, loc.y + y, loc.z + z, b.id, b.s); }
    },
  },
};
export const EasingType = new Proxy({}, { get: (_, k) => k });
export const HudVisibility = { Hide: 0, Reset: 1 };
export const InputPermissionCategory = { Camera: 1, Movement: 2, Jump: 6 };
export const EntityDamageCause = new Proxy({}, { get: (_, k) => k });
export const GameMode = new Proxy({}, { get: (_, k) => k });
export const StructureSaveMode = { Memory: "Memory", World: "World" };
export const StructureAnimationMode = { Blocks: "Blocks", Layers: "Layers", None: "None" };
export class BlockPermutation { static resolve(id, s = {}) { return permDe(id, s); } }
export class ItemStack { constructor(id, n = 1) { this.typeId = id; this.amount = n; } }
export class MolangVariableMap { constructor() { this.v = {}; } setVector3(k, v) { for (const c of ["x", "y", "z"]) if (!Number.isFinite(v[c])) throw new Error(`molang ${k}.${c}=${v[c]}`); this.v[k] = { ...v }; } setFloat(k, v) { if (!Number.isFinite(v)) throw new Error(`molang ${k}=${v}`); this.v[k] = v; } setColorRGB() {} }
export const CustomCommandParamType = new Proxy({}, { get: (_, k) => k });
export const CommandPermissionLevel = new Proxy({}, { get: (_, k) => k });
export const CustomCommandStatus = new Proxy({}, { get: (_, k) => k });
export const EquipmentSlot = new Proxy({}, { get: (_, k) => k });
export const DyeColor = new Proxy({}, { get: (_, k) => k });
export const TicksPerSecond = 20;
export const TimeOfDay = new Proxy(function () {}, { get: (_, k) => (k === "prototype" ? {} : k) });
export const WeatherType = new Proxy(function () {}, { get: (_, k) => (k === "prototype" ? {} : k) });
