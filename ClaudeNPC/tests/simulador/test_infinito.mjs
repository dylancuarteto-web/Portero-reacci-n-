// Pruebas de Claude Exponencial Infinito (v10) en el simulador con física. No es el juego:
// el simulador imita la Script API 2.4.0 (física simple, proyectiles, explosiones y los sensores
// de daño leídos del BP) para probar la lógica. Se corre con tests/simulador/correr.sh.
import {
  Entity, InputPermissionCategory, ItemStack, Player, W, emitir, entidades, errores, escribir, handlers, leer, log, medida, overworld as dim, system, tick, world,
} from "@minecraft/server";
import "./scripts/main.js";
import { NPC } from "./scripts/config.js";
import { estados } from "./scripts/estado.js";
import { INFINITO, INFINITO_CFG, GANANCIA } from "./scripts/infinito/config.js";
import { DESDE, FASES, faseDe, puede, umbral, maxDeterminacion } from "./scripts/infinito/fases.js";
import { ganar, ponerFase, ponerDeterminacion } from "./scripts/infinito/determinacion.js";
import { infinitos, guardar, nuevoEstado, cargar } from "./scripts/infinito/registro.js";
import { COMBOS, iniciarCombo, registrarCombo, ACCIONES } from "./scripts/infinito/combos.js";
import { combinacionRepetida, golpeDelRival, predecir, rival, anotar } from "./scripts/infinito/memoria.js";
import { rasgos } from "./scripts/infinito/adaptacion.js";
import { bloquesPuestos, cuantosTemporales, errores as erroresInf } from "./scripts/infinito/rendimiento.js";
import { cambiarEstado } from "./scripts/infinito/cerebro.js";
import { danoMaza } from "./scripts/infinito/golpe.js";

const correr = (n, cada) => { for (let t = 0; t < n; t++) { tick(); cada?.(t); } };
const fallas = [];
const ok = [];
const esperar = (c, m) => { if (!c) fallas.push(m); else ok.push(m); };
const dist = (a, b) => Math.hypot(a.location.x - b.location.x, a.location.z - b.location.z);
const limpiarMundo = () => { for (const e of entidades) if (e.typeId !== "minecraft:player") e.isValid = false; };
const jugadorEn = (x, z, o = {}) => { const p = new Player(dim, { x, y: 65, z }); Object.assign(p, o); p.vida = o.vida ?? 20; p.vidaMax = 20; return p; };
const sacar = (p) => { p.isValid = false; };
function nuevo(x, z, fase = 1) {
  const e = dim.spawnEntity(INFINITO, { x, y: 65, z });
  tick();
  const s = infinitos.get(e.id);
  if (fase > 1) {
    ponerFase(e, s, fase);
    correr(26); // la presentación de la fase (intocable 24 ticks)
  }
  return { e, s };
}

// ---------------------------------------------------------------------------------------
// 1) Aparece y se registra (fase 1: espada de madera, sin escudo ni armadura).
{
  const { e, s } = nuevo(0.5, 0.5);
  esperar(!!s, "se registra al aparecer");
  esperar(s.fase === 1 && e.mano === "minecraft:wooden_sword", "fase 1 con espada de madera");
  esperar(!s.escudo && e.equipo["slot.armor.chest"] === "minecraft:air", "fase 1 sin escudo ni armadura");
  esperar(e.nameTag === "§c§lDETERMINACIÓN §r§e0", "encima solo se ve la determinación");
  console.log("APARECE", { fase: s.fase, mano: e.mano, nombre: e.nameTag.split("\n") });
  e.isValid = false;
  correr(101);
}

// 2) Técnicas por fase (se acumulan) y aspecto.
{
  const s = { fase: 1 };
  const nunca = [];
  for (let n = 1; n <= 20; n++) {
    s.fase = n;
    if (n < 3 && puede(s, "arco")) nunca.push(`arco en ${n}`);
    if (n < 11 && puede(s, "aguaClutch")) nunca.push(`cubetas en ${n}`);
    if (n < 14 && puede(s, "maza")) nunca.push(`maza en ${n}`);
    if (n < 13 && puede(s, "tnt")) nunca.push(`tnt en ${n}`);
    if (n < 7 && puede(s, "wtap")) nunca.push(`wtap en ${n}`);
    if (n >= 11 && !puede(s, "aguaClutch")) nunca.push(`sin cubetas en ${n}`);
  }
  esperar(!nunca.length, `técnicas por fase: ${nunca.join(", ") || "ok"}`);
  esperar(FASES.length === 20 && FASES[19].nombre === "INFINITE DETERMINATION" && FASES[6].nombre === "ESPECIALISTA EN ESPADAS", "20 fases con sus nombres");
  const { e, s: si } = nuevo(0.5, 0.5);
  const aspecto = [];
  for (const n of [5, 6, 11, 16, 20]) {
    ponerFase(e, si, n);
    aspecto.push({ n, variante: e.variant, aura: e.markVariant, vidaMax: e.vidaMax, mano: e.mano, pecho: e.equipo["slot.armor.chest"], escudo: e.equipo["slot.weapon.offhand"] });
  }
  console.log("ASPECTO", aspecto);
  esperar(aspecto[0].variante === 0 && aspecto[1].variante === 1 && aspecto[2].variante === 2 && aspecto[3].variante === 3 && aspecto[4].variante === 4, "aspecto cambia en 6, 11, 16 y 20");
  esperar(aspecto[4].aura === 1 && aspecto[3].aura === 0, "aura solo en la fase 20");
  esperar(aspecto[4].mano === "minecraft:netherite_sword" && aspecto[4].pecho === "minecraft:netherite_chestplate", "fase 20 en netherita");
  esperar(aspecto[1].escudo === "minecraft:shield", "escudo en la otra mano");
  e.isValid = false;
  correr(101);
}

