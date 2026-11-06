import { GameMode, system } from "@minecraft/server";
import { GOLDEN_FINAL, SONIDO } from "../../../config.js";
import { now, soundAt } from "../../../util.js";
import { danar } from "../../comun.js";
import { limitar } from "../arena.js";
import { cortar, particula, pose, sonar, titulo, todosLosJugadores, vivos, yawHacia } from "../comun.js";
import { avisoExcl, cargar, hacia, laser, medir, tajos } from "../laser.js";
import { alcanza, avisar, columna, espada } from "./espadas.js";

// Poderes nuevos de la v9.0 (todos con láseres de energía, ideas propias):
//   - MIRAS: de sus dos espadas salen miras láser finas que te siguen; cuando una se FIJA (se
//     pone blanca y hace "clic") tienes un instante para salirte de la línea antes del disparo.
//     Cinco disparos alternando espadas; el último es morado y enorme.
//   - RELOJ DE SOL: vuela al centro y un láser a ras del suelo gira como la aguja de un reloj:
//     hay que SALTARLO cuando pasa. Después vienen dos agujas moradas, al revés y más rápido.
//   - PRISMA: tres prismas dorados flotan sobre la arena. Golden dispara a uno, el prisma reparte
//     la energía y los otros dos disparan: uno AMARILLO donde estás (daña si te quedas quieto) y
//     uno AZUL donde vas a estar (daña si te mueves). Hay que pensar rápido.
//   - SINFONÍA: dirige con las espadas como un director de orquesta; vallas de láser cruzan la
//     arena una tras otra, cada una con un hueco en otro lugar. Las amarillas no te dañan si te
//     mueves, las azules no te dañan si estás quieto y las moradas solo se pasan por el hueco.
//   - ÚLTIMO ALIENTO: con muy poca vida (después del parkour) grita, sube al techo y durante
//     10 segundos llueven láseres que te siguen y aspas que giran; al final cae agotado, de
//     rodillas, y recibe el doble de daño un rato: es tu oportunidad.

function jugadoresDe(g) {
  const ids = g.final?.jugadores ?? new Set();
  return todosLosJugadores().filter((p) => ids.has(p.id));
}

function enJuego(p) {
  try {
    const m = p.getGameMode();
    return p.isValid && m !== GameMode.Spectator && m !== GameMode.Creative;
  } catch {
    return false;
  }
}

function centro(f, alto = 0) {
  const c = f.arena?.centro ?? f.suelo ?? { x: 0, y: 0, z: 0 };
  return { x: Math.floor(c.x) + 0.5, y: Math.floor(c.y) + alto, z: Math.floor(c.z) + 0.5 };
}

function radio(f) {
  return (f.arena?.R ?? GOLDEN_FINAL.arenaRadio) - 1.5;
}

function pecho(p) {
  return { x: p.location.x, y: p.location.y + 1.1, z: p.location.z };
}

function normal(a) {
  return ((a % 360) + 360) % 360;
}

// Vuela de donde está a "destino" en "ticks" (mirando a "mira").
function volar(e, desde, destino, k, mira) {
  const p = { x: desde.x + (destino.x - desde.x) * k, y: desde.y + (destino.y - desde.y) * k, z: desde.z + (destino.z - desde.z) * k };
  try {
    e.teleport(p, { rotation: { x: 0, y: mira ? yawHacia(p, mira) : e.getRotation().y }, keepVelocity: false });
  } catch {
    // Descargado.
  }
}

// =============================================================================
// Miras
// =============================================================================

