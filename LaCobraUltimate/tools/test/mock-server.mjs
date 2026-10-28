// Simulador mínimo de @minecraft/server para pruebas automáticas fuera del juego.
// No reemplaza las pruebas en Minecraft: verifica la lógica de los scripts y que
// cada partícula, sonido, animación, entidad y evento usados existan en los packs.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const BP = path.join(ROOT, "packs/LaCobra_BP");
const RP = path.join(ROOT, "packs/LaCobra_RP");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const list = (d) => fs.readdirSync(d).map((f) => path.join(d, f));

// ------------------------------------------------------------- datos reales de los packs
const PARTICLES = new Set(list(path.join(RP, "particles")).map((f) => readJson(f).particle_effect.description.identifier));
const SOUNDS = new Set(Object.keys(readJson(path.join(RP, "sounds/sound_definitions.json")).sound_definitions));
const ANIMS = new Set();
for (const f of list(path.join(RP, "animations"))) for (const k of Object.keys(readJson(f).animations)) ANIMS.add(k);
const BP_ENTITIES = new Map();
for (const f of list(path.join(BP, "entities"))) {
  const e = readJson(f)["minecraft:entity"];
  BP_ENTITIES.set(e.description.identifier, e);
}
const VANILLA_FAMILIES = {
  "minecraft:player": ["player", "mob"],
  "minecraft:zombie": ["zombie", "undead", "monster", "mob"],
  "minecraft:skeleton": ["skeleton", "undead", "monster", "mob"],
  "minecraft:villager": ["villager", "peasant", "mob"],
  "minecraft:cow": ["cow", "mob"],
  "minecraft:arrow": ["arrow"],
  "minecraft:item": ["item"],
};

export const log = { errors: [], particles: [], sounds: [], anims: [], commands: [] };
const strict = (cond, msg) => {
  if (!cond) log.errors.push(msg);
};

// ------------------------------------------------------------- enums
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const GameMode = { Survival: "Survival", Creative: "Creative", Adventure: "Adventure", Spectator: "Spectator" };
export const Difficulty = { Peaceful: "Peaceful", Easy: "Easy", Normal: "Normal", Hard: "Hard" };
export const EntityDamageCause = { entityAttack: "entityAttack", projectile: "projectile" };
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const CustomCommandParamType = { Integer: "Integer", Enum: "Enum", String: "String" };
export const CustomCommandStatus = { Success: 0, Failure: 1 };

export class MolangVariableMap {
  constructor() {
    this.vars = {};
  }
  setFloat(k, v) {
    this.vars[k] = v;
  }
}

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId;
    this.amount = amount;
  }
}

class Signal {
  constructor() {
    this.subs = [];
  }
  subscribe(cb, opts) {
    this.subs.push({ cb, opts });
    return cb;
  }
  unsubscribe(cb) {
    this.subs = this.subs.filter((s) => s.cb !== cb);
  }
  fire(ev, entity) {
    for (const s of this.subs) {
      const o = s.opts;
      if (o && entity) {
        if (o.entityTypes && !o.entityTypes.includes(entity.typeId)) continue;
        if (o.entityFilter?.type && o.entityFilter.type !== entity.typeId) continue;
      }
      s.cb(ev);
    }
  }
}

// ------------------------------------------------------------- system
const intervals = [];
let runQueue = [];
export const system = {
  currentTick: 0,
  runInterval(fn, n = 1) {
    intervals.push({ fn, n });
    return intervals.length;
  },
  run(fn) {
    runQueue.push(fn);
    return runQueue.length;
  },
  beforeEvents: { startup: new Signal() },
};

export function advance(ticks = 1) {
  for (let i = 0; i < ticks; i++) {
    system.currentTick++;
    const q = runQueue;
    runQueue = [];
    for (const fn of q) fn();
    for (const it of intervals) if (system.currentTick % it.n === 0) it.fn();
  }
}

// ------------------------------------------------------------- entidades
let nextId = 1;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

