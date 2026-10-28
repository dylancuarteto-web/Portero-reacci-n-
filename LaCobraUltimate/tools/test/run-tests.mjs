// Pruebas automáticas de La Cobra Ultimate sobre el simulador del Script API.
// Ejecuta: npm test   (escribe el resultado en docs/REGISTRO_PRUEBAS_AUTOMATICAS.txt)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  system, world, advance, log, Player, Entity, ItemStack, GameMode, Difficulty,
} from "./mock-server.mjs";
import { formAnswers, shownForms } from "./mock-server-ui.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = [];
let pass = 0;
let fail = 0;
let current = "";
function section(name) {
  current = name;
  out.push(`\n## ${name}`);
}
function check(cond, desc) {
  if (cond) {
    pass++;
    out.push(`  [OK]    ${desc}`);
  } else {
    fail++;
    out.push(`  [FALLO] ${desc}`);
  }
}

// ------------------------------------------------------------- arranque del addon
const components = {};
const commands = {};
const enums = {};
await import("../../packs/LaCobra_BP/scripts/main.js");
const sched = await import("../../packs/LaCobra_BP/scripts/core/scheduler.js");
const stateMod = await import("../../packs/LaCobra_BP/scripts/core/state.js");
const { CONFIG } = await import("../../packs/LaCobra_BP/scripts/config.js");

system.beforeEvents.startup.fire({
  itemComponentRegistry: { registerCustomComponent: (n, c) => (components[n] = c) },
  customCommandRegistry: {
    registerCommand: (def, cb) => (commands[def.name] = { def, cb }),
    registerEnum: (n, v) => (enums[n] = v),
  },
});
world.afterEvents.worldLoad.fire({});

const ow = world.getDimension("overworld");
const S = (p) => stateMod.getState(p);
const fxAlive = () => ow.getEntities({ families: ["lacobra_fx"] }).length;
const mob = (type, x, z, y = 0) => ow.add(new Entity(type, ow, { x, y, z }));
function newPlayer(name, x = 0, z = 0) {
  const p = ow.add(new Player(ow, { x, y: 0, z }, name));
  p.view = { x: 0, y: 0, z: 1 };
  world.afterEvents.playerSpawn.fire({ player: p, initialSpawn: true });
  return p;
}
const useRune = (p, sk) => components["lacobra:runa"].onUse({ source: p }, { params: { habilidad: sk } });
const clearMobs = () => {
  for (const e of [...ow.entities.values()]) if (e.typeId !== "minecraft:player") e.remove();
};
const ticks = (n) => advance(n);

// =============================================================== pruebas
section("Registro de componentes y comandos");
for (const c of ["lacobra:espada", "lacobra:balon", "lacobra:guantes", "lacobra:totem", "lacobra:idolo", "lacobra:libro", "lacobra:runa"]) {
  check(!!components[c], `componente ${c} registrado`);
}
check(Object.keys(commands).length === 6, "6 comandos personalizados registrados");
check(Array.isArray(enums["lacobra:habilidad"]) && enums["lacobra:habilidad"].length === 5, "enum de habilidades registrado");

section("Energía inicial, HUD y bienvenida");
const p1 = newPlayer("Cobra");
check(S(p1).energy === 100, "energía inicial 100");
check(p1.messages.length === 1, "mensaje de bienvenida la primera vez");
p1.inv[0] = new ItemStack("lacobra:espada_cobra");
ticks(10);
check(p1.actionbar.includes("Energía"), "la barra de energía aparece al empuñar un objeto de La Cobra");

