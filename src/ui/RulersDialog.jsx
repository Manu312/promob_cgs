import { useEffect, useState } from 'react';
import { addRulerGroup, updateRulerGroup, removeRulerGroup, addRuler, updateRuler, removeRuler } from '../domain/rulers.js';

// Reglas de la pared (Promob: clic derecho → Réguas / Editar Réguas): elegir el grupo de esta
// pared y editar los grupos (Atraer, Gap, reglas con su valor y texto).
export default function RulersDialog({ wallLabel, current, groups, onPick, onGroups, onClose }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const [sel, setSel] = useState(current || groups[0]?.id || null);
  const [name, setName] = useState('');
  const g = groups.find((x) => x.id === sel);
  return (
    <div className="menu-backdrop dim">
      <div className="wall-dialog rulers-dialog" role="dialog" aria-label="Reglas">
        <h3>Reglas · {wallLabel}</h3>
        <div className="rl-cols">
          <div className="rl-groups">
            <label className="radio"><input type="radio" name="rl" checked={!current} onChange={() => onPick(null)} /> Sin reglas</label>
            {groups.map((x) => (
              <label key={x.id} className={`radio${x.id === sel ? ' on' : ''}`} onClick={() => setSel(x.id)}>
                <input type="radio" name="rl" checked={current === x.id} onChange={() => onPick(x.id)} /> {x.name}
              </label>
            ))}
            <div className="rl-add"><input placeholder="Grupo nuevo" value={name} onChange={(e) => setName(e.target.value)} />
              <button disabled={!name.trim()} onClick={() => { const gs = addRulerGroup(groups, name); onGroups(gs); setSel(gs.at(-1).id); setName(''); }}>Agregar grupo</button></div>
          </div>
          {g && (
            <div className="rl-edit">
              <label className="field"><span>Nombre</span><input value={g.name} onChange={(e) => onGroups(updateRulerGroup(groups, g.id, { name: e.target.value }))} /></label>
              <label className="check"><input type="checkbox" checked={g.attract} onChange={(e) => onGroups(updateRulerGroup(groups, g.id, { attract: e.target.checked }))} /> Atraer</label>
              <label className="field"><span>Gap</span><input type="number" value={g.gap} onChange={(e) => onGroups(updateRulerGroup(groups, g.id, { gap: +e.target.value || 0 }))} /></label>
              <table className="rl-table">
                <thead><tr><th>Valor (alto)</th><th>Texto</th><th /></tr></thead>
                <tbody>
                  {g.rulers.map((r, i) => (
                    <tr key={i}>
                      <td><input type="number" value={r.value} onChange={(e) => onGroups(updateRuler(groups, g.id, i, { value: +e.target.value || 0 }))} /></td>
                      <td><input value={r.text} onChange={(e) => onGroups(updateRuler(groups, g.id, i, { text: e.target.value }))} /></td>
                      <td><button onClick={() => onGroups(removeRuler(groups, g.id, i))} title="Quitar">✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row-btns">
                <button onClick={() => onGroups(addRuler(groups, g.id))}>Agregar regla</button>
                <button className="danger" onClick={() => { onGroups(removeRulerGroup(groups, g.id)); setSel(null); }}>Quitar grupo</button>
              </div>
            </div>
          )}
        </div>
        <p className="hint">Para verlas: Mostrar → Grilla y reglas. Los módulos se pegan a las reglas si "Atraer" está tildado.</p>
        <div className="row-btns"><button className="active" onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}