export const miras = {
  id: "miras",
  cd: 420,
  si: (c) => c.espadas,
  peso: (_c) => 3,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    const DISPAROS = 5;
    const dura = 12 + DISPAROS * 16 + 14;
    g.quietoHasta = now() + dura;
    pose(g, 12);
    const tiros = [];
    for (let k = 0; k < DISPAROS; k++) {
      tiros.push({ lado: k % 2 === 0 ? 1 : 2, inicio: 12 + k * 16, final: k === DISPAROS - 1 });
    }
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea" || !j.isValid) return system.clearRun(id);
        try {
          e.teleport(e.location, { rotation: { x: 0, y: yawHacia(e.location, j.location) }, keepVelocity: false });
        } catch {
          // Sin giro.
        }
        for (const s of tiros) {
          const punta = espada(g, s.lado);
          const color = s.final ? "morado" : "oro";
          // Mira que sigue al jugador (10 ticks).
          if (t >= s.inicio && t < s.inicio + 10 && t % 2 === 0) {
            if (t === s.inicio) cargar(dim, punta, color);
            laser(dim, punta, pecho(j), { color: "oro", grosor: 0, vida: 2, motas: false, sonido: false });
          }
          // Se fija: la línea queda quieta, se pone blanca y hace "clic" (8 ticks para salirse).
          if (t === s.inicio + 10) {
            const m = medir(punta, pecho(j));
            s.desde = punta;
            s.hasta = hacia(punta, m.yaw, m.pitch, Math.min(40, m.largo + 12));
            soundAt(dim, punta, "random.click", 1.8, 1);
            for (const p of jugadoresDe(g)) {
              try {
                p.playSound("note.pling", { pitch: 2, volume: 0.8 });
              } catch {
                // Sin sonido.
              }
            }
            avisoExcl(dim, j.location, color, t);
          }
          if (s.hasta && t > s.inicio + 10 && t < s.inicio + 18 && t % 2 === 0) {
            laser(dim, s.desde, s.hasta, { color, grosor: 0, vida: 2, motas: false, sonido: false });
          }
          // ¡Disparo! (con el corte de esa espada)
          if (t === s.inicio + 18 && s.hasta) {
            cortar(e, s.lado);
            laser(dim, s.desde, s.hasta, {
              color, grosor: s.final ? 3 : 2, vida: s.final ? 12 : 8, impacto: true,
              golpe: { golden: e, dano: s.final ? GOLDEN_FINAL.danoMorado + 3 : GOLDEN_FINAL.danoRayo, activo: 3 },
            });
            if (s.final) sonar(jugadoresDe(g), SONIDO.rayoMorado, 1, 1);
          }
        }
        if (t >= dura) system.clearRun(id);
      } catch {
        system.clearRun(id);
      }
    }, 1);
    system.runTimeout(() => e.isValid && pose(g, 0), dura);
    return dura;
  },
};

// =============================================================================
// Reloj de sol
// =============================================================================

// ¿La aguja (de "a0" a "a1" grados, a ras del suelo) pasó por este jugador sin que saltara?
// "despeje": a qué altura tienen que estar sus pies para pasarla por encima.
function cruzaAguja(p, c, a0, a1, despeje, r) {
  const dx = p.location.x - c.x;
  const dz = p.location.z - c.z;
  const d = Math.hypot(dx, dz);
  if (d > r + 0.5) return false;
  const pies = p.location.y - c.y;
  if (pies > despeje || pies < -1) return false; // saltó por encima (o está abajo)
  const ang = normal((Math.atan2(-dx, dz) * 180) / Math.PI);
  const extra = d < 0.6 ? 180 : (Math.atan2(0.45, d) * 180) / Math.PI;
  const desde = normal(Math.min(a0, a1) - extra);
  const ancho = Math.abs(a1 - a0) + extra * 2;
  return normal(ang - desde) <= ancho;
}

