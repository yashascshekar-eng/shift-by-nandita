'use client';
// Searchable food catalogue, modelled on the FITTR catalogue Nandita uses:
// Food / Favourites / Recent / Custom tabs, veg marker, serving + macros, heart, +.
import { useMemo, useState, useTransition } from 'react';
import type { Food } from '@/lib/types';
import { CATEGORIES, UNITS, scaleFood, servingLabel } from '@/lib/catalogue';

type Tab = 'food' | 'fav' | 'recent' | 'custom';
export interface NewFood { name: string; serving_qty: number; unit: string; kcal: number; p: number; c: number; f: number; food_type: Food['food_type']; category: string }

export function TypeDot({ t }: { t: Food['food_type'] }) {
  const color = t === 'nonveg' ? 'var(--bad)' : t === 'egg' ? 'var(--mf)' : 'var(--good)';
  const label = t === 'nonveg' ? 'Non-vegetarian' : t === 'egg' ? 'Contains egg' : 'Vegetarian';
  return <span className="tdot" style={{ borderColor: color }} title={label} aria-label={label}><i style={{ background: color }} /></span>;
}

export function FoodPicker({
  foods, favourites = [], recents = [], addLabel = 'Add', onAdd, onToggleFav, onCreate, customLabel = 'Custom',
}: {
  foods: Food[];
  favourites?: string[];
  recents?: string[];
  addLabel?: string;
  onAdd: (food: Food, qty: number) => Promise<void> | void;
  onToggleFav?: (foodId: string) => Promise<void>;
  onCreate?: (f: NewFood) => Promise<Food | null>;
  customLabel?: string;
}) {
  const [tab, setTab] = useState<Tab>('food');
  const [q, setQ] = useState('');
  const [pref, setPref] = useState<'all' | 'veg' | 'egg'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [favs, setFavs] = useState(new Set(favourites));
  const [list, setList] = useState(foods);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');
  const [pending, start] = useTransition();

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let base = list.filter((f) => !f.archived);
    if (tab === 'fav') base = base.filter((f) => favs.has(f.id));
    if (tab === 'recent') base = recents.map((id) => base.find((f) => f.id === id)).filter(Boolean) as Food[];
    if (tab === 'custom') base = base.filter((f) => f.owner_client_id);
    if (pref === 'veg') base = base.filter((f) => f.food_type === 'veg');
    if (pref === 'egg') base = base.filter((f) => f.food_type !== 'nonveg');
    if (words.length) base = base.filter((f) => words.every((w) => `${f.name} ${f.category}`.toLowerCase().includes(w)));
    return base.slice(0, 80);
  }, [list, tab, q, pref, favs, recents]);

  const toggleFav = (id: string) => {
    if (!onToggleFav) return;
    const next = new Set(favs);
    next.has(id) ? next.delete(id) : next.add(id);
    setFavs(next);
    start(() => onToggleFav(id));
  };

  const add = (f: Food) => {
    const n = parseFloat(qty) || Number(f.serving_qty);
    start(async () => { await onAdd(f, n); setOpen(null); setMsg(`Added ${f.name}`); setTimeout(() => setMsg(''), 2500); });
  };

  const create = (form: FormData) => {
    if (!onCreate) return;
    const nf: NewFood = {
      name: String(form.get('name') || '').trim(), serving_qty: Number(form.get('serving_qty')) || 100, unit: String(form.get('unit') || 'g'),
      kcal: Number(form.get('kcal')) || 0, p: Number(form.get('p')) || 0, c: Number(form.get('c')) || 0, f: Number(form.get('f')) || 0,
      food_type: (String(form.get('food_type')) as Food['food_type']) || 'veg', category: String(form.get('category') || 'Other'),
    };
    if (!nf.name || !(nf.kcal > 0)) { setMsg('Add a name and the calories.'); return; }
    start(async () => {
      const saved = await onCreate(nf);
      if (saved) { setList([saved, ...list]); setCreating(false); setTab('custom'); setMsg(`Saved ${saved.name}`); }
      else setMsg('Could not save that food. Check the numbers.');
    });
  };

  const tabs: [Tab, string][] = [['food', 'Food'], ['fav', 'Favourites'], ['recent', 'Recent'], ['custom', customLabel]];
  return (
    <div className="picker">
      <input type="search" className="psearch" placeholder='Search "paneer", "dosa batter"…' value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" />
      <div className="row between">
        <div className="ptabs" role="tablist">{tabs.filter(([k]) => (k !== 'fav' || onToggleFav) && (k !== 'recent' || recents.length)).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}</div>
        <select value={pref} onChange={(e) => setPref(e.target.value as never)} aria-label="Food preference" style={{ width: 'auto', padding: '6px 10px', fontSize: 13 }}>
          <option value="all">All foods</option><option value="veg">Veg only</option><option value="egg">Veg + egg</option>
        </select>
      </div>
      {msg && <p className="banner" role="status">{msg}</p>}
      {tab === 'custom' && onCreate && (
        creating ? (
          <form action={create} className="card" style={{ background: 'var(--surface-2)' }}>
            <b>Add your own food</b>
            <input name="name" type="text" placeholder="Food name, e.g. Homemade ragi dosa" required />
            <div className="grid3">
              <label className="f">Quantity<input name="serving_qty" type="number" step="any" defaultValue={100} /></label>
              <label className="f">Unit<select name="unit" defaultValue="g">{UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label className="f">Calories<input name="kcal" type="number" step="any" required /></label>
              <label className="f">Protein g<input name="p" type="number" step="any" /></label>
              <label className="f">Carbs g<input name="c" type="number" step="any" /></label>
              <label className="f">Fat g<input name="f" type="number" step="any" /></label>
              <label className="f">Food type<select name="food_type" defaultValue="veg"><option value="veg">Vegetarian</option><option value="egg">Egg</option><option value="nonveg">Non-vegetarian</option></select></label>
              <label className="f" style={{ gridColumn: 'span 2' }}>Category<select name="category" defaultValue="Other">{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            </div>
            <p className="small muted">Copy the numbers from the pack label, for the quantity you entered.</p>
            <div className="row"><button className="btn sm" disabled={pending}>Save food</button><button type="button" className="btn sm ghost" onClick={() => setCreating(false)}>Cancel</button></div>
          </form>
        ) : <button type="button" className="prow addown" onClick={() => setCreating(true)}><b>Add your own food</b><span className="pplus">+</span></button>
      )}
      <div className="plist">
        {shown.length ? shown.map((f) => {
          const isOpen = open === f.id;
          const n = parseFloat(qty) || Number(f.serving_qty);
          const m = scaleFood(f, n);
          return (
            <div key={f.id} className="prow">
              <div style={{ minWidth: 0 }}>
                <b className="pname">{f.name}</b>
                <div className="small muted"><TypeDot t={f.food_type} /> {servingLabel(Number(f.serving_qty), f.unit)} · {Math.round(Number(f.kcal))} kcal</div>
                <div className="small muted num">P {Number(f.p)} g · C {Number(f.c)} g · F {Number(f.f)} g</div>
                {isOpen && (
                  <div className="row" style={{ marginTop: 8, flexWrap: 'nowrap' }}>
                    <span className="unit" style={{ width: 120 }}><input type="number" step="any" min="0" value={qty} autoFocus onChange={(e) => setQty(e.target.value)} aria-label={`Amount of ${f.name}`} /><em>{f.unit}</em></span>
                    <span className="small num">{m.kcal} kcal · P {m.p}</span>
                    <button type="button" className="btn sm" disabled={pending} onClick={() => add(f)}>{addLabel}</button>
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'nowrap', alignSelf: 'center' }}>
                {onToggleFav && <button type="button" className={`pheart ${favs.has(f.id) ? 'on' : ''}`} aria-pressed={favs.has(f.id)} aria-label={favs.has(f.id) ? `Remove ${f.name} from favourites` : `Add ${f.name} to favourites`} onClick={() => toggleFav(f.id)}>♥</button>}
                <button type="button" className="pplus" aria-label={`Add ${f.name}`} aria-expanded={isOpen} onClick={() => { setOpen(isOpen ? null : f.id); setQty(String(Number(f.serving_qty))); }}>{isOpen ? '×' : '+'}</button>
              </div>
            </div>
          );
        }) : <p className="small muted" style={{ padding: 12 }}>{tab === 'fav' ? 'Tap ♥ on a food to keep it here.' : tab === 'custom' ? 'No custom foods yet.' : 'No foods match. Try another word, or add your own under Custom.'}</p>}
      </div>
    </div>
  );
}
