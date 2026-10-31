import { system } from "@minecraft/server";
import { ANIM, PARTICLES } from "../../config.js";
import { animate, particleAt, sound, soundAt } from "../../util.js";
import { anunciar, avisarJugador, danar, empujar, estallido, lerp, objetivos, sueloEn } from "../comun.js";

// Estrella fugaz: sube brillando, cae en picada donde estabas y del impacto salen dos
// ondas de luz por el suelo. Quien esté pisando el suelo cuando pase la onda, sale
// volando: hay que saltarla.
export const ola = {
  id: "ola",
  nombre: "Estrella fugaz",
  cd: 420,
  peso: () => 1.1,
  si: (c) => c.dist < 22 && c.cielo,
  usar(g, jugador) {
    const e = g.entidad;
    const dim = e.dimension;
    const inicio = { ...e.location };
    const arriba = { x: inicio.x, y: inicio.y + 9, z: inicio.z };
    anunciar(g, "Estrella fugaz", "§6");
    sound(e, "beacon.power", 1.4);
    g.vueloPropio = true;
    let destino;
    const anillos = [];
    let t = 0;
    const id = system.runInterval(() => {
      t++;
      try {
        if (!e.isValid) {
          system.clearRun(id);
          return;
        }
        if (t <= 16) {
          e.teleport(lerp(inicio, arriba, t / 16), { facingLocation: jugador.isValid ? jugador.location : arriba });
          if (t % 3 === 0) particleAt(dim, PARTICLES.auraDorada, e.location);
          return;
        }
        if (t === 17) {
          destino = (jugador.isValid && sueloEn(dim, jugador.location.x, jugador.location.z, jugador.location.y)) || { ...inicio };
          animate(e, ANIM.goldenPicada);
          sound(e, "firework.launch", 0.7);
          if (jugador.isValid) avisarJugador(jugador, "§e¡Salta cuando llegue la onda!");
        }
        if (t <= 25) {
          const k = (t - 16) / 9;
          e.teleport(lerp(arriba, { x: destino.x, y: destino.y + 0.3, z: destino.z }, k * k), { facingLocation: destino });
          particleAt(dim, PARTICLES.cohete, e.location);
          return;
        }
        if (t === 26 || t === 36) {
          if (t === 26) {
            estallido(dim, { x: destino.x, y: destino.y + 0.5, z: destino.z });
            soundAt(dim, destino, "random.explode", 0.9, 0.9);
            g.vueloPropio = false; // vuelve a volar mientras las ondas avanzan
          }
          anillos.push({ r: 0.6, golpeados: new Set() });
        }
        for (const a of anillos) {
          a.r += 0.5;
          if (a.r > 13) continue;
          for (let i = 0; i < 14; i++) {
            const ang = (i / 14) * Math.PI * 2 + t * 0.07;
            particleAt(dim, PARTICLES.ondaChispa, { x: destino.x + Math.cos(ang) * a.r, y: destino.y + 0.2, z: destino.z + Math.sin(ang) * a.r });
          }
          for (const j of objetivos(dim, destino, a.r + 1)) {
            if (a.golpeados.has(j.id)) continue;
            const d = Math.hypot(j.location.x - destino.x, j.location.z - destino.z);
            if (d < a.r - 0.8 || d > a.r + 0.4 || Math.abs(j.location.y - destino.y) > 1.5 || !j.isOnGround) continue;
            a.golpeados.add(j.id);
            danar(j, g.fase === 2 ? 7 : 6, e);
            empujar(j, destino, 0.6, 0.55);
          }
        }
        if (t > 64) system.clearRun(id);
      } catch {
        g.vueloPropio = false;
        system.clearRun(id);
      }
    }, 1);
    return 70;
  },
};
