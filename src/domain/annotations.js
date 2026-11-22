// Cotas manuales (como las del Editor de Paredes de Promob): lineales (2 puntos) y
// angulares (3 puntos: brazo, vértice, brazo). Se guardan en project.annotations.

import { roomWalls } from './room.js';
import { footprint } from './modules.js';
import { rid } from './walls.js';

const rectSegs = (x0, z0, x1, z1) => [[[x0, z0], [x1, z0]], [[x1, z0], [x1, z1]], [[x1, z1], [x0, z1]], [[x0, z1], [x0, z0]]];

// Puntos y aristas a los que se pega el cursor: esquinas y caras de paredes, módulos y columnas.
function snapGeometry(room, modules) {
  const vertices = room.nodes.map((n) => [n.x, n.z]);
  const edges = roomWalls(room).map((g) => [g.a, g.b]);
  const rect = (x0, z0, x1, z1) => {
    vertices.push([x0, z0], [x1, z0], [x1, z1], [x0, z1]);
    edges.push(...rectSegs(x0, z0, x1, z1));
  };
  for (const m of modules) { const { fw, fd } = footprint(m); rect(m.x, m.z, m.x + fw, m.z + fd); }
  for (const c of room.columns || []) rect(c.x, c.z, c.x + c.w, c.z + c.d);
  return { vertices, edges };
}

function projectOnSeg(p, a, b) {
  const ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez;
  const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2)) : 0;
  return [a[0] + ex * t, a[1] + ez * t];
}

export function snapPoint(room, modules, p, { vertexTol = 120, edgeTol = 80, grid = 10 } = {}) {
  const { vertices, edges } = snapGeometry(room, modules);
  const dist = (q) => Math.hypot(q[0] - p[0], q[1] - p[1]);
  const round = (q) => q.map((v) => Math.round(v) + 0);
  let best = null;
  for (const v of vertices) if (dist(v) <= vertexTol && (!best || dist(v) < dist(best))) best = v;
  if (best) return { point: round(best), kind: 'vertex' };
  for (const [a, b] of edges) { const q = projectOnSeg(p, a, b); if (dist(q) <= edgeTol && (!best || dist(q) < dist(best))) best = q; }
  if (best) return { point: round(best), kind: 'edge' };
  return { point: p.map((v) => Math.round(v / grid) * grid + 0), kind: 'free' };
}

// Lineal: distancia en mm. Angular: ángulo en el punto del medio, en grados (0–180, a 0,1°).
export function annotationValue(a) {
  const [p0, p1, p2] = a.points;
  if (a.kind === 'lin') return Math.round(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]));
  const u = [p0[0] - p1[0], p0[1] - p1[1]], v = [p2[0] - p1[0], p2[1] - p1[1]];
  const c = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
  return Math.round((Math.acos(Math.max(-1, Math.min(1, c))) * 1800) / Math.PI) / 10;
}

export const addAnnotation = (project, kind, points) => ({ ...project, annotations: [...(project.annotations || []), { id: rid('a'), kind, points }] });
export const removeAnnotation = (project, id) => ({ ...project, annotations: (project.annotations || []).filter((a) => a.id !== id) });
