import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireCoach, supabaseUser } from '@/lib/supabase/server';
import { addDays, istDate, prettyDate } from '@/lib/dates';
import { ACTIVITY, DIETS, ENERGY, GOALS, SLOT_LABEL, SPLITS, activityMult, bmr, draftTargets, macros, totals, type Sex, type SplitKey } from '@/lib/nutrition';
import { within24h } from '@/lib/dates';
import { aiEnabled } from '@/lib/ai';
import { WeightChart } from '@/components/Charts';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import type { Client, Food, Log, Meal, Measurement } from '@/lib/types';
import { METRICS, ProgressView, mergeRows, type MetricKey } from '@/components/Progress';
import { messageClient, replyToLog, saveStatus, saveTargets, sendPaymentLink } from '../actions';
import { PlanEditor } from '../PlanEditor';
import { clientStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';
const TABS = [['checkins', 'Check-ins'], ['progress', 'Progress'], ['targets', 'Targets'], ['plan', 'Diet chart & workouts'], ['chat', 'WhatsApp'], ['profile', 'Profile & plan']] as const;

export default async function ClientPage({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string; metric?: string } }) {
  await requireCoach();
  const sb = supabaseUser();
  const { data } = await sb.from('clients').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const c = data as Client;
  const tab = TABS.some(([k]) => k === searchParams.tab) ? searchParams.tab! : 'checkins';
  const st = clientStatus(c);
  const windowOpen = within24h(c.last_inbound_at);

  return (
    <main className="wrap stack" style={{ paddingBottom: 48 }}>
      <Link href="/coach" className="small">← All clients</Link>
      <div className="row between">
        <div><h1 style={{ fontSize: 28 }}>{c.name || c.phone}</h1><p className="small muted">{GOALS[c.goal ?? 'lose']} · {DIETS[c.diet ?? 'veg']} · +{c.phone}</p></div>
        <div className="row"><span className="pill">{c.status}</span><span className={`pill ${st.tone}`}>{st.label}</span></div>
      </div>
      <nav className="seg tabs">{TABS.map(([k, l]) => <Link key={k} href={`/coach/${c.id}?tab=${k}`} aria-current={tab === k ? 'page' : undefined}>{l}</Link>)}</nav>
      <p className="small muted">{windowOpen ? 'Messaged in the last 24 hours: your messages go as normal WhatsApp replies.' : 'No message in the last 24 hours: your messages go as the coach template.'}</p>
      {tab === 'checkins' && <Checkins c={c} />}
      {tab === 'targets' && <Targets c={c} />}
      {tab === 'plan' && <Plan c={c} />}
      {tab === 'progress' && <ClientProgress c={c} metric={(METRICS.some(([k]) => k === searchParams.metric) ? searchParams.metric : 'weight') as MetricKey} />}
      {tab === 'chat' && <Chat c={c} />}
      {tab === 'profile' && <Profile c={c} />}
    </main>
  );
}