// 3) Determinación exponencial con tope; evolución con presentación.
{
  const tabla = [2, 5, 10, 15, 20].map((n) => [n, Math.round(umbral(n))]);
  console.log("UMBRALES", tabla, "máximo", Math.round(maxDeterminacion()));
  esperar(umbral(3) - umbral(2) < umbral(20) - umbral(19), "los umbrales crecen de forma exponencial");
  esperar(faseDe(maxDeterminacion() * 10) === 20, "nunca pasa de la fase 20");
  const p = jugadorEn(4.5, 0.5);
  p.modo = "Creative";
  const { e, s } = nuevo(0.5, 0.5);
  const titulos0 = log.titulos.length;
  for (let k = 0; k < 6; k++) ganar(e, s, "golpe");
  correr(2);
  console.log("EVOLUCION", { det: s.determinacion, fase: s.fase, titulos: log.titulos.slice(titulos0).map((t) => `${t.txt} / ${t.sub}`) });
  esperar(s.fase >= 2, "con 6 golpes sube a la fase 2");
  esperar(log.titulos.slice(titulos0).some((t) => t.txt.includes("FASE 2") && t.sub.includes("APRENDIZ")), "título de la fase al evolucionar");
  esperar(log.anims.some((a) => a.a.includes("infinito.evolucion")), "animación de evolución");
  // Tope por combate.
  s.combate = { ganado: 0 };
  for (let k = 0; k < 2000; k++) ganar(e, s, "victoria");
  esperar(s.combate.ganado <= INFINITO_CFG.maxPorCombate + 1e-6, "tope de determinación por combate");
  s.combate = undefined;
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 4) NOOB contra un jugador: se acerca directo, golpea lento y a veces falla; no esquiva.
{
  const p = jugadorEn(6.5, 0.5);
  const { e, s } = nuevo(0.5, 0.5);
  const modos = new Set();
  let maxDefensa = 0;
  correr(400, () => { modos.add(s.mov?.modo); if (s.estado === "DEFENDING") maxDefensa++; p.teleport({ x: 6.5, y: 65, z: 0.5 }); });
  const golpes = (p.historial ?? []).filter((h) => h.quien === INFINITO);
  const separacion = golpes.slice(1).map((g, i) => g.t - golpes[i].t);
  console.log("NOOB", { golpes: golpes.length, separacionMin: Math.min(...separacion), modos: [...modos], intentos: s.combate?.intentos, estado: s.estado });
  esperar(golpes.length >= 3, "el NOOB llega y golpea");
  esperar(Math.min(...separacion) >= 30, "el NOOB golpea lento (30 ticks)");
  esperar(!modos.has("lado") && maxDefensa === 0, "el NOOB no hace strafe ni se defiende");
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 4b) Pelea como un jugador: corre saltando hacia ti, no retrocede para guardar distancia y
//     no se queda quieto (fases 1, 5, 7 y 12).
for (const faseN of [1, 5, 7, 12]) {
  const p = jugadorEn(14.5, 0.5);
  const { e, s } = nuevo(0.5, 0.5, faseN);
  const modos = new Set();
  let quieto = 0;
  let cerca = 0;
  let saltos = 0;
  let enSuelo = true;
  let llego;
  const flechas0 = entidades.filter((x) => x.typeId === "minecraft:arrow").length;
  correr(400, (t) => {
    const tnt = entidades.some((x) => x.isValid && x.typeId === "minecraft:tnt" && dist(x, e) < 7);
    // (los combos con TNT o cristal, y huir de su propia TNT, sí lo alejan un momento)
    if (s.estado !== "COMBO" && !tnt) modos.add(s.mov?.modo);
    e.vida = e.vidaMax; // con toda la vida (no tiene por qué retirarse)
    p.vida = 20;
    // El jugador camina en círculos.
    p.teleport({ x: 14.5 + Math.cos(t / 30) * 5, y: 65, z: 0.5 + Math.sin(t / 30) * 5 });
    const d = dist(e, p);
    if (llego === undefined && d < 4) llego = t;
    if (enSuelo && !e.isOnGround && e.vel.y > 0.25) saltos++;
    enSuelo = e.isOnGround;
    if (llego !== undefined && s.estado !== "COMBO" && !s.comiendo) {
      cerca++;
      if (Math.hypot(e.vel.x, e.vel.z) < 0.02 && e.isOnGround) quieto++;
    }
  });
  const flechas = entidades.filter((x) => x.typeId === "minecraft:arrow").length - flechas0;
  console.log(`HUMANO fase ${faseN}`, { llegoEn: llego, saltos, quieto: `${quieto}/${cerca}`, modos: [...modos], flechas });
  esperar(llego !== undefined && llego < (faseN >= 12 ? 200 : faseN >= 3 ? 170 : 120), `fase ${faseN}: llega corriendo (empieza a 14-19 bloques)`);
  esperar(saltos >= (faseN <= 1 ? 1 : 2), `fase ${faseN}: corre saltando`);
  esperar(!modos.has("lejos"), `fase ${faseN}: no retrocede para guardar distancia`);
  esperar(cerca > 0 && quieto / cerca < 0.1, `fase ${faseN}: casi nunca se queda quieto (${quieto}/${cerca})`);
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 4c) La determinación sube cuando le pegas (más cuanto más fuerte).
{
  const p = jugadorEn(0.5, 2.5, { modo: "Creative" });
  const { e, s } = nuevo(0.5, 0.5, 3);
  s.proximaDecision = system.currentTick + 100000;
  const d0 = s.determinacion;
  e.applyDamage(4, { cause: "entityAttack", damagingEntity: p });
  correr(2);
  const d1 = s.determinacion;
  e.inmuneHasta = undefined;
  e.applyDamage(10, { cause: "entityAttack", damagingEntity: p });
  correr(2);
  const d2 = s.determinacion;
  console.log("HERIDO", { d0, d1: d1.toFixed(2), d2: d2.toFixed(2) });
  esperar(d1 > d0 && d2 - d1 > d1 - d0, "la determinación sube al recibir daño (más con golpes más fuertes)");
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 5) Fase 7 (ESPECIALISTA EN ESPADAS): strafe, W-tap/S-tap, combos y ritmo de 10+ ticks.
{
  const p = jugadorEn(5.5, 0.5);
  const { e, s } = nuevo(0.5, 0.5, 7);
  const modos = new Set();
  const estadosVistos = new Set();
  let wtaps = 0;
  correr(700, (t) => {
    modos.add(s.mov?.modo);
    estadosVistos.add(s.estado);
    if (s.mov?.pausaHasta) wtaps++;
    // El jugador se mueve un poco (para que haya strafe y persecución).
    p.teleport({ x: 5.5 + Math.sin(t / 30) * 2, y: 65, z: 0.5 + Math.cos(t / 40) * 2 });
    p.vida = 20;
  });
  const golpes = (p.historial ?? []).filter((h) => h.quien === INFINITO);
  const separacion = golpes.slice(1).map((g, i) => g.t - golpes[i].t);
  console.log("FASE 7", { golpes: golpes.length, sepMin: Math.min(...separacion), modos: [...modos], estados: [...estadosVistos], combos: s.ultimosCombos, mano: e.mano, wtaps });
  esperar(golpes.length >= 8, "la fase 7 golpea seguido");
  esperar(Math.min(...separacion) >= 10, "respeta la invulnerabilidad de 10 ticks");
  esperar(modos.has("presion") || modos.has("lado"), "hace strafe (rodea al rival)");
  esperar(s.ultimosCombos.length > 0, "usa combos");
  esperar(/minecraft:diamond_(sword|axe)/.test(e.mano ?? ""), "arma de diamante en la fase 7 (puede haber evolucionado a la 8)");
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 6) A distancia (fase 12): arco o ballesta con flechas reales que se quitan solas.
{
  const p = jugadorEn(16.5, 0.5);
  const { e, s } = nuevo(0.5, 0.5, 12);
  s.cd.combo = system.currentTick + 10000; // solo el tiro (para medir)
  const armas = new Set();
  const n0 = entidades.length;
  correr(300, () => { armas.add(e.mano); p.teleport({ x: 16.5, y: 65, z: 0.5 }); p.vida = 20; });
  const flechas = entidades.slice(n0).filter((x) => x.typeId === "minecraft:arrow");
  const vivas = flechas.filter((x) => x.isValid);
  for (const f of flechas) if (f.dueno !== e) console.log("FLECHA AJENA", f.id, f.dueno?.typeId, f.location);
  console.log("DISTANCIA", { armas: [...armas], flechas: flechas.length, flechasConDueno: flechas.filter((f) => f.dueno === e).length, golpesFlecha: (p.historial ?? []).filter((h) => h.causa === "projectile").length });
  esperar([...armas].some((a) => a === "minecraft:bow" || a === "minecraft:crossbow"), "usa arco o ballesta a distancia");
  esperar(flechas.length >= 2 && flechas.every((f) => f.dueno === e), "dispara flechas reales");
  esperar((p.historial ?? []).some((h) => h.causa === "projectile"), "alguna flecha acierta (con predicción)");
  correr(120, () => { p.teleport({ x: 16.5, y: 65, z: 0.5 }); });
  esperar(entidades.filter((x) => x.typeId === "minecraft:arrow" && x.isValid && x.clavada).length <= 3, "las flechas clavadas se quitan");
  void vivas;
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 7) Escudo (fase 4): para el golpe sin hacha; con hacha se lo desactiva 5 s.
{
  const p = jugadorEn(0.5, 2.5);
  const { e, s } = nuevo(0.5, 0.5, 4);
  p.modo = "Creative"; // quieto, para controlar
  e.mira = { x: 0, y: 0, z: 1 };
  s.objetivo = p;
  s.escudoArriba = true;
  s.escudoHasta = system.currentTick + 200;
  s.proximaDecision = system.currentTick + 100000; // el cerebro no interviene en esta prueba
  correr(2);
  const v0 = e.vida;
  e.applyDamage(6, { cause: "entityAttack", damagingEntity: p });
  correr(2);
  esperar(e.vida === v0 && s.bloqueoEn > 0, "el escudo para el golpe (evento de bloqueo)");
  p.mano = "minecraft:iron_axe";
  e.inmuneHasta = undefined;
  s.escudoArriba = true;
  s.escudoHasta = system.currentTick + 200;
  correr(1);
  e.applyDamage(6, { cause: "entityAttack", damagingEntity: p });
  correr(2);
  console.log("ESCUDO", { v0, vida: e.vida, escudo: s.escudoArriba, roto: s.escudoRotoHasta - system.currentTick });
  esperar(e.vida < v0 && !s.escudoArriba && s.escudoRotoHasta > system.currentTick + 80, "el hacha pasa y desactiva su escudo");
  p.mano = undefined;
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 8) Jugador con escudo: el Infinito con hacha se lo desactiva (fase 8).
{
  const p = jugadorEn(0.5, 2.6);
  p.isSneaking = true;
  p.equipo.Offhand = "minecraft:shield";
  p.mira = { x: 0, y: 0, z: -1 };
  const { e, s } = nuevo(0.5, 0.5, 8);
  correr(320, () => { p.teleport({ x: 0.5, y: 65, z: 2.6 }); p.vida = 20; });
  console.log("ROMPEGUARDIA", { cooldowns: log.cooldowns.length, mano: e.mano, estilo: s.estilo, combos: s.ultimosCombos });
  esperar(log.cooldowns.some((c) => c.cat === "shield" && c.dur === 100), "le desactiva el escudo al jugador con el hacha");
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 9) Combos que hacen cosas reales.
function probarCombo(id, fase, prep = () => {}, ticks = 160) {
  // Se prueba la mecánica del combo: sin el error aleatorio de la fase (2 % en la 14, por ejemplo).
  const errores0 = FASES.map((f) => f.error);
  for (const f of FASES) f.error = 0;
  try {
    return probarCombo2(id, fase, prep, ticks);
  } finally {
    FASES.forEach((f, i) => { f.error = errores0[i]; });
  }
}
function probarCombo2(id, fase, prep, ticks) {
  const p = jugadorEn(0.5, 3.5, { modo: "Creative" }); // no pelea antes del combo
  const { e, s } = nuevo(0.5, 0.5, fase);
  p.modo = "Survival";
  prep(e, s, p);
  s.objetivo = p;
  const def = COMBOS.find((c) => c.id === id);
  cambiarEstado(e, s, "ENGAGING", true);
  iniciarCombo(e, s, def, p);
  s.estado = "COMBO";
  const manos = new Set();
  const antes = { sets: log.sets.length, expl: log.explosiones.length, efectos: log.efectos.length, ent: entidades.length };
  let maxY = e.location.y;
  correr(ticks, () => { manos.add(e.mano); maxY = Math.max(maxY, e.location.y); if (s.combo?.def.id !== id && !s.combo) {} });
  const r = { e, s, p, manos: [...manos], sets: log.sets.slice(antes.sets), expl: log.explosiones.slice(antes.expl), efectos: log.efectos.slice(antes.efectos), nuevas: entidades.slice(antes.ent), maxY, ultimo: s.ultimoCombo };
  return r;
}
{
  const r = probarCombo("espada_reset_espada", 7, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 2.9 }));
  console.log("COMBO espada_reset_espada", { golpes: (r.p.historial ?? []).length, ultimo: r.ultimo });
  esperar((r.p.historial ?? []).length >= 2, "espada → sprint reset → espada: dos golpes reales");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("hacha_escudo_espada", 8, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 2.9 }));
  console.log("COMBO hacha_escudo_espada", { manos: r.manos, golpes: (r.p.historial ?? []).length, ultimo: r.ultimo });
  esperar(r.manos.includes("minecraft:diamond_axe") && r.manos.includes("minecraft:diamond_sword"), "hacha → escudo → espada cambia de arma de verdad");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("agua_reposicion_ataque", 11, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 3.5 }), 60);
  const agua = r.sets.filter((x) => x.id === "minecraft:water");
  console.log("COMBO agua", { agua: agua.length, ultimo: r.ultimo });
  esperar(agua.length >= 1, "cubeta de agua: pone agua real a los pies del rival");
  correr(80);
  esperar(agua.every((a) => leer(a.x, a.y, a.z).id === "minecraft:air"), "y la quita sola");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("cristal_preciso", 13, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 4 }), 80);
  const obs = r.sets.filter((x) => x.id === "minecraft:obsidian");
  const ex = r.expl[0];
  console.log("COMBO cristal", { obsidiana: obs.length, explosion: ex && { fuente: ex.fuente, pedidos: ex.bloquesPedidos, rotos: ex.bloquesRotos, danados: ex.danados }, vidaJugador: r.p.vida });
  esperar(obs.length === 1 && r.nuevas.some((x) => x.typeId === "minecraft:ender_crystal"), "cristal: pone obsidiana y el cristal");
  esperar(!!ex && ex.bloquesRotos === 0, "la explosión del cristal no rompe bloques");
  esperar(ex?.danados.some((d) => d.tipo === "minecraft:player"), "la explosión daña al jugador");
  esperar(!ex?.danados.some((d) => d.tipo === INFINITO), "a él no lo daña su propia explosión");
  correr(150);
  esperar(obs.every((o) => leer(o.x, o.y, o.z).id === "minecraft:air"), "la obsidiana se quita sola");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("tnt_zona", 13, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 5 }), 140);
  const ex = r.expl.find((x) => x.fuente === "minecraft:tnt");
  console.log("COMBO tnt", { tnt: r.nuevas.filter((x) => x.typeId === "minecraft:tnt").length, explosion: ex && { pedidos: ex.bloquesPedidos, rotos: ex.bloquesRotos, danados: ex.danados } });
  esperar(!!ex && ex.bloquesPedidos > 0 && ex.bloquesRotos === 0, "la TNT explota sin romper bloques");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("maza_caida_vertical", 14, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 3 }), 90);
  const g = (r.p.historial ?? []).filter((h) => h.quien === INFINITO);
  console.log("COMBO maza", { resultado: r.ultimo, intentos: r.s.combate?.intentos, maxY: r.maxY.toFixed(2), golpes: g.map((x) => x.dano), danoMaza3: danoMaza(3), caidaPropia: r.e.historial?.filter((h) => h.causa === "fall") ?? [] });
  esperar(r.maxY > 67, "maza: gana altura");
  esperar(g.some((x) => x.dano > 12), "maza: el golpe vertical pega más que un espadazo");
  esperar(!(r.e.historial ?? []).some((h) => h.causa === "fall"), "maza: sin daño por caída");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  // La maza empezando en el aire (después de un salto): espera a tocar el suelo y salta.
  const r = probarCombo("maza_caida_vertical", 14, (e, s, p) => { p.teleport({ x: 0.5, y: 65, z: 3 }); e.applyImpulse({ x: 0, y: 0.42, z: 0 }); }, 110);
  const g = (r.p.historial ?? []).filter((h) => h.quien === INFINITO);
  console.log("COMBO maza (en el aire)", { golpes: g.map((x) => x.dano), resultado: r.ultimo });
  esperar(g.some((x) => x.dano > 12), "maza: también si el combo empieza en el aire");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("perla_flanco", 9, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 14 }), 120);
  const perlas = r.nuevas.filter((x) => x.typeId === "minecraft:ender_pearl");
  console.log("COMBO perla", { perlas: perlas.length, distanciaFinal: dist(r.e, r.p).toFixed(1), llego: r.s.perlaLlego });
  esperar(perlas.length === 1 && !!r.s.perlaLlego, "perla real: la lanza y aparece donde cae");
  esperar(dist(r.e, r.p) < 6, "la perla lo deja junto al rival");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("pilar_maza", 14, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 3 }), 120);
  const piedra = r.sets.filter((x) => x.id === "minecraft:cobblestone");
  console.log("COMBO pilar", { bloques: piedra.length, maxY: r.maxY.toFixed(2), golpes: (r.p.historial ?? []).map((h) => h.dano) });
  esperar(piedra.length >= 1, "pilar: pone bloques debajo para subir");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("pociones_presion", 15, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 2.8 }), 120);
  console.log("COMBO pociones", { pociones: r.nuevas.filter((x) => x.typeId === "minecraft:splash_potion").length, efectos: r.efectos.map((x) => `${x.quien}:${x.ef}`) });
  esperar(r.nuevas.some((x) => x.typeId === "minecraft:splash_potion"), "Pot PvP: pociones arrojadizas reales");
  esperar(r.efectos.some((x) => x.ef === "strength" && x.quien === INFINITO), "la poción de fuerza le hace efecto");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  const r = probarCombo("tridente_acercamiento_combo", 12, (e, s, p) => p.teleport({ x: 0.5, y: 65, z: 10 }), 120);
  const tr = r.nuevas.filter((x) => x.typeId === "minecraft:thrown_trident");
  console.log("COMBO tridente", { tridentes: tr.length, golpes: (r.p.historial ?? []).length });
  esperar(tr.length === 1, "tridente: lo lanza de verdad");
  correr(80);
  esperar(tr.every((t) => !t.isValid), "el tridente lanzado se quita (no se puede recoger)");
  r.e.isValid = false; sacar(r.p); correr(101);
}
{
  // Lava: no la pone si hay algo que se queme cerca.
  const r1 = probarCombo("lava_corte", 11, (e, s, p) => { p.teleport({ x: 0.5, y: 65, z: 6 }); }, 30);
  const lava1 = r1.sets.filter((x) => x.id === "minecraft:lava");
  r1.e.isValid = false; sacar(r1.p); correr(101);
  for (let x = -3; x <= 3; x++) escribir(x, 66, 4, "minecraft:oak_planks");
  const r2 = probarCombo("lava_corte", 11, (e, s, p) => { p.teleport({ x: 0.5, y: 65, z: 6 }); }, 30);
  const lava2 = r2.sets.filter((x) => x.id === "minecraft:lava");
  console.log("COMBO lava", { sinMadera: lava1.length, conMadera: lava2.length });
  esperar(lava1.length === 1 && lava2.length === 0, "lava de control solo sin cosas inflamables cerca");
  correr(60);
  esperar(lava1.every((a) => leer(a.x, a.y, a.z).id === "minecraft:air"), "la lava se quita sola");
  for (let x = -3; x <= 3; x++) W.delete(`${x},66,4`);
  r2.e.isValid = false; sacar(r2.p); correr(101);
}
// Catálogo ampliable sin tocar el código.
{
  const n = COMBOS.length;
  registrarCombo({ id: "prueba_extra", nombre: "Extra", fase: 1, rango: [0, 4], pasos: ["golpe", { a: "esperar", ticks: 2 }, "golpe"] });
  esperar(COMBOS.length === n + 1 && !!ACCIONES.golpe, "se agregan combos sin tocar el resto");
  const pedidos = ["espada_reset_espada", "espada_salto_critico", "hacha_escudo_espada", "arco_persecucion_espada", "agua_reposicion_ataque",
    "persecucion_salto_aereo", "tridente_acercamiento_combo", "maza_caida_vertical", "bloqueo_contra_persecucion", "cambio_sorpresa"];
  esperar(pedidos.every((id) => COMBOS.some((c) => c.id === id)), "están los 10 combos pedidos");
  const desconocidas = COMBOS.flatMap((c) => (typeof c.pasos === "function" ? [] : c.pasos)).map((p) => (typeof p === "string" ? p : p.a)).filter((a) => !ACCIONES[a]);
  esperar(!desconocidas.length, `todas las acciones existen ${desconocidas.join(",")}`);
  COMBOS.splice(COMBOS.findIndex((c) => c.id === "prueba_extra"), 1);
  console.log("CATALOGO", { combos: COMBOS.length });
}

