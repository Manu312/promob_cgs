// Decore (Promob): objetos de decoración para ambientar y renderizar. Modelos paramétricos
// propios (nada de la biblioteca de Promob): mesas, sillas, banquetas, sofá, plantas, cuadros,
// utensilios y alfombras. No van al despiece; pueden llevar precio al presupuesto.
// Material principal elegible (como "aplicar material al ítem de Decore").

import { box, cyl } from './appliances.js';

export const DECORE_MATERIALS = [
  ['madera', 'Madera clara'], ['madera_osc', 'Madera oscura'], ['blanco', 'Blanco'], ['negro', 'Negro'],
  ['tela_gris', 'Tela gris'], ['tela_beige', 'Tela beige'], ['verde', 'Verde'], ['terracota', 'Terracota'], ['dorado', 'Dorado'], ['inox', 'Metal'],
];

function mesa({ width: W, height: H, depth: D, material: m = 'madera', forma = 'rect' }) {
  const t = 30, leg = 50;
  if (forma === 'redonda') return [cyl(W / 2, H - t, D / 2, W / 2, t, m), cyl(W / 2, 0, D / 2, 40, H - t, m), cyl(W / 2, 0, D / 2, W / 4, 20, m)];
  return [
    box(0, H - t, 0, W, t, D, m),
    ...[[30, 30], [W - 30 - leg, 30], [30, D - 30 - leg], [W - 30 - leg, D - 30 - leg]].map(([x, z]) => box(x, 0, z, leg, H - t, leg, m)),
  ];
}
function silla({ width: W, height: H, depth: D, material: m = 'madera' }) {
  const seat = 450, leg = 35;
  return [
    box(0, seat - 30, 0, W, 30, D, m),
    ...[[0, 0], [W - leg, 0], [0, D - leg], [W - leg, D - leg]].map(([x, z]) => box(x, 0, z, leg, seat - 30, leg, m)),
    box(0, seat, 0, leg, H - seat, leg, m), box(W - leg, seat, 0, leg, H - seat, leg, m),
    box(0, H - 180, 0, W, 160, 25, m),
  ];
}
function banqueta({ width: W, height: H, material: m = 'madera' }) {
  const r = W / 2;
  return [cyl(r, H - 40, r, r, 40, m), ...[[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]].map(([a, b]) => cyl(W * a, 0, W * b, 15, H - 40, 'negro')), box(W * 0.2, 280, W * 0.5 - 10, W * 0.6, 20, 20, 'negro')];
}
function sofa({ width: W, height: H, depth: D, material: m = 'tela_gris' }) {
  const arm = 150, seatH = 420;
  return [
    box(0, 80, 0, W, seatH - 80, D, m), box(0, seatH, 0, W, H - seatH, 200, m), // base y respaldo
    box(0, seatH, 0, arm, 220, D, m), box(W - arm, seatH, 0, arm, 220, D, m), // apoyabrazos
    ...[[40, 40], [W - 80, 40], [40, D - 80], [W - 80, D - 80]].map(([x, z]) => box(x, 0, z, 40, 80, 40, 'negro')),
  ];
}
function planta({ width: W, height: H, material: m = 'terracota' }) {
  const r = W / 2, pot = Math.min(H * 0.35, 350);
  return [
    cyl(r, 0, r, r * 0.7, pot, m),
    cyl(r, pot, r, r, (H - pot) * 0.45, 'verde'), cyl(r, pot + (H - pot) * 0.4, r, r * 0.8, (H - pot) * 0.35, 'verde'), cyl(r, pot + (H - pot) * 0.7, r, r * 0.5, (H - pot) * 0.3, 'verde'),
  ];
}
function cuadro({ width: W, height: H, material: m = 'negro' }) {
  return [box(0, 0, 0, W, H, 25, m), box(40, 40, 25, W - 80, H - 80, 3, 'blanco')];
}
function frutero({ width: W, material: m = 'ceramica' }) {
  const r = W / 2;
  return [cyl(r, 0, r, r * 0.45, 20, m), cyl(r, 20, r, r, 70, m), cyl(r * 0.7, 80, r, 40, 70, 'terracota'), cyl(r * 1.3, 80, r, 40, 70, 'verde'), cyl(r, 90, r * 1.3, 38, 65, 'dorado')];
}
function ollas({ material: m = 'inox' }) {
  return [cyl(130, 0, 130, 120, 140, m), cyl(330, 0, 130, 90, 110, m), cyl(330, 110, 130, 95, 8, 'negro'), cyl(130, 140, 130, 125, 8, 'negro')];
}
function alfombra({ width: W, depth: D, material: m = 'tela_beige' }) {
  return [box(0, 0, 0, W, 8, D, m)];
}

export const DECORE_BUILDERS = { mesa, silla, banqueta, sofa, planta, cuadro, frutero, ollas, alfombra };

// "Aplicar en todos de este tipo": el material elegido pasa a todos los objetos iguales.
export function applyDecoreMaterialToType(project, type, material) {
  return { ...project, modules: project.modules.map((m) => (m.type === type ? { ...m, params: { ...m.params, material } } : m)) };
}
