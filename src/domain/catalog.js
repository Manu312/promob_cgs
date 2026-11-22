// Catálogo de materiales, herrajes y precios por defecto.
// PRECIOS DE EJEMPLO: reemplazarlos por la lista real en la pestaña "Precios".

export const DEFAULT_MATERIALS = [
  { id: 'mel18_blanco', name: 'Melamina 18mm Blanco', t: 18, L: 2600, W: 1830, color: '#f1f0eb', wood: false, edge: true, price: 85000 },
  { id: 'mel18_gris', name: 'Melamina 18mm Gris Grafito', t: 18, L: 2600, W: 1830, color: '#4b4e53', wood: false, edge: true, price: 98000 },
  { id: 'mel18_negro', name: 'Melamina 18mm Negro', t: 18, L: 2600, W: 1830, color: '#222222', wood: false, edge: true, price: 98000 },
  { id: 'mel18_roble', name: 'Melamina 18mm Roble', t: 18, L: 2600, W: 1830, color: '#b98b5c', wood: true, edge: true, price: 105000 },
  { id: 'mel18_nogal', name: 'Melamina 18mm Nogal', t: 18, L: 2600, W: 1830, color: '#6e4b33', wood: true, edge: true, price: 105000 },
  { id: 'fibro3_blanco', name: 'Fibrofácil 3mm Blanco (fondos)', t: 3, L: 2600, W: 1830, color: '#ecebe6', wood: false, edge: false, price: 18000 },
];

export const DEFAULT_HARDWARE = [
  { code: 'bisagra', name: 'Bisagra cazoleta 35mm cierre suave', unit: 'u', price: 3500 },
  { code: 'corredera', name: 'Par correderas telescópicas', unit: 'par', price: 12000 },
  { code: 'manija', name: 'Manija 128mm', unit: 'u', price: 2500 },
  { code: 'pata', name: 'Pata regulable', unit: 'u', price: 900 },
  { code: 'barral', name: 'Barral oval + soportes', unit: 'm', price: 6000 },
  { code: 'soporte_estante', name: 'Soporte de estante', unit: 'u', price: 80 },
  { code: 'kit_corrediza', name: 'Kit puerta corrediza (por hoja)', unit: 'u', price: 25000 },
  { code: 'kit_armado', name: 'Kit armado por módulo (minifix, tarugos, tornillos)', unit: 'u', price: 4000 },
  { code: 'mesada', name: 'Mesada (granito / cuarzo)', unit: 'm²', price: 150000 },
  { code: 'bacha', name: 'Bacha de acero inoxidable', unit: 'u', price: 85000 },
];

export const DEFAULT_SETTINGS = {
  materials: DEFAULT_MATERIALS,
  hardware: DEFAULT_HARDWARE,
  edgePerM: 600, // $ por metro de tapacanto
  edgeWaste: 0.1, // 10% desperdicio de tapacanto
  laborPct: 40, // mano de obra % sobre materiales
  marginPct: 30, // margen %
  ivaPct: 0,
  kerf: 4, // espesor de sierra (mm)
  trim: 10, // refilado por lado (mm)
};

export function mergeSettings(s) {
  const base = { ...DEFAULT_SETTINGS, ...(s || {}) };
  if (!Array.isArray(base.materials) || base.materials.length === 0) base.materials = DEFAULT_MATERIALS;
  const hw = Array.isArray(base.hardware) ? [...base.hardware] : [];
  for (const d of DEFAULT_HARDWARE) if (!hw.find((h) => h.code === d.code)) hw.push(d);
  base.hardware = hw;
  return base;
}

export function matById(settings, id) {
  return settings.materials.find((m) => m.id === id) || settings.materials[0];
}