export const relojSol = {
  id: "reloj_sol",
  cd: 640,
  si: (c) => c.espadas && c.vida <= 760,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    const c = centro(f);
    const R = radio(f);
    const arriba = centro(f, 3);
    const inicio = { ...e.location };
    const ALTO = 0.45; // altura de la aguja (hay que saltarla)
    const DESPEJE = 0.75; // con los pies más arriba que esto, pasa por debajo
    const a0 = yawHacia(c, j.location) + 150;
    const dura = 190;
    g.vueloPropio = true;
    g.quietoHasta = now() + dura;
    pose(g, 12);
    const heridos = [new Set(), new Set()];
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea") return fin();
        const jug = jugadoresDe(g).filter(enJuego);
        if (t <= 16) volar(e, inicio, arriba, t / 16, j.isValid ? j.location : undefined);
        else if (t < dura - 14) volar(e, arriba, arriba, 1, j.isValid ? j.location : undefined);
        else volar(e, arriba, inicio, (t - (dura - 14)) / 14);
        // Aviso: la aguja aparece fina donde va a empezar y un "!" sobre cada jugador.
        if (t >= 16 && t < 36 && t % 3 === 0) {
          laser(dim, { x: c.x, y: c.y + ALTO, z: c.z }, hacia({ x: c.x, y: c.y + ALTO, z: c.z }, a0, 0, R),
            { color: "oro", grosor: 0, vida: 3, motas: false, sonido: false });
          for (const p of jug) avisoExcl(dim, p.location, "oro", t);
        }
        if (t === 20) {
          cargar(dim, arriba, "oro", jug);
          titulo(jug, " ", "§6¡Salta la aguja!", 0, 30, 6);
        }
        // Primera vuelta: una aguja dorada, 6° por tick (3 segundos).
        if (t >= 36 && t < 96) {
          const a = a0 + (t - 36) * 6;
          aguja(a, a - 6, "oro", 0, jug, t % 10 === 0);
        }
        if (t === 100) {
          cargar(dim, arriba, "morado", jug);
          cortar(e, 0, 1);
        }
        // Segunda: dos agujas moradas opuestas, al revés y más rápido.
        if (t >= 110 && t < 170) {
          const a = a0 + 90 - (t - 110) * 7.5;
          aguja(a, a + 7.5, "morado", 1, jug, t % 8 === 0);
          aguja(a + 180, a + 187.5, "morado", 1, jug, false);
        }
        if (t >= dura) fin();
      } catch {
        fin();
      }
    }, 1);
    function aguja(a, previo, color, vuelta, jug, sonido) {
      const base = { x: c.x, y: c.y + ALTO, z: c.z };
      laser(dim, base, hacia(base, a, 0, R), { color, grosor: 2, vida: 2, motas: t % 3 === 0, sonido });
      for (const p of jug) {
        if (heridos[vuelta].has(p.id) || !cruzaAguja(p, c, previo, a, DESPEJE, R)) continue;
        heridos[vuelta].add(p.id);
        danar(p, color === "morado" ? GOLDEN_FINAL.danoMorado : GOLDEN_FINAL.danoRayo, e);
        particula(dim, `claudenpc:laser_chispas_${color}`, pecho(p));
        soundAt(dim, p.location, "random.fizz", 1.6, 0.7);
      }
    }
    function fin() {
      system.clearRun(id);
      g.vueloPropio = false;
      if (e.isValid) pose(g, 0);
    }
    return dura;
  },
};

// =============================================================================
// Prisma
// =============================================================================