export class Entity {
  constructor(typeId, dim, loc) {
    this.id = String(nextId++);
    this.typeId = typeId;
    this.dimension = dim;
    this.location = { ...loc };
    this._valid = true;
    const bp = BP_ENTITIES.get(typeId);
    const fam = bp?.components["minecraft:type_family"]?.family ?? VANILLA_FAMILIES[typeId] ?? [];
    this.families = new Set(fam);
    const hp = bp?.components["minecraft:health"]?.value ?? (typeId === "minecraft:player" ? 20 : 20);
    this.hp = hp;
    this.maxHp = hp;
    this.effects = {};
    this.damageLog = [];
    this.knock = [];
    this.props = {};
    for (const [k, p] of Object.entries(bp?.description.properties ?? {})) this.props[k] = p.default;
    this.dyn = {};
    this.events = [];
    this.view = { x: 0, y: 0, z: 1 };
    this.projectile = BP_ENTITIES.get(typeId)?.components["minecraft:projectile"]
      ? { owner: undefined, shot: null, shoot(v) { this.shot = v; } }
      : undefined;
  }
  get isValid() {
    return this._valid;
  }
  getComponent(id) {
    id = id.replace("minecraft:", "");
    if (id === "health") {
      const e = this;
      return {
        get currentValue() { return e.hp; },
        effectiveMax: e.maxHp,
        setCurrentValue(v) { e.hp = v; return true; },
      };
    }
    if (id === "type_family") return { hasTypeFamily: (f) => this.families.has(f) };
    if (id === "projectile") return this.projectile;
    return undefined;
  }
  applyDamage(amount, opts) {
    strict(this._valid, "applyDamage sobre entidad inválida");
    this.hp = Math.max(0, this.hp - amount);
    this.damageLog.push({ amount, by: opts?.damagingEntity?.id });
    if (this.hp <= 0 && this.typeId !== "minecraft:player") {
      world.afterEvents.entityDie.fire({ deadEntity: this, damageSource: {} });
    }
    return true;
  }
  applyKnockback(h, v) {
    this.knock.push({ h, v });
  }
  applyImpulse(v) {
    this.impulse = v;
  }
  addEffect(id, dur, opts) {
    this.effects[id] = { dur, amp: opts?.amplifier ?? 0 };
  }
  teleport(loc, opts) {
    strict(this._valid, "teleport sobre entidad inválida " + this.typeId);
    this.location = { ...loc };
    this.facing = opts?.facingLocation;
  }
  remove() {
    if (!this._valid) throw new Error("ya eliminada");
    this._valid = false;
    this.dimension.entities.delete(this.id);
  }
  triggerEvent(name) {
    const ev = BP_ENTITIES.get(this.typeId)?.events?.[name];
    strict(ev, `triggerEvent: ${this.typeId} no tiene el evento ${name}`);
    this.events.push(name);
    for (const st of ev?.sequence ?? [ev ?? {}]) Object.assign(this.props, st.set_property ?? {});
  }
  getProperty(k) {
    strict(k in this.props, `getProperty: ${this.typeId} no define ${k}`);
    return this.props[k];
  }
  playAnimation(name) {
    strict(ANIMS.has(name), "playAnimation: animación inexistente " + name);
    log.anims.push({ entity: this.typeId, name });
  }
  getViewDirection() {
    return this.view;
  }
  getHeadLocation() {
    return { x: this.location.x, y: this.location.y + 1.6, z: this.location.z };
  }
  getDynamicProperty(k) {
    return this.dyn[k];
  }
  setDynamicProperty(k, v) {
    this.dyn[k] = v;
  }
  runCommand(c) {
    log.commands.push(c);
    return { successCount: 1 };
  }
  getEntitiesFromViewDirection(opts) {
    const out = [];
    for (const e of this.dimension.entities.values()) {
      if (e === this) continue;
      const d = { x: e.location.x - this.location.x, y: 0, z: e.location.z - this.location.z };
      const l = Math.hypot(d.x, d.z);
      if (l > (opts?.maxDistance ?? 64) || l === 0) continue;
      if ((d.x * this.view.x + d.z * this.view.z) / l > 0.97) out.push({ entity: e, distance: l });
    }
    return out.sort((a, b) => a.distance - b.distance);
  }
}

