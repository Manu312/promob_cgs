import { DEFAULT_SETTINGS, pathLabel, ACC_FAMILIES } from '../domain/catalog.js';
import { uid } from '../domain/modules.js';
import { NumField } from './fields.jsx';

const parsePath = (s) => s.split('>').map((x) => x.trim()).filter(Boolean);

// Ruta en la biblioteca ("Granitos > Gris > Gris Mara"); se confirma al salir del campo.
function PathInput({ m, onPath }) {
  return (
    <input type="text" defaultValue={pathLabel(m)} title="Ruta en la biblioteca, separada por >" key={pathLabel(m)}
      onBlur={(e) => { const p = parsePath(e.target.value); if (p.length && p.join('>') !== m.path?.join('>')) onPath(m.id, p); }} />
  );
}

export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const setMat = (id, patch) => set({ materials: settings.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
  const delMat = (id) => set({ materials: settings.materials.filter((m) => m.id !== id) });
  const byPath = (a, b) => pathLabel(a).localeCompare(pathLabel(b));
  const placas = settings.materials.filter((m) => m.kind !== 'piedra').sort(byPath);
  const piedras = settings.materials.filter((m) => m.kind === 'piedra').sort(byPath);
  const onPath = (id, path) => setMat(id, { path });
  const setAcc = (fam, id, patch) => set({ accessories: { ...settings.accessories, [fam]: settings.accessories[fam].map((a) => (a.id === id ? { ...a, ...patch } : a)) } });
  const delAcc = (fam, id) => set({ accessories: { ...settings.accessories, [fam]: settings.accessories[fam].filter((a) => a.id !== id) } });
  const addAcc = (fam) => set({ accessories: { ...settings.accessories, [fam]: [...settings.accessories[fam], { id: 'acc_' + uid(), path: ['Otros', 'Nuevo'], name: 'Nuevo', price: 0, ...(fam === 'tiradores' ? { shape: 'barral', len: 128 } : {}) }] } });
  const setHw = (i, patch) => set({ hardware: settings.hardware.map((h, j) => (j === i ? { ...h, ...patch } : h)) });

  return (
    <div className="page">
      <div className="page-head">
        <h2>Precios y parámetros</h2>
        <div className="row-btns">
          <button className="danger" onClick={() => { if (window.confirm('¿Restaurar precios y materiales por defecto?')) setSettings(DEFAULT_SETTINGS); }}>Restaurar valores por defecto</button>
        </div>
      </div>
      <p className="hint">⚠ Los precios iniciales son de ejemplo. Cargá los de tu lista de proveedores. Todo se guarda en este navegador.</p>

      <h3>Placas</h3>
      <div className="table-wrap">
        <table className="edit">
          <thead><tr><th>Biblioteca</th><th>Nombre</th><th>Esp. mm</th><th>Largo</th><th>Ancho</th><th>Color</th><th>Veta</th><th>Tapacanto</th><th>Precio placa</th><th></th></tr></thead>
          <tbody>
            {placas.map((m) => (
              <tr key={m.id}>
                <td><PathInput m={m} onPath={onPath} /></td>
                <td><input type="text" value={m.name} onChange={(e) => setMat(m.id, { name: e.target.value })} /></td>
                <td><NumField compact value={m.t} min={1} max={50} onChange={(v) => setMat(m.id, { t: v })} /></td>
                <td><NumField compact value={m.L} min={500} max={4000} onChange={(v) => setMat(m.id, { L: v })} /></td>
                <td><NumField compact value={m.W} min={300} max={2500} onChange={(v) => setMat(m.id, { W: v })} /></td>
                <td><input type="color" value={m.color} onChange={(e) => setMat(m.id, { color: e.target.value })} /></td>
                <td><input type="checkbox" checked={!!m.wood} onChange={(e) => setMat(m.id, { wood: e.target.checked })} /></td>
                <td><input type="checkbox" checked={m.edge !== false} onChange={(e) => setMat(m.id, { edge: e.target.checked })} /></td>
                <td><NumField compact value={m.price} min={0} max={1e9} step={100} onChange={(v) => setMat(m.id, { price: v })} /></td>
                <td>{placas.length > 1 && <button className="danger small" onClick={() => delMat(m.id)}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => set({ materials: [...settings.materials, { id: 'mat_' + uid(), kind: 'placa', path: ['Colores', 'Nueva'], name: 'Nueva melamina 18mm', t: 18, L: 2600, W: 1830, color: '#cccccc', wood: false, edge: true, price: 90000 }] })}>+ Agregar placa</button>

      <h3>Piedras (tapas y mesadas)</h3>
      <div className="table-wrap">
        <table className="edit">
          <thead><tr><th>Biblioteca</th><th>Tipo</th><th>Color</th><th>Grano / veta</th><th>Precio m²</th><th></th></tr></thead>
          <tbody>
            {piedras.map((m) => (
              <tr key={m.id}>
                <td><PathInput m={m} onPath={onPath} /></td>
                <td>
                  <select value={m.pattern} onChange={(e) => setMat(m.id, { pattern: e.target.value })}>
                    <option value="granito">Granito</option><option value="marmol">Mármol</option><option value="cuarzo">Cuarzo</option>
                  </select>
                </td>
                <td><input type="color" value={m.color} onChange={(e) => setMat(m.id, { color: e.target.value })} /></td>
                <td><input type="color" value={m.grain} onChange={(e) => setMat(m.id, { grain: e.target.value })} /></td>
                <td><NumField compact value={m.priceM2} min={0} max={1e9} step={1000} onChange={(v) => setMat(m.id, { priceM2: v })} /></td>
                <td>{piedras.length > 1 && <button className="danger small" onClick={() => delMat(m.id)}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => set({ materials: [...settings.materials, { id: 'pie_' + uid(), kind: 'piedra', path: ['Granitos', 'Gris', 'Nuevo granito'], name: 'Nuevo granito', color: '#9a9893', grain: '#3a3a3a', pattern: 'granito', priceM2: 150000 }] })}>+ Agregar piedra</button>

      <h3>Accesorios (modelos del panel Modelos)</h3>
      <div className="table-wrap">
        <table className="edit acc-table">
          <thead><tr><th>Familia</th><th>Biblioteca</th><th>Precio</th><th></th></tr></thead>
          <tbody>
            {ACC_FAMILIES.flatMap((f) => (settings.accessories?.[f.id] || []).map((a, i) => (
              <tr key={f.id + a.id}>
                <td>{i === 0 ? <b>{f.label}</b> : ''}</td>
                <td><PathInput m={a} onPath={(id, path) => setAcc(f.id, id, { path, name: path.join(' ') })} /></td>
                <td><NumField compact value={a.price} min={0} max={1e9} step={10} unit={f.unit === 'm' ? '$/m' : `$/${f.unit}`} onChange={(v) => setAcc(f.id, a.id, { price: v })} /></td>
                <td>
                  {i === settings.accessories[f.id].length - 1 && <button className="small" onClick={() => addAcc(f.id)} title={`Agregar ${f.one.toLowerCase()}`}>+</button>}
                  {settings.accessories[f.id].length > 1 && <button className="danger small" onClick={() => delAcc(f.id, a.id)}>✕</button>}
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>

      <h3>Otros herrajes</h3>
      <div className="table-wrap">
        <table className="edit">
          <thead><tr><th>Herraje</th><th>Unidad</th><th>Precio</th></tr></thead>
          <tbody>
            {settings.hardware.map((h, i) => (
              <tr key={h.code}>
                <td><input type="text" value={h.name} onChange={(e) => setHw(i, { name: e.target.value })} /></td>
                <td>{h.unit}</td>
                <td><NumField compact value={h.price} min={0} max={1e9} step={10} onChange={(v) => setHw(i, { price: v })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Costos y corte</h3>
      <div className="grid-fields">
        <NumField label="Desperdicio tapacanto" unit="%" value={Math.round(settings.edgeWaste * 100)} min={0} max={100} onChange={(v) => set({ edgeWaste: v / 100 })} />
        <NumField label="Mano de obra" unit="%" value={settings.laborPct} min={0} max={500} onChange={(v) => set({ laborPct: v })} />
        <NumField label="Margen" unit="%" value={settings.marginPct} min={0} max={500} onChange={(v) => set({ marginPct: v })} />
        <NumField label="IVA" unit="%" value={settings.ivaPct} min={0} max={50} onChange={(v) => set({ ivaPct: v })} />
        <NumField label="Espesor de sierra" unit="mm" value={settings.kerf} min={0} max={10} step={0.5} onChange={(v) => set({ kerf: v })} />
        <NumField label="Refilado por lado" unit="mm" value={settings.trim} min={0} max={50} onChange={(v) => set({ trim: v })} />
      </div>
    </div>
  );
}
