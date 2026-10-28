// Empaqueta los packs en dist/LaCobraUltimate.mcaddon (y un .mcpack por pack).
// Ejecuta antes el validador; si hay errores no genera nada.
// Uso: node tools/build.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const PACKS = ["LaCobra_BP", "LaCobra_RP"];

execFileSync(process.execPath, [path.join(ROOT, "tools/validate.mjs")], { stdio: "inherit" });

function walk(dir) {
  const out = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Escritor ZIP mínimo (deflate) compatible con el importador de Minecraft. */
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (10 << 5) | 28;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = comp.length < data.length;
    const body = useDeflate ? comp : data;
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // nombres UTF-8
    local.writeUInt16LE(useDeflate ? 8 : 0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(useDeflate ? 8 : 0, 10);
    cen.writeUInt16LE(dosTime, 12);
    cen.writeUInt16LE(dosDate, 14);
    cen.writeUInt32LE(crc >>> 0, 16);
    cen.writeUInt32LE(body.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += 30 + nameBuf.length + body.length;
  }
  const cenSize = central.reduce((a, b) => a + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cenSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

function packEntries(pack, prefix) {
  const dir = path.join(ROOT, "packs", pack);
  return walk(dir).map((f) => ({
    name: prefix + path.relative(dir, f).split(path.sep).join("/"),
    data: fs.readFileSync(f),
  }));
}

fs.mkdirSync(DIST, { recursive: true });
const all = [];
for (const p of PACKS) {
  const entries = packEntries(p, "");
  fs.writeFileSync(path.join(DIST, `${p}.mcpack`), zip(entries));
  all.push(...packEntries(p, p + "/"));
}
const out = path.join(DIST, "LaCobraUltimate.mcaddon");
fs.writeFileSync(out, zip(all));
const kb = (fs.statSync(out).size / 1024).toFixed(1);
console.log(`Generado ${path.relative(ROOT, out)} (${kb} KB, ${all.length} archivos)`);
