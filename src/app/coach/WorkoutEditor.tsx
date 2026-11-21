'use client';
// Weekly workout builder: pick from Nandita's exercise library by muscle group, set sets / reps / rest per day,
// start from a template, or save this week as a new template.
import { useMemo, useState, useTransition } from 'react';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { saveTemplate, saveWorkout } from './actions';
import { WEEKDAYS } from '@/lib/nutrition';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import type { Exercise, WorkoutItem, WorkoutPlan, WorkoutTemplate } from '@/lib/types';

const GROUPS = ['All', 'Chest', 'Back', 'Shoulders', 'Lower body', 'Abs', 'Cardio'];
const clean = (p: WorkoutPlan): WorkoutPlan => Object.fromEntries(WEEKDAYS.filter((d) => p[d]?.length).map((d) => [d, p[d]]));

export function WorkoutEditor({ clientId, plan, exercises, templates }: {
  clientId: string; plan: WorkoutPlan; exercises: Exercise[]; templates: WorkoutTemplate[];
}) {
  const [w, setW] = useState<WorkoutPlan>(clean(plan));
  const [day, setDay] = useState<string>(WEEKDAYS.find((d) => plan[d]?.length) ?? 'Mon');
  const [group, setGroup] = useState('All');
  const [q, setQ] = useState('');
  const [tplName, setTplName] = useState('');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const byName = useMemo(() => new Map(exercises.map((e) => [e.name.toLowerCase(), e])), [exercises]);
  const groups = GROUPS.filter((g) => g === 'All' || exercises.some((e) => e.muscle_group === g)).concat(
    [...new Set(exercises.map((e) => e.muscle_group))].filter((g) => !GROUPS.includes(g)),
  );

  const items = w[day] ?? [];
  const setItems = (next: WorkoutItem[]) => setW({ ...w, [day]: next });
  const patch = (i: number, p: Partial<WorkoutItem>) => setItems(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const move = (i: number, d: number) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(Math.max(0, Math.min(n.length, i + d)), 0, x); setItems(n); };
  const add = (e: Exercise) => setItems([...items, e.muscle_group === 'Cardio' ? { n: e.name, s: '1', r: '30 min', rest: '' } : { n: e.name, s: '3', r: '12', rest: '60s' }]);

  const list = exercises.filter((e) => (group === 'All' || e.muscle_group === group) && e.name.toLowerCase().includes(q.trim().toLowerCase()));
  const applyTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setW(clean(t.days));
    setDay(WEEKDAYS.find((d) => t.days[d]?.length) ?? 'Mon');
    setMsg(`Loaded "${t.name}". Adjust it for this client, then save.`);
  };
  const saveTpl = () => start(async () => {
    const r = await saveTemplate(tplName, '', JSON.stringify(clean(w)));
    setMsg(r.message);
    if (r.ok) setTplName('');
  });

  return (
    <ActionForm action={saveWorkout}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="workout" value={JSON.stringify(clean(w))} />
      <div className="row between">
        <h3>Weekly workouts</h3>
        {templates.length > 0 && (
          <select aria-label="Start from a template" value="" onChange={(e) => applyTemplate(e.target.value)} style={{ maxWidth: 260 }}>
            <option value="">Start from a template…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.is_demo ? 'Demo · ' : ''}{t.name}</option>)}
          </select>
        )}
      </div>
      {msg && <p className="banner">{msg}</p>}

      <nav className="seg" aria-label="Day">
        {WEEKDAYS.map((d) => (
          <button key={d} type="button" aria-current={day === d ? 'page' : undefined} onClick={() => setDay(d)}>
            {d}{w[d]?.length ? ` · ${w[d].length}` : ''}
          </button>
        ))}
      </nav>

      <div className="log">
        <div className="row between"><b>{day}</b><span className="small muted">{items.length ? `${items.length} exercise${items.length > 1 ? 's' : ''}` : 'Rest day'}</span></div>
        {items.length > 0 && (
          <div className="scroll"><table className="tbl">
            <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th><th>Note</th><th /></tr></thead>
            <tbody>{items.map((it, i) => {
              const ex = byName.get(it.n.toLowerCase());
              return (
                <tr key={i}>
                  <td style={{ minWidth: 160 }}><b>{it.n}</b>{ex && <div className="small muted">{ex.muscle_group} · {ex.equipment}</div>}</td>
                  <td><input type="text" value={String(it.s)} onChange={(e) => patch(i, { s: e.target.value })} aria-label={`Sets for ${it.n}`} style={{ width: 52 }} /></td>
                  <td><input type="text" value={it.r} onChange={(e) => patch(i, { r: e.target.value })} aria-label={`Reps for ${it.n}`} style={{ width: 84 }} /></td>
                  <td><input type="text" value={it.rest ?? ''} onChange={(e) => patch(i, { rest: e.target.value })} aria-label={`Rest for ${it.n}`} style={{ width: 60 }} placeholder="60s" /></td>
                  <td><input type="text" value={it.note ?? ''} onChange={(e) => patch(i, { note: e.target.value })} aria-label={`Note for ${it.n}`} style={{ width: 150 }} placeholder="Optional" /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="linkbtn" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button type="button" className="linkbtn" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button type="button" className="linkbtn" onClick={() => setItems(items.filter((_, k) => k !== i))} aria-label={`Remove ${it.n}`}>✕</button>
                  </td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
        <div className="row">
          {items.length > 0 && <button type="button" className="linkbtn" onClick={() => setItems([])}>Make {day} a rest day</button>}
          {WEEKDAYS.filter((d) => d !== day && w[d]?.length).length > 0 && (
            <select aria-label={`Copy another day into ${day}`} value="" onChange={(e) => e.target.value && setItems((w[e.target.value] ?? []).map((x) => ({ ...x })))} style={{ maxWidth: 180 }}>
              <option value="">Copy from…</option>
              {WEEKDAYS.filter((d) => d !== day && w[d]?.length).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="card" style={{ background: 'var(--surface-2)' }}>
        <div className="row between"><b>Add to {day}</b><span className="small muted">{exercises.length} in the library</span></div>
        <div className="seg" role="group" aria-label="Muscle group" style={{ flexWrap: 'wrap' }}>
          {groups.map((g) => <button key={g} type="button" aria-current={group === g ? 'page' : undefined} onClick={() => setGroup(g)}>{g}</button>)}
        </div>
        <input type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
        {(() => {
          const p = exercises.find((x) => x.id === preview);
          return p ? (
            <div className="log">
              <div className="row between"><b>{p.name}</b><button type="button" className="linkbtn small" onClick={() => setPreview(null)}>Close</button></div>
              <ExerciseDemo name={p.name} videoUrl={p.video_url} cue={p.cue} />
              <button type="button" className="btn sm ghost" onClick={() => add(p)}>+ Add to {day}</button>
            </div>
          ) : null;
        })()}
        <div className="stack" style={{ gap: 6, maxHeight: 320, overflowY: 'auto' }}>
          {list.map((e) => (
            <div key={e.id} className="stack" style={{ gap: 6 }}>
              <div className="row between" style={{ flexWrap: 'nowrap', gap: 8 }}>
                <div style={{ minWidth: 0 }}><b>{e.name}</b><div className="small muted">{e.muscle_group} · {e.equipment}</div></div>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <button type="button" className="linkbtn small" onClick={() => setPreview(preview === e.id ? null : e.id)}>{preview === e.id ? 'Hide' : 'Demo'}</button>
                  <button type="button" className="btn sm ghost" onClick={() => add(e)}>+ Add</button>
                </div>
              </div>
            </div>
          ))}
          {!list.length && <p className="small muted">No match. Add new exercises under Exercises in the coach menu.</p>}
        </div>
      </div>

      <label className="row small"><input type="checkbox" name="notify" value="1" defaultChecked /> Tell the client</label>
      <div className="row">
        <SubmitButton>Save workouts</SubmitButton>
        <input type="text" value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Template name" aria-label="Template name" style={{ maxWidth: 200 }} />
        <button type="button" className="btn sm ghost" onClick={saveTpl} disabled={pending || !tplName.trim()}>{pending ? 'Saving…' : 'Save week as template'}</button>
      </div>
    </ActionForm>
  );
}
