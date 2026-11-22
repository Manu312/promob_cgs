// Catálogo de materiales, herrajes y precios por defecto.
// PRECIOS DE EJEMPLO: reemplazarlos por la lista real en la pestaña "Precios".

// Biblioteca de materiales (como la de Promob): cada uno con su ruta (`path`) y su tipo.
// 'placa': se corta (espesor, medidas y precio por placa). 'piedra': tapas y mesadas
// (precio por m², color base + color del grano; textura procedural propia).
const placa = (id, path, name, color, price, extra = {}) => ({ id, kind: 'placa', path, name, t: 18, L: 2600, W: 1830, color, wood: false, edge: true, price, ...extra });
const piedra = (id, path, color, grain, pattern, priceM2) => ({ id, kind: 'piedra', path, name: path.at(-1), color, grain, pattern, priceM2 });

export const DEFAULT_MATERIALS = [
  placa('mel18_blanco', ['Colores', 'Blanco'], 'Melamina 18mm Blanco', '#f1f0eb', 85000),
  placa('mel18_arena', ['Colores', 'Arena'], 'Melamina 18mm Arena', '#d9cdb8', 98000),
  placa('mel18_gris', ['Colores', 'Gris grafito'], 'Melamina 18mm Gris Grafito', '#4b4e53', 98000),
  placa('mel18_negro', ['Colores', 'Negro'], 'Melamina 18mm Negro', '#222222', 98000),
  placa('mel18_roble', ['Maderas', 'Roble'], 'Melamina 18mm Roble', '#b98b5c', 105000, { wood: true }),
  placa('mel18_fresno', ['Maderas', 'Fresno'], 'Melamina 18mm Fresno', '#cbb592', 105000, { wood: true }),
  placa('mel18_cerezo', ['Maderas', 'Cerezo'], 'Melamina 18mm Cerezo', '#9b5a3c', 105000, { wood: true }),
  placa('mel18_nogal', ['Maderas', 'Nogal'], 'Melamina 18mm Nogal', '#6e4b33', 105000, { wood: true }),
  placa('fibro3_blanco', ['Fondos', 'Fibrofácil blanco'], 'Fibrofácil 3mm Blanco (fondos)', '#ecebe6', 18000, { t: 3, edge: false }),
  piedra('gra_gris_mara', ['Granitos', 'Gris', 'Gris Mara'], '#8e8d8a', '#2e2e2e', 'granito', 145000),
  piedra('gra_gris_perla', ['Granitos', 'Gris', 'Gris Perla'], '#a9a7a3', '#555350', 'granito', 150000),
  piedra('gra_negro_brasil', ['Granitos', 'Negro', 'Negro Brasil'], '#232326', '#6a6a6e', 'granito', 165000),
  piedra('gra_negro_absoluto', ['Granitos', 'Negro', 'Negro Absoluto'], '#141416', '#2c2c30', 'granito', 190000),
  piedra('gra_blanco_dallas', ['Granitos', 'Blanco', 'Blanco Dallas'], '#d9d5cd', '#4f4942', 'granito', 160000),
  piedra('gra_verde_ubatuba', ['Granitos', 'Verde', 'Verde Ubatuba'], '#22302a', '#73805a', 'granito', 150000),
  piedra('gra_cafe_imperial', ['Granitos', 'Marrón', 'Café Imperial'], '#4b3023', '#1a0f0a', 'granito', 170000),
  piedra('gra_amarillo_ornamental', ['Granitos', 'Amarillo', 'Amarillo Ornamental'], '#c8a978', '#5a4530', 'granito', 150000),
  piedra('mar_carrara', ['Mármoles', 'Carrara'], '#ecebe7', '#8d8d8d', 'marmol', 260000),
  piedra('mar_travertino', ['Mármoles', 'Travertino'], '#d8c6a4', '#a68f68', 'marmol', 220000),
  piedra('cua_blanco_estelar', ['Cuarzo', 'Blanco Estelar'], '#f2f1ee', '#c7c3bb', 'cuarzo', 320000),
  piedra('cua_gris_concreto', ['Cuarzo', 'Gris Concreto'], '#9a9893', '#6f6d69', 'cuarzo', 300000),
];