// 10) Water clutch (fase 11): cae desde 20 bloques, pone agua, no se lastima y la recoge.
{
  const { e, s } = nuevo(30.5, 0.5, 11);
  e.teleport({ x: 30.5, y: 85, z: 0.5 });
  e.caidaDesde = 85;
  s.alturaMax = 85;
  let aguaPuesta;
  correr(80, () => { const a = log.sets.find((x) => x.id === "minecraft:water" && x.x === 30 && x.t > system.currentTick - 2); if (a) aguaPuesta = a; });
  const caidas = (e.historial ?? []).filter((h) => h.causa === "fall");
  console.log("CLUTCH", { agua: aguaPuesta, vida: e.vida, caida: e.ultimaCaida, recogida: aguaPuesta && leer(aguaPuesta.x, aguaPuesta.y, aguaPuesta.z).id });
  esperar(!!aguaPuesta && !caidas.length, "water clutch: agua antes del suelo y sin daño");
  esperar(aguaPuesta && leer(aguaPuesta.x, aguaPuesta.y, aguaPuesta.z).id === "minecraft:air", "recoge el agua");
  e.isValid = false;
  const f10 = nuevo(40.5, 0.5, 10);
  f10.e.teleport({ x: 40.5, y: 85, z: 0.5 });
  f10.e.caidaDesde = 85;
  f10.s.alturaMax = 85;
  correr(80);
  esperar((f10.e.historial ?? []).some((h) => h.causa === "fall"), "en la fase 10 todavía no sabe hacer clutch");
  f10.e.isValid = false;
  correr(101);
}

