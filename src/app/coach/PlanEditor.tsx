'use client';
// Coach's plan editor: diet chart built from the food catalogue (live macros vs targets) + weekly workouts.
import { useState, useTransition } from 'react';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { FoodPicker } from '@/components/FoodPicker';
import { draftPlanWithAI, savePlans } from './actions';
import { WEEKDAYS, type Targets } from '@/lib/nutrition';
import { chartItem, chartTotal, itemsTotal, scaleFood } from '@/lib/catalogue';
import type { ChartMeal, Food } from '@/lib/types';

type Workout = Record<string, { n: string; s: string | number; r: string }[]>;
const toText = (w: Workout) => Object.fromEntries(WEEKDAYS.map((d) => [d, (w[d] ?? []).map((e) => `${e.n} | ${e.s} | ${e.r}`).join('\n')]));
const DEFAULT: ChartMeal[] = [
  { meal: 'Early morning', time: '6:30', items: [] }, { meal: 'Breakfast', time: '8:30', items: [] }, { meal: 'Lunch', time: '13:00', items: [] },
  { meal: 'Evening snack', time: '17:00', items: [] }, { meal: 'Dinner', time: '20:00', items: [] },
];

function Totals({ t, target }: { t: { kcal: number; p: number; c: number; f: number }; target: Targets }) {
  const tone = (v: number, goal: number) => (Math.abs(v - goal) <= goal * 0.05 ? 'good' : v > goal ? 'warn' : '');
  return (
    <div className="stats">
      <div className="stat"><span>Calories</span><b className={`pill ${tone(t.kcal, target.kcal)}`} style={{ fontSize: 15 }}>{t.kcal}</b><span className="small muted">/ {target.kcal}</span></div>
      <div className="stat"><span>Protein</span><b>{t.p} g</b><span className="small muted">/ {target.p}</span></div>
      <div className="stat"><span>Carbs</span><b>{t.c} g</b><span className="small muted">/ {target.c}</span></div>
      <div className="stat"><span>Fat</span><b>{t.f} g</b><span className="small muted">/ {target.f}</span></div>
    </div>
  );
}