section("Habilidad A: Instinto de la Cobra");
const z1 = mob("minecraft:zombie", 0, 2);
useRune(p1, "instinto");
check(S(p1).energy === 85, "consume 15 de energía");
check(p1.effects.speed?.amp === 1, "aplica velocidad II");
check(log.sounds.includes("lacobra.instinto_on"), "sonido de activación");
useRune(p1, "instinto");
check(S(p1).energy === 85, "una segunda activación inmediata se rechaza sin gastar energía");
check(p1.actionbar.length > 0 && S(p1).msg.includes("ya está activo") || S(p1).msg.includes("enfriamiento"), "mensaje claro al rechazar");
ticks(20);
const pBefore = log.particles.length;
ticks(20);
check(log.particles.length > pBefore, "genera partículas de aura mientras está activo");
world.afterEvents.entityHitEntity.fire({ damagingEntity: p1, hitEntity: z1 });
check(z1.damageLog.length === 1 && z1.damageLog[0].amount === 3, "golpe con Instinto: +3 de daño validado en servidor");
world.afterEvents.entityHitEntity.fire({ damagingEntity: p1, hitEntity: z1 });
check(z1.damageLog.length === 1, "no aplica el bono dos veces en el mismo golpe");
ticks(8 * 20);
check(S(p1).instintoUntil === 0, "el Instinto termina tras 8 s");
check(log.sounds.includes("lacobra.instinto_off"), "sonido de finalización");
check(sched.taskCount("instinto") === 0, "no quedan tareas del Instinto");
clearMobs();

section("Habilidad B: Remate Legendario");
stateMod.getState(p1).energy = 100;
const z2 = mob("minecraft:zombie", 0, 10);
const vil = mob("minecraft:villager", 1, 10);
const p2 = newPlayer("Rival", -1, 10);
useRune(p1, "remate");
check(S(p1).busy === "remate", "entra en estado de carga");
useRune(p1, "veneno");
check(S(p1).energy === 75, "no se puede lanzar otra habilidad durante la carga");
ticks(26);
const orb = ow.getEntities({ type: "lacobra:esfera_remate" })[0];
check(!!orb && !!orb.projectile.shot, "lanza un proyectil real con velocidad tras 1.2 s de carga");
check(orb && orb.projectile.owner === p1, "el proyectil tiene propietario (validación de daño)");
check(S(p1).busy === null, "sale del estado de carga");
world.afterEvents.projectileHitEntity.fire({
  projectile: orb, location: { x: 0, y: 1, z: 10 }, dimension: ow, source: p1,
  getEntityHit: () => ({ entity: z2 }),
});
check(z2.damageLog.length === 1 && z2.damageLog[0].amount >= 8, "daño de área al zombi");
check(vil.damageLog.length === 0, "no daña aldeanos");
check(p2.damageLog.length === 0, "no daña jugadores con PvP desactivado");
check(z2.knock.length === 1, "empuje de la onda expansiva");
check(log.particles.some((x) => x.id === "lacobra:shockwave" && x.vars?.["variable.radius"] > 0), "onda expansiva con radio");
check(log.sounds.includes("lacobra.impacto"), "sonido de impacto");
world.gameRules.pvp = true;
S(p1).cooldowns = {};
S(p1).energy = 100;
useRune(p1, "remate");
ticks(26);
const orb2 = ow.getEntities({ type: "lacobra:esfera_remate" }).find((e) => e !== orb);
world.afterEvents.projectileHitBlock.fire({ projectile: orb2, location: { x: -1, y: 0, z: 10 }, dimension: ow, source: p1 });
check(p2.damageLog.length === 1, "con PvP activado sí daña a otros jugadores");
world.gameRules.pvp = false;
clearMobs();

section("Remate interrumpido: devolución de energía");
S(p1).cooldowns = {};
S(p1).energy = 60;
useRune(p1, "remate");
ticks(5);
world.afterEvents.entityDie.fire({ deadEntity: p1 });
check(S(p1).energy === 60, "la energía se devuelve si la carga se interrumpe");
check(S(p1).busy === null, "estado de carga limpiado");
ticks(30);
check(ow.getEntities({ type: "lacobra:esfera_remate" }).length === 0, "no se lanza ninguna esfera tras morir");

