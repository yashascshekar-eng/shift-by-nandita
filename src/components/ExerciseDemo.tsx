'use client';
// Exercise "how to": Nandita's own video when she has uploaded one, otherwise an animated figure,
// plus tempo, three steps and the most common mistake.
import { useEffect, useRef, useState } from 'react';
import { demoFor } from '@/lib/demo/exercises';
import { draw, poseAt, type Demo, type Shape } from '@/lib/demo/rig';

const COLOR: Record<Shape['role'], string> = {
  work: 'var(--good)', body: 'var(--ink)', far: 'var(--line)', head: 'var(--ink)',
  prop: 'var(--mf)', band: 'var(--mp)', floor: 'var(--line)',
};

function Figure({ demo, label }: { demo: Demo; label: string }) {
  const [ms, setMs] = useState(0);
  const [playing, setPlaying] = useState(true);
  const ref = useRef<SVGSVGElement>(null);
  const visible = useRef(true);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
    const el = ref.current;
    const io = el && 'IntersectionObserver' in window ? new IntersectionObserver(([e]) => { visible.current = e.isIntersecting; }) : null;
    if (el && io) io.observe(el);
    return () => io?.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now(), t = ms;
    const tick = (now: number) => {
      if (visible.current) { t += now - last; setMs(t); }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const shapes = draw(demo, poseAt(demo, ms));
  return (
    <div style={{ position: 'relative', maxWidth: 260, margin: '0 auto', width: '100%' }}>
      <svg ref={ref} viewBox="0 0 200 200" role="img" aria-label={`${label} animation`} style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto', background: 'var(--surface-2)', borderRadius: 12 }}>
        {shapes.map((s, i) => {
          const c = COLOR[s.role];
          const filled = s.k === 'circle' || s.k === 'rect' || (s.k === 'path' && s.role === 'prop');
          const a = s.a as Record<string, string | number>;
          const style = filled ? { fill: c } : { stroke: c, strokeLinecap: 'round' as const, fill: 'none' };
          if (s.k === 'line') return <line key={i} {...a} style={style} />;
          if (s.k === 'circle') return <circle key={i} {...a} style={style} />;
          if (s.k === 'rect') return <rect key={i} {...a} style={style} />;
          return <path key={i} {...a} style={style} />;
        })}
        {demo.label && <text x="8" y="16" fontSize="10" style={{ fill: 'var(--muted)' }}>{demo.label}</text>}
      </svg>
      <button type="button" className="linkbtn small" onClick={() => setPlaying(!playing)} style={{ position: 'absolute', right: 6, bottom: 6 }} aria-label={playing ? 'Pause animation' : 'Play animation'}>
        {playing ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}

export function ExerciseDemo({ name, videoUrl, cue, note }: { name: string; videoUrl?: string | null; cue?: string | null; note?: string }) {
  const demo = demoFor(name);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {videoUrl
        ? <video src={videoUrl} autoPlay muted loop playsInline controls style={{ width: '100%', maxWidth: 320, borderRadius: 12, margin: '0 auto', display: 'block' }} />
        : demo ? <Figure demo={demo} label={name} /> : null}
      {note && <p className="small"><b>Nandita:</b> {note}</p>}
      {demo ? (<>
        <p className="small muted">Tempo: {demo.tempo}</p>
        <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>{demo.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <p className="small" style={{ color: 'var(--bad)', margin: 0 }}>{demo.avoid}</p>
      </>) : cue ? <p className="small">{cue}</p> : null}
    </div>
  );
}
