// Validador de La Cobra Ultimate: sintaxis JSON, referencias cruzadas entre
// Behavior Pack, Resource Pack y scripts, manifiestos e imports.
// Uso: node tools/validate.mjs   (código de salida 1 si hay errores)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BP = path.join(ROOT, "packs/LaCobra_BP");
const RP = path.join(ROOT, "packs/LaCobra_RP");
const errors = [];
const warnings = [];
let checks = 0;
const err = (m) => errors.push(m);
const ok = () => checks++;

// recursos vanilla que se referencian legítimamente
const VANILLA_TEXTURES = new Set(["textures/misc/enchanted_item_glint"]);
const VANILLA_GEOMETRY = /^geometry\.humanoid\.armor\.(helmet|chestplate|leggings|boots)$/;
const VANILLA_RC = new Set(["controller.render.armor"]);
const VANILLA_MATERIALS = new Set([
  "entity_alphatest", "entity_emissive_alpha", "armor", "armor_enchanted", "entity", "entity_alphablend",
]);
const PARTICLE_MATERIALS = new Set(["particles_alpha", "particles_blend", "particles_opaque"]);

function walk(dir, ext) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...walk(p, ext));
    else if (!ext || p.endsWith(ext)) out.push(p);
  }
  return out;
}
const rel = (p) => path.relative(ROOT, p);

// ------------------------------------------------------------- 1. sintaxis JSON
const json = new Map();
for (const f of [...walk(BP, ".json"), ...walk(RP, ".json")]) {
  try {
    json.set(f, JSON.parse(fs.readFileSync(f, "utf8")));
    ok();
  } catch (e) {
    err(`JSON inválido ${rel(f)}: ${e.message}`);
  }
}
const J = (p) => json.get(p);
const inDir = (base, sub) => [...json.keys()].filter((k) => k.startsWith(path.join(base, sub) + path.sep));

// ------------------------------------------------------------- 2. manifiestos
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const bpm = J(path.join(BP, "manifest.json"));
const rpm = J(path.join(RP, "manifest.json"));
const uuids = new Set();
for (const [name, m] of [["BP", bpm], ["RP", rpm]]) {
  if (!m) {
    err(`Falta manifest ${name}`);
    continue;
  }
  if (m.format_version !== 2) err(`${name}: format_version debe ser 2`);
  for (const u of [m.header.uuid, ...m.modules.map((x) => x.uuid)]) {
    if (!UUID.test(u)) err(`${name}: UUID inválido ${u}`);
    if (uuids.has(u)) err(`${name}: UUID duplicado ${u}`);
    uuids.add(u);
    ok();
  }
}
if (bpm && rpm) {
  const dep = (m, u) => m.dependencies?.some((d) => d.uuid === u);
  if (!dep(bpm, rpm.header.uuid)) err("BP no depende del RP");
  if (!dep(rpm, bpm.header.uuid)) err("RP no depende del BP");
  const script = bpm.modules.find((m) => m.type === "script");
  if (!script || !fs.existsSync(path.join(BP, script.entry))) err("Entrada de script inexistente");
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  for (const d of bpm.dependencies.filter((d) => d.module_name)) {
    const installed = pkg.devDependencies[d.module_name];
    if (installed !== d.version) err(`Dependencia ${d.module_name} ${d.version} no coincide con los tipos verificados (${installed})`);
    ok();
  }
  for (const f of ["pack_icon.png"]) {
    if (!fs.existsSync(path.join(BP, f)) || !fs.existsSync(path.join(RP, f))) warnings.push("Falta pack_icon.png");
  }
}