section("Habilidad C: Veneno Serpentino");
S(p1).cooldowns = {};
S(p1).energy = 100;
useRune(p1, "veneno");
check(S(p1).energy === 100 && !S(p1).cooldowns.veneno, "sin objetivo: se rechaza sin gastar energía ni enfriamiento");
check(S(p1).msg.includes("objetivo"), "mensaje: no hay objetivo");
const z3 = mob("minecraft:zombie", 0, 9);
useRune(p1, "veneno");
check(S(p1).energy === 80, "con objetivo consume 20");
check(ow.getEntities({ type: "lacobra:serpiente_energia" }).length === 1, "aparece la serpiente de energía");
let hitAt = -1;
for (let i = 0; i < 80 && hitAt < 0; i++) {
  ticks(1);
  if (z3.damageLog.length) hitAt = i;
}
check(hitAt > 0 && hitAt < 40, `la serpiente persigue y alcanza al objetivo (${hitAt} ticks)`);
check(z3.damageLog[0]?.amount === 6 && z3.effects.slowness && z3.effects.poison, "daño moderado + lentitud + veneno");
ticks(15);
check(ow.getEntities({ type: "lacobra:serpiente_energia" }).length === 0, "la serpiente desaparece al terminar");
S(p1).cooldowns = {};
const z4 = mob("minecraft:zombie", 0, 15);
useRune(p1, "veneno");
ticks(3);
z4.remove();
ticks(20);
check(ow.getEntities({ type: "lacobra:serpiente_energia" }).length === 0, "si el objetivo desaparece la serpiente se desvanece");
check(sched.taskCount("veneno") === 0, "no quedan tareas de Veneno");
clearMobs();

section("Habilidad D: Dominio Absoluto");
S(p1).cooldowns = {};
S(p1).energy = 100;
const z5 = mob("minecraft:zombie", 3, 3);
z5.hp = z5.maxHp = 200; // aguanta los rayos para medir la onda final
const cow = mob("minecraft:cow", -3, 2);
useRune(p1, "dominio");
check(S(p1).energy === 60, "consume 40");
check(ow.getEntities({ type: "lacobra:circulo_magico" }).length === 1, "crea el círculo mágico");
check(p1.effects.strength && p1.effects.resistance, "mejoras temporales al jugador");
useRune(p1, "dominio");
check(S(p1).energy === 60, "no se acumula: segunda activación rechazada");
p1.location = { x: 2, y: 0, z: 0 };
ticks(25);
const circ = ow.getEntities({ type: "lacobra:circulo_magico" })[0];
check(circ && circ.location.x === 2, "el círculo sigue al jugador");
check(z5.effects.weakness && z5.effects.slowness, "debilita enemigos cercanos");
check(!cow.effects.weakness, "no afecta a animales pacíficos");
ticks(10 * 20);
check(z5.damageLog.some((d) => d.amount === 6), "onda expansiva final");
ticks(15);
check(ow.getEntities({ type: "lacobra:circulo_magico" }).length === 0, "el círculo se elimina al terminar");
check(S(p1).dominioUntil === 0, "estado del Dominio limpiado");
p1.location = { x: 0, y: 0, z: 0 };
clearMobs();

section("Habilidad definitiva: La Cobra Suprema");
S(p1).cooldowns = {};
S(p1).energy = 99;
useRune(p1, "suprema");
check(!S(p1).busy && S(p1).msg.includes("insuficiente"), "requiere 100 de energía");
S(p1).energy = 100;
const z6 = mob("minecraft:zombie", 5, 5);
const z7 = mob("minecraft:zombie", 20, 0);
useRune(p1, "suprema");
check(S(p1).energy === 0 && S(p1).busy === "suprema", "consume 100 y comienza la secuencia");
ticks(12);
check(ow.getEntities({ type: "lacobra:cobra_suprema" }).length === 1, "aparece la serpiente gigante");
ticks(30);
check(ow.getEntities({ type: "lacobra:avatar_cobra" }).length === 1, "transformación: aparece el espíritu de La Cobra");
check(log.anims.some((a) => a.name === "animation.lacobra.player.transform"), "animación de transformación del jugador");
ticks(70);
check(z6.damageLog.length === 1 && z6.damageLog[0].amount >= 14, "gran onda: daño real dentro del radio");
check(z7.damageLog.length === 0, "fuera del radio no recibe daño");
check(log.commands.some((c) => c.startsWith("camerashake")), "vibración de cámara moderada");
ticks(50);
check(S(p1).busy === null, "secuencia terminada");
check(p1.titles.some((t) => t.t.includes("SUPREMA")), "mensaje especial de finalización");
check(fxAlive() === 0, "todas las entidades de efecto eliminadas");
clearMobs();

