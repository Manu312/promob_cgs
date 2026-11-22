import { useEffect, useState } from 'react';

export const money = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);
export const num = (v, d = 0) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: d }).format(v || 0);

export function NumField({ label, value, onChange, min, max, step = 1, unit, compact }) {
  const [s, setS] = useState(String(value ?? ''));
  useEffect(() => setS(String(value ?? '')), [value]);
  const commit = () => {
    let v = Number(String(s).replace(',', '.'));
    if (s === '' || !Number.isFinite(v)) { setS(String(value ?? '')); return; }
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    if (v !== value) onChange(v); else setS(String(value));
  };
  const input = (
    <div className="numwrap">
      <input type="number" value={s} step={step} onChange={(e) => setS(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
      {unit && <em>{unit}</em>}
    </div>
  );
  if (compact) return input;
  return <label className="field"><span>{label}</span>{input}</label>;
}

// Lista de números (p. ej. alturas) en un campo de texto; se confirma al salir o con Enter.
export function ListField({ label, value, parse, onChange }) {
  const txt = value.join(', ');
  const [s, setS] = useState(txt);
  useEffect(() => setS(txt), [txt]);
  const commit = () => { const v = parse(s); if (v.join(',') !== value.join(',')) onChange(v); else setS(txt); };
  return (
    <label className="field">
      <span>{label}</span>
      <input type="text" value={s} onChange={(e) => setS(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    </label>
  );
}

export function SelField({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function TextField({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function download(filename, content, type) {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