// ------------------------------------------------------------- 3. recursos del RP
const texExists = (t) => VANILLA_TEXTURES.has(t) || fs.existsSync(path.join(RP, t + ".png"));
const geometries = new Map(); // id -> Set(bones)
for (const f of inDir(RP, "models")) {
  for (const g of J(f)["minecraft:geometry"] ?? []) {
    geometries.set(g.description.identifier, new Set(g.bones.map((b) => b.name)));
    for (const b of g.bones) if (b.parent && !g.bones.some((x) => x.name === b.parent)) err(`${rel(f)}: hueso ${b.name} con padre inexistente`);
    ok();
  }
}
const animations = new Map(); // id -> anim
for (const f of inDir(RP, "animations")) for (const [k, v] of Object.entries(J(f).animations)) animations.set(k, v);
const controllers = new Map();
for (const f of inDir(RP, "animation_controllers")) for (const [k, v] of Object.entries(J(f).animation_controllers)) controllers.set(k, v);
const renderControllers = new Set(VANILLA_RC);
for (const f of inDir(RP, "render_controllers")) for (const k of Object.keys(J(f).render_controllers)) renderControllers.add(k);
const particles = new Map();
for (const f of inDir(RP, "particles")) {
  const p = J(f).particle_effect;
  particles.set(p.description.identifier, p);
  const r = p.description.basic_render_parameters;
  if (!texExists(r.texture)) err(`Partícula ${p.description.identifier}: textura ${r.texture} no existe`);
  if (!PARTICLE_MATERIALS.has(r.material)) err(`Partícula ${p.description.identifier}: material ${r.material}`);
  ok();
}
const soundDefs = J(path.join(RP, "sounds/sound_definitions.json"))?.sound_definitions ?? {};
for (const [k, v] of Object.entries(soundDefs)) {
  for (const s of v.sounds) {
    if (!fs.existsSync(path.join(RP, s.name + ".ogg"))) err(`Sonido ${k}: falta ${s.name}.ogg`);
    ok();
  }
}
for (const [ent, v] of Object.entries(J(path.join(RP, "sounds.json"))?.entity_sounds?.entities ?? {})) {
  for (const s of Object.values(v.events)) if (!soundDefs[s]) err(`sounds.json ${ent}: evento usa sonido inexistente ${s}`);
}

// texturas de objetos
const itemAtlas = J(path.join(RP, "textures/item_texture.json"))?.texture_data ?? {};
for (const [k, v] of Object.entries(itemAtlas)) {
  if (!texExists(v.textures)) err(`item_texture ${k}: falta ${v.textures}.png`);
  ok();
}

// entidades de cliente
const clientEntities = new Map();
function bonesOfAnim(a) {
  return Object.keys(a.bones ?? {});
}
for (const f of [...inDir(RP, "entity"), ...inDir(RP, "attachables")]) {
  const root = J(f)["minecraft:client_entity"] ?? J(f)["minecraft:attachable"];
  const d = root.description;
  clientEntities.set(d.identifier, d);
  for (const [k, t] of Object.entries(d.textures ?? {})) if (!texExists(t)) err(`${rel(f)}: textura ${k}=${t} no existe`);
  for (const m of Object.values(d.materials ?? {})) if (!VANILLA_MATERIALS.has(m)) err(`${rel(f)}: material desconocido ${m}`);
  const geos = Object.values(d.geometry ?? {});
  for (const g of geos) if (!geometries.has(g) && !VANILLA_GEOMETRY.test(g)) err(`${rel(f)}: geometría ${g} no existe`);
  for (const rc of d.render_controllers ?? []) {
    const id = typeof rc === "string" ? rc : Object.keys(rc)[0];
    if (!renderControllers.has(id)) err(`${rel(f)}: render controller ${id} no existe`);
  }
  for (const [short, full] of Object.entries(d.animations ?? {})) {
    if (full.startsWith("controller.")) {
      if (!controllers.has(full)) err(`${rel(f)}: controlador ${full} no existe`);
      else {
        for (const st of Object.values(controllers.get(full).states))
          for (const a of st.animations ?? []) {
            const n = typeof a === "string" ? a : Object.keys(a)[0];
            if (!d.animations[n]) err(`${rel(f)}: el controlador usa ${n} no declarada`);
          }
      }
      continue;
    }
    const a = animations.get(full);
    if (!a) {
      err(`${rel(f)}: animación ${full} no existe`);
      continue;
    }
    // los huesos animados deben existir en la geometría de la entidad
    for (const g of geos) {
      const bones = geometries.get(g);
      if (!bones) continue;
      for (const b of bonesOfAnim(a)) if (!bones.has(b)) err(`${rel(f)}: ${full} anima el hueso "${b}" que no existe en ${g}`);
    }
    for (const pe of Object.values(a.particle_effects ?? {})) {
      const eff = pe.effect;
      if (!d.particle_effects?.[eff]) err(`${rel(f)}: ${full} usa el efecto ${eff} no declarado`);
    }
    ok();
  }
  for (const a of d.scripts?.animate ?? []) {
    const n = typeof a === "string" ? a : Object.keys(a)[0];
    if (!d.animations?.[n]) err(`${rel(f)}: animate usa ${n} no declarada`);
  }
  for (const p of Object.values(d.particle_effects ?? {})) if (!particles.has(p)) err(`${rel(f)}: partícula ${p} no existe`);
  ok();
}