export const prisma = {
  id: "prisma",
  cd: 560,
  si: (c) => c.espadas,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    const c = centro(f);
    const a0 = Math.random() * 360;
    const prismas = [0, 120, 240].map((d) => hacia({ x: c.x, y: c.y + 8, z: c.z }, a0 + d, 0, 9));
    const RONDAS = 3;
    const dura = 22 + RONDAS * 32 + 6;
    g.quietoHasta = now() + dura;
    pose(g, 12);
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea" || !j.isValid) return system.clearRun(id);
        // Los prismas brillan mientras dura.
        if (t % 3 === 0) for (const p of prismas) particula(dim, "claudenpc:laser_estrella_oro", p);
        if (t === 2) {
          for (const p of prismas) particula(dim, "claudenpc:laser_destello_oro", p);
          soundAt(dim, c, "beacon.activate", 1.6, 1);
        }
        for (let k = 0; k < RONDAS; k++) {
          const t0 = 22 + k * 32;
          const P = prismas[k % 3];
          const Q = prismas[(k + 1) % 3];
          const S = prismas[(k + 2) % 3];
          if (t === t0) {
            // Donde estás (amarillo) y donde vas a estar (azul).
            const v = j.getVelocity();
            const aqui = { x: j.location.x, y: j.location.y, z: j.location.z };
            const luego = limitar(f.arena, { x: aqui.x + v.x * 16, y: aqui.y, z: aqui.z + v.z * 16 }, 2);
            if (Math.hypot(luego.x - aqui.x, luego.z - aqui.z) < 1.5) {
              const a = Math.random() * Math.PI * 2;
              luego.x = aqui.x + Math.cos(a) * 3;
              luego.z = aqui.z + Math.sin(a) * 3;
            }
            f.prismaBlancos = [{ l: aqui, color: "amarillo" }, { l: luego, color: "azul" }];
          }
          const blancos = f.prismaBlancos ?? [];
          if (t >= t0 && t < t0 + 20 && t % 4 === 0) for (const b of blancos) avisar(dim, [b.l], b.color, t);
          if (t === t0 + 12) {
            cortar(e, k % 2 === 0 ? 1 : 2);
            laser(dim, espada(g, k % 2 === 0 ? 1 : 2), P, { color: "oro", grosor: 2, vida: 8, impacto: true });
          }
          if (t === t0 + 15) {
            particula(dim, "claudenpc:laser_destello_oro", P);
            laser(dim, P, Q, { color: "amarillo", grosor: 1, vida: 6, sonido: false });
            laser(dim, P, S, { color: "azul", grosor: 1, vida: 6, sonido: false });
          }
          if (t === t0 + 20) {
            const [b1, b2] = blancos;
            if (b1) disparo(Q, b1);
            if (b2) disparo(S, b2);
          }
        }
        if (t >= dura) system.clearRun(id);
      } catch {
        system.clearRun(id);
      }
    }, 1);
    function disparo(desde, b) {
      const m = medir(desde, b.l);
      laser(dim, desde, hacia(desde, m.yaw, m.pitch, m.largo + 1), { color: b.color, grosor: 2, vida: 9, impacto: true });
      particula(dim, `claudenpc:laser_impacto_${b.color}`, { x: b.l.x, y: b.l.y + 0.08, z: b.l.z });
      for (const p of jugadoresDe(g).filter(enJuego)) {
        if (Math.hypot(p.location.x - b.l.x, p.location.z - b.l.z) > 1.8 || Math.abs(p.location.y - b.l.y) > 2.5) continue;
        if (!alcanza(b.color, p)) continue;
        danar(p, GOLDEN_FINAL.danoRayo, e);
        particula(dim, `claudenpc:laser_chispas_${b.color}`, pecho(p));
      }
    }
    return dura;
  },
};

// =============================================================================
// Sinfonía de vallas
// =============================================================================