section("Cobra Suprema interrumpida al salir del mundo");
S(p1).cooldowns = {};
S(p1).energy = 100;
useRune(p1, "suprema");
ticks(50);
check(fxAlive() >= 2, "efectos activos durante la secuencia");
world.beforeEvents.playerLeave.fire({ player: p1 });
world.afterEvents.playerLeave.fire({ playerId: p1.id, playerName: p1.name });
p1.remove();
ticks(5);
check(fxAlive() === 0, "limpieza total al salir el jugador");
check(sched.taskCount("suprema") === 0, "tareas canceladas");
check(typeof p1.dyn["lacobra:energia"] === "number", "la energía se guarda al salir");

section("Regeneración de energía");
const p3 = newPlayer("Regen", 50, 50);
S(p3).energy = 0;
ticks(100);
check(S(p3).energy >= 9 && S(p3).energy <= 11, `regenera ~2/s (${S(p3).energy} en 5 s)`);

section("Progresión: runas necesarias para el menú y la espada");
S(p3).energy = 100;
p3.inv[0] = new ItemStack("lacobra:libro_tactico");
formAnswers.push(0);
components["lacobra:libro"].onUse({ source: p3 });
ticks(2);
await new Promise((r) => setTimeout(r, 5));
check(shownForms.length === 1 && shownForms[0].buttons.length === 6, "el Libro Táctico abre un menú con 6 botones táctiles");
check(S(p3).energy === 100 && S(p3).msg.includes("Runa"), "sin la runa la habilidad está bloqueada");
p3.inv[5] = new ItemStack("lacobra:runa_instinto");
formAnswers.push(0);
components["lacobra:libro"].onUse({ source: p3 });
ticks(2);
await new Promise((r) => setTimeout(r, 5));
check(S(p3).energy === 85, "con la runa en el inventario el menú lanza la habilidad");
p3.gameMode = GameMode.Creative;
S(p3).selected = "dominio";
components["lacobra:espada"].onUse({ source: p3 });
check(S(p3).dominioUntil > 0, "en creativo la espada lanza la habilidad seleccionada");
p3.gameMode = GameMode.Survival;
ticks(260);

section("Tótem de La Cobra");
const p4 = newPlayer("Totem", -50, -50);
p4.inv[0] = new ItemStack("lacobra:totem_cobra", 2);
components["lacobra:totem"].onUse({ source: p4 });
check(p4.inv[0].amount === 1, "consume un tótem");
check(p4.effects.resistance && p4.effects.absorption, "efectos defensivos temporales");
check(ow.getEntities({ type: "lacobra:serpiente_energia" }).some((e) => e.props["lacobra:variante"] === 1), "aparece la serpiente guardiana");
components["lacobra:totem"].onUse({ source: p4 });
check(p4.inv[0].amount === 1, "no se puede reactivar mientras está activo");
const zt = mob("minecraft:zombie", -50, -47);
ticks(40);
check(zt.damageLog.length >= 1, "la guardiana ataca a enemigos cercanos");
ticks(15 * 20);
check(ow.getEntities({ type: "lacobra:serpiente_energia" }).length === 0, "la guardiana desaparece al terminar");
components["lacobra:totem"].onUse({ source: p4 });
check(p4.inv[0].amount === 1, "enfriamiento de 60 s respetado");
const p5 = newPlayer("Salvado", -60, -60);
p5.equip.Offhand = new ItemStack("lacobra:totem_cobra", 1);
p5.hp = 4;
const hurtEv = { hurtEntity: p5, damage: 30, cancel: false, damageSource: {} };
world.beforeEvents.entityHurt.fire(hurtEv, p5);
check(hurtEv.cancel === true, "un golpe letal se cancela si llevas el Tótem en la mano");
ticks(2);
check(p5.equip.Offhand === undefined && p5.hp >= 8, "el Tótem se consume y te salva");
clearMobs();
ticks(15 * 20 + 20);

