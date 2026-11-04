'use client';
import { useState } from 'react';
import { ACTIVITY, SPLITS, activityMult, bmr, macros, navyBodyFat, type SplitKey, type Sex } from '@/lib/nutrition';

const METS: [string, number][] = [['Walking, brisk', 4.3], ['Running, 8 km/h', 8.3], ['Cycling, moderate', 6.8], ['Strength training', 5], ['Yoga', 2.5], ['Swimming', 7], ['Skipping', 11], ['Badminton', 5.5], ['Dance workout', 5], ['HIIT', 8]];
const TABS = [['bmr', 'BMR & TDEE'], ['bf', 'Body fat'], ['goal', 'Goal'], ['macro', 'Macros'], ['burn', 'Calories burned']] as const;
type Tab = (typeof TABS)[number][0];

export function Calculators() {
  const [tab, setTab] = useState<Tab>('bmr');
  const [v, setV] = useState({ sex: 'f' as Sex, age: '30', hcm: '162', w: '62', bf: '', act: 'light', waist: '80', neck: '33', hip: '98', tw: '56', weeks: '12', kcal: '1800', split: 'moderate' as SplitKey, met: '0', min: '30' });
  const n = (k: keyof typeof v) => parseFloat(v[k] as string) || 0;
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  const num = (k: keyof typeof v, label: string, unit = '') => (
    <label className="f">{label}<span className="unit"><input id={`calc-${k}`} type="number" inputMode="decimal" value={v[k] as string} onChange={set(k)} />{unit && <em>{unit}</em>}</span></label>
  );
  const sexSeg = (
    <div className="seg">{([['f', 'Female'], ['m', 'Male']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={v.sex === k} onClick={() => setV({ ...v, sex: k })}>{l}</button>)}</div>
  );
  const b = bmr({ sex: v.sex, weightKg: n('w'), heightCm: n('hcm'), age: n('age'), bodyFat: n('bf') });
  const tdee = b * activityMult(v.act);

  let body: React.ReactNode;
  if (tab === 'bmr') {
    body = (<>
      {sexSeg}
      <div className="grid3">{num('age', 'Age', 'yrs')}{num('hcm', 'Height', 'cm')}{num('w', 'Weight', 'kg')}</div>
      {num('bf', 'Body fat (optional)', '%')}
      <label className="f">How active are you?<select id="calc-act" value={v.act} onChange={set('act')}>{ACTIVITY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
      <div className="grid2">
        <div className="res"><span className="small muted">BMR, at complete rest</span><span className="big num">{n('w') ? Math.round(b) : '–'}</span><span className="small muted">kcal a day</span></div>
        <div className="res"><span className="small muted">TDEE, with your activity</span><span className="big num">{n('w') ? Math.round(tdee) : '–'}</span><span className="small muted">kcal a day</span></div>
      </div>
      <p className="small muted">{n('bf') ? 'Katch–McArdle formula, using your lean mass.' : 'Mifflin–St Jeor formula. Add body fat for a lean-mass estimate.'}</p>
    </>);
  } else if (tab === 'bf') {
    const bf = navyBodyFat(v.sex, n('waist'), n('neck'), n('hcm'), n('hip'));
    body = (<>
      {sexSeg}
      <div className="grid2">{num('waist', v.sex === 'f' ? 'Waist, narrowest point' : 'Waist, at the navel', 'cm')}{num('neck', 'Neck, below the larynx', 'cm')}{v.sex === 'f' && num('hip', 'Hips, widest point', 'cm')}{num('hcm', 'Height', 'cm')}</div>
      <div className="res"><span className="small muted">Estimated body fat</span><span className="big num">{isFinite(bf) && bf > 2 && bf < 70 ? `${Math.round(bf * 10) / 10}%` : '–'}</span><span className="small muted">US Navy tape method · measure relaxed, tape snug not tight</span></div>
    </>);
  } else if (tab === 'goal') {
    const delta = ((n('tw') - n('w')) * 7700) / (Math.max(1, n('weeks')) * 7);
    const kcal = tdee + delta;
    const pace = Math.abs(n('tw') - n('w')) / Math.max(1, n('weeks'));
    body = (<>
      <div className="grid3">{num('w', 'Current weight', 'kg')}{num('tw', 'Target weight', 'kg')}{num('weeks', 'Weeks')}</div>
      <p className="small muted">Uses your TDEE from the first tab ({Math.round(tdee)} kcal).</p>
      <div className="res"><span className="small muted">Eat about</span><span className="big num">{n('w') ? Math.round(kcal / 10) * 10 : '–'}</span><span className="small muted">kcal a day · {delta < 0 ? 'deficit' : 'surplus'} of {Math.round(Math.abs(delta))} kcal</span></div>
      {n('w') > 0 && pace > n('w') * 0.01 && <p className="small" style={{ color: 'var(--warn)' }}>That is {Math.round(pace * 10) / 10} kg a week, more than 1% of body weight. Give it more weeks to protect muscle.</p>}
      {n('w') > 0 && kcal < b && <p className="small" style={{ color: 'var(--warn)' }}>This is below your BMR of {Math.round(b)} kcal. Not recommended without a coach.</p>}
    </>);
  } else if (tab === 'macro') {
    const m = macros(n('kcal'), v.split);
    body = (<>
      {num('kcal', 'Calories per day', 'kcal')}
      <div className="split">{(Object.entries(SPLITS) as [SplitKey, (typeof SPLITS)[SplitKey]][]).map(([k, s]) => (
        <label key={k}><input type="radio" name="split" checked={v.split === k} onChange={() => setV({ ...v, split: k })} /><b>{s.label}</b><span>C {s.c}% · P {s.p}% · F {s.f}%</span></label>
      ))}</div>
      <div className="grid3">
        <div className="res"><span className="small" style={{ color: 'var(--mp)', fontWeight: 700 }}>Protein</span><span className="big num">{m.p}g</span></div>
        <div className="res"><span className="small" style={{ color: 'var(--mc)', fontWeight: 700 }}>Carbs</span><span className="big num">{m.c}g</span></div>
        <div className="res"><span className="small" style={{ color: 'var(--mf)', fontWeight: 700 }}>Fat</span><span className="big num">{m.f}g</span></div>
      </div>
    </>);
  } else {
    const met = METS[n('met')] ?? METS[0];
    body = (<>
      <label className="f">Activity<select id="calc-met" value={v.met} onChange={set('met')}>{METS.map((x, i) => <option key={x[0]} value={i}>{x[0]}</option>)}</select></label>
      <div className="grid2">{num('w', 'Body weight', 'kg')}{num('min', 'Time', 'min')}</div>
      <div className="res"><span className="small muted">Roughly burned</span><span className="big num">{n('w') ? Math.round((met[1] * n('w') * n('min')) / 60) : '–'}</span><span className="small muted">kcal · MET {met[1]}</span></div>
    </>);
  }
  return (
    <div className="stack">
      <div className="seg tabs">{TABS.map(([k, l]) => <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="card">{body}</div>
    </div>
  );
}