// 11) Memoria: detecta que saltas siempre y que repites la misma combinación.
{
  const p = jugadorEn(0.5, 3.5);
  const { e, s } = nuevo(0.5, 0.5, 6);
  const estadosVistos = new Set();
  correr(320, (t) => {
    // Salta todo el tiempo (16 s).
    p.isOnGround = t % 8 >= 4;
    p.vel = { x: 0, y: t % 8 === 4 ? 0.42 : 0, z: 0 };
    p.isJumping = t % 8 === 4;
    estadosVistos.add(s.estado);
    p.vida = 20;
  });
  const m = rival(s, p);
  console.log("MEMORIA", { saltos: m.saltos.toFixed(2), patrones: m.patrones, estados: [...estadosVistos], det: s.estadisticas.patron });
  esperar(rasgos(m, p).saltaMucho && m.patrones.includes("saltaMucho"), "detecta que salta mucho");
  esperar(estadosVistos.has("ADAPTING") && (s.estadisticas.patron ?? 0) >= 1, "se adapta y gana determinación por aprender el patrón");
  for (let k = 0; k < 4; k++) { anotar(m, "golpe_espada"); anotar(m, "salto"); anotar(m, "golpe_espada"); }
  const rep = combinacionRepetida(m);
  const pred = predecir(m);
  console.log("PATRON", { rep, pred });
  esperar(!!rep, "detecta una combinación repetida");
  esperar(!!pred, "predice lo siguiente");
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 12) Multijugador: cambia al rival débil (fase 4+); antes, no.
for (const faseN of [3, 6]) {
  const ritmo = INFINITO_CFG.ritmo;
  INFINITO_CFG.ritmo = 0; // que no evolucione en medio de la prueba
  const a = jugadorEn(5.5, 0.5);
  const b = jugadorEn(-5.5, 0.5, { vida: 2 });
  const { e, s } = nuevo(0.5, 0.5, faseN);
  s.objetivo = a;
  s.objetivoDesde = system.currentTick;
  const objetivos = new Set();
  correr(160, () => { objetivos.add(s.objetivo?.id === a.id ? "A" : s.objetivo?.id === b.id ? "B" : "-"); a.vida = 20; b.vida = Math.min(b.vida, 2); a.teleport({ x: 5.5, y: 65, z: 0.5 }); b.teleport({ x: -5.5, y: 65, z: 0.5 }); });
  console.log(`MULTI fase ${faseN}`, [...objetivos]);
  if (faseN >= 4) esperar(objetivos.has("B"), "fase 4+: cambia al rival con poca vida");
  else esperar(!objetivos.has("B"), "antes de la fase 4 no cambia de objetivo");
  INFINITO_CFG.ritmo = ritmo;
  e.isValid = false;
  sacar(a);
  sacar(b);
  correr(101);
}

