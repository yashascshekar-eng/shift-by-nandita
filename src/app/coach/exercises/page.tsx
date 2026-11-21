import Link from 'next/link';
import { requireCoach, supabaseUser } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { WEEKDAYS } from '@/lib/nutrition';
import type { Exercise, WorkoutTemplate } from '@/lib/types';
import { deleteTemplate, saveExercise, setExerciseArchived } from '../actions';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import { VideoUpload } from './VideoUpload';

export const metadata = { title: 'Exercises' };
export const dynamic = 'force-dynamic';

const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Lower body', 'Abs', 'Cardio', 'Mobility', 'Other'];
const EQUIPMENT = ['Bodyweight', 'Dumbbells', 'Band', 'Kettlebell', 'Barbell', 'Machine', 'Other'];

function Fields({ e }: { e?: Exercise }) {
  return (<>
    {e && <input type="hidden" name="id" value={e.id} />}
    <input name="name" type="text" defaultValue={e?.name} placeholder="Exercise name" required aria-label="Exercise name" />
    <div className="grid2">
      <label className="f">Muscle group<select name="muscle_group" defaultValue={e?.muscle_group ?? 'Lower body'}>{GROUPS.map((g) => <option key={g}>{g}</option>)}</select></label>
      <label className="f">Equipment<select name="equipment" defaultValue={e?.equipment ?? 'Bodyweight'}>{EQUIPMENT.map((g) => <option key={g}>{g}</option>)}</select></label>
    </div>
    <label className="f">How to (clients see this)<textarea name="cue" defaultValue={e?.cue ?? ''} style={{ minHeight: 60 }} /></label>
  </>);
}

export default async function Exercises({ searchParams }: { searchParams: { show?: string; q?: string } }) {
  await requireCoach();
  const sb = supabaseUser();
  const [{ data: ex }, { data: tpl }] = await Promise.all([
    sb.from('exercises').select('*').order('sort').order('name'),
    sb.from('workout_templates').select('*').order('is_demo').order('created_at'),
  ]);
  const show = searchParams.show ?? 'library';
  const q = (searchParams.q ?? '').toLowerCase().trim();
  const all = (ex ?? []) as Exercise[];
  const list = all.filter((e) => (show === 'archived' ? e.archived : !e.archived)).filter((e) => !q || `${e.name} ${e.muscle_group} ${e.equipment}`.toLowerCase().includes(q));
  const groups = [...new Set(list.map((e) => e.muscle_group))];
  const templates = (tpl ?? []) as WorkoutTemplate[];

  return (
    <main className="wrap stack" style={{ paddingBottom: 48, maxWidth: 820 }}>
      <Link href="/coach" className="small">← Clients</Link>
      <div className="row between"><h1 style={{ fontSize: 28 }}>Exercises</h1><span className="small muted">Pick from these in each client&rsquo;s Workouts tab.</span></div>
      <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>+ Add an exercise</summary>
        <ActionForm action={saveExercise} className="stack"><Fields /><SubmitButton>Add to library</SubmitButton></ActionForm>
      </details>

      <div className="row between">
        <div className="seg">
          <Link href="/coach/exercises" aria-current={show === 'library' ? 'page' : undefined}>Library ({all.filter((e) => !e.archived).length})</Link>
          <Link href="/coach/exercises?show=archived" aria-current={show === 'archived' ? 'page' : undefined}>Archived ({all.filter((e) => e.archived).length})</Link>
          <Link href="/coach/exercises?show=templates" aria-current={show === 'templates' ? 'page' : undefined}>Templates ({templates.length})</Link>
        </div>
        {show !== 'templates' && <form className="row" style={{ flexWrap: 'nowrap' }}><input type="hidden" name="show" value={show} /><input name="q" type="search" defaultValue={searchParams.q} placeholder="Search" aria-label="Search exercises" style={{ width: 180 }} /><button className="btn sm ghost">Search</button></form>}
      </div>

      {show === 'templates' ? (
        templates.length ? templates.map((t) => (
          <div key={t.id} className="card">
            <div className="row between"><h3>{t.name}</h3><div className="row">{t.is_demo && <span className="pill warn">Demo</span>}<form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><button className="linkbtn">Delete</button></form></div></div>
            {t.description && <p className="small muted">{t.description}</p>}
            <div className="grid2">{WEEKDAYS.filter((d) => t.days[d]?.length).map((d) => (
              <div key={d} className="log"><b>{d}</b>{t.days[d].map((e, i) => <div key={i} className="ex small"><span>{e.n}</span><span className="muted num">{e.s} × {e.r}{e.rest ? ` · ${e.rest}` : ''}</span></div>)}</div>
            ))}</div>
          </div>
        )) : <p className="muted">No templates yet. Build a week in a client&rsquo;s Workouts tab and save it as a template.</p>
      ) : groups.map((g) => (
        <section key={g} className="stack" style={{ gap: 8 }}>
          <h3>{g}</h3>
          {list.filter((e) => e.muscle_group === g).map((e) => (
            <details key={e.id} className="log">
              <summary style={{ cursor: 'pointer' }}><b>{e.name}</b> <span className="small muted">· {e.equipment}{e.video_url ? ' · your video' : ''}</span></summary>
              <div className="grid2" style={{ alignItems: 'start' }}>
                <ExerciseDemo name={e.name} videoUrl={e.video_url} cue={e.cue} />
                <VideoUpload exerciseId={e.id} hasVideo={!!e.video_url} />
              </div>
              <ActionForm action={saveExercise} className="stack"><Fields e={e} /><SubmitButton>Save</SubmitButton></ActionForm>
              <form action={setExerciseArchived}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="archived" value={e.archived ? '0' : '1'} /><button className="linkbtn">{e.archived ? 'Restore' : 'Archive'}</button></form>
            </details>
          ))}
        </section>
      ))}
    </main>
  );
}
