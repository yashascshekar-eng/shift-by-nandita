// Stick-figure rig for exercise demos. Pure functions: pose data in, SVG shape list out,
// so the same code drives the React animation and static previews.

export type View = 'side' | 'front';
export type Prop = 'db' | 'db2' | 'dbHips' | 'dbFeet' | 'band' | 'bandHands' | 'bandBack' | 'chair' | 'bench' | 'wedge' | 'chairBack' | 'chairFront';
export type Part = 'torso' | 'arm1' | 'arm2' | 'leg1' | 'leg2';
export type Anchor = 'hip' | 'ankle1' | 'feet' | 'knee1';

/** Angles are absolute degrees in screen space: 0 = right, 90 = down, -90 = up. */
export interface Pose {
  x: number; y: number;
  t: number;            // side: hip→shoulder angle (-90 upright). front: lean from vertical.
  c?: number;           // spine curve (side), px
  h?: number;           // head offset angle (side)
  sh?: number;          // shoulder lift (front), px
  tl?: number;          // torso length scale (front, for hinged moves)
  a1: number; e1: number; a2: number; e2: number;  // upper arm, forearm (side: near/far; front: screen-left/right)
  k1: number; s1: number; k2: number; s2: number;  // thigh, shin
  f1?: number; f2?: number;                        // foot angle; default shin - 90
}

export interface Frame { p: Partial<Pose>; d?: number; h?: number }  // move time, hold time (ms)

export interface Demo {
  view: View; anchor?: Anchor; label?: string;
  frames: Frame[]; props?: Prop[]; work: Part[];
  chair?: [number, number]; // x, seat height above floor
  tempo: string; steps: [string, string, string]; avoid: string;
}

export const FLOOR = 182;
const L = { torso: 50, neck: 7, head: 10, ua: 22, fa: 20, th: 34, sh: 33, ft: 11 };
const rad = (d: number) => (d * Math.PI) / 180;
type P = [number, number];
const go = (p: P, a: number, l: number): P => [p[0] + Math.cos(rad(a)) * l, p[1] + Math.sin(rad(a)) * l];
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

/** Pose at time ms in the loop. Each frame only lists what changes from the previous one. */
export function poseAt(d: Demo, ms: number): Pose {
  const full: Pose[] = [];
  d.frames.forEach((f, i) => full.push({ ...(i ? full[i - 1] : ({} as Pose)), ...f.p } as Pose));
  if (full.length === 1) return full[0];
  const seg = d.frames.map((f) => ({ d: f.d ?? 1200, h: f.h ?? 300 }));
  const total = seg.reduce((s, x) => s + x.d + x.h, 0);
  let t = ms % total;
  for (let i = 0; i < full.length; i++) {
    // Frame i: hold at pose i, then move to pose i+1 (wrapping).
    const { d: mv, h } = seg[i];
    if (t < h) return full[i];
    t -= h;
    if (t < mv) {
      const a = full[i], b = full[(i + 1) % full.length], k = ease(t / mv);
      const out = { ...a } as Record<string, number>;
      for (const key of Object.keys(b)) {
        const va = (a as unknown as Record<string, number>)[key], vb = (b as unknown as Record<string, number>)[key];
        if (typeof va === 'number' && typeof vb === 'number') out[key] = va + (vb - va) * k;
      }
      return out as unknown as Pose;
    }
    t -= mv;
  }
  return full[0];
}

export interface Shape { k: 'line' | 'circle' | 'rect' | 'path'; a: Record<string, number | string>; role: 'work' | 'body' | 'far' | 'prop' | 'band' | 'floor' | 'head' }