// 13) Derribo → rescate por un Claude → recuperación.
let datosRescate;
{
  const p = jugadorEn(0.5, 3);
  const { e, s } = nuevo(0.5, 0.5, 5);
  const claude = new Entity(dim, NPC, { x: 10.5, y: 65, z: 0.5 });
  claude.vida = 40; claude.vidaMax = 40;
  correr(5);
  const det0 = s.determinacion;
  e.vida = 3;
  e.applyDamage(10, { cause: "entityAttack", damagingEntity: p });
  correr(3);
  console.log("DERRIBO", { etapa: s.etapa, vida: e.vida, intocable: e.hasTag("claudenpc_intocable"), titulo: log.titulos.at(-1) });
  esperar(s.etapa === "derribado" && e.isValid && e.vida > 0, "el golpe mortal lo derriba (no muere)");
  esperar(log.anims.some((x) => x.a.endsWith("pose_derrota")), "pose de derrota");
  const v = e.vida;
  e.inmuneHasta = undefined;
  e.applyDamage(50, { cause: "entityAttack", damagingEntity: p });
  esperar(e.vida === v, "derribado es intocable");
  p.modo = "Creative"; // el jugador se queda mirando
  let cargadoVisto = false;
  let sobreHombro = 0;
  const etapas = new Set();
  correr(INFINITO_CFG.rescateA + 700, () => {
    etapas.add(s.etapa);
    if (s.etapa === "cargado") { cargadoVisto = true; sobreHombro = Math.max(sobreHombro, e.location.y - claude.location.y); }
  });
  const rs = estados.get(claude.id);
  console.log("RESCATE", { etapas: [...etapas], sobreHombro: sobreHombro.toFixed(2), rescate: rs?.rescate?.etapa, distanciaClaude: dist(e, claude).toFixed(1), marcas: log.particulas.filter((x) => x === "claudenpc:sello_marca").length });
  esperar(cargadoVisto && sobreHombro > 1.2, "un Claude lo carga al hombro");
  esperar(etapas.has("recuperando"), "lo deja recuperándose");
  esperar(log.particulas.includes("claudenpc:sello_marca"), "marcas del sello mientras está derribado");
  correr(INFINITO_CFG.recuperacion + 40);
  console.log("RECUPERADO", { etapa: s.etapa, vida: e.vida, max: e.vidaMax, ganado: (s.determinacion - det0).toFixed(1) });
  esperar(s.etapa === "pelea" && e.vida === e.vidaMax, "se recupera con toda la vida");
  esperar(s.determinacion - det0 >= GANANCIA.levantarse, "gana determinación al levantarse");
  esperar(!estados.get(claude.id)?.rescate, "el rescatista queda libre");
  datosRescate = { e, s, claude, p };
}

