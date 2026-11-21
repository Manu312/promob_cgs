import { download, num } from './fields.jsx';

const PALETTE = ['#cfe3ff', '#ffe1c2', '#d6f2d5', '#f6d4e6', '#e6dcff', '#fff2b3', '#cdeff0', '#f3d9cc'];
const colorFor = (ref) => PALETTE[(parseInt(ref.slice(1), 10) || 0) % PALETTE.length];

function Sheet({ mat, sheet, index, total }) {
  return (
    <figure className="sheet">
      <figcaption>Placa {index + 1}/{total} · aprovechamiento {num(sheet.yield * 100, 1)}%</figcaption>
      <svg viewBox={`-20 -20 ${mat.L + 40} ${mat.W + 40}`} role="img" aria-label={`Placa ${index + 1}`}>
        <rect x="0" y="0" width={mat.L} height={mat.W} fill="#f7f3ea" stroke="#8a8a8a" strokeWidth="5" />
        {sheet.placed.map((p, i) => {
          const fs = Math.max(22, Math.min(64, p.pw / 3.2, p.pl / 7));
          return (
            <g key={i}>
              <rect x={p.x} y={p.y} width={p.pl} height={p.pw} fill={colorFor(p.ref)} stroke="#333" strokeWidth="3" />
              {p.pl > 120 && p.pw > 60 && (
                <text x={p.x + p.pl / 2} y={p.y + p.pw / 2} fontSize={fs} textAnchor="middle" dominantBaseline="middle" fill="#222">
                  {p.ref} {p.l}×{p.w}{p.rot ? ' ↻' : ''}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

export default function CutPlan({ cut, nesting, settings, project }) {
  const exportCsv = () => {
    const head = ['Ref', 'Material', 'Pieza', 'Largo', 'Ancho', 'Espesor', 'Cant', 'Canto largo', 'Canto ancho', 'Módulos'];
    const lines = cut.rows.map((r) => [r.ref, r.matName, r.name, r.length, r.width, r.thick, r.qty, r.edgesL, r.edgesW, r.modules.join(' ')]);
    const csv = '﻿' + [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    download(`${project.name || 'proyecto'} - despiece.csv`, csv, 'text/csv;charset=utf-8');
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Plan de corte</h2>
        <div className="row-btns">
          <button onClick={exportCsv}>Exportar despiece CSV</button>
          <button onClick={() => window.print()}>Imprimir</button>
        </div>
      </div>
      <p className="hint">Corte tipo guillotina · sierra {settings.kerf} mm · refilado {settings.trim} mm por lado. En materiales con veta no se rotan piezas (largo = sentido de la veta). ↻ = pieza rotada.</p>

      {nesting.map((n) => (
        <section key={n.mat.id} className="mat-block">
          <h3>{n.mat.name} — {n.sheets.length} placa(s) de {n.mat.L}×{n.mat.W} · aprovechamiento total {num(n.yield * 100, 1)}%</h3>
          {n.unplaced.length > 0 && <p className="error">⚠ {n.unplaced.length} pieza(s) no entran en la placa: {[...new Set(n.unplaced.map((u) => `${u.ref} ${u.l}×${u.w}`))].join(', ')}</p>}
          <div className="sheets">
            {n.sheets.map((s, i) => <Sheet key={i} mat={n.mat} sheet={s} index={i} total={n.sheets.length} />)}
          </div>
        </section>
      ))}

      <h3>Despiece</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Ref</th><th>Material</th><th>Pieza</th><th>Largo</th><th>Ancho</th><th>Esp.</th><th>Cant.</th><th>Canto L</th><th>Canto A</th><th>Módulos</th></tr></thead>
          <tbody>
            {cut.rows.map((r) => (
              <tr key={r.ref}>
                <td><span className="chip" style={{ background: colorFor(r.ref) }}>{r.ref}</span></td>
                <td>{r.matName}</td><td>{r.name}</td><td className="n">{r.length}</td><td className="n">{r.width}</td><td className="n">{r.thick}</td>
                <td className="n">{r.qty}</td><td className="n">{r.edgesL}</td><td className="n">{r.edgesW}</td><td>{r.modules.join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
