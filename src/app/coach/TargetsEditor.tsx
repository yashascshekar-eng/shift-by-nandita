'use client';
// Daily targets: calories, a preset macro split or Nandita's own C/P/F percentages, water and steps.
import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { saveTargets } from './actions';
import { SPLITS, macros, ratioOf, ratioValid, type Ratio, type SplitChoice, type SplitKey, type Targets } from '@/lib/nutrition';

export function TargetsEditor({ clientId, targets, weightKg, coachNote, bmr, tdee, activity }: {
  clientId: string; targets: Targets; weightKg: number; coachNote: string; bmr: number; tdee: number; activity: string;
}) {
  const [kcal, setKcal] = useState(String(targets.kcal));
  const [split, setSplit] = useState<SplitChoice>(targets.split);
  const [ratio, setRatio] = useState<Ratio>(ratioOf(targets));
  const k = Number(kcal) || 0;
  const r = split === 'custom' ? ratio : ratioOf({ split });
  const m = macros(k, split, ratio);
  const sum = Math.round(ratio.c + ratio.p + ratio.f);
  const customOk = split !== 'custom' || ratioValid(ratio);
  const perKg = (g: number) => (weightKg > 0 ? Math.round((g / weightKg) * 10) / 10 : 0);
  const pick = (s: SplitChoice) => {
    // Starting a custom split from the current preset makes small tweaks easy.
    if (s === 'custom' && split !== 'custom') setRatio(ratioOf({ split }));
    setSplit(s);
  };
  const setPct = (key: keyof Ratio) => (e: React.ChangeEvent<HTMLInputElement>) => setRatio({ ...ratio, [key]: Number(e.target.value) || 0 });

  return (
    <ActionForm action={saveTargets}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="split" value={split} />
      <div className="row between"><h3>Daily targets</h3>{!targets.confirmed && <span className="pill warn">Not confirmed yet</span>}</div>
      <p className="small muted">BMR ≈ <b className="num">{Math.round(bmr)}</b> kcal · TDEE ≈ <b className="num">{Math.round(tdee)}</b> kcal ({activity}) · weight {weightKg} kg</p>
      <label className="f">Daily calories<span className="unit"><input name="kcal" type="number" value={kcal} onChange={(e) => setKcal(e.target.value)} min={900} max={5000} /><em>kcal</em></span></label>

      <div className="split">
        {(Object.entries(SPLITS) as [SplitKey, (typeof SPLITS)[SplitKey]][]).map(([key, s]) => (
          <label key={key}><input type="radio" name="split_pick" checked={split === key} onChange={() => pick(key)} /><b>{s.label}</b><span>C {s.c}% · P {s.p}% · F {s.f}%</span></label>
        ))}
        <label style={{ gridColumn: '1 / -1' }}><input type="radio" name="split_pick" checked={split === 'custom'} onChange={() => pick('custom')} /><b>Custom split</b><span>Set your own carb, protein and fat percentages</span></label>
      </div>

      {split === 'custom' && (
        <div className="card" style={{ background: 'var(--surface-2)' }}>
          <div className="grid3">
            <label className="f">Carbs %<input name="rc" type="number" min={5} max={80} value={ratio.c} onChange={setPct('c')} /></label>
            <label className="f">Protein %<input name="rp" type="number" min={5} max={80} value={ratio.p} onChange={setPct('p')} /></label>
            <label className="f">Fat %<input name="rf" type="number" min={5} max={80} value={ratio.f} onChange={setPct('f')} /></label>
          </div>
          <p className="small" style={{ color: sum === 100 ? 'var(--good)' : 'var(--bad)' }}>Total {sum}%{sum !== 100 ? `: needs to add up to 100 (${sum > 100 ? 'remove' : 'add'} ${Math.abs(100 - sum)})` : ''}</p>
        </div>
      )}

      <div className="stats">
        <div className="stat"><span>Protein</span><b>{m.p} g</b><span className="small muted">{r.p}% · {perKg(m.p)} g/kg</span></div>
        <div className="stat"><span>Carbs</span><b>{m.c} g</b><span className="small muted">{r.c}%</span></div>
        <div className="stat"><span>Fat</span><b>{m.f} g</b><span className="small muted">{r.f}% · {perKg(m.f)} g/kg</span></div>
        <div className="stat"><span>Calories</span><b>{k}</b><span className="small muted">{tdee ? `${k - Math.round(tdee) > 0 ? '+' : ''}${k - Math.round(tdee)} vs TDEE` : ''}</span></div>
      </div>

      <div className="grid2">
        <label className="f">Water<span className="unit"><input name="water" type="number" defaultValue={targets.water} /><em>glasses</em></span></label>
        <label className="f">Steps<input name="steps" type="number" defaultValue={targets.steps} /></label>
      </div>
      <label className="f">Note to client (shows on their plan)<textarea name="coach_note" defaultValue={coachNote} /></label>
      <label className="row small"><input type="checkbox" name="notify" value="1" defaultChecked /> Tell the client</label>
      {customOk ? <SubmitButton>Save and confirm targets</SubmitButton> : <button className="btn" disabled>Percentages must add up to 100</button>}
    </ActionForm>
  );
}