export class Player extends Entity {
  constructor(dim, loc, name) {
    super("minecraft:player", dim, loc);
    this.name = name;
    this.gameMode = GameMode.Survival;
    this.actionbar = "";
    this.titles = [];
    this.messages = [];
    this.selectedSlotIndex = 0;
    this.inv = new Array(36).fill(undefined);
    this.equip = {};
  }
  getGameMode() {
    return this.gameMode;
  }
  get onScreenDisplay() {
    const p = this;
    return {
      setActionBar(t) { p.actionbar = t; },
      setTitle(t, o) { p.titles.push({ t, sub: o?.subtitle }); },
    };
  }
  playSound(id) {
    strict(SOUNDS.has(id), "playSound: sonido inexistente " + id);
  }
  sendMessage(m) {
    this.messages.push(m);
  }
  getComponent(id) {
    const p = this;
    const s = id.replace("minecraft:", "");
    if (s === "inventory") {
      return {
        container: {
          size: 36,
          getItem: (i) => p.inv[i],
          setItem: (i, it) => { p.inv[i] = it; },
          addItem: (it) => {
            const i = p.inv.findIndex((x) => !x);
            if (i < 0) return it;
            p.inv[i] = it;
            return undefined;
          },
        },
      };
    }
    if (s === "equippable") {
      return {
        getEquipment: (slot) => (slot === "Mainhand" ? p.inv[p.selectedSlotIndex] : p.equip[slot]),
        setEquipment: (slot, it) => {
          if (slot === "Mainhand") p.inv[p.selectedSlotIndex] = it;
          else p.equip[slot] = it;
          return true;
        },
      };
    }
    return super.getComponent(id);
  }
}

export class Dimension {
  constructor(id) {
    this.id = "minecraft:" + id;
    this.entities = new Map();
    this.items = [];
  }
  add(e) {
    this.entities.set(e.id, e);
    return e;
  }
  spawnEntity(type, loc) {
    if (type.startsWith("lacobra:")) strict(BP_ENTITIES.has(type), "spawnEntity: entidad inexistente " + type);
    const e = this.add(new Entity(type, this, loc));
    world.afterEvents.entitySpawn.fire({ entity: e, cause: "Spawned" });
    return e;
  }
  spawnItem(it, loc) {
    this.items.push({ it, loc });
    return new Entity("minecraft:item", this, loc);
  }
  spawnParticle(id, loc, map) {
    strict(PARTICLES.has(id), "spawnParticle: partícula inexistente " + id);
    log.particles.push({ id, vars: map?.vars });
  }
  playSound(id) {
    strict(SOUNDS.has(id), "playSound: sonido inexistente " + id);
    log.sounds.push(id);
  }
  getEntities(o = {}) {
    return [...this.entities.values()].filter((e) => {
      if (o.type && e.typeId !== o.type) return false;
      if (o.location && o.maxDistance !== undefined && dist(e.location, o.location) > o.maxDistance) return false;
      if (o.families && !o.families.every((f) => e.families.has(f))) return false;
      if (o.excludeFamilies && o.excludeFamilies.some((f) => e.families.has(f))) return false;
      if (o.excludeTypes && o.excludeTypes.includes(e.typeId)) return false;
      return true;
    });
  }
  getPlayers(o = {}) {
    return this.getEntities({ ...o, type: "minecraft:player" });
  }
}

const dims = { overworld: new Dimension("overworld"), nether: new Dimension("nether"), the_end: new Dimension("the_end") };

export const world = {
  gameRules: { pvp: false },
  difficulty: Difficulty.Normal,
  getDimension: (id) => dims[id.replace("minecraft:", "")],
  getAllPlayers: () => [...dims.overworld.entities.values()].filter((e) => e.typeId === "minecraft:player" && e.isValid),
  getDifficulty: () => world.difficulty,
  afterEvents: {
    worldLoad: new Signal(), entityHitEntity: new Signal(), entityHurt: new Signal(), projectileHitEntity: new Signal(),
    projectileHitBlock: new Signal(), entitySpawn: new Signal(), entityLoad: new Signal(), entityDie: new Signal(),
    playerLeave: new Signal(), playerSpawn: new Signal(),
  },
  beforeEvents: { entityHurt: new Signal(), playerLeave: new Signal() },
};