// Accesorios con modelos (filas "Accesorios" del panel Modelos, como Promob): cada familia
// reemplaza a un herraje (`code`) y cada modelo tiene ruta y precio. Acabado = tapacanto ($/m).
export const ACC_FAMILIES = [
  { id: 'tiradores', label: 'Tiradores', one: 'Tirador', code: 'manija', unit: 'u' },
  { id: 'bisagras', label: 'Bisagras', one: 'Bisagra', code: 'bisagra', unit: 'u' },
  { id: 'correderas', label: 'Correderas', one: 'Corredera', code: 'corredera', unit: 'par' },
  { id: 'patas', label: 'Patas', one: 'Pata', code: 'pata', unit: 'u' },
  { id: 'acabado', label: 'Acabado', one: 'Tapacanto', code: null, unit: 'm' },
];
const acc = (id, path, price, extra = {}) => ({ id, path, name: path.join(' '), price, ...extra });
export const DEFAULT_ACCESSORIES = {
  tiradores: [
    acc('tir_barral_128', ['Barrales', '128 mm'], 2500, { shape: 'barral', len: 128 }),
    acc('tir_barral_192', ['Barrales', '192 mm'], 3500, { shape: 'barral', len: 192 }),
    acc('tir_barral_320', ['Barrales', '320 mm'], 5200, { shape: 'barral', len: 320 }),
    acc('tir_boton', ['Botones', 'Redondo'], 1500, { shape: 'boton' }),
    acc('tir_sin', ['Sin tirador', 'Push / uñero'], 0, { shape: 'sin' }),
  ],
  bisagras: [
    acc('bis_comun', ['Cazoleta 35 mm', 'Común'], 1800),
    acc('bis_suave', ['Cazoleta 35 mm', 'Cierre suave'], 3500),
  ],
  correderas: [
    acc('cor_tele', ['Telescópicas', 'Común'], 8000),
    acc('cor_tele_suave', ['Telescópicas', 'Cierre suave'], 12000),
    acc('cor_oculta', ['Ocultas', 'Cierre suave'], 22000),
    acc('cor_push', ['Ocultas', 'Push'], 26000),
  ],
  patas: [
    acc('pata_plastica', ['Regulables', 'Plástica'], 900),
    acc('pata_metal', ['Regulables', 'Metálica cromada'], 2500),
  ],
  acabado: [
    acc('tc_pvc045', ['PVC', '0,45 mm'], 400),
    acc('tc_pvc2', ['PVC', '2 mm'], 600),
    acc('tc_abs2', ['ABS', '2 mm'], 900),
  ],
};
const ACC_DEFAULT = { tiradores: 'tir_barral_128', bisagras: 'bis_suave', correderas: 'cor_tele_suave', patas: 'pata_plastica', acabado: 'tc_pvc2' };
const ACC_CODES = new Set(ACC_FAMILIES.map((f) => f.code).filter(Boolean));

export function accById(settings, fam, id) {
  const list = settings.accessories?.[fam] || DEFAULT_ACCESSORIES[fam];
  return list.find((a) => a.id === id) || list.find((a) => a.id === ACC_DEFAULT[fam]) || list[0];
}

export const DEFAULT_HARDWARE = [
  { code: 'barral', name: 'Barral oval + soportes', unit: 'm', price: 6000 },
  { code: 'soporte_estante', name: 'Soporte de estante', unit: 'u', price: 80 },
  { code: 'kit_corrediza', name: 'Kit puerta corrediza (por hoja)', unit: 'u', price: 25000 },
  { code: 'kit_armado', name: 'Kit armado por módulo (minifix, tarugos, tornillos)', unit: 'u', price: 4000 },
  { code: 'bacha', name: 'Bacha de acero inoxidable', unit: 'u', price: 85000 },
];

export const DEFAULT_SETTINGS = {
  materials: DEFAULT_MATERIALS,
  accessories: DEFAULT_ACCESSORIES,
  styles: null, // null = los de fábrica (src/domain/styles.js)
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
  base.materials = migrateMaterials(base.materials);
  const hw = Array.isArray(base.hardware) ? [...base.hardware] : [];
  for (const d of DEFAULT_HARDWARE) if (!hw.find((h) => h.code === d.code)) hw.push(d);
  // la mesada se cobra por m² de su piedra y bisagras/correderas/tiradores/patas por su modelo
  base.hardware = hw.filter((h) => h.code !== 'mesada' && !ACC_CODES.has(h.code));
  base.accessories = Object.fromEntries(ACC_FAMILIES.map((f) => [f.id, Array.isArray(base.accessories?.[f.id]) && base.accessories[f.id].length ? base.accessories[f.id] : DEFAULT_ACCESSORIES[f.id]]));
  return base;
}