// 14) Golpe fuerte al rescatista: lo suelta y vuelve a correr el tiempo del sello.
{
  const { e, s, claude, p } = datosRescate;
  e.vida = 2;
  p.modo = "Survival";
  e.inmuneHasta = undefined;
  e.applyDamage(10, { cause: "entityAttack", damagingEntity: p });
  p.modo = "Creative";
  correr(3);
  claude.teleport({ x: e.location.x + 6, y: 65, z: e.location.z });
  let soltado = false;
  let rescatista;
  correr(INFINITO_CFG.rescateA + 200, (k) => {
    if (s.etapa === "cargado" && !soltado) {
      // Golpea al que lo está cargando (puede ser otro Claude si este se fue lejos).
      rescatista = world.getEntity(s.carga.rescatistaId);
      rescatista.inmuneHasta = undefined;
      rescatista.applyDamage(6, { cause: "entityAttack", damagingEntity: p });
      soltado = true;
    }
  });
  console.log("SOLTAR", { soltado, otroClaude: rescatista && rescatista !== claude, etapa: s.etapa, t0: s.derribo && system.currentTick - s.derribo.t0, titulo: log.titulos.filter((t) => t.txt.includes("soltó")).length });
  esperar(soltado && log.titulos.some((t) => t.txt.includes("soltó")), "golpe fuerte al rescatista: lo suelta");
}

// 14b) Siempre viene un Claude: si el que venía muere, viene otro; y si no hay suelo lejos
//      (por ejemplo, en el mar o en el Nether), aparece uno a su lado.
{
  const p = jugadorEn(-40.5, 0.5, { modo: "Creative" });
  const { e, s } = nuevo(-40.5, 6.5, 3);
  for (const x of entidades) if (x.typeId === NPC && x.isValid && dist(x, e) < 60) x.isValid = false;
  const getTop = dim.getTopmostBlock;
  // Sin suelo a más de 5 bloques: solo puede aparecer uno a su lado.
  dim.getTopmostBlock = (q) => (Math.hypot(q.x - e.location.x, q.z - e.location.z) > 5 ? undefined : getTop(q));
  e.vida = 2;
  p.modo = "Survival";
  e.inmuneHasta = undefined;
  e.applyDamage(10, { cause: "entityAttack", damagingEntity: p });
  p.modo = "Creative";
  const quien = () => s.derribo?.rescatistaId ?? s.carga?.rescatistaId;
  const vistos = [];
  let d1 = Infinity;
  let llevadoPorOtro = false;
  correr(INFINITO_CFG.rescateA * 2 + 600, () => {
    const id = quien();
    if (id !== undefined && !vistos.includes(id)) {
      vistos.push(id);
      if (vistos.length === 1) {
        // El primero muere antes de llevárselo (y ya hay suelo otra vez).
        const primero = world.getEntity(id);
        d1 = primero ? dist(primero, e) : Infinity;
        if (primero) {
          estados.get(primero.id).rescate = undefined;
          primero.isValid = false;
        }
        dim.getTopmostBlock = getTop;
      }
    }
    if (s.etapa === "cargado" && vistos.length >= 2 && s.carga?.rescatistaId !== vistos[0]) llevadoPorOtro = true;
  });
  dim.getTopmostBlock = getTop;
  console.log("RESCATISTAS", { vistos: vistos.length, distanciaPrimero: d1.toFixed(1), llevadoPorOtro, etapa: s.etapa });
  esperar(d1 < 3, "sin suelo lejos, el rescatista aparece a su lado");
  esperar(vistos.length >= 2, "si el que venía muere, viene otro");
  esperar(llevadoPorOtro, "y el otro se lo lleva");
  e.isValid = false;
  for (const x of entidades) if (x.typeId === NPC && dist(x, e) < 80) x.isValid = false;
  sacar(p);
  correr(101);
}

// 15) Sello: con el sello completo desaparece para siempre.
{
  const { e, s } = datosRescate;
  // Los rescatistas ya no están (el de la prueba o uno que llegó corriendo): si lo cargaban, lo
  // sueltan. Mientras se construye el sello no llama a otro (eso se prueba en la 14b).
  const rescateA = INFINITO_CFG.rescateA;
  INFINITO_CFG.rescateA = 1e9;
  for (const x of entidades) if (x.typeId === NPC) x.isValid = false;
  correr(25);
  if (s.etapa === "pelea") {
    e.vida = 2; e.inmuneHasta = undefined;
    datosRescate.p.modo = "Survival";
    e.applyDamage(10, { cause: "entityAttack", damagingEntity: datosRescate.p });
    datosRescate.p.modo = "Creative";
    correr(25);
  }
  const etapaSello = s.etapa;
  const b = (s.derribo ?? s.recuperacion).base;
  // Sello incompleto (falta una llama): no pasa nada.
  const esquinas = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
  esquinas.forEach(([dx, dz], i) => {
    escribir(b.x + dx, b.y, b.z + dz, "minecraft:obsidian");
    escribir(b.x + dx, b.y + 1, b.z + dz, i === 0 ? "minecraft:crying_obsidian" : "minecraft:obsidian");
    if (i < 3) escribir(b.x + dx, b.y + 2, b.z + dz, ["minecraft:soul_torch", "minecraft:soul_lantern", "minecraft:soul_campfire"][i]);
  });
  correr(30);
  esperar(e.isValid && (s.etapa === "derribado" || s.etapa === "recuperando"), `con el sello incompleto sigue ahí (${etapaSello})`);
  escribir(b.x - 2, b.y + 2, b.z - 2, "minecraft:soul_torch");
  correr(40);
  console.log("SELLO", { valido: e.isValid, registrado: infinitos.has(e.id), contador: world.getDynamicProperty("claudenpc:infinitos_sellados"), titulo: log.titulos.at(-1) });
  esperar(!e.isValid && !infinitos.has(e.id), "sellado: desaparece");
  esperar(world.getDynamicProperty("claudenpc:infinitos_sellados") === 1, "cuenta los sellados del mundo");
  correr(200);
  esperar(!entidades.some((x) => x.typeId === INFINITO && x.isValid), "no vuelve a aparecer");
  INFINITO_CFG.rescateA = rescateA;
  sacar(datosRescate.p);
}

// 15b) Si muere de verdad (algo que el sensor no paró), reaparece derribado con todo lo que
//      sabía; con /kill (override) o sellado, no.
{
  const { e, s } = nuevo(60.5, 0.5, 9);
  const det = s.determinacion;
  emitir("world.after.entityDie", { deadEntity: e, damageSource: { cause: "lava" } });
  e.isValid = false;
  correr(3);
  const otro = entidades.find((x) => x.typeId === INFINITO && x.isValid && x !== e && Math.abs(x.location.x - 60.5) < 1);
  const s2 = otro && infinitos.get(otro.id);
  console.log("REVIVE", { otro: !!otro, etapa: s2?.etapa, fase: s2?.fase, det: s2 && Math.round(s2.determinacion) });
  esperar(!!s2 && s2.etapa === "derribado" && Math.abs(s2.determinacion - det) < 0.5, "si muere de verdad, reaparece derribado con su determinación");
  emitir("world.after.entityDie", { deadEntity: otro, damageSource: { cause: "selfDestruct" } }); // /kill
  otro.isValid = false;
  correr(3);
  esperar(!entidades.some((x) => x.typeId === INFINITO && x.isValid && Math.abs(x.location.x - 60.5) < 1), "con /kill no reaparece");
  correr(101);
}