export const sinfonia = {
  id: "sinfonia",
  cd: 720,
  si: (c) => c.espadas && c.vida <= 640,
  peso: (_c) => 2,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    const c = centro(f);
    const R = radio(f);
    // Las vallas cruzan desde el lado de Golden hacia el otro lado.
    const yaw = yawHacia(e.location, j.location);
    const u = { x: -Math.sin((yaw * Math.PI) / 180), z: Math.cos((yaw * Math.PI) / 180) }; // avance
    const w = { x: -u.z, z: u.x }; // a lo ancho
    const colores = ["amarillo", "azul", "morado", "morado", "amarillo", "azul"];
    const VALLAS = colores.length;
    const ENTRE = 16; // ticks entre vallas
    const PASO = 2; // bloques por paso (cada 2 ticks)
    const dura = 20 + (VALLAS - 1) * ENTRE + Math.ceil((2 * R) / PASO) * 2 + 10;
    g.quietoHasta = now() + dura;
    pose(g, 12);
    const vallas = colores.map((color, i) => {
      // El hueco: 3,5 bloques, cerca de donde estás (para que tengas que buscarlo).
      const lat = (j.location.x - c.x) * w.x + (j.location.z - c.z) * w.z;
      const hueco = Math.max(-R + 3, Math.min(R - 6.5, lat - 1.75 + (Math.random() - 0.5) * 12));
      return { color, inicio: 20 + i * ENTRE, hueco, s: -R, heridos: new Set() };
    });
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea") return system.clearRun(id);
        // Dirige: un corte por compás y una nota.
        if (t % 8 === 0 && t < dura - 10) {
          cortar(e, (t / 8) % 3 === 0 ? 0 : (t / 8) % 2 === 0 ? 1 : 2);
          const nota = [0.7, 0.84, 0.94, 1.05, 1.26, 1.4][(t / 8) % 6];
          for (const p of jugadoresDe(g)) {
            try {
              p.playSound("note.bell", { pitch: nota, volume: 0.6 });
            } catch {
              // Sin sonido.
            }
          }
        }
        const jug = jugadoresDe(g).filter(enJuego);
        for (const v of vallas) {
          if (t < v.inicio || v.s > R) continue;
          if (t === v.inicio) cargar(dim, espada(g, 1), v.color);
          if ((t - v.inicio) % 2 !== 0) continue;
          const s0 = v.s;
          v.s += PASO;
          valla(v, v.s);
          // ¿Pasó por algún jugador fuera del hueco?
          for (const p of jug) {
            if (v.heridos.has(p.id)) continue;
            const du = (p.location.x - c.x) * u.x + (p.location.z - c.z) * u.z;
            const dw = (p.location.x - c.x) * w.x + (p.location.z - c.z) * w.z;
            if (du < s0 - 0.6 || du > v.s + 0.6) continue;
            if (dw >= v.hueco && dw <= v.hueco + 3.5) continue; // en el hueco
            if (Math.abs(p.location.y - c.y) > 2.2) continue;
            if (!alcanza(v.color, p)) continue;
            v.heridos.add(p.id);
            danar(p, v.color === "morado" ? GOLDEN_FINAL.danoMorado : GOLDEN_FINAL.danoRayo, e);
            particula(dim, `claudenpc:laser_chispas_${v.color}`, pecho(p));
          }
        }
        if (t >= dura) system.clearRun(id);
      } catch {
        system.clearRun(id);
      }
    }, 1);
    // Una valla: dos tramos de láser a 0,9 bloques del suelo, con el hueco entre ellos.
    function valla(v, s) {
      const ancho = Math.sqrt(Math.max(0, R * R - s * s));
      if (ancho < 1) return;
      const en = (lat) => ({ x: c.x + u.x * s + w.x * lat, y: c.y + 0.9, z: c.z + u.z * s + w.z * lat });
      // Grosor enorme: cubre de 0,2 a 1,6 bloques (no se salta).
      if (v.hueco > -ancho) laser(dim, en(-ancho), en(Math.min(v.hueco, ancho)), { color: v.color, grosor: 3, vida: 1, motas: false, sonido: false });
      if (v.hueco + 3.5 < ancho) laser(dim, en(ancho), en(Math.max(v.hueco + 3.5, -ancho)), { color: v.color, grosor: 3, vida: 1, motas: false, sonido: false });
      if (Math.round(s) % 6 === 0) soundAt(dim, en(0), SONIDO.laserDisparo, 1.3, 0.4);
    }
    return dura;
  },
};

// =============================================================================
// Último aliento
// =============================================================================

