import Link from 'next/link';
import { requireClient, supabaseUser } from '@/lib/supabase/server';
import { addDays, istDate, prettyDate, weekdayShort } from '@/lib/dates';
import { ACTIVITY, DIETS, draftTargets, ENERGY, GOALS, MEAL_SLOTS, SLOT_LABEL, splitLabel, WEEKDAYS, totals, type Targets } from '@/lib/nutrition';
import { Bar, Ring } from '@/components/Charts';
import { DietChartView } from '@/components/DietChart';
import { METRICS, ProgressView, mergeRows, type MetricKey } from '@/components/Progress';
import { Calculators } from '../tools/Calculators';
import { MealLogger } from './MealLogger';
import { istHourMinute, slotForTime } from '@/lib/dates';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import type { Client, Food, Log, Meal, Measurement, WorkoutItem } from '@/lib/types';
import { deleteMeal, deleteMeasurement, logChartMeal, saveBodyFat, saveCheckin, saveIntake, saveMeasurement } from './actions';

export const metadata = { title: 'My plan' };
export const dynamic = 'force-dynamic';

export default async function Me({ searchParams }: { searchParams: { date?: string; tab?: string; saved?: string; error?: string; metric?: string } }) {
  const { client } = await requireClient();
  if (!client && searchParams.error === 'exists') return (
    <main className="narrow stack"><h1 style={{ fontSize: 28 }}>Almost there</h1>
      <p className="banner">Your number already has a SHIFT record from WhatsApp. Message Nandita and she&rsquo;ll connect it to this login in a minute.</p></main>
  );
  if (!client) return <Intake error={searchParams.error === 'intake'} />;

  const today = istDate();
  const date = searchParams.date && searchParams.date <= today && searchParams.date >= addDays(today, -60) ? searchParams.date : today;
  const tab = ['today', 'plan', 'progress', 'tools'].includes(searchParams.tab ?? '') ? searchParams.tab! : 'today';
  const sb = supabaseUser(); // reads go through RLS as this client
  const week = [...Array(7)].map((_, i) => addDays(today, i - 6));
  const [{ data: meals }, { data: logs }, { data: foods }, { data: favs }, { data: recentMeals }, { data: ms }, { data: exs }] = await Promise.all([
    sb.from('meals').select('*').eq('client_id', client.id).eq('date', date).order('created_at'),
    sb.from('logs').select('*').eq('client_id', client.id).gte('date', addDays(today, -365)).order('date'),
    tab === 'today' ? sb.from('foods').select('*').eq('archived', false).order('name') : Promise.resolve({ data: [] }),
    tab === 'today' ? sb.from('favourites').select('food_id').eq('client_id', client.id) : Promise.resolve({ data: [] }),
    tab === 'today' ? sb.from('meals').select('food_id').eq('client_id', client.id).not('food_id', 'is', null).order('created_at', { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    tab === 'progress' ? sb.from('measurements').select('*').eq('client_id', client.id).order('date') : Promise.resolve({ data: [] }),
    tab === 'today' ? sb.from('exercises').select('name, cue, video_url') : Promise.resolve({ data: [] }),
  ]);
  const exInfo = Object.fromEntries(((exs ?? []) as { name: string; cue: string | null; video_url: string | null }[]).map((e) => [e.name.toLowerCase(), e]));
  const recents = [...new Set(((recentMeals ?? []) as { food_id: string }[]).map((m) => m.food_id))].slice(0, 20);
  const allLogs = (logs ?? []) as Log[];
  const log = allLogs.find((l) => l.date === date);
  const T = client.targets ?? draftTargets(client);
  const t = totals((meals ?? []) as Meal[]);
  const left = T.kcal - t.kcal;
  const tabLink = (k: string, l: string) => <Link href={`/me?tab=${k}${k === 'today' ? `&date=${date}` : ''}`} aria-current={tab === k ? 'page' : undefined}>{l}</Link>;
  const metric = (METRICS.some(([k]) => k === searchParams.metric) ? searchParams.metric : 'weight') as MetricKey;

  return (
    <main className="narrow stack">
      <div className="row between">
        <div><h1 style={{ fontSize: 28 }}>Hi {client.name?.split(' ')[0] ?? 'there'}</h1><p className="small muted">{GOALS[client.goal ?? 'lose']}{client.status !== 'active' ? ' · plan not started yet' : ''}</p></div>
        {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && <a className="btn sm ghost" href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}>Open WhatsApp</a>}
      </div>
      <div className="seg">{tabLink('today', 'Today')}{tabLink('plan', 'Diet chart')}{tabLink('progress', 'Progress')}{tabLink('tools', 'Calculators')}</div>
      {searchParams.saved && <p className="banner">{searchParams.saved === 'measure' ? 'Measurements saved.' : searchParams.saved === 'meal' ? 'Meal logged from your diet chart.' : 'Check-in saved.'}</p>}
      {searchParams.error === 'measure' && <p className="banner err">Some measurements were out of range. Use kg for weight and cm for the tape measurements.</p>}
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
              <span><b>{SLOT_LABEL[m.slot]}</b><span className={`src ${m.source}`}>{m.source === 'whatsapp' ? 'WhatsApp' : m.source === 'coach' ? 'Coach' : 'Web'}</span><br /><span className="small">{m.name}{m.qty ? ` · ${Number(m.qty)} ${m.unit ?? ''}` : ''}</span></span>
              <span className="row small num" style={{ gap: 6 }}>{Math.round(Number(m.kcal))} kcal
                <form action={deleteMeal}><input type="hidden" name="id" value={m.id} /><button className="linkbtn" aria-label={`Remove ${m.name}`}>✕</button></form></span>
            </div>
          )) : <p className="small muted">Nothing logged for this day yet.</p>}
        </div>
        <MealLogger foods={(foods ?? []) as Food[]} favourites={((favs ?? []) as { food_id: string }[]).map((f) => f.food_id)} recents={recents} date={date} defaultSlot={date === today ? slotForTime(istHourMinute()) : 'lunch'} />

        <Workout plan={client.workout_plan?.[weekdayShort(date)] ?? []} day={weekdayShort(date)} info={exInfo} />

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
            <div className="res"><span className="small muted">{splitLabel(T)}</span><b className="num">P {T.p}g · C {T.c}g · F {T.f}g</b><span className="small muted">Water {T.water} glasses · {T.steps.toLocaleString('en-IN')} steps</span></div>
          </div>
        </div>
        {client.coach_note && <div className="card"><h3>From Nandita</h3><div className="note">{client.coach_note}</div></div>}
        <PlanMeals client={client} targets={T} today={today} />
        <div className="card"><h3>Weekly workouts</h3>{WEEKDAYS.map((d) => {
          const x = client.workout_plan?.[d] ?? [];
          return <div key={d} className="meal" style={{ gridTemplateColumns: '1fr' }}><b>{d}{!x.length && <span className="small muted"> · Rest</span>}</b>{x.map((e, i) => <div className="ex" key={i}><span>{e.n}</span><span className="muted num">{e.s} × {e.r}{e.rest ? ` · ${e.rest}` : ''}</span></div>)}</div>;
        })}</div>
      </>)}

      {tab === 'progress' && (<>
        <ProgressView rows={mergeRows(allLogs, (ms ?? []) as Measurement[])} metric={metric} hrefFor={(m) => `/me?tab=progress&metric=${m}`} deleteAction={deleteMeasurement} startWeight={Number(client.weight_kg)} targetWeight={client.target_weight} />
        <MeasureForm today={today} />
        <Streak logs={allLogs} today={today} />
      </>)}
      {tab === 'tools' && (<>
        <Calculators prefill={{ sex: (client.sex ?? 'f') as 'f' | 'm', age: String(client.age ?? ''), hcm: String(client.height_cm ?? ''), w: String(allLogs.filter((l) => l.weight).pop()?.weight ?? client.weight_kg ?? ''), act: client.activity ?? 'light', tw: String(client.target_weight ?? ''), kcal: String(T.kcal) }} onSaveBodyFat={saveBodyFat} />
        <p className="small muted">Your details are filled in from your profile. Body fat from the tape method can be saved to your progress.</p>
      </>)}
    </main>
  );
}