// 16) Guardado: determinación, memoria y etapa se recuperan.
{
  const { e, s } = nuevo(0.5, 0.5, 9);
  ponerDeterminacion(e, s, umbral(9) + 3);
  s.estadisticas.golpe = 42;
  guardar(s);
  const s2 = nuevoEstado(e);
  cargar(e, s2);
  esperar(s2.fase === 9 && Math.abs(s2.determinacion - s.determinacion) < 0.02 && s2.estadisticas.golpe === 42, "guarda y recupera la determinación");
  e.isValid = false;
  correr(101);
}

// 17) Rendimiento: 6 Infinitos peleando con 3 jugadores; como mucho 3 piensan por tick.
{
  const ps = [jugadorEn(0.5, 8), jugadorEn(8, 0.5), jugadorEn(-8, 0.5)];
  const lista = [];
  for (let k = 0; k < 6; k++) lista.push(nuevo(Math.cos(k) * 3, Math.sin(k) * 3, 1 + k * 3).s);
  let maxPorTick = 0;
  const m0 = { ...medida };
  const total = () => lista.reduce((n, s) => n + (s.decisiones ?? 0), 0);
  let antes = total();
  correr(400, () => {
    const ahora = total();
    maxPorTick = Math.max(maxPorTick, ahora - antes);
    antes = ahora;
    for (const p of ps) p.vida = 20;
  });
  const ms = (medida.msScripts - m0.msScripts) / (medida.ticks - m0.ticks);
  console.log("RENDIMIENTO", { maxPorTick, msPorTick: ms.toFixed(3), particulas: log.particulas.length, temporales: cuantosTemporales() });
  esperar(maxPorTick <= INFINITO_CFG.maxPensandoPorTick, "como mucho 3 Infinitos deciden por tick");
  for (const s of lista) s.e.isValid = false;
  for (const p of ps) sacar(p);
  correr(101);
}

// 18b) Comandos: /claudenpc:infinito [fase], /claudenpc:fase, /claudenpc:determinacion, /claudenpc:infinito_info.
{
  const registrados = new Map();
  const registry = { registerCommand: (def, fn) => registrados.set(def.name, { def, fn }), registerEnum: () => {} };
  for (const fn of handlers["system.before.startup"] ?? []) fn({ customCommandRegistry: registry });
  const nombres = ["claudenpc:infinito", "claudenpc:fase", "claudenpc:determinacion", "claudenpc:infinito_info"];
  esperar(nombres.every((n) => registrados.has(n)), "se registran los 4 comandos del Infinito");
  esperar(registrados.get("claudenpc:infinito").def.optionalParameters?.length === 1, "/claudenpc:infinito con fase opcional");
  const p = jugadorEn(100.5, 100.5, { modo: "Creative" });
  p.mira = { x: 1, y: 0, z: 0 };
  const m0 = log.mensajes.length;
  registrados.get("claudenpc:infinito").fn({ sourceEntity: p }, 12);
  correr(3);
  const e = entidades.find((x) => x.typeId === INFINITO && x.isValid && Math.abs(x.location.x - 103.5) < 0.1);
  const s = e && infinitos.get(e.id);
  esperar(!!s && s.fase === 12, "/claudenpc:infinito 12 lo trae en la fase 12");
  registrados.get("claudenpc:fase").fn({ sourceEntity: p }, 3);
  correr(2);
  esperar(s?.fase === 3, "/claudenpc:fase 3");
  registrados.get("claudenpc:determinacion").fn({ sourceEntity: p }, 500);
  correr(2);
  esperar(s?.fase === 12 && Math.floor(s.determinacion) === 500, "/claudenpc:determinacion 500 (fase 12)");
  registrados.get("claudenpc:infinito_info").fn({ sourceEntity: p });
  correr(2);
  const msgs = log.mensajes.slice(m0);
  console.log("COMANDOS", msgs.map((m) => m.split("\n")[0]));
  esperar(msgs.some((m) => m.includes("fase") && m.includes("determinación")), "/claudenpc:infinito_info responde");
  const noJugador = registrados.get("claudenpc:fase").fn({ sourceEntity: undefined }, 5);
  esperar(noJugador.status === "Failure", "los comandos piden un jugador");
  e.isValid = false;
  sacar(p);
  correr(101);
}

// 18c) Sin jugadores pelea con monstruos (y gana determinación).
{
  const { e, s } = nuevo(200.5, 0.5, 6);
  const z = new Entity(dim, "minecraft:zombie", { x: 205.5, y: 65, z: 0.5 });
  z.vida = 20; z.vidaMax = 20;
  const det0 = s.determinacion;
  correr(400);
  console.log("PVE", { zombiVivo: z.isValid, vida: z.vida, monstruos: s.estadisticas.monstruo, det: (s.determinacion - det0).toFixed(1) });
  esperar(!z.isValid || z.vida <= 0, "pelea con un monstruo si no hay jugadores");
  esperar((s.estadisticas.monstruo ?? 0) >= 1, "gana determinación al vencer al monstruo");
  e.isValid = false;
  correr(101);
}

