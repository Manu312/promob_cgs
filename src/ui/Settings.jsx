import { DEFAULT_SETTINGS } from '../domain/catalog.js';
import { uid } from '../domain/modules.js';
import { NumField } from './fields.jsx';

export default function Settings({ settings, setSettings }) {
  const set = (patch) => setSettings((s) => ({ ...s, ...patch }));
  const setMat = (i, patch) => set({ materials: settings.materials.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
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
          <thead><tr><th>Nombre</th><th>Esp. mm</th><th>Largo</th><th>Ancho</th><th>Color</th><th>Veta</th><th>Tapacanto</th><th>Precio placa</th><th></th></tr></thead>
          <tbody>
            {settings.materials.map((m, i) => (
              <tr key={m.id}>
                <td><input type="text" value={m.name} onChange={(e) => setMat(i, { name: e.target.value })} /></td>
                <td><NumField compact value={m.t} min={1} max={50} onChange={(v) => setMat(i, { t: v })} /></td>
                <td><NumField compact value={m.L} min={500} max={4000} onChange={(v) => setMat(i, { L: v })} /></td>
                <td><NumField compact value={m.W} min={300} max={2500} onChange={(v) => setMat(i, { W: v })} /></td>
                <td><input type="color" value={m.color} onChange={(e) => setMat(i, { color: e.target.value })} /></td>
                <td><input type="checkbox" checked={!!m.wood} onChange={(e) => setMat(i, { wood: e.target.checked })} /></td>
                <td><input type="checkbox" checked={m.edge !== false} onChange={(e) => setMat(i, { edge: e.target.checked })} /></td>
                <td><NumField compact value={m.price} min={0} max={1e9} step={100} onChange={(v) => setMat(i, { price: v })} /></td>
                <td>{settings.materials.length > 1 && <button className="danger small" onClick={() => set({ materials: settings.materials.filter((_, j) => j !== i) })}>✕</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => set({ materials: [...settings.materials, { id: 'mat_' + uid(), name: 'Nueva melamina 18mm', t: 18, L: 2600, W: 1830, color: '#cccccc', wood: false, edge: true, price: 90000 }] })}>+ Agregar placa</button>

      <h3>Herrajes</h3>
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
        <NumField label="Tapacanto $/m" value={settings.edgePerM} min={0} max={1e6} step={10} onChange={(v) => set({ edgePerM: v })} />
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