function Workout({ plan, day, info }: { plan: WorkoutItem[]; day: string; info: Record<string, { cue: string | null; video_url: string | null }> }) {
  return (
    <div className="card">
      <div className="row between"><h3>Workout · {day}</h3>{!plan.length && <span className="pill">Rest day</span>}</div>
      {plan.length ? <div>{plan.map((e, i) => {
        const x = info[e.n.toLowerCase()];
        return (
          <div className="ex" key={i} style={{ alignItems: 'start' }}>
            <div style={{ minWidth: 0 }}>
              <b>{e.n}</b>
              <details className="small"><summary style={{ cursor: 'pointer', color: 'var(--brand)' }}>Show me how</summary><ExerciseDemo name={e.n} videoUrl={x?.video_url} cue={x?.cue} note={e.note} /></details>
            </div>
            <span className="muted num" style={{ textAlign: 'right' }}>{e.s} × {e.r}{e.rest ? <><br />rest {e.rest}</> : null}</span>
          </div>
        );
      })}</div> : <p className="small muted">No workout planned. A 30 minute walk still counts.</p>}
    </div>
  );
}

function Streak({ logs, today }: { logs: Log[]; today: string }) {
  const days = [...Array(14)].map((_, i) => addDays(today, i - 13));
  const logged = days.filter((d) => logs.some((l) => l.date === d)).length;
  return <div className="card"><div className="row between"><h3>Last 14 days</h3><span className={`pill ${logged >= 10 ? 'good' : logged >= 6 ? '' : 'warn'}`}>{logged}/14 days checked in</span></div></div>;
}

