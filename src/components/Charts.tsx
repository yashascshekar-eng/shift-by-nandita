// Server-rendered SVG charts (no client JS).
import { prettyDate, daysBetween } from '@/lib/dates';

export function Ring({ eaten, target }: { eaten: number; target: number }) {
  const R = 50, C = 2 * Math.PI * R, f = target > 0 ? Math.min(1, eaten / target) : 0;
  return (
    <svg className="ring" viewBox="0 0 120 120" width="100%" role="img" aria-label={`${Math.round(eaten)} of ${target} kcal`}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
      <circle cx="60" cy="60" r={R} fill="none" stroke={eaten > target ? 'var(--warn)' : 'var(--brand)'} strokeWidth="11" strokeLinecap="round" strokeDasharray={`${C * f} ${C}`} transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="700">{Math.round(eaten)}</text>
      <text x="60" y="76" textAnchor="middle" fontSize="11" style={{ fill: 'var(--muted)' }}>of {target} kcal</text>
    </svg>
  );
}

export function Bar({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div className="bar">
      <div className="lab"><b style={{ color }}>{label}</b><span className="num">{Math.round(value)} / {target} g</span></div>
      <div className="tr"><div className="fi" style={{ width: `${target > 0 ? Math.min(100, (value / target) * 100) : 0}%`, background: color }} /></div>
    </div>
  );
}

export function WeightChart({ points }: { points: { date: string; weight: number }[] }) {
  return <LineChart points={points.map((p) => ({ date: p.date, value: p.weight }))} label="Weight" />;
}

/** Line chart of one measurement over time, with an area fill and the latest point marked. */
export function LineChart({ points, label, unit = '' }: { points: { date: string; value: number }[]; label: string; unit?: string }) {
  const pts = points.filter((p) => p.value > 0).sort((a, b) => a.date.localeCompare(b.date)).slice(-60);
  if (pts.length < 2) return <p className="small muted">Add {label.toLowerCase()} on two or more days to see the trend.</p>;
  const W = 320, H = 150, pl = 34, pr = 10, pt = 10, pb = 22;
  const vs = pts.map((p) => p.value);
  const pad = Math.max(0.5, (Math.max(...vs) - Math.min(...vs)) * 0.15);
  const lo = Math.floor(Math.min(...vs) - pad), hi = Math.ceil(Math.max(...vs) + pad);
  const d0 = pts[0].date, span = Math.max(1, daysBetween(d0, pts[pts.length - 1].date));
  const x = (d: string) => pl + ((W - pl - pr) * daysBetween(d0, d)) / span;
  const y = (v: number) => pt + ((H - pt - pb) * (hi - v)) / (hi - lo || 1);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} trend, latest ${last.value}${unit}`}>
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={pl - 6} y={y(v) + 4} textAnchor="end">{Math.round(v * 10) / 10}</text></g>
      ))}
      <path d={`${line} L${x(last.date)},${H - pb} L${pl},${H - pb} Z`} fill="var(--tile)" opacity=".6" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" />
      {pts.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="2.5" fill="var(--brand)" />)}
      <circle cx={x(last.date)} cy={y(last.value)} r="4.5" fill="var(--brand)" />
      <text x={pl} y={H - 6}>{prettyDate(d0)}</text>
      <text x={W - pr} y={H - 6} textAnchor="end">{prettyDate(last.date)}</text>
    </svg>
  );
}
