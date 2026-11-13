// Read-only diet chart: each meal as a table with per-item and per-meal macros, day total vs targets.
import { itemsTotal, chartTotal, servingLabel } from '@/lib/catalogue';
import type { ChartMeal } from '@/lib/types';
import type { Targets } from '@/lib/nutrition';

export function DietChartView({ chart, targets, logForm }: { chart: ChartMeal[]; targets: Targets; logForm?: (mealIndex: number) => React.ReactNode }) {
  const day = chartTotal(chart);
  const diff = (a: number, b: number) => { const d = Math.round(a - b); return d === 0 ? '' : ` (${d > 0 ? '+' : ''}${d})`; };
  return (<>
    <div className="card">
      <div className="row between"><h3>Day total</h3><span className="small muted">Target {targets.kcal} kcal</span></div>
      <div className="stats">
        <div className="stat"><span>Calories</span><b>{day.kcal}</b><span className="small muted">{diff(day.kcal, targets.kcal)}</span></div>
        <div className="stat"><span>Protein</span><b>{day.p} g</b><span className="small muted">of {targets.p}</span></div>
        <div className="stat"><span>Carbs</span><b>{day.c} g</b><span className="small muted">of {targets.c}</span></div>
        <div className="stat"><span>Fat</span><b>{day.f} g</b><span className="small muted">of {targets.f}</span></div>
      </div>
    </div>
    {chart.map((m, i) => {
      const t = itemsTotal(m.items);
      return (
        <div className="card" key={i}>
          <div className="row between"><h3>{m.meal}{m.time && <span className="small muted" style={{ fontWeight: 400 }}> · {m.time}</span>}</h3><span className="pill num">{t.kcal} kcal</span></div>
          {m.items.length ? (
            <div className="scroll"><table className="tbl">
              <thead><tr><th>Food</th><th>Amount</th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr></thead>
              <tbody>{m.items.map((it, j) => <tr key={j}><td>{it.name}</td><td>{servingLabel(it.qty, it.unit)}</td><td>{it.kcal}</td><td>{it.p}</td><td>{it.c}</td><td>{it.f}</td></tr>)}</tbody>
              <tfoot><tr><td>Meal total</td><td /><td>{t.kcal}</td><td>{t.p}</td><td>{t.c}</td><td>{t.f}</td></tr></tfoot>
            </table></div>
          ) : <p className="small muted">Nothing planned.</p>}
          {logForm && m.items.length > 0 && logForm(i)}
        </div>
      );
    })}
  </>);
}
