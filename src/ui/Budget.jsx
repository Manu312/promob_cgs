import { money, num } from './fields.jsx';

export default function Budget({ budget, settings, project, built }) {
  const groups = ['Placas', 'Tapas', 'Tapacantos', 'Herrajes', 'Electrodomésticos'];
  return (
    <div className="page">
      <div className="page-head">
        <h2>Presupuesto — {project.name}</h2>
        <div className="row-btns"><button onClick={() => window.print()}>Imprimir / PDF</button></div>
      </div>
      <p className="hint">Fecha: {new Date().toLocaleDateString('es-AR')} · {built.length} módulo(s): {built.map((b) => `${b.tag} ${b.label}`).join(', ')}</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Concepto</th><th className="n">Cant.</th><th>Unidad</th><th className="n">Precio unit.</th><th className="n">Subtotal</th></tr></thead>
          <tbody>
            {groups.map((g) => {
              const ls = budget.lines.filter((l) => l.group === g);
              if (!ls.length) return null;
              return [
                <tr key={g} className="group-row"><td colSpan={5}>{g}</td></tr>,
                ...ls.map((l, i) => (
                  <tr key={g + i}><td>{l.desc}</td><td className="n">{num(l.qty, 2)}</td><td>{l.unit}</td><td className="n">{money(l.unitPrice)}</td><td className="n">{money(l.total)}</td></tr>
                )),
              ];
            })}
          </tbody>
          <tfoot>
            <tr><td colSpan={4}>Materiales</td><td className="n">{money(budget.materiales)}</td></tr>
            <tr><td colSpan={4}>Mano de obra ({settings.laborPct}%)</td><td className="n">{money(budget.labor)}</td></tr>
            <tr><td colSpan={4}>Margen ({settings.marginPct}%)</td><td className="n">{money(budget.margen)}</td></tr>
            {settings.ivaPct > 0 && <tr><td colSpan={4}>IVA ({settings.ivaPct}%)</td><td className="n">{money(budget.iva)}</td></tr>}
            <tr className="total"><td colSpan={4}>TOTAL</td><td className="n">{money(budget.total)}</td></tr>
          </tfoot>
        </table>
      </div>
      <p className="hint">Costo interno (materiales + mano de obra): {money(budget.costo)}. Los precios se editan en la pestaña “Precios”.</p>
    </div>
  );
}