// ------------------------------------------------------------- 4. Behavior Pack
const bpEntities = new Map();
for (const f of inDir(BP, "entities")) {
  const e = J(f)["minecraft:entity"];
  const id = e.description.identifier;
  bpEntities.set(id, e);
  if (!clientEntities.has(id)) err(`Entidad ${id} sin entidad de cliente en el RP`);
  const loot = e.components["minecraft:loot"]?.table;
  if (loot && !fs.existsSync(path.join(BP, loot))) err(`${id}: tabla de botín ${loot} no existe`);
  // eventos referenciados por grupos y timers
  for (const [evn, ev] of Object.entries(e.events ?? {})) {
    const steps = ev.sequence ?? [ev];
    for (const st of steps)
      for (const op of ["add", "remove"])
        for (const g of st[op]?.component_groups ?? [])
          if (!e.component_groups?.[g]) err(`${id}: evento ${evn} usa grupo inexistente ${g}`);
  }
  const timer = e.components["minecraft:timer"]?.time_down_event?.event;
  if (timer && !e.events?.[timer]) err(`${id}: timer apunta a evento inexistente ${timer}`);
  ok();
}
for (const id of clientEntities.keys()) {
  const isAttachable = J([...json.keys()].find((k) => J(k)["minecraft:attachable"]?.description.identifier === id));
  if (!bpEntities.has(id) && !isAttachable) err(`Entidad de cliente ${id} sin entidad en el BP`);
}