async function Checkins({ c }: { c: Client }) {
  const sb = supabaseUser();
  const from = addDays(istDate(), -13);
  const [{ data: logs }, { data: meals }, { data: weights }] = await Promise.all([
    sb.from('logs').select('*').eq('client_id', c.id).gte('date', from).order('date', { ascending: false }),
    sb.from('meals').select('*').eq('client_id', c.id).gte('date', from).order('created_at'),
    sb.from('logs').select('date,weight').eq('client_id', c.id).not('weight', 'is', null).gte('date', addDays(istDate(), -60)),
  ]);
  const T = c.targets ?? draftTargets(c);
  const dates = [...new Set([...(logs ?? []).map((l) => l.date), ...(meals ?? []).map((m) => m.date)])].sort().reverse();
  const photoPaths = (meals ?? []).map((m) => m.photo_path).filter(Boolean) as string[];
  const signed = photoPaths.length ? (await sb.storage.from('meal-photos').createSignedUrls(photoPaths, 3600)).data ?? [] : [];
  const url = (p: string) => signed.find((s) => s.path === p)?.signedUrl;

  return (<>
    <div className="card"><h3>Weight</h3><WeightChart points={(weights ?? []).map((w) => ({ date: w.date, weight: Number(w.weight) }))} /></div>
    {!dates.length && <div className="card"><p className="small muted">No check-ins or meals in the last 14 days.</p></div>}
    {dates.map((d) => {
      const l = (logs ?? []).find((x) => x.date === d) as Log | undefined;
      const ms = ((meals ?? []) as Meal[]).filter((m) => m.date === d);
      const t = totals(ms), off = Math.round(t.kcal - T.kcal);
      return (
        <div className="log" key={d}>
          <div className="row between"><b>{prettyDate(d)}</b><span className={`pill ${Math.abs(off) <= 150 ? 'good' : off > 0 ? 'warn' : ''}`}>{Math.round(t.kcal)} kcal · {off > 0 ? '+' : ''}{off}</span></div>
          <div className="kv num">
            <span>P <b>{Math.round(t.p)}</b>/{T.p} g</span><span>C <b>{Math.round(t.c)}</b>/{T.c} g</span><span>F <b>{Math.round(t.f)}</b>/{T.f} g</span>
            {l?.weight && <span>Weight <b>{l.weight}</b> kg</span>}{l?.water != null && <span>Water <b>{l.water}</b></span>}
            {l?.steps != null && <span>Steps <b>{Number(l.steps).toLocaleString('en-IN')}</b></span>}
            {l?.workout && <span>Workout <b>{l.workout}</b></span>}{l?.energy && <span>Energy <b>{ENERGY[l.energy - 1]}</b></span>}
          </div>
          {ms.length > 0 && <p className="small muted">{ms.map((m) => `${SLOT_LABEL[m.slot]}: ${m.name} (${Math.round(Number(m.kcal))})`).join(' · ')}</p>}
          {ms.some((m) => m.photo_path) && <div className="thumbs">{ms.filter((m) => m.photo_path && url(m.photo_path)).map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={m.id} href={url(m.photo_path!)} target="_blank" rel="noopener"><img src={url(m.photo_path!)} alt={m.name} /></a>
          ))}</div>}
          {l?.note && <div className="note">{l.note}</div>}
          {l?.coach_reply && <p className="small"><b>You replied:</b> {l.coach_reply}</p>}
          <ActionForm action={replyToLog} className="row" >
            <input type="hidden" name="client_id" value={c.id} /><input type="hidden" name="date" value={d} />
            <input name="reply" type="text" placeholder={l?.note ? 'Reply to this note' : 'Send feedback on this day'} style={{ flex: 1, minWidth: 0 }} />
            <SubmitButton className="btn sm">Send</SubmitButton>
          </ActionForm>
        </div>
      );
    })}
  </>);
}

function Targets({ c }: { c: Client }) {
  const T = c.targets ?? draftTargets(c);
  const w = Number(c.weight_kg) || 60;
  const b = bmr({ sex: (c.sex as Sex) || 'f', weightKg: w, heightCm: Number(c.height_cm) || 160, age: Number(c.age) || 30 });
  const tdee = b * activityMult(c.activity);
  return (
    <ActionForm action={saveTargets}>
      <input type="hidden" name="client_id" value={c.id} />
      <p className="small muted">BMR ≈ <b className="num">{Math.round(b)}</b> kcal · TDEE ≈ <b className="num">{Math.round(tdee)}</b> kcal ({(ACTIVITY.find((a) => a.key === c.activity) ?? ACTIVITY[1]).label.toLowerCase()}) · intake weight {w} kg</p>
      {!T.confirmed && <p className="banner">These are the automatic starting targets. Saving confirms them for the client.</p>}
      <label className="f">Daily calories<span className="unit"><input name="kcal" type="number" defaultValue={T.kcal} min={900} max={5000} /><em>kcal</em></span></label>
      <div className="split">{(Object.entries(SPLITS) as [SplitKey, (typeof SPLITS)[SplitKey]][]).map(([k, s]) => {
        const m = macros(T.kcal, k);
        return <label key={k}><input type="radio" name="split" value={k} defaultChecked={T.split === k} /><b>{s.label}</b><span>C {s.c}% · P {s.p}% · F {s.f}% · P {m.p} g ({Math.round((m.p / w) * 10) / 10} g/kg)</span></label>;
      })}</div>
      <div className="grid2">
        <label className="f">Water<span className="unit"><input name="water" type="number" defaultValue={T.water} /><em>glasses</em></span></label>
        <label className="f">Steps<input name="steps" type="number" defaultValue={T.steps} /></label>
      </div>
      <label className="f">Note to client (shows on their plan)<textarea name="coach_note" defaultValue={c.coach_note ?? ''} /></label>
      <label className="row small"><input type="checkbox" name="notify" value="1" defaultChecked /> Send the new targets on WhatsApp</label>
      <SubmitButton>Save and confirm targets</SubmitButton>
    </ActionForm>
  );
}