// 18e) Cinemática de la fase 20: cara estilo Saitama, máscara estilo Garou (guardando el casco),
//      gráfica con curvas y caras, destello, "TOP 1" al lado y el choque de puños.
{
  const p = jugadorEn(6.5, 0.5);
  const casco = new ItemStack("minecraft:diamond_helmet", 1);
  casco.marca = "mi casco encantado";
  p.getComponent("minecraft:equippable").setEquipment("Head", casco);
  const { e, s } = nuevo(0.5, 0.5, 19);
  const cam0 = log.camaras.length;
  const c0 = (log.cine ?? []).length;
  const com0 = log.comandos.length;
  const tit0 = log.titulos.length;
  ponerFase(e, s, 20);
  esperar(!!s.cine && p.permisos?.[InputPermissionCategory.Movement] === false, "al llegar a la 20 empieza la cinemática y el jugador queda quieto");
  correr(6);
  const cabezaDurante = p.getComponent("minecraft:equippable").getEquipment("Head");
  const enInventario = p.items?.find((x) => x === casco);
  esperar(e.eventos.includes("claudenpc:cara_1"), "el Infinito pone su cara estilo Saitama");
  esperar(cabezaDurante?.typeId === "claudenpc:mascara_garou" && !!enInventario, "el jugador lleva la máscara y su casco queda en el inventario");
  const vida0 = p.vida;
  e.inmuneHasta = undefined;
  const v0 = e.vida;
  e.applyDamage(30, { cause: "entityAttack", damagingEntity: p });
  esperar(e.vida === v0, "intocable durante la cinemática");
  let vidaMin = p.vida;
  let n = 0;
  while (s.cine && n++ < 400) { tick(); vidaMin = Math.min(vidaMin, p.vida); }
  correr(10);
  const cine = (log.cine ?? []).slice(c0);
  const cuenta = (id) => cine.filter((x) => x.id === id).length;
  const top = cine.filter((x) => x.id === "claudenpc:cine_top1");
  const fondo = cine.find((x) => x.id === "claudenpc:cine_fondo");
  const camaras = log.camaras.slice(cam0);
  console.log("CINEMATICA", { fondo: cuenta("claudenpc:cine_fondo"), trazos: cuenta("claudenpc:cine_trazo"), caraS: cuenta("claudenpc:cine_cara_s"),
    caraG: cuenta("claudenpc:cine_cara_g"), destello: cuenta("claudenpc:cine_destello"), top1: top.length, rojo: cuenta("claudenpc:cine_rojo"),
    camaras: camaras.length, temblor: log.comandos.slice(com0).filter((x) => x.startsWith("camerashake")).length,
    titulo: log.titulos.slice(tit0).map((x) => x.txt) });
  esperar(cuenta("claudenpc:cine_fondo") === 1 && cuenta("claudenpc:cine_trazo") === 80, "la gráfica: fondo con cuadrícula y dos curvas de 40 trazos");
  esperar(cuenta("claudenpc:cine_cara_s") > 60 && cuenta("claudenpc:cine_cara_g") > 60, "las caras suben por las curvas");
  esperar(cuenta("claudenpc:cine_destello") === 1 && top.length === 2 && cuenta("claudenpc:cine_rojo") === 1, "destello arriba, TOP 1 dos veces y el choque con energía roja");
  // El TOP 1 de la gráfica sale a la derecha de la cara del Infinito y arriba.
  const caraFinal = cine.filter((x) => x.id === "claudenpc:cine_cara_s").at(-1);
  const camG = camaras.find((x) => x.o.facingLocation && Math.abs(x.o.location.y - fondo.pos.y) < 0.01);
  if (camG && caraFinal && top[0]) {
    const F = { x: fondo.pos.x - camG.o.location.x, z: fondo.pos.z - camG.o.location.z };
    const l = Math.hypot(F.x, F.z); F.x /= l; F.z /= l;
    const R = { x: -F.z, z: F.x };
    const derecha = (top[0].pos.x - caraFinal.pos.x) * R.x + (top[0].pos.z - caraFinal.pos.z) * R.z;
    console.log("TOP1 POSICION", { derecha: derecha.toFixed(2), altura: (top[0].pos.y - camG.o.location.y).toFixed(2) });
    esperar(derecha > 2 && top[0].pos.y > camG.o.location.y + 4, "TOP 1 al lado de la cara (a la derecha) y arriba de la gráfica");
  } else {
    esperar(false, "TOP 1 al lado de la cara (a la derecha) y arriba de la gráfica");
  }
  esperar(camaras.length >= 5, "cámaras: hombro, gráfica y choque");
  esperar(log.comandos.slice(com0).some((x) => x.startsWith("camerashake")), "temblor de cámara en el choque");
  esperar(!s.cine && p.permisos?.[InputPermissionCategory.Movement] === true, "al terminar el jugador vuelve a moverse");
  const cabezaDespues = p.getComponent("minecraft:equippable").getEquipment("Head");
  esperar(cabezaDespues === casco && cabezaDespues.marca === "mi casco encantado" && !p.items.includes(casco), "le devuelve su mismo casco (con sus encantamientos)");
  esperar(e.eventos.includes("claudenpc:cara_0"), "el Infinito vuelve a su cara");
  esperar(vidaMin >= vida0 - 0.001, "el jugador no recibe daño en la cinemática");
  const golpes0 = (p.historial ?? []).filter((h) => h.quien === INFINITO).length;
  correr(160, () => { p.vida = 20; });
  esperar((p.historial ?? []).filter((h) => h.quien === INFINITO).length > golpes0, "después sigue la pelea (te vuelve a golpear)");
  e.isValid = false;
  sacar(p);
  correr(101);
}
{
  // Inventario lleno: no le pone la máscara (para no perder su casco).
  const p = jugadorEn(6.5, 30.5);
  const casco = new ItemStack("minecraft:netherite_helmet", 1);
  p.getComponent("minecraft:equippable").setEquipment("Head", casco);
  p.items = new Array(36).fill(0).map(() => new ItemStack("minecraft:dirt", 64));
  const { e, s } = nuevo(0.5, 30.5, 19);
  ponerFase(e, s, 20);
  correr(10);
  esperar(p.getComponent("minecraft:equippable").getEquipment("Head") === casco, "con el inventario lleno no le cambia el casco");
  // Si el Infinito desaparece a la mitad, nadie queda congelado.
  e.remove();
  correr(3);
  esperar(p.permisos?.[InputPermissionCategory.Movement] === true && !s.cine, "si el Infinito desaparece a la mitad, la cinemática se cierra");
  sacar(p);
  correr(101);
}

// 18) Limpieza final y errores.
{
  correr(1000);
  const quedan = [...W.entries()].filter(([, b]) => ["minecraft:water", "minecraft:lava", "minecraft:obsidian", "minecraft:cobblestone"].includes(b.id));
  // Solo lo suyo (las flechas de los Claudes normales se quedan clavadas como las de un esqueleto).
  const proy = entidades.filter((x) => x.isValid && ["minecraft:arrow", "minecraft:thrown_trident", "minecraft:ender_pearl", "minecraft:ender_crystal", "minecraft:tnt"].includes(x.typeId)
    && (x.dueno?.typeId === INFINITO || x.hasTag("claudenpc_inf_obj") || !x.dueno));
  for (const f of proy) console.log("QUEDA", f.typeId, f.id, f.dueno?.typeId, f.location, f.clavada, f.volando);
  console.log("LIMPIEZA", { bloques: quedan.length, temporales: cuantosTemporales(), proyectiles: proy.map((x) => x.typeId), erroresInf: erroresInf(), erroresMock: errores.slice(0, 5).map((x) => String(x?.stack ?? x).split("\n").slice(0, 3).join(" | ")) });
  // Solo cuentan los bloques que puso él (las obsidianas del sello las puso el jugador y
  // los Claudes normales construyen sus torres).
  const suyos = bloquesPuestos().ultimos.filter((b) => leer(b.x, b.y, b.z).id === b.tipo);
  console.log("BLOQUES SUYOS", { puestos: bloquesPuestos().total, quedan: suyos, otros: quedan.map(([k, b]) => `${k}:${b.id}`) });
  esperar(!suyos.length && cuantosTemporales() === 0, "no quedan agua, lava ni bloques suyos");
  esperar(!proy.length, "no quedan flechas, tridentes, perlas, cristales ni TNT");
  esperar(!erroresInf().length, "sin errores registrados por el Infinito");
  esperar(!errores.length, "sin excepciones en los bucles");
}

console.log(`\n${ok.length} pruebas bien, ${fallas.length} fallas`);
if (fallas.length) { console.log("FALLAS:\n - " + fallas.join("\n - ")); process.exitCode = 1; }
void handlers;
