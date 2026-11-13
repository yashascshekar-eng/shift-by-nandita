// Progress tracker: chart of one metric plus a full table. Shared by the client and coach views.
import Link from 'next/link';
import { LineChart } from './Charts';
import { prettyDate } from '@/lib/dates';
import type { Measurement } from '@/lib/types';

export const METRICS = [
  ['weight', 'Weight', 'kg'], ['waist', 'Waist', 'cm'], ['hip', 'Hip', 'cm'], ['chest', 'Chest', 'cm'],
  ['arm', 'Arm', 'cm'], ['thigh', 'Thigh', 'cm'], ['neck', 'Neck', 'cm'], ['body_fat', 'Body fat', '%'],
] as const;
export type MetricKey = (typeof METRICS)[number][0];

export type Row = Omit<Measurement, 'client_id'>;

/** Merge check-in weights (logs) with tape measurements into one row per date. */
export function mergeRows(logs: { date: string; weight: number | null }[], ms: Measurement[]): Row[] {
  const by = new Map<string, Row>();
  for (const m of ms) by.set(m.date, { ...m });
  for (const l of logs) {
    if (!l.weight) continue;
    const r = by.get(l.date) ?? { date: l.date, weight: null, waist: null, hip: null, chest: null, arm: null, thigh: null, neck: null, body_fat: null };
    if (!r.weight) r.weight = Number(l.weight);
    by.set(l.date, r);
  }
  return [...by.values()].sort((a, b) => b.date.localeCompare(a.date));
}

export function ProgressView({ rows, metric, hrefFor, deleteAction, startWeight, targetWeight }: {
  rows: Row[]; metric: MetricKey; hrefFor: (m: MetricKey) => string; deleteAction?: (f: FormData) => Promise<void>; startWeight?: number | null; targetWeight?: number | null;
}) {
  const [, label, unit] = METRICS.find(([k]) => k === metric) ?? METRICS[0];
  const points = rows.filter((r) => r[metric]).map((r) => ({ date: r.date, value: Number(r[metric]) }));
  const used = METRICS.filter(([k]) => rows.some((r) => r[k]));
  const series = (k: MetricKey) => rows.filter((r) => r[k]).map((r) => Number(r[k]));
  const change = (k: MetricKey) => { const s = series(k); return s.length >= 2 ? Math.round((s[0] - s[s.length - 1]) * 10) / 10 : null; };
  const w = series('weight');
  const first = w.length ? w[w.length - 1] : startWeight ?? null, now = w.length ? w[0] : first;
  return (<>
    <div className="grid3">
      <div className="res"><span className="small muted">Start</span><span className="big num" style={{ fontSize: 24 }}>{first ?? '–'}</span><span className="small muted">kg</span></div>
      <div className="res"><span className="small muted">Now</span><span className="big num" style={{ fontSize: 24 }}>{now ?? '–'}</span><span className="small muted">kg</span></div>
      <div className="res"><span className="small muted">Change</span><span className="big num" style={{ fontSize: 24 }}>{first && now ? `${now - first > 0 ? '+' : ''}${Math.round((now - first) * 10) / 10}` : '–'}</span><span className="small muted">kg{targetWeight ? ` · goal ${targetWeight}` : ''}</span></div>
    </div>
    <div className="card">
      <div className="row between"><h3>{label}</h3>{change(metric) !== null && <span className="pill num">{change(metric)! > 0 ? '+' : ''}{change(metric)} {unit} overall</span>}</div>
      <div className="seg">{METRICS.filter(([k]) => k === 'weight' || used.some(([u]) => u === k)).map(([k, l]) => <Link key={k} href={hrefFor(k)} aria-current={metric === k ? 'page' : undefined} scroll={false}>{l}</Link>)}</div>
      <LineChart points={points} label={label} unit={unit} />
    </div>
    <div className="card">
      <h3>All entries</h3>
      {rows.length ? (
        <div className="scroll"><table className="tbl">
          <thead><tr><th>Date</th>{METRICS.filter(([k]) => used.some(([u]) => u === k)).map(([k, l, u]) => <th key={k}>{l} <span style={{ textTransform: 'none' }}>({u})</span></th>)}{deleteAction && <th />}</tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.date}><td className="date">{prettyDate(r.date)}</td>{METRICS.filter(([k]) => used.some(([u]) => u === k)).map(([k]) => <td key={k}>{r[k] ?? '–'}</td>)}
              {deleteAction && <td>{r.id ? <form action={deleteAction}><input type="hidden" name="id" value={r.id} /><button className="linkbtn" aria-label={`Delete measurements for ${prettyDate(r.date)}`}>✕</button></form> : null}</td>}</tr>
          ))}</tbody>
        </table></div>
      ) : <p className="small muted">No entries yet.</p>}
    </div>
  </>);
}
