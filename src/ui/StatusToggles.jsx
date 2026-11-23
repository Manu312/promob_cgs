import { useState } from 'react';

// Interruptores de la barra inferior derecha, como en Promob: Mostrar ▾ · Colisión ·
// Acoplamientos · Auto Rebajar. El activo se ve enmarcado.
export default function StatusToggles({ ui, onToggle, showDims, onShowDims, planImage, onPlanImage, onShowRulers, show, onShow }) {
  const [open, setOpen] = useState(false);
  const on = (k) => ui[k] !== false;
  const sw = (k, label, title) => (
    <button key={k} className={`sb-toggle${on(k) ? ' on' : ''}`} aria-pressed={on(k)} title={title} onClick={() => onToggle(k)}>{label}</button>
  );
  return (
    <span className="sb-toggles">
      <span className="sb-show">
        <button className="sb-toggle" onClick={() => setOpen((o) => !o)} title="Qué se ve en el visor">Mostrar ▾</button>
        {open && (
          <span className="sb-menu" onMouseLeave={() => setOpen(false)}>
            <label><input type="checkbox" checked={showDims} onChange={(e) => onShowDims(e.target.checked)} /> Cotas</label>
            <label><input type="checkbox" checked={!!ui.showRulers} onChange={(e) => onShowRulers?.(e.target.checked)} /> Grilla y reglas</label>
            {planImage && <label><input type="checkbox" checked={!!planImage.visible} onChange={(e) => onPlanImage(e.target.checked)} /> Plano de referencia</label>}
            {show && onShow && [['planos', 'Planos importados'], ['flechas', 'Flechas de medidas'], ['hotpoints', 'HotPoints'], ['insercion', 'Posición de inserción'], ['invisibles', 'Módulos invisibles']].map(([k, l]) => (
              <label key={k}><input type="checkbox" checked={!!show[k]} onChange={(e) => onShow(k, e.target.checked)} /> {l}</label>
            ))}
          </span>
        )}
      </span>
      {sw('collision', 'Colisión', 'Colisión (B): los módulos no se superponen entre sí ni con las paredes')}
      {sw('magnets', 'Acoplamientos', 'Acoplamientos: al mover, los módulos se pegan a paredes, columnas y otros módulos')}
      {sw('autoLower', 'Auto Rebajar', 'Auto Rebajar: las paredes que tapan la vista bajan a zócalo')}
    </span>
  );
}
