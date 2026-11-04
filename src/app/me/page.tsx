import Link from 'next/link';
import { requireClient, supabaseUser } from '@/lib/supabase/server';
import { addDays, istDate, prettyDate, weekdayShort } from '@/lib/dates';
import { ACTIVITY, DIETS, draftTargets, ENERGY, GOALS, MEAL_SLOTS, SLOT_LABEL, SPLITS, WEEKDAYS, totals } from '@/lib/nutrition';
import { FOODS } from '@/lib/foods';
import { Bar, Ring, WeightChart } from '@/components/Charts';
import type { Log, Meal } from '@/lib/types';
import { addMeal, deleteMeal, saveCheckin, saveIntake } from './actions';

export const metadata = { title: 'My plan' };
export const dynamic = 'force-dynamic';

export default async function Me({ searchParams }: { searchParams: { date?: string; tab?: string; saved?: string; error?: string } }) {
  const { client } = await requireClient();
  if (!client) return <Intake error={searchParams.error === 'intake'} />;

  const today = istDate();
  const date = searchParams.date && searchParams.date <= today && searchParams.date >= addDays(today, -60) ? searchParams.date : today;
  const tab = ['today', 'plan', 'progress'].includes(searchParams.tab ?? '') ? searchParams.tab! : 'today';
  const sb = supabaseUser(); // reads go through RLS as this client
  const week = [...Array(7)].map((_, i) => addDays(today, i - 6));
  const [{ data: meals }, { data: logs }] = await Promise.all([
    sb.from('meals').select('*').eq('client_id', client.id).eq('date', date).order('created_at'),
    sb.from('logs').select('*').eq('client_id', client.id).gte('date', addDays(today, -60)).order('date'),
  ]);
  const allLogs = (logs ?? []) as Log[];
  const log = allLogs.find((l) => l.date === date);
  const T = client.targets ?? draftTargets(client);
  const t = totals((meals ?? []) as Meal[]);
  const left = T.kcal - t.kcal;
  const tabLink = (k: string, l: string) => <Link href={`/me?tab=${k}${k === 'today' ? `&date=${date}` : ''}`} aria-current={tab === k ? 'page' : undefined}>{l}</Link>;

  return (
    <main className="narrow stack">
      <div className="row between">
        <div><h1 style={{ fontSize: 28 }}>Hi {client.name?.split(' ')[0] ?? 'there'}</h1><p className="small muted">{GOALS[client.goal ?? 'lose']}{client.status !== 'active' ? ' · plan not started yet' : ''}</p></div>
        {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && <a className="btn sm ghost" href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}>Open WhatsApp</a>}
      </div>
      <div className="seg">{tabLink('today', 'Today')}{tabLink('plan', 'My plan')}{tabLink('progress', 'Progress')}</div>
      {searchParams.saved && <p className="banner">Check-in saved.</p>}
      {searchParams.error === 'checkin' && <p className="banner err">Some check-in values were out of range. Check weight, water and steps.</p>}

      {tab === 'today' && (<>
        <div className="dates">{week.map((d) => (
          <Link key={d} href={`/me?date=${d}`} aria-current={d === date ? 'page' : undefined} className={allLogs.some((l) => l.date === d) ? 'has' : ''}>
            <span>{weekdayShort(d)}</span><b className="num">{Number(d.slice(8))}</b><i />
          </Link>
        ))}</div>
        {!T.confirmed && <p className="banner">These are starting targets from your details. Nandita will review and confirm them.</p>}
        <div className="card">
          <div className="ringwrap"><Ring eaten={t.kcal} target={T.kcal} /><div className="bars">
            <Bar label="Protein" value={t.p} target={T.p} color="var(--mp)" /><Bar label="Carbs" value={t.c} target={T.c} color="var(--mc)" /><Bar label="Fat" value={t.f} target={T.f} color="var(--mf)" />
          </div></div>
          <p className="small" style={{ fontWeight: 600 }}>{left >= 0 ? `${Math.round(left)} kcal left for ${date === today ? 'today' : prettyDate(date)}` : <span style={{ color: 'var(--warn)' }}>{Math.round(-left)} kcal over target</span>}</p>
        </div>

        <div className="card">
          <div className="row between"><h3>Meals</h3><span className="small muted">Or send a photo on WhatsApp</span></div>
          {(meals ?? []).length ? (meals as Meal[]).map((m) => (
            <div className="meal" key={m.id}>
              <span><b>{SLOT_LABEL[m.slot]}</b><span className={`src ${m.source}`}>{m.source === 'whatsapp' ? 'WhatsApp' : m.source === 'coach' ? 'Coach' : 'Web'}</span><br /><span className="small">{m.name}</span></span>
              <span className="row small num" style={{ gap: 6 }}>{Math.round(Number(m.kcal))} kcal
                <form action={deleteMeal}><input type="hidden" name="id" value={m.id} /><button className="linkbtn" aria-label={`Remove ${m.name}`}>✕</button></form></span>
            </div>
          )) : <p className="small muted">Nothing logged for this day yet.</p>}
          <form action={addMeal} className="addrow">
            <input type="hidden" name="date" value={date} />
            <select name="food" aria-label="Food">{FOODS.map((f) => <option key={f.key} value={f.key}>{f.name} · {f.kcal} kcal/{f.unit}</option>)}</select>
            <input name="qty" type="number" step="0.5" min="0.5" defaultValue="1" aria-label="Quantity" />
            <select name="slot" aria-label="Meal" defaultValue={date === today ? undefined : 'lunch'}>{MEAL_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select>
            <button className="btn sm">Add</button>
          </form>
          <details><summary className="small" style={{ cursor: 'pointer' }}>Add something not in the list</summary>
            <form action={addMeal} className="grid3" style={{ marginTop: 8 }}>
              <input type="hidden" name="date" value={date} />
              <input name="custom_name" type="text" placeholder="Food" required style={{ gridColumn: '1/-1' }} />
              <input name="custom_kcal" type="number" placeholder="kcal" required /><input name="custom_p" type="number" placeholder="Protein g" /><input name="custom_c" type="number" placeholder="Carbs g" />
              <input name="custom_f" type="number" placeholder="Fat g" />
              <select name="slot" aria-label="Meal">{MEAL_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select>
              <button className="btn sm">Add</button>
            </form>
          </details>
        </div>

        <Workout plan={client.workout_plan?.[weekdayShort(date)] ?? []} day={weekdayShort(date)} />

        <form action={saveCheckin} className="card">
          <h3>Check-in · {date === today ? 'today' : prettyDate(date)}</h3>
          <input type="hidden" name="date" value={date} />
          <div className="grid3">
            <label className="f">Weight<span className="unit"><input name="weight" type="number" step="0.1" defaultValue={log?.weight ?? ''} /><em>kg</em></span></label>
            <label className="f">Water<span className="unit"><input name="water" type="number" defaultValue={log?.water ?? ''} /><em>/ {T.water}</em></span></label>
            <label className="f">Steps<input name="steps" type="number" defaultValue={log?.steps ?? ''} /></label>
          </div>
          <div className="grid2">
            <label className="f">Workout<select name="workout" defaultValue={log?.workout ?? ''}><option value="">Not logged</option><option value="done">All done</option><option value="partial">Partly done</option><option value="skipped">Skipped</option></select></label>
            <label className="f">Energy<select name="energy" defaultValue={log?.energy ?? ''}><option value="">Not logged</option>{ENERGY.map((e, i) => <option key={e} value={i + 1}>{e}</option>)}</select></label>
          </div>
          <label className="f">Note for Nandita<textarea name="note" defaultValue={log?.note ?? ''} placeholder="Cravings, missed meals, pain, a win" /></label>
          {log?.coach_reply && <div className="note"><b>Nandita:</b> {log.coach_reply}</div>}
          <button className="btn">Save check-in</button>
        </form>
      </>)}

      {tab === 'plan' && (<>
        <div className="card">
          <div className="row between"><h3>Daily targets</h3><span className={`pill ${T.confirmed ? 'good' : 'warn'}`}>{T.confirmed ? 'Set by Nandita' : 'Awaiting review'}</span></div>
          <div className="grid2">
            <div className="res"><span className="small muted">Calories</span><span className="big num">{T.kcal}</span></div>
            <div className="res"><span className="small muted">{SPLITS[T.split]?.label}</span><b className="num">P {T.p}g · C {T.c}g · F {T.f}g</b><span className="small muted">Water {T.water} glasses · {T.steps.toLocaleString('en-IN')} steps</span></div>
          </div>
        </div>
        {client.coach_note && <div className="card"><h3>From Nandita</h3><div className="note">{client.coach_note}</div></div>}
        <div className="card"><h3>Meal plan</h3>{client.meal_plan?.length ? client.meal_plan.map((m, i) => <div className="meal" key={i}><span><b>{m.meal}</b><br /><span className="muted" style={{ whiteSpace: 'pre-wrap' }}>{m.items}</span></span></div>) : <p className="small muted">Your meal plan appears here once Nandita writes it.</p>}</div>
        <div className="card"><h3>Weekly workouts</h3>{WEEKDAYS.map((d) => {
          const x = client.workout_plan?.[d] ?? [];
          return <div key={d} className="meal" style={{ gridTemplateColumns: '1fr' }}><b>{d}{!x.length && <span className="small muted"> · Rest</span>}</b>{x.map((e, i) => <div className="ex" key={i}><span>{e.n}</span><span className="muted num">{e.s} × {e.r}</span></div>)}</div>;
        })}</div>
      </>)}

      {tab === 'progress' && <Progress logs={allLogs} start={Number(client.weight_kg)} target={client.target_weight} today={today} />}
    </main>
  );
}

function Workout({ plan, day }: { plan: { n: string; s: string | number; r: string }[]; day: string }) {
  return (
    <div className="card">
      <div className="row between"><h3>Workout · {day}</h3>{!plan.length && <span className="pill">Rest day</span>}</div>
      {plan.length ? <div>{plan.map((e, i) => <div className="ex" key={i}><b>{e.n}</b><span className="muted num">{e.s} sets × {e.r}</span></div>)}</div> : <p className="small muted">No workout planned. A 30 minute walk still counts.</p>}
    </div>
  );
}

function Progress({ logs, start, target, today }: { logs: Log[]; start: number; target: number | null; today: string }) {
  const ws = logs.filter((l) => l.weight).map((l) => ({ date: l.date, weight: Number(l.weight) }));
  const first = ws[0]?.weight ?? start, now = ws[ws.length - 1]?.weight ?? first;
  const days = [...Array(14)].map((_, i) => addDays(today, i - 13));
  const logged = days.filter((d) => logs.some((l) => l.date === d)).length;
  return (<>
    <div className="grid3">
      <div className="res"><span className="small muted">Start</span><span className="big num" style={{ fontSize: 24 }}>{first}</span><span className="small muted">kg</span></div>
      <div className="res"><span className="small muted">Now</span><span className="big num" style={{ fontSize: 24 }}>{now}</span><span className="small muted">kg</span></div>
      <div className="res"><span className="small muted">Change</span><span className="big num" style={{ fontSize: 24 }}>{now - first > 0 ? '+' : ''}{Math.round((now - first) * 10) / 10}</span><span className="small muted">kg{target ? ` · goal ${target}` : ''}</span></div>
    </div>
    <div className="card"><h3>Weight</h3><WeightChart points={ws} /></div>
    <div className="card"><div className="row between"><h3>Last 14 days</h3><span className={`pill ${logged >= 10 ? 'good' : logged >= 6 ? '' : 'warn'}`}>{logged}/14 days checked in</span></div></div>
  </>);
}

function Intake({ error }: { error: boolean }) {
  const radio = (name: string, opts: [string, string][], def: string) => (
    <div className="seg">{opts.map(([v, l]) => <label key={v}><input type="radio" name={name} value={v} defaultChecked={v === def} />{l}</label>)}</div>
  );
  return (
    <main className="narrow stack">
      <h1 style={{ fontSize: 28 }}>Start with SHIFT</h1>
      <p className="muted">Tell Nandita about yourself. You can also do this on WhatsApp by saying hi.</p>
      {error && <p className="banner err">Please check the highlighted details: name, age, height and weight are needed.</p>}
      <form action={saveIntake} className="card">
        <label className="f">Your name<input name="name" type="text" required minLength={2} /></label>
        <div className="f"><span className="small" style={{ fontWeight: 600 }}>Sex (for the calorie formula)</span>{radio('sex', [['f', 'Female'], ['m', 'Male']], 'f')}</div>
        <div className="grid3">
          <label className="f">Age<input name="age" type="number" required min={14} max={90} /></label>
          <label className="f">Height<span className="unit"><input name="height_cm" type="number" required min={120} max={220} /><em>cm</em></span></label>
          <label className="f">Weight<span className="unit"><input name="weight_kg" type="number" step="0.1" required min={30} max={250} /><em>kg</em></span></label>
        </div>
        <div className="f"><span className="small" style={{ fontWeight: 600 }}>Main goal</span>{radio('goal', Object.entries(GOALS), 'lose')}</div>
        <label className="f">Target weight (optional)<span className="unit"><input name="target_weight" type="number" step="0.1" /><em>kg</em></span></label>
        <label className="f">How active are you?<select name="activity" defaultValue="light">{ACTIVITY.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}</select></label>
        <div className="f"><span className="small" style={{ fontWeight: 600 }}>Food preference</span>{radio('diet', Object.entries(DIETS), 'veg')}</div>
        <label className="f">Routine, injuries, foods you avoid<textarea name="notes" placeholder="e.g. Night shifts, lower back pain, no mushrooms" /></label>
        <button className="btn block">Send to Nandita</button>
      </form>
    </main>
  );
}