async function Chat({ c }: { c: Client }) {
  const { data } = await supabaseUser().from('wa_messages').select('*').eq('client_id', c.id).order('created_at', { ascending: false }).limit(40);
  const text = (m: { direction: string; kind: string; body: any }) => {
    const b = m.body ?? {};
    if (m.direction === 'in') return b.text || b.caption || (b.type === 'image' ? '📷 Photo' : b.buttonId ? `[${b.text ?? b.buttonId}]` : '');
    return b.text?.body || b.interactive?.body?.text || (b.template ? `Template: ${b.template.name}` : '');
  };
  return (<>
    <ActionForm action={messageClient}>
      <input type="hidden" name="client_id" value={c.id} />
      <label className="f">Message {c.name?.split(' ')[0]}<textarea name="text" placeholder="Goes to their WhatsApp from the SHIFT number" /></label>
      <SubmitButton>Send on WhatsApp</SubmitButton>
    </ActionForm>
    <div className="card"><h3>Recent messages</h3>
      {(data ?? []).length ? (data ?? []).map((m) => (
        <div key={m.id} className="meal">
          <span className="small" style={{ whiteSpace: 'pre-wrap' }}><b>{m.direction === 'in' ? c.name?.split(' ')[0] : 'SHIFT'}</b>{m.category && m.direction === 'out' ? <span className="src">{m.category}</span> : null}<br />{String(text(m)).slice(0, 400)}</span>
          <span className="small muted num">{new Date(m.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )) : <p className="small muted">No messages yet.</p>}
    </div>
  </>);
}

function Profile({ c }: { c: Client }) {
  return (<>
    <div className="card">
      <div className="kv"><span>Sex <b>{c.sex === 'm' ? 'Male' : 'Female'}</b></span><span>Age <b>{c.age}</b></span><span>Height <b>{c.height_cm} cm</b></span><span>Intake weight <b>{c.weight_kg} kg</b></span>
        <span>Target <b>{c.target_weight ? `${c.target_weight} kg` : '–'}</b></span><span>Activity <b>{(ACTIVITY.find((a) => a.key === c.activity) ?? ACTIVITY[1]).label}</b></span><span>Joined <b>{prettyDate(c.created_at.slice(0, 10))}</b></span></div>
      {c.notes ? <div className="note">{c.notes}</div> : <p className="small muted">No notes from intake.</p>}
    </div>
    <ActionForm action={saveStatus}>
      <input type="hidden" name="client_id" value={c.id} />
      <h3>Coaching plan</h3>
      <div className="grid2">
        <label className="f">Status<select name="status" defaultValue={c.status}><option value="lead">Lead (not paid)</option><option value="active">Active</option><option value="paused">Paused</option><option value="ended">Ended</option></select></label>
        <label className="f">Plan name<input name="plan_name" type="text" defaultValue={c.plan_name ?? ''} placeholder="3 months" /></label>
        <label className="f">Plan ends<input name="plan_ends" type="date" defaultValue={c.plan_ends ?? ''} /></label>
        <label className="f">Payment link<input name="payment_link" type="url" defaultValue={c.payment_link ?? ''} placeholder="https://rzp.io/l/..." /></label>
      </div>
      <p className="small muted">Only active clients get the 7 am plan, evening check-in and weekly summary.</p>
      <SubmitButton>Save</SubmitButton>
    </ActionForm>
    {c.payment_link && (
      <ActionForm action={sendPaymentLink} className="row">
        <input type="hidden" name="client_id" value={c.id} />
        <SubmitButton className="btn ghost">Send payment link on WhatsApp</SubmitButton>
      </ActionForm>
    )}
  </>);
}

async function Plan({ c }: { c: Client }) {
  const { data } = await supabaseUser().from('foods').select('*').eq('archived', false).or(`owner_client_id.is.null,owner_client_id.eq.${c.id}`).order('name');
  return <PlanEditor clientId={c.id} chart={c.diet_chart ?? []} workout={c.workout_plan ?? {}} foods={(data ?? []) as Food[]} targets={c.targets ?? draftTargets(c)} diet={DIETS[c.diet ?? 'veg']} aiOn={aiEnabled()} />;
}

async function ClientProgress({ c, metric }: { c: Client; metric: MetricKey }) {
  const sb = supabaseUser();
  const [{ data: logs }, { data: ms }] = await Promise.all([
    sb.from('logs').select('date,weight').eq('client_id', c.id).not('weight', 'is', null).order('date'),
    sb.from('measurements').select('*').eq('client_id', c.id).order('date'),
  ]);
  return <ProgressView rows={mergeRows((logs ?? []) as { date: string; weight: number }[], (ms ?? []) as Measurement[])} metric={metric} hrefFor={(m) => `/coach/${c.id}?tab=progress&metric=${m}`} startWeight={Number(c.weight_kg)} targetWeight={c.target_weight} />;
}
