'use client';
import { useState, useTransition } from 'react';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { draftPlanWithAI, savePlans } from './actions';
import { WEEKDAYS } from '@/lib/nutrition';

type Meals = { meal: string; items: string }[];
type Workout = Record<string, { n: string; s: string | number; r: string }[]>;

const toText = (w: Workout) => Object.fromEntries(WEEKDAYS.map((d) => [d, (w[d] ?? []).map((e) => `${e.n} | ${e.s} | ${e.r}`).join('\n')]));
const DEFAULT_MEALS: Meals = [{ meal: 'Breakfast', items: '' }, { meal: 'Lunch', items: '' }, { meal: 'Snacks', items: '' }, { meal: 'Dinner', items: '' }];

export function PlanEditor({ clientId, meals, workout, diet, aiOn }: { clientId: string; meals: Meals; workout: Workout; diet: string; aiOn: boolean }) {
  const [m, setM] = useState<Meals>(meals.length ? meals : DEFAULT_MEALS);
  const [w, setW] = useState<Record<string, string>>(toText(workout));
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();
  const rows = [...m, ...Array(Math.max(0, 6 - m.length)).fill({ meal: '', items: '' })].slice(0, 8);

  const draft = () => start(async () => {
    const r = await draftPlanWithAI(clientId);
    setMsg(r.message);
    if (r.draft) { setM(r.draft.meal_plan); setW(toText(r.draft.workout_plan as Workout)); }
  });

  return (
    <ActionForm action={savePlans}>
      <input type="hidden" name="client_id" value={clientId} />
      <div className="row between">
        <h3>Meal plan</h3>
        <button type="button" className="btn sm ghost" onClick={draft} disabled={!aiOn || pending} title={aiOn ? '' : 'Needs an Anthropic API key'}>{pending ? 'Drafting…' : 'Draft with AI'}</button>
      </div>
      {msg && <p className="banner">{msg}</p>}
      <p className="small muted">{diet} client. Write each meal the way the client will read it. Empty rows are ignored.</p>
      {rows.map((r, i) => (
        <div key={i} className="grid2" style={{ gridTemplateColumns: '140px 1fr' }}>
          <input name={`meal_${i}`} type="text" value={r.meal} onChange={(e) => setM(Object.assign([...rows], { [i]: { ...r, meal: e.target.value } }))} placeholder="Meal" aria-label={`Meal ${i + 1} name`} />
          <input name={`items_${i}`} type="text" value={r.items} onChange={(e) => setM(Object.assign([...rows], { [i]: { ...r, items: e.target.value } }))} placeholder="e.g. 2 idli + sambar + 1 cup curd" aria-label={`Meal ${i + 1} items`} />
        </div>
      ))}
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