export const ultimoAliento = {
  id: "ultimo_aliento",
  cd: 999999,
  si: (c) => c.parkour && !c.ultimo && c.vida <= 150,
  peso: (_c) => 1000,
  usar(g, j) {
    const e = g.entidad;
    const dim = e.dimension;
    const f = g.final;
    f.ultimoAliento = true;
    const c = centro(f);
    const R = radio(f);
    const techo = centro(f, 9);
    const inicio = { ...e.location };
    const dura = 260;
    g.vueloPropio = true;
    g.quietoHasta = now() + dura;
    const todos = vivos(jugadoresDe(g));
    titulo(todos, "§6§l¡TODAVÍA NO!", "§e§olas cinco mentes arden", 4, 40, 10);
    sonar(todos, "mob.wither.spawn", 1.2, 0.7);
    pose(g, 7);
    const marcas = [];
    const aspas = new Map(); // jugador → tick hasta el que no lo vuelven a dañar
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid || f.etapa !== "pelea") return fin();
        const jug = jugadoresDe(g).filter(enJuego);
        const obj = jug[0];
        if (t <= 24) volar(e, inicio, techo, t / 24, obj?.location);
        else if (t < 232) volar(e, techo, { x: techo.x, y: techo.y + Math.sin(t / 6) * 0.3, z: techo.z }, 1, obj?.location);
        else volar(e, techo, { x: c.x, y: c.y + 0.1, z: c.z }, Math.min(1, (t - 232) / 18), obj?.location);
        if (t === 26) pose(g, 12);
        // Lluvia de láseres que te siguen: cada 8 ticks marca dónde vas a estar y 12 ticks
        // después cae una columna (amarillo, azul y morado, por turnos).
        if (t >= 30 && t < 220 && t % 8 === 0) {
          for (const p of jug) {
            const v = p.getVelocity();
            const l = limitar(f.arena, { x: p.location.x + v.x * 10, y: p.location.y, z: p.location.z + v.z * 10 }, 2);
            marcas.push({ l, color: ["amarillo", "azul", "morado"][(t / 8) % 3], cae: t + 12 });
          }
        }
        for (const m of marcas) {
          if (t < m.cae && (m.cae - t) % 4 === 0) avisar(dim, [m.l], m.color, t);
          if (t === m.cae) columna(dim, m.l, m.color, e, true, { alto: 9, grosor: 2 });
        }
        while (marcas.length && marcas[0].cae < t) marcas.shift();
        // Cada 40 ticks, un abanico de láseres desde lo alto (adorno).
        if (t >= 40 && t < 220 && t % 40 === 0) {
          cortar(e, 0);
          tajos(g, 0, ["amarillo", "azul"], { largo: 18, pasos: 4 });
        }
        // Segunda mitad: aspas que giran a ras del suelo (hay que saltarlas).
        if (t >= 130 && t < 220) {
          const a = (t - 130) * 4;
          const base = { x: c.x, y: c.y + 0.45, z: c.z };
          for (const d of [0, 180]) {
            laser(dim, base, hacia(base, a + d, 0, R), { color: "oro", grosor: 2, vida: 2, motas: false, sonido: t % 10 === 0 && d === 0 });
          }
          for (const p of jug) {
            if (t < (aspas.get(p.id) ?? 0)) continue;
            if (cruzaAguja(p, c, a - 4, a, 0.75, R) || cruzaAguja(p, c, a + 176, a + 180, 0.75, R)) {
              aspas.set(p.id, t + 20);
              danar(p, GOLDEN_FINAL.danoRayo, e);
              particula(dim, "claudenpc:laser_chispas_oro", pecho(p));
            }
          }
        }
        if (t === 226) titulo(jug, " ", "§e¡Está agotado! ¡Ahora!", 0, 40, 10);
        if (t >= 250) {
          pose(g, 2); // de rodillas
          g.aturdidoHasta = now() + 200; // recibe el doble de daño un rato
        }
        if (t >= dura) fin();
      } catch {
        fin();
      }
    }, 1);
    function fin() {
      system.clearRun(id);
      g.vueloPropio = false;
      system.runTimeout(() => e.isValid && g.final?.etapa === "pelea" && pose(g, 0), 200);
    }
    return dura + 40;
  },
};