export function PlanEditor({ clientId, chart, workout, foods, targets, diet, aiOn }: {
  clientId: string; chart: ChartMeal[]; workout: Workout; foods: Food[]; targets: Targets; diet: string; aiOn: boolean;
}) {
  const [meals, setMeals] = useState<ChartMeal[]>(chart.length ? chart : DEFAULT);
  const [w, setW] = useState<Record<string, string>>(toText(workout));
  const [adding, setAdding] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const byId = new Map(foods.map((f) => [f.id, f]));

  const update = (i: number, patch: Partial<ChartMeal>) => setMeals(meals.map((m, k) => (k === i ? { ...m, ...patch } : m)));
  const setQty = (i: number, j: number, qty: number) => {
    const it = meals[i].items[j];
    const food = it.food_id ? byId.get(it.food_id) : null;
    const scaled = food ? scaleFood(food, qty) : { kcal: it.kcal, p: it.p, c: it.c, f: it.f };
    update(i, { items: meals[i].items.map((x, k) => (k === j ? { ...x, qty, ...scaled } : x)) });
  };
  const move = (i: number, d: number) => { const n = [...meals]; const [m] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, i + d)), 0, m); setMeals(n); };

  const draft = () => start(async () => {
    const r = await draftPlanWithAI(clientId);
    setMsg(r.message);
    if (r.chart) setMeals(r.chart);
    if (r.workout) setW(toText(r.workout as Workout));
  });

  return (
    <ActionForm action={savePlans}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="diet_chart" value={JSON.stringify(meals)} />
      <div className="row between">
        <h3>Diet chart</h3>
        <button type="button" className="btn sm ghost" onClick={draft} disabled={!aiOn || pending} title={aiOn ? '' : 'Needs an Anthropic API key'}>{pending ? 'Drafting…' : 'Draft with AI'}</button>
      </div>
      {msg && <p className="banner">{msg}</p>}
      <p className="small muted">{diet} client. Build each meal from the catalogue; amounts are in each food&rsquo;s own unit.</p>
      <Totals t={chartTotal(meals)} target={targets} />

      {meals.map((m, i) => {
        const t = itemsTotal(m.items);
        return (
          <div key={i} className="log">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <input type="text" value={m.meal} onChange={(e) => update(i, { meal: e.target.value })} aria-label="Meal name" style={{ fontWeight: 700 }} />
              <input type="text" value={m.time ?? ''} onChange={(e) => update(i, { time: e.target.value })} aria-label="Time" placeholder="Time" style={{ width: 80 }} />
              <span className="pill num">{t.kcal} kcal</span>
            </div>
            {m.items.length > 0 && (
              <div className="scroll"><table className="tbl">
                <thead><tr><th>Food</th><th>Amount</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th /></tr></thead>
                <tbody>{m.items.map((it, j) => (
                  <tr key={j}>
                    <td>{it.name}</td>
                    <td><span className="unit" style={{ display: 'inline-block', width: 96 }}><input type="number" step="any" min="0" value={it.qty} onChange={(e) => setQty(i, j, Number(e.target.value) || 0)} aria-label={`Amount of ${it.name}`} style={{ padding: '6px 34px 6px 8px', fontSize: 13 }} /><em>{it.unit}</em></span></td>
                    <td>{it.kcal}</td><td>{it.p}</td><td>{it.c}</td><td>{it.f}</td>
                    <td><button type="button" className="linkbtn" aria-label={`Remove ${it.name}`} onClick={() => update(i, { items: m.items.filter((_, k) => k !== j) })}>✕</button></td>
                  </tr>
                ))}</tbody>
                <tfoot><tr><td>Meal total</td><td /><td>{t.kcal}</td><td>{t.p}</td><td>{t.c}</td><td>{t.f}</td><td /></tr></tfoot>
              </table></div>
            )}
            {adding === i ? (
              <div className="card" style={{ background: 'var(--surface)' }}>
                <div className="row between"><b>Add to {m.meal}</b><button type="button" className="linkbtn" onClick={() => setAdding(null)}>Done</button></div>
                <FoodPicker foods={foods} addLabel="Add" customLabel="Client foods" onAdd={(f, qty) => update(i, { items: [...m.items, chartItem(f, qty)] })} />
              </div>
            ) : (
              <div className="row">
                <button type="button" className="btn sm ghost" onClick={() => setAdding(i)}>+ Add food</button>
                <button type="button" className="linkbtn" onClick={() => move(i, -1)} aria-label="Move meal up">↑</button>
                <button type="button" className="linkbtn" onClick={() => move(i, 1)} aria-label="Move meal down">↓</button>
                <button type="button" className="linkbtn" onClick={() => setMeals(meals.filter((_, k) => k !== i))}>Remove meal</button>
              </div>
            )}
          </div>
        );
      })}
      <button type="button" className="btn sm ghost" onClick={() => setMeals([...meals, { meal: 'Meal', time: '', items: [] }])}>+ Add meal</button>

      <h3 style={{ marginTop: 8 }}>Weekly workouts</h3>
      <p className="small muted">One exercise per line: <b>name | sets | reps</b>. Leave a day empty for rest.</p>
      <div className="grid2">{WEEKDAYS.map((d) => (
        <label key={d} className="f">{d}<textarea name={`wo_${d}`} value={w[d]} onChange={(e) => setW({ ...w, [d]: e.target.value })} style={{ minHeight: 76 }} placeholder="Goblet squat | 3 | 10-12" /></label>
      ))}</div>
      <label className="row small"><input type="checkbox" name="notify" value="1" defaultChecked /> Tell the client on WhatsApp</label>
      <SubmitButton>Save plan</SubmitButton>
    </ActionForm>
  );
}