function joints(d: Demo, p: Pose) {
  const o: P = [0, 0];
  let J: Record<string, P>;
  if (d.view === 'side') {
    const sh = go(o, p.t, L.torso);
    const hd = go(sh, p.h ?? p.t, L.neck + L.head);
    const far: P = [2, -3]; // far limbs sit slightly behind
    const sh2: P = [sh[0] + far[0], sh[1] + far[1]], hp2: P = [o[0] + far[0], o[1] + far[1]];
    const el1 = go(sh, p.a1, L.ua), ha1 = go(el1, p.e1, L.fa), el2 = go(sh2, p.a2, L.ua), ha2 = go(el2, p.e2, L.fa);
    const kn1 = go(o, p.k1, L.th), an1 = go(kn1, p.s1, L.sh), kn2 = go(hp2, p.k2, L.th), an2 = go(kn2, p.s2, L.sh);
    const to1 = go(an1, p.f1 ?? p.s1 - 90, L.ft), to2 = go(an2, p.f2 ?? p.s2 - 90, L.ft);
    J = { hp: o, sh, hd, sh2, hp2, el1, ha1, el2, ha2, kn1, an1, kn2, an2, to1, to2 };
  } else {
    const tl = L.torso * (p.tl ?? 1);
    const nk = go(o, -90 + p.t, tl);
    const lift = p.sh ?? 0;
    const perp = rad(p.t);
    const w = 16, hw = 9;
    const shL: P = [nk[0] - Math.cos(perp) * w, nk[1] - Math.sin(perp) * w - lift];
    const shR: P = [nk[0] + Math.cos(perp) * w, nk[1] + Math.sin(perp) * w - lift];
    const hpL: P = [-hw, 0], hpR: P = [hw, 0];
    const hd = go(nk, -90 + p.t, L.neck + L.head);
    const el1 = go(shL, p.a1, L.ua), ha1 = go(el1, p.e1, L.fa), el2 = go(shR, p.a2, L.ua), ha2 = go(el2, p.e2, L.fa);
    const kn1 = go(hpL, p.k1, L.th), an1 = go(kn1, p.s1, L.sh), kn2 = go(hpR, p.k2, L.th), an2 = go(kn2, p.s2, L.sh);
    const to1 = go(an1, p.f1 ?? 180, 7), to2 = go(an2, p.f2 ?? 0, 7);
    J = { hp: o, nk, sh: shL, sh2: shR, hd, hpL, hpR, el1, ha1, el2, ha2, kn1, an1, kn2, an2, to1, to2 };
  }
  // Translate so the anchor joint sits at (x, y).
  const ref = d.anchor === 'ankle1' ? J.an1 : d.anchor === 'knee1' ? J.kn1 : d.anchor === 'feet' ? ([(J.an1[0] + J.an2[0]) / 2, (J.an1[1] + J.an2[1]) / 2] as P) : J.hp;
  const dx = p.x - ref[0], dy = p.y - ref[1];
  for (const k of Object.keys(J)) J[k] = [J[k][0] + dx, J[k][1] + dy];
  return J;
}

