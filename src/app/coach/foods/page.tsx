import Link from 'next/link';
import { requireCoach, supabaseUser } from '@/lib/supabase/server';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { TypeDot } from '@/components/FoodPicker';
import { CATEGORIES, UNITS, servingLabel } from '@/lib/catalogue';
import type { Food } from '@/lib/types';
import { promoteFood, saveFood, setFoodArchived } from '../actions';

export const metadata = { title: 'Food catalogue' };
export const dynamic = 'force-dynamic';

function FoodFields({ f }: { f?: Food }) {
  return (<>
    {f && <input type="hidden" name="id" value={f.id} />}
    <input name="name" type="text" defaultValue={f?.name} placeholder="Food name" required aria-label="Food name" />
    <div className="grid3">
      <label className="f">Quantity<input name="serving_qty" type="number" step="any" defaultValue={f?.serving_qty ?? 100} required /></label>
      <label className="f">Unit<select name="unit" defaultValue={f?.unit ?? 'g'}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
      <label className="f">Calories<input name="kcal" type="number" step="any" defaultValue={f?.kcal} required /></label>
      <label className="f">Protein g<input name="p" type="number" step="any" defaultValue={f?.p} /></label>
      <label className="f">Carbs g<input name="c" type="number" step="any" defaultValue={f?.c} /></label>
      <label className="f">Fat g<input name="f" type="number" step="any" defaultValue={f?.f} /></label>
      <label className="f">Type<select name="food_type" defaultValue={f?.food_type ?? 'veg'}><option value="veg">Vegetarian</option><option value="egg">Egg</option><option value="nonveg">Non-vegetarian</option></select></label>
      <label className="f" style={{ gridColumn: 'span 2' }}>Category<select name="category" defaultValue={f?.category ?? 'Other'}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
    </div>
  </>);
}

export default async function Foods({ searchParams }: { searchParams: { q?: string; show?: string } }) {
  await requireCoach();
  const sb = supabaseUser();
  const [{ data }, { data: clients }] = await Promise.all([sb.from('foods').select('*').order('category').order('name'), sb.from('clients').select('id,name')]);
  const q = (searchParams.q ?? '').toLowerCase().trim();
  const show = searchParams.show ?? 'catalogue';
  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const all = (data ?? []) as Food[];
  const list = all
    .filter((f) => (show === 'clients' ? f.owner_client_id : show === 'archived' ? f.archived : !f.owner_client_id && !f.archived))
    .filter((f) => !q || `${f.name} ${f.category}`.toLowerCase().includes(q));
  const tab = (k: string, l: string, n: number) => <Link href={`/coach/foods?show=${k}`} aria-current={show === k ? 'page' : undefined}>{l} ({n})</Link>;

  return (
    <main className="wrap stack" style={{ paddingBottom: 48, maxWidth: 820 }}>
      <Link href="/coach" className="small">← Clients</Link>
      <div className="row between"><h1 style={{ fontSize: 28 }}>Food catalogue</h1><span className="small muted">Every client sees these when logging and in diet charts.</span></div>
      <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>+ Add a food</summary>
        <ActionForm action={saveFood} className="stack" ><FoodFields /><SubmitButton>Add to catalogue</SubmitButton></ActionForm>
      </details>
      <div className="row between">
        <div className="seg">
          {tab('catalogue', 'Catalogue', all.filter((f) => !f.owner_client_id && !f.archived).length)}
          {tab('clients', 'Clients’ own foods', all.filter((f) => f.owner_client_id).length)}
          {tab('archived', 'Hidden', all.filter((f) => f.archived).length)}
        </div>
        <form className="row" style={{ flexWrap: 'nowrap' }}><input type="hidden" name="show" value={show} /><input name="q" type="search" defaultValue={searchParams.q} placeholder="Search" aria-label="Search foods" style={{ width: 200 }} /><button className="btn sm ghost">Search</button></form>
      </div>
      <div className="plist" style={{ maxHeight: 'none' }}>
        {list.length ? list.map((f) => (
          <details key={f.id} className="prow" style={{ display: 'block' }}>
            <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
              <div className="row between" style={{ flexWrap: 'nowrap' }}>
                <span style={{ minWidth: 0 }}><b className="pname">{f.name}</b>
                  <span className="small muted"><TypeDot t={f.food_type} /> {servingLabel(Number(f.serving_qty), f.unit)} · {Math.round(Number(f.kcal))} kcal · P {Number(f.p)} · C {Number(f.c)} · F {Number(f.f)}</span>
                  {f.owner_client_id && <span className="small muted"> · added by {names.get(f.owner_client_id) ?? 'a client'}</span>}</span>
                <span className="pill">{f.category}</span>
              </div>
            </summary>
            <div className="stack" style={{ marginTop: 10 }}>
              <ActionForm action={saveFood} className="stack"><FoodFields f={f} /><SubmitButton className="btn sm">Save changes</SubmitButton></ActionForm>
              <div className="row">
                <form action={setFoodArchived}><input type="hidden" name="id" value={f.id} /><input type="hidden" name="archived" value={f.archived ? '0' : '1'} /><button className="btn sm ghost">{f.archived ? 'Show again' : 'Hide from clients'}</button></form>
                {f.owner_client_id && <form action={promoteFood}><input type="hidden" name="id" value={f.id} /><button className="btn sm ghost">Add to shared catalogue</button></form>}
              </div>
            </div>
          </details>
        )) : <p className="small muted">No foods here.</p>}
      </div>
    </main>
  );
}