// Tipos de pieza (filas del panel Modelos, como Promob). Cada uno lleva un material; las
// tapas, una piedra. `slotOf` decide el tipo de cada pieza por su rol y su nombre.
export const SLOTS = [
  { id: 'cajas', label: 'Cajas', kind: 'placa' },
  { id: 'externo', label: 'Externo cajas', kind: 'placa' },
  { id: 'puertas', label: 'Puertas', kind: 'placa' },
  { id: 'frentes', label: 'Frentes', kind: 'placa' },
  { id: 'fondos', label: 'Fondos', kind: 'placa' },
  { id: 'cajones', label: 'Cajones', kind: 'placa' },
  { id: 'tapas', label: 'Tapas', kind: 'piedra' },
];

export function slotOf(part) {
  if (part.role === 'fondo') return 'fondos';
  if (part.role === 'cajon') return 'cajones';
  if (part.role === 'frente') return /^Puerta/.test(part.name) ? 'puertas' : 'frentes';
  return part.name === 'Lateral' ? 'externo' : 'cajas';
}

// Materiales por tipo de pieza a partir de los nombres viejos (cuerpo, frente, fondo, cajon).
// En el proyecto completa todo (cajones = cajas si no hay); en un módulo deja sin definir
// lo que hereda del proyecto.
export function slotIds(o = {}, { fill = false } = {}) {
  const v = (x) => (x === '' ? undefined : x);
  const out = {
    cajas: v(o.cajas) ?? v(o.cuerpo),
    externo: v(o.externo) ?? v(o.cuerpo),
    puertas: v(o.puertas) ?? v(o.frente),
    frentes: v(o.frentes) ?? v(o.frente),
    fondos: v(o.fondos) ?? v(o.fondo),
    cajones: v(o.cajones) ?? v(o.cajon),
    tapas: v(o.tapas),
    ...Object.fromEntries(ACC_FAMILIES.map((f) => [f.id, v(o[f.id])])),
  };
  if (fill) {
    out.cajas ??= 'mel18_blanco'; out.externo ??= out.cajas; out.puertas ??= 'mel18_roble'; out.frentes ??= out.puertas;
    out.fondos ??= 'fibro3_blanco'; out.cajones ??= out.cajas; out.tapas ??= 'gra_gris_mara';
    for (const f of ACC_FAMILIES) out[f.id] ??= ACC_DEFAULT[f.id];
  }
  return Object.fromEntries(Object.entries(out).filter(([, x]) => x !== undefined));
}

export function stoneById(settings, id) {
  return settings.materials.find((m) => m.id === id && m.kind === 'piedra') || settings.materials.find((m) => m.kind === 'piedra');
}

// Placa por id (si no existe, la primera placa: un id viejo o borrado no rompe el despiece).
export function matById(settings, id) {
  return settings.materials.find((m) => m.id === id && m.kind !== 'piedra') || settings.materials.find((m) => m.kind !== 'piedra');
}

// Materiales de antes de la biblioteca: se les completa tipo y ruta, y se suman las
// piedras de la biblioteca que falten (las placas borradas a propósito no vuelven).
export function migrateMaterials(list) {
  const defs = new Map(DEFAULT_MATERIALS.map((m) => [m.id, m]));
  const out = list.map((m) => {
    if (m.kind && Array.isArray(m.path) && m.path.length) return m;
    const d = defs.get(m.id);
    if (d) return { ...d, ...m, kind: d.kind, path: d.path };
    const folder = m.wood ? 'Maderas' : (m.t || 18) < 10 ? 'Fondos' : 'Colores';
    return { ...m, kind: 'placa', path: [folder, m.name] };
  });
  const have = new Set(out.map((m) => m.id));
  for (const d of DEFAULT_MATERIALS) if (d.kind === 'piedra' && !have.has(d.id)) out.push(d);
  return out;
}

export const pathLabel = (m) => (m?.path || [m?.name || '']).join(' > ');

// Árbol para el menú en cascada: carpetas por la ruta (menos el último tramo, que es el
// nombre del material) y, en cada carpeta, sus materiales. `kind` filtra placas o piedras.
export function libraryTree(materials, kind = null) {
  const root = { name: '', folders: [], items: [] };
  for (const m of materials) {
    if (kind && m.kind !== kind) continue;
    let node = root;
    for (const seg of (m.path || [m.name]).slice(0, -1)) {
      let f = node.folders.find((x) => x.name === seg);
      if (!f) { f = { name: seg, folders: [], items: [] }; node.folders.push(f); }
      node = f;
    }
    node.items.push(m);
  }
  return root;
}