function MeasureForm({ today }: { today: string }) {
  const field = (name: string, label: string, unit: string, step = '0.1') => (
    <label className="f">{label}<span className="unit"><input name={name} type="number" step={step} inputMode="decimal" /><em>{unit}</em></span></label>
  );
  return (
    <form action={saveMeasurement} className="card">
      <div className="row between"><h3>Add measurements</h3><input name="date" type="date" defaultValue={today} max={today} style={{ width: 'auto' }} aria-label="Date" /></div>
      <p className="small muted">Measure in the morning, before food. Fill in only what you measured.</p>
      <div className="grid3">
        {field('weight', 'Weight', 'kg')}{field('waist', 'Waist', 'cm')}{field('hip', 'Hip', 'cm')}
        {field('chest', 'Chest', 'cm')}{field('arm', 'Arm', 'cm')}{field('thigh', 'Thigh', 'cm')}
        {field('neck', 'Neck', 'cm')}{field('body_fat', 'Body fat', '%')}
      </div>
      <button className="btn">Save measurements</button>
    </form>
  );
}

function PlanMeals({ client, targets, today }: { client: Client; targets: Targets; today: string }) {
  if (client.diet_chart?.length) {
    return <DietChartView chart={client.diet_chart} targets={targets} logForm={(i) => (
      <form action={logChartMeal} className="row">
        <input type="hidden" name="meal" value={i} /><input type="hidden" name="date" value={today} />
        <select name="slot" defaultValue={guessSlot(client.diet_chart[i].meal)} aria-label="Log as" style={{ width: 'auto' }}>{MEAL_SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}</select>
        <button className="btn sm ghost">I ate this today</button>
      </form>
    )} />;
  }
  if (client.meal_plan?.length) {
    return <div className="card"><h3>Meal plan</h3>{client.meal_plan.map((m, i) => <div className="meal" key={i}><span><b>{m.meal}</b><br /><span className="muted" style={{ whiteSpace: 'pre-wrap' }}>{m.items}</span></span></div>)}</div>;
  }
  return <div className="card"><h3>Diet chart</h3><p className="small muted">Your diet chart appears here once Nandita writes it.</p></div>;
}

function guessSlot(meal: string): string {
  const m = meal.toLowerCase();
  if (/break|morning|early/.test(m)) return 'breakfast';
  if (/lunch/.test(m)) return 'lunch';
  if (/dinner|night/.test(m)) return 'dinner';
  return 'snacks';
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
