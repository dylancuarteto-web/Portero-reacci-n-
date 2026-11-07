import { now, piso } from "../util.js";
import { PROP_INF } from "./config.js";
import { faseDe } from "./fases.js";
import { resumen } from "./memoria.js";
import { registrarError } from "./rendimiento.js";

// Estado de cada Claude Exponencial Infinito y su guardado en la propiedad dinámica
// "claudenpc:infinito" (determinación, experiencia, estadísticas, lo que recuerda de sus
// rivales, estilo y etapa: derribado o recuperándose sigue así al volver a abrir el mundo).

export const infinitos = new Map(); // id → estado

export function nuevoEstado(e) {
  return {
    e, id: e.id,
    fase: 1, determinacion: 0, experiencia: 0, estadisticas: {}, combate: undefined,
    memoria: new Map(), memoriaGuardada: {},
    estado: "IDLE", estadoDesde: now(), estadoPrevio: "IDLE", transiciones: 0,
    objetivo: undefined, objetivoDesde: 0, aggro: new Map(), provocador: undefined, provocadoEn: -1000,
    arma: undefined, armaPrincipal: "espada", armaDesde: -1000, item: undefined, listoEn: 0,
    escudo: false, escudoArriba: false, escudoHasta: 0, escudoRotoHasta: 0,
    combo: undefined, ultimosCombos: [], seguidasMal: 0,
    cd: {}, proximaDecision: 0, proximoGolpe: 0, ultimoGolpe: -1000, atacar: false,
    mov: { modo: "quieto" }, sprint: false, sprintDesde: 0, lado: 1,
    etapa: "pelea", derribo: undefined, recuperacion: undefined, carga: undefined,
    alturaMax: e.location.y, sinCaidaHasta: 0, ultimoSuelo: undefined,
    actitud: "confiado", frase: "", fraseHasta: 0, nombre: "",
    estilo: undefined, estiloDesde: 0, pose: undefined, tramo: -1, aura: -1, armadura: -2,
    vfx: { seg: 0, n: 0 }, presentacionHasta: 0,
  };
}

export function guardar(s) {
  const e = s.e;
  if (!e?.isValid || s.etapa === "sellado") return;
  let t = 0;
  if (s.etapa === "derribado" && s.derribo) t = now() - s.derribo.t0;
  if (s.etapa === "recuperando" && s.recuperacion) t = now() - s.recuperacion.t0;
  const datos = {
    v: 1, det: Math.round(s.determinacion * 100) / 100, exp: Math.round(s.experiencia), est: s.estadisticas,
    mem: resumen(s), etapa: s.etapa, estilo: s.estilo, t, base: s.derribo?.base ?? s.recuperacion?.base,
  };
  try {
    let txt = JSON.stringify(datos);
    if (txt.length > 30000) txt = JSON.stringify({ ...datos, mem: {} });
    e.setDynamicProperty(PROP_INF, txt);
  } catch (err) {
    registrarError("guardar", err);
  }
}

export function cargar(e, s) {
  let d;
  try {
    const raw = e.getDynamicProperty(PROP_INF);
    if (typeof raw === "string") d = JSON.parse(raw);
  } catch {
    d = undefined;
  }
  if (!d) return false;
  s.determinacion = Math.max(0, Number(d.det) || 0);
  s.fase = faseDe(s.determinacion);
  s.experiencia = Number(d.exp) || 0;
  s.estadisticas = d.est && typeof d.est === "object" ? d.est : {};
  s.memoriaGuardada = d.mem && typeof d.mem === "object" ? d.mem : {};
  s.estilo = typeof d.estilo === "string" ? d.estilo : undefined;
  const base = d.base ?? piso(e.location);
  if (d.etapa === "derribado" || d.etapa === "cargado") {
    // Si lo estaban cargando, queda derribado donde esté (el rescatista se perdió al cerrar).
    s.etapa = "derribado";
    s.derribo = { t0: now() - (d.etapa === "derribado" ? Number(d.t) || 0 : 0), base, rescatistaId: undefined, llamado: false,
      recalcular: d.etapa === "cargado" };
  } else if (d.etapa === "recuperando") {
    s.etapa = "recuperando";
    s.recuperacion = { t0: now() - (Number(d.t) || 0), base };
  }
  return true;
}
