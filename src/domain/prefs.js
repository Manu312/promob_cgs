// Preferencias (Promob): fondo del visor, relleno por defecto, paredes y piso de los proyectos
// nuevos, paso de las flechas del teclado, luz del visor y altura del rebaje de paredes.
// Se guardan para todos los proyectos (no en el proyecto).

export const DEFAULT_PREFS = { bg: '#f3f4f6', fill: 'texturas', wallT: 150, wallH: 2600, floorMat: '', arrowStep: 10, light: 1, lowerH: 100 };

export function prefsOf(ui = {}) {
  const p = { ...DEFAULT_PREFS, ...(ui.prefs || {}) };
  const n = (v, d, a, b) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : d);
  return {
    ...p,
    bg: /^#[0-9a-f]{6}$/i.test(p.bg) ? p.bg : DEFAULT_PREFS.bg,
    wallT: n(p.wallT, 150, 50, 600), wallH: n(p.wallH, 2600, 1000, 6000), arrowStep: n(p.arrowStep, 10, 1, 500),
    light: n(p.light, 1, 0.2, 3), lowerH: n(p.lowerH, 100, 0, 1500),
  };
}

// Un proyecto nuevo con las preferencias: espesor y alto de paredes, piso y rebaje.
export function applyPrefsToNewProject(project, prefs) {
  const room = { ...project.room, t: prefs.wallT, h: prefs.wallH, lowerH: prefs.lowerH, walls: project.room.walls.map((w) => ({ ...w, t: prefs.wallT, h0: prefs.wallH, h1: prefs.wallH })) };
  if (prefs.floorMat) room.finishes = { ...(room.finishes || {}), floor: { mat: prefs.floorMat, scaleX: 1, scaleY: 1, rot: 0 } };
  return { ...project, room };
}