export function draw(d: Demo, p: Pose): Shape[] {
  const J = joints(d, p);
  const S: Shape[] = [];
  const w = new Set(d.work);
  const ln = (a: P, b: P, role: Shape['role'], width = 7): Shape => ({ k: 'line', a: { x1: r(a[0]), y1: r(a[1]), x2: r(b[0]), y2: r(b[1]), 'stroke-width': width }, role });
  const role = (part: Part, far = false): Shape['role'] => (w.has(part) ? 'work' : far ? 'far' : 'body');
  const props = new Set(d.props ?? []);
  S.push({ k: 'line', a: { x1: 0, y1: FLOOR + 1, x2: 200, y2: FLOOR + 1, 'stroke-width': 1.5 }, role: 'floor' });
  if (d.chair && (props.has('chair') || props.has('bench') || props.has('chairBack') || props.has('chairFront'))) {
    const [cx, hgt] = d.chair, top = FLOOR - hgt;
    S.push({ k: 'rect', a: { x: cx - 18, y: top, width: 36, height: 5, rx: 2 }, role: 'prop' });
    S.push(ln([cx - 15, top + 5], [cx - 15, FLOOR], 'prop', 3), ln([cx + 15, top + 5], [cx + 15, FLOOR], 'prop', 3));
    if (props.has('chair') || props.has('chairBack')) S.push(ln([cx - 15, top], [cx - 15, top - 30], 'prop', 3));
  }
  if (props.has('wedge')) S.push({ k: 'path', a: { d: `M${r(J.an1[0] - 6)},${FLOOR} L${r(J.an1[0] + 4)},${FLOOR - 6} L${r(J.an1[0] + 4)},${FLOOR} Z` }, role: 'prop' });
  if (d.view === 'side') {
    S.push(ln(J.sh2, J.el2, role('arm2', true)), ln(J.el2, J.ha2, role('arm2', true)));
    S.push(ln(J.hp2, J.kn2, role('leg2', true)), ln(J.kn2, J.an2, role('leg2', true)), ln(J.an2, J.to2, role('leg2', true), 5));
    if (p.c) {
      const mx = (J.hp[0] + J.sh[0]) / 2, my = (J.hp[1] + J.sh[1]) / 2;
      const a = Math.atan2(J.sh[1] - J.hp[1], J.sh[0] - J.hp[0]) - Math.PI / 2;
      const cx = mx + Math.cos(a) * p.c * 2, cy = my + Math.sin(a) * p.c * 2;
      S.push({ k: 'path', a: { d: `M${r(J.hp[0])},${r(J.hp[1])} Q${r(cx)},${r(cy)} ${r(J.sh[0])},${r(J.sh[1])}`, 'stroke-width': 8, fill: 'none' }, role: role('torso') });
    } else S.push(ln(J.hp, J.sh, role('torso'), 8));
    S.push({ k: 'circle', a: { cx: r(J.hd[0]), cy: r(J.hd[1]), r: L.head }, role: 'head' });
    S.push(ln(J.hp, J.kn1, role('leg1')), ln(J.kn1, J.an1, role('leg1')), ln(J.an1, J.to1, role('leg1'), 5));
    S.push(ln(J.sh, J.el1, role('arm1')), ln(J.el1, J.ha1, role('arm1')));
  } else {
    S.push(ln(J.hpL, J.kn1, role('leg1')), ln(J.kn1, J.an1, role('leg1')), ln(J.an1, J.to1, role('leg1'), 5));
    S.push(ln(J.hpR, J.kn2, role('leg2')), ln(J.kn2, J.an2, role('leg2')), ln(J.an2, J.to2, role('leg2'), 5));
    S.push(ln(J.hpL, J.hpR, role('torso'), 8), ln(J.sh, J.sh2, role('torso'), 8));
    S.push(ln([J.hp[0], J.hp[1]], J.nk, role('torso'), 8));
    S.push({ k: 'circle', a: { cx: r(J.hd[0]), cy: r(J.hd[1]), r: L.head }, role: 'head' });
    S.push(ln(J.sh, J.el1, role('arm1')), ln(J.el1, J.ha1, role('arm1')), ln(J.sh2, J.el2, role('arm2')), ln(J.el2, J.ha2, role('arm2')));
  }
  const dbAt = (q: P): Shape => ({ k: 'rect', a: { x: r(q[0] - 8), y: r(q[1] - 4), width: 16, height: 8, rx: 3 }, role: 'prop' });
  if (props.has('db')) S.push(dbAt(J.ha1));
  if (props.has('db2')) S.push(dbAt(J.ha2));
  if (props.has('dbHips')) S.push(dbAt([J.hp[0], J.hp[1] - 9]));
  if (props.has('dbFeet')) S.push(dbAt(J.an1));
  if (props.has('band')) {
    S.push({ k: 'line', a: { x1: r(J.an1[0]), y1: r(J.an1[1]), x2: r(J.ha1[0]), y2: r(J.ha1[1]), 'stroke-width': 2.5 }, role: 'band' });
    if (d.view === 'front') S.push({ k: 'line', a: { x1: r(J.an2[0]), y1: r(J.an2[1]), x2: r(J.ha2[0]), y2: r(J.ha2[1]), 'stroke-width': 2.5 }, role: 'band' });
  }
  if (props.has('bandHands')) S.push({ k: 'line', a: { x1: r(J.ha1[0]), y1: r(J.ha1[1]), x2: r(J.ha2[0]), y2: r(J.ha2[1]), 'stroke-width': 2.5 }, role: 'band' });
  if (props.has('bandBack')) S.push({ k: 'path', a: { d: `M${r(J.ha1[0])},${r(J.ha1[1])} L${r(J.sh[0] - 8)},${r(J.sh[1] + 4)}`, 'stroke-width': 2.5, fill: 'none' }, role: 'band' });
  return S;
}

const r = (n: number) => Math.round(n * 10) / 10;