section("Guantes del GOAT");
const p6 = newPlayer("Portero", 80, 0);
S(p6).energy = 100;
p6.equip.Offhand = new ItemStack("lacobra:guantes_goat");
ticks(20);
const ev2 = { hurtEntity: p6, damage: 10, cancel: false, damageSource: { damagingProjectile: {} } };
world.beforeEvents.entityHurt.fire(ev2, p6);
check(Math.abs(ev2.damage - 6) < 0.01, "pasiva: -40% de daño de proyectiles con los guantes en la mano secundaria");
const arrow = ow.add(new Entity("minecraft:arrow", ow, { x: 82, y: 1, z: 0 }));
components["lacobra:guantes"].onUse({ source: p6 });
check(!arrow.isValid, "Atajada del GOAT: detiene proyectiles cercanos");
const ev3 = { hurtEntity: p6, damage: 10, cancel: false, damageSource: { damagingProjectile: {} } };
world.beforeEvents.entityHurt.fire(ev3, p6);
check(ev3.cancel, "durante la Atajada los proyectiles no hacen daño");
const e0 = S(p6).energy;
components["lacobra:guantes"].onUse({ source: p6 });
check(S(p6).energy === e0, "enfriamiento de la Atajada respetado");

section("Balón Dorado");
const z8 = mob("minecraft:zombie", 80, 5);
const ball = ow.spawnEntity("lacobra:balon_proyectil", { x: 80, y: 1, z: 4 });
const eb = S(p6).energy;
world.afterEvents.projectileHitEntity.fire({
  projectile: ball, location: { x: 80, y: 1, z: 5 }, dimension: ow, source: p6, getEntityHit: () => ({ entity: z8 }),
});
check(S(p6).energy === Math.min(100, eb + 3), "¡GOLAZO! energía extra al acertar");
check(z8.damageLog[0]?.amount === 5, "el balón hace 5 de daño (calculado por el servidor)");
check(ow.items.some((i) => i.it.typeId === "lacobra:balon_dorado"), "el balón se puede recuperar en supervivencia");
p6.gameMode = GameMode.Creative;
const nItems = ow.items.length;
world.afterEvents.projectileHitBlock.fire({ projectile: ball, location: { x: 80, y: 0, z: 6 }, dimension: ow, source: p6 });
check(ow.items.length === nItems, "en creativo no se duplica el balón");
clearMobs();

section("Jefe: La Serpiente Legendaria");
const p7 = newPlayer("Heroe", 200, 0);
world.difficulty = Difficulty.Peaceful;
p7.inv[0] = new ItemStack("lacobra:idolo_serpiente");
components["lacobra:idolo"].onUse({ source: p7 });
check(p7.inv[0]?.amount === 1, "en Pacífico no se invoca ni se consume el ídolo");
world.difficulty = Difficulty.Normal;
components["lacobra:idolo"].onUse({ source: p7 });
check(p7.inv[0] === undefined, "el Ídolo se consume");
ticks(70);
const boss = ow.getEntities({ type: "lacobra:serpiente_legendaria" })[0];
check(!!boss, "el ritual invoca al jefe");
check(fxAlive() === 0, "el círculo del ritual se elimina");
p7.inv[0] = new ItemStack("lacobra:idolo_serpiente");
components["lacobra:idolo"].onUse({ source: p7 });
check(p7.inv[0]?.amount === 1, "no se puede invocar un segundo jefe cerca");
boss.location = { x: 200, y: 0, z: 6 };
boss.applyDamage(180);
world.afterEvents.entityHurt.fire({ hurtEntity: boss, damage: 180, damageSource: {} }, boss);
check(boss.props["lacobra:fase"] === 2, "fase 2 al 66% de vida");
check(log.anims.some((a) => a.name === "animation.lacobra.boss.roar"), "rugido al cambiar de fase");
ticks(40 * 20);
const minions = ow.getEntities({ type: "lacobra:serpiente_esbirro" }).length;
check(minions > 0 && minions <= CONFIG.jefe.maxEsbirros, `fase 2 invoca esbirros con límite (${minions})`);
check(ow.getEntities({ type: "lacobra:escupitajo" }).length > 0 || log.sounds.includes("lacobra.jefe_siseo"), "ataques de veneno");
boss.applyDamage(170);
world.afterEvents.entityHurt.fire({ hurtEntity: boss, damage: 170, damageSource: {} }, boss);
check(boss.props["lacobra:fase"] === 3, "fase 3 al 33% de vida");
p7.hp = 1000; // el simulador no hace reaparecer al jugador
const hpBefore = p7.hp;
ticks(30 * 20);
check(p7.hp < hpBefore, "los ataques especiales de fase 3 dañan al jugador");
world.afterEvents.entityHitEntity.fire({ damagingEntity: boss, hitEntity: p7 });
check(log.anims.some((a) => a.name === "animation.lacobra.boss.bite"), "animación de mordida al atacar");
boss.applyDamage(1000);
check(ow.getEntities({ type: "lacobra:serpiente_esbirro" }).length === 0, "al morir el jefe desaparecen sus esbirros");
check(p7.titles.some((t) => t.t.includes("VICTORIA")), "mensaje de victoria");

