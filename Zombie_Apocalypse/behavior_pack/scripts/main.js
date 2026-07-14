// main.js — punto de entrada del addon Zombie Apocalypse.
//
// Cada sistema vive en su módulo y se inicializa aquí. Todos los bucles usan
// system.runInterval espaciado (10-1200 ticks); NADA corre cada tick.
//
//  desesperacion  → contador 1-99 por jugador, HUD (actionbar), subidas/bajadas
//  spawner        → qué zombie aparece según el nivel, cap global de 40
//  combate        → efectos al golpear, explosión/tótem/kills al morir
//  guia           → el papel "Guía de Supervivencia" + descubrimiento
//  ia/minero      → Minero/Demoledor/Mutante rompen bloques (raycast + lista)
//  ia/constructor → Constructor coloca rampas/puentes marcados y limpiables
//  ia/general     → buffs de área + follow_range extendido vía evento
//  ia/especiales  → Chamán, Invocador, Enderman, Domador
//  ia/watchdog    → anti-atorados: 10 s sin moverse y lejos → despawn
import { initDesesperacion } from "./desesperacion.js";
import { initSpawner } from "./spawner.js";
import { initCombate } from "./combate.js";
import { initGuia } from "./guia.js";
import { initMinero } from "./ia/minero.js";
import { initConstructor } from "./ia/constructor.js";
import { initGeneral } from "./ia/general.js";
import { initEspeciales } from "./ia/especiales.js";
import { initWatchdog } from "./ia/watchdog.js";

initDesesperacion();
initSpawner();
initCombate();
initGuia();
initMinero();
initConstructor();
initGeneral();
initEspeciales();
initWatchdog();

console.log("[Zombie Apocalypse] Scripts cargados.");
