import { now } from "../util.js";
import { ANIM_INF, POSE_INF } from "./config.js";

// AnimationController: poses que se sostienen (guardia, observar, cubrirse, derrota,
// cargado, recuperar) en un controlador con nombre, y gestos sueltos (golpe rápido,
// pesado, crítico, esquiva, cambio de arma, finta, victoria, evolución...).

const POSES = {
  ninguna: "animation.claudenpc.infinito.pose_ninguna",
  guardia: "animation.claudenpc.infinito.pose_guardia",
  observar: "animation.claudenpc.infinito.pose_observar",
  cubrirse: "animation.claudenpc.infinito.pose_cubrirse",
  derrota: "animation.claudenpc.infinito.pose_derrota",
  cargado: "animation.claudenpc.infinito.pose_cargado",
  recuperar: "animation.claudenpc.infinito.pose_recuperar",
};

export function pose(e, s, nombre) {
  if (s.pose === nombre || !POSES[nombre]) return;
  s.pose = nombre;
  try {
    e.playAnimation(POSES[nombre], { controller: POSE_INF, blendOutTime: 0.3 });
  } catch {
    // Paquete de recursos no activo.
  }
}

// Un gesto (como mucho uno cada 3 ticks, salvo "forzar").
export function gesto(e, s, nombre, forzar = false) {
  const id = ANIM_INF[nombre];
  if (!id) return;
  if (!forzar && now() - (s.cd.gesto ?? -100) < 3) return;
  s.cd.gesto = now();
  try {
    e.playAnimation(id, { blendOutTime: 0.15 });
  } catch {
    // Paquete de recursos no activo.
  }
}

// Gesto del golpe según el arma y el tipo de golpe.
const POR_ARMA = {
  espada: ["espadazo", "espadazo2", "estocada"],
  hacha: ["hachazo", "pesado"],
  maza: ["pesado"],
  tridente: ["estocada"],
  mano: ["rapido"],
};

export function gestoGolpe(e, s, tipo) {
  if (tipo === "critico") return gesto(e, s, "critico", true);
  if (tipo === "pesado") return gesto(e, s, s.arma === "espada" ? "pesado" : "hachazo", true);
  if (tipo === "rapido") return gesto(e, s, "rapido", true);
  const lista = POR_ARMA[s.arma] ?? POR_ARMA.mano;
  s.golpeAnim = ((s.golpeAnim ?? -1) + 1) % lista.length;
  gesto(e, s, lista[s.golpeAnim], true);
}

// Pose de combate según el estado (la llama el cerebro al cambiar de estado).
export function poseDeEstado(e, s) {
  if (s.escudoArriba) return pose(e, s, "cubrirse");
  switch (s.estado) {
    case "OBSERVING":
    case "ADAPTING":
      return pose(e, s, "observar");
    case "IDLE":
      return pose(e, s, "ninguna");
    default:
      return pose(e, s, s.fase >= 6 ? "guardia" : "ninguna");
  }
}