section("Escupitajo del jefe");
const p9 = newPlayer("Victima", 400, 0);
const spitE = ow.spawnEntity("lacobra:escupitajo", { x: 400, y: 1, z: 1 });
world.afterEvents.projectileHitEntity.fire({
  projectile: spitE, location: p9.location, dimension: ow, source: undefined, getEntityHit: () => ({ entity: p9 }),
});
check(p9.damageLog[0]?.amount === 6 && p9.effects.slowness, "escupitajo: 6 de daño + lentitud");
p9.equip.Offhand = new ItemStack("lacobra:guantes_goat");
ticks(20);
world.afterEvents.projectileHitEntity.fire({
  projectile: spitE, location: p9.location, dimension: ow, source: undefined, getEntityHit: () => ({ entity: p9 }),
});
check(Math.abs(p9.damageLog[1]?.amount - 3.6) < 0.01, "los guantes reducen el daño del escupitajo");

section("Comandos de prueba");
const p8 = newPlayer("Admin", 300, 0);
const r1 = commands["lacobra:energia"].cb({ sourceEntity: p8 }, 42);
ticks(1);
check(r1.status === 0 && S(p8).energy === 42, "/lacobra:energia");
commands["lacobra:kit"].cb({ sourceEntity: p8 });
ticks(1);
check(p8.inv.filter(Boolean).length >= 19, "/lacobra:kit entrega todos los objetos");
const r2 = commands["lacobra:estado"].cb({ sourceEntity: p8 });
check(r2.message.includes("Energía"), "/lacobra:estado");

section("Robustez del planificador");
const bad = sched.addTask({ name: "falla", tick() { throw new Error("boom"); } });
ticks(3);
check(bad.done, "una tarea que lanza un error se cierra (no se repite cada tick)");

section("Integridad: recursos usados por los scripts");
check(log.errors.length === 0, "todas las partículas, sonidos, animaciones, entidades y eventos usados existen" +
  (log.errors.length ? ": " + [...new Set(log.errors)].join("; ") : ""));
for (const e of [...ow.entities.values()]) if (e.typeId !== "minecraft:player") e.remove();
ticks(400);
check(sched.activeTasks() === 0, "no quedan tareas activas al final");
check(fxAlive() === 0, "no quedan entidades de efecto");

const summary = `\nResultado: ${pass} correctas, ${fail} fallidas`;
out.push(summary);
const header = `# Registro de pruebas automáticas — La Cobra Ultimate\n# Simulador del Script API (tools/test). Fecha: ${new Date().toISOString()}\n`;
fs.writeFileSync(path.join(ROOT, "docs/REGISTRO_PRUEBAS_AUTOMATICAS.txt"), header + out.join("\n") + "\n");
console.log(out.join("\n"));
process.exit(fail ? 1 : 0);
