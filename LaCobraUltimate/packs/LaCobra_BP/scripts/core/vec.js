// Utilidades de vectores 3D.

export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const len = (a) => Math.hypot(a.x, a.y, a.z);
export const dist = (a, b) => len(sub(a, b));
export const norm = (a) => {
  const l = len(a);
  return l > 1e-6 ? mul(a, 1 / l) : { x: 0, y: 0, z: 1 };
};
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const flat = (a) => norm({ x: a.x, y: 0, z: a.z });
export const up = (a, h) => ({ x: a.x, y: a.y + h, z: a.z });
export const circlePoint = (c, r, angDeg, h = 0) => {
  const a = (angDeg * Math.PI) / 180;
  return { x: c.x + Math.cos(a) * r, y: c.y + h, z: c.z + Math.sin(a) * r };
};
