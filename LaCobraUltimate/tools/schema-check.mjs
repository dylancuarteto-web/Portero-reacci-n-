// Valida los JSON de los packs contra los esquemas de Bedrock de Blockception
// (los mismos que usa la extensión "Blockception Minecraft Bedrock Development" de VS Code).
// Descarga los esquemas a build/schemas la primera vez (requiere acceso a GitHub).
// Uso: node tools/schema-check.mjs
import Ajv from "ajv";
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SC = path.join(ROOT_DIR, "build/schemas"), ROOT = path.join(ROOT_DIR, "packs");
const BASE = "https://raw.githubusercontent.com/Blockception/Minecraft-bedrock-json-schemas/main/";
const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false, unicodeRegExp: false });
const map = [
 ["LaCobra_BP/items", "behavior/items/items.json"],
 ["LaCobra_BP/entities", "behavior/entities/entities.json"],
 ["LaCobra_BP/recipes", "behavior/recipes/recipes.json"],
 ["LaCobra_BP/loot_tables/entities", "behavior/loot_tables/loot_tables.json"],
 ["LaCobra_RP/entity", "resource/entity/entity.json"],
 ["LaCobra_RP/attachables", "resource/attachables/attachables.json"],
 ["LaCobra_RP/particles", "resource/particles/particles.json"],
 ["LaCobra_RP/animations", "resource/animations/actor_animation.json"],
 ["LaCobra_RP/animation_controllers", "resource/animation_controllers/animation_controller.json"],
 ["LaCobra_RP/render_controllers", "resource/render_controllers/render_controllers.json"],
 ["LaCobra_RP/models/entity", "resource/models/entity/model_entity.json"],
 ["LaCobra_RP/sounds/sound_definitions.json", "resource/sounds/sound_definitions.json"],
 ["LaCobra_RP/sounds.json", "resource/sounds.json"],
 ["LaCobra_BP/manifest.json", "general/manifest.json"],
 ["LaCobra_RP/manifest.json", "general/manifest.json"],
 ["LaCobra_RP/textures/item_texture.json", "resource/textures/item_texture.json"],
];
let bad = 0, n = 0;
for (const [, s] of map) {
  const dest = path.join(SC, s);
  if (fs.existsSync(dest)) continue;
  const res = await fetch(BASE + s);
  if (!res.ok) throw new Error("No se pudo descargar " + s + ": " + res.status);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, await res.text());
}
for (const [p, s] of map) {
  const schema = JSON.parse(fs.readFileSync(path.join(SC, s)));
  delete schema.$id;
  const v = ajv.compile(schema);
  const full = path.join(ROOT, p);
  const files = fs.statSync(full).isDirectory() ? fs.readdirSync(full).map(f => path.join(full, f)) : [full];
  for (const f of files) {
    n++;
    if (!v(JSON.parse(fs.readFileSync(f)))) {
      bad++;
      const errs = v.errors.filter(e => !["if","anyOf","oneOf"].includes(e.keyword)).slice(0, 6);
      console.log("✗", path.relative(ROOT, f)); for (const e of errs) console.log("   ", e.instancePath, e.message, JSON.stringify(e.params));
    }
  }
}
console.log(`Esquemas: ${n} archivos validados, ${bad} con errores`);
process.exit(bad ? 1 : 0);