// propiedades usadas por el cliente deben existir en el BP y estar sincronizadas
for (const [id, d] of clientEntities) {
  const used = JSON.stringify(d).match(/query\.property\('([^']+)'\)/g) ?? [];
  const rcs = (d.render_controllers ?? []).map((r) => (typeof r === "string" ? r : Object.keys(r)[0]));
  let extra = "";
  for (const f of inDir(RP, "render_controllers")) for (const r of rcs) if (J(f).render_controllers[r]) extra += JSON.stringify(J(f).render_controllers[r]);
  for (const a of Object.values(d.animations ?? {})) if (animations.get(a)) extra += JSON.stringify(animations.get(a));
  const all = [...used, ...(extra.match(/query\.property\('([^']+)'\)/g) ?? [])];
  for (const u of all) {
    const prop = u.match(/'([^']+)'/)[1];
    const p = bpEntities.get(id)?.description.properties?.[prop];
    if (!p) err(`${id}: usa la propiedad ${prop} que el BP no define`);
    else if (!p.client_sync) err(`${id}: la propiedad ${prop} no tiene client_sync`);
    ok();
  }
}

const langRP = fs.readFileSync(path.join(RP, "texts/es_ES.lang"), "utf8");
const langKeys = new Set(langRP.split("\n").filter((l) => l.includes("=")).map((l) => l.split("=")[0].trim()));
const items = new Map();
const mainJs = fs.readFileSync(path.join(BP, "scripts/main.js"), "utf8");
const registered = new Set([...mainJs.matchAll(/registerCustomComponent\("([^"]+)"/g)].map((m) => m[1]));
for (const f of inDir(BP, "items")) {
  const it = J(f)["minecraft:item"];
  const id = it.description.identifier;
  items.set(id, it);
  const c = it.components;
  const icon = typeof c["minecraft:icon"] === "string" ? c["minecraft:icon"] : c["minecraft:icon"]?.textures?.default;
  if (!itemAtlas[icon]) err(`${id}: icono ${icon} no está en item_texture.json`);
  const dn = c["minecraft:display_name"]?.value;
  if (dn && !langKeys.has(dn)) err(`${id}: falta traducción ${dn}`);
  for (const k of Object.keys(c)) if (k.startsWith("lacobra:") && !registered.has(k)) err(`${id}: componente ${k} no registrado en main.js`);
  const pe = c["minecraft:projectile"]?.projectile_entity;
  if (pe && !bpEntities.has(pe)) err(`${id}: proyectil ${pe} no existe`);
  if (c["minecraft:wearable"] && !clientEntities.has(id)) err(`${id}: armadura sin attachable`);
  ok();
}
for (const r of registered) {
  if (![...items.values()].some((it) => it.components[r])) warnings.push(`Componente ${r} registrado pero no usado`);
}
for (const id of bpEntities.keys()) {
  if (!langKeys.has(`entity.${id}.name`)) err(`Falta nombre de entidad entity.${id}.name`);
}

// recetas
const recipeIds = new Set();
for (const f of inDir(BP, "recipes")) {
  const r = J(f)["minecraft:recipe_shaped"] ?? J(f)["minecraft:recipe_shapeless"];
  const id = r.description.identifier;
  if (recipeIds.has(id)) err(`Receta duplicada ${id}`);
  recipeIds.add(id);
  const refs = [r.result.item, ...(r.unlock ?? []).map((u) => u.item).filter(Boolean)];
  if (r.key) {
    refs.push(...Object.values(r.key).map((k) => k.item));
    const keys = new Set(r.pattern.join("").replace(/ /g, ""));
    for (const k of keys) if (!r.key[k]) err(`${id}: símbolo ${k} sin clave`);
    if (r.pattern.some((row) => row.length > 3) || r.pattern.length > 3) err(`${id}: patrón mayor de 3x3`);
  }
  if (r.ingredients) refs.push(...r.ingredients.map((i) => i.item));
  for (const ref of refs) if (ref.startsWith("lacobra:") && !items.has(ref)) err(`${id}: objeto ${ref} no existe`);
  ok();
}
for (const f of walk(path.join(BP, "loot_tables"), ".json")) {
  for (const pool of J(f).pools)
    for (const e of pool.entries) if (e.name.startsWith("lacobra:") && !items.has(e.name)) err(`${rel(f)}: ${e.name} no existe`);
}

// ------------------------------------------------------------- 5. scripts
const scriptFiles = walk(path.join(BP, "scripts"), ".js");
const allowedModules = new Set(bpm.dependencies.filter((d) => d.module_name).map((d) => d.module_name));
let scriptSrc = "";
for (const f of scriptFiles) {
  const src = fs.readFileSync(f, "utf8");
  scriptSrc += src;
  for (const m of src.matchAll(/^\s*import[\s\S]*?from\s+"([^"]+)"/gm)) {
    const spec = m[1];
    if (spec.startsWith(".")) {
      if (!fs.existsSync(path.resolve(path.dirname(f), spec))) err(`${rel(f)}: import inexistente ${spec}`);
    } else if (!allowedModules.has(spec)) err(`${rel(f)}: módulo ${spec} no declarado en el manifest`);
    ok();
  }
}
for (const m of scriptSrc.matchAll(/(?:particle|ringOf)\(\s*[\w.]+,\s*"([\w]+)"/g)) {
  if (!particles.has("lacobra:" + m[1])) err(`Script usa partícula inexistente lacobra:${m[1]}`);
  ok();
}
for (const m of scriptSrc.matchAll(/(?:sound|playerSound)\(\s*[\w.]+,\s*"([\w]+)"/g)) {
  if (!soundDefs["lacobra." + m[1]]) err(`Script usa sonido inexistente lacobra.${m[1]}`);
  ok();
}
for (const m of scriptSrc.matchAll(/"(animation\.lacobra\.[\w.]+)"/g)) {
  if (!animations.has(m[1])) err(`Script usa animación inexistente ${m[1]}`);
  ok();
}
for (const m of scriptSrc.matchAll(/"(lacobra:[a-z_]*[a-z])"/g)) {
  const id = m[1];
  const known =
    bpEntities.has(id) || items.has(id) || registered.has(id) || particles.has(id) ||
    [...bpEntities.values()].some((e) => e.events?.[id] || e.description.properties?.[id]) ||
    /^lacobra:(energia|seleccion|bienvenida|habilidad|kit|reset|jefe|estado)$/.test(id);
  if (!known) err(`Script referencia identificador desconocido ${id}`);
  ok();
}
// el jugador anima huesos estándar
const PLAYER_BONES = new Set(["rightArm", "leftArm", "body", "head", "rightLeg", "leftLeg"]);
for (const [k, a] of animations) {
  if (!k.startsWith("animation.lacobra.player.")) continue;
  for (const b of bonesOfAnim(a)) if (!PLAYER_BONES.has(b)) err(`${k}: hueso de jugador desconocido ${b}`);
}

// ------------------------------------------------------------- informe
for (const w of warnings) console.log("AVISO:", w);
if (errors.length) {
  for (const e of errors) console.log("ERROR:", e);
  console.log(`\n${errors.length} errores, ${checks} comprobaciones`);
  process.exit(1);
}
console.log(`Validación OK: ${checks} comprobaciones, ${json.size} JSON, ${scriptFiles.length} scripts, ` +
  `${items.size} objetos, ${bpEntities.size} entidades, ${particles.size} partículas, ${Object.keys(soundDefs).length} sonidos, ` +
  `${animations.size} animaciones, ${recipeIds.size} recetas.`);
