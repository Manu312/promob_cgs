// Aperturas (como Promob): qué frentes tiene un módulo y cómo se mueven al abrirse.
// El motor marca cada pieza de un frente con `front` (índice) y las puertas con `hinge`.
// El estado abierto/cerrado es de la vista: { open: { [k]: true }, cascade: bool }.

export const DOOR_ANGLE = 100; // grados que gira una puerta abierta

// Frentes del módulo para el diagrama: puertas (con su bisagra) y cajones.
export function frontsOf(built) {
  return (built?.parts || [])
    .filter((p) => p.front != null && (p.name === 'Puerta' || p.name === 'Frente cajón'))
    .map((p) => ({ k: p.front, kind: p.name === 'Puerta' ? 'door' : 'drawer', hinge: p.hinge, x: p.x, y: p.y, w: p.sx, h: p.sy, z: p.z, t: p.sz }))
    .sort((a, b) => a.k - b.k);
}

// Movimiento de cada frente abierto: la puerta gira sobre el canto de la bisagra (afuera);
// el cajón sale con su caja. En cascada, los cajones salen escalonados (los de abajo más).
export function frontTransforms(built, state = {}, depth = 560) {
  const out = new Map();
  const fronts = frontsOf(built);
  const drawers = fronts.filter((f) => f.kind === 'drawer').sort((a, b) => b.y - a.y);
  for (const f of fronts) {
    const open = state.cascade ? f.kind === 'drawer' : state.open?.[f.k];
    if (!open) continue;
    if (f.kind === 'door') {
      const left = f.hinge !== 'der';
      out.set(f.k, { type: 'door', px: left ? f.x : f.x + f.w, pz: f.z + f.t, angle: ((left ? -1 : 1) * DOOR_ANGLE * Math.PI) / 180 });
    } else {
      const rank = drawers.findIndex((d) => d.k === f.k);
      const share = state.cascade ? 0.25 + 0.15 * rank : 0.65;
      out.set(f.k, { type: 'drawer', dz: Math.round(Math.min(depth * share, depth - 60)) });
    }
  }
  return out;
}

// Invertir el lado de la bisagra de una puerta (queda en los parámetros del módulo).
export function invertHinge(mod, built, k) {
  const f = frontsOf(built).find((x) => x.k === k && x.kind === 'door');
  if (!f) return mod;
  return { ...mod, params: { ...mod.params, hinges: { ...(mod.params.hinges || {}), [k]: f.hinge === 'der' ? 'izq' : 'der' } } };
}
