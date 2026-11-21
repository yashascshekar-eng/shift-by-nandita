import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { DEMOS, demoFor } from '../src/lib/demo/exercises';
import { draw, poseAt } from '../src/lib/demo/rig';

const sql = readFileSync('supabase/migrations/0004_exercises_templates.sql', 'utf8');
const names = [...sql.matchAll(/^\s*\('([^']+)', '(Chest|Back|Shoulders|Lower body|Abs|Cardio)'/gm)].map((m) => m[1]);

describe('exercise demos', () => {
  it('covers every seeded exercise', () => {
    expect(names.length).toBe(53);
    expect(names.filter((n) => !demoFor(n))).toEqual([]);
    expect(Object.keys(DEMOS).length).toBe(53);
  });
  it('renders finite shapes across the whole loop', () => {
    for (const [name, d] of Object.entries(DEMOS)) {
      for (let ms = 0; ms < 12000; ms += 250) {
        for (const s of draw(d, poseAt(d, ms))) {
          for (const v of Object.values(s.a)) if (typeof v === 'number') expect(Number.isFinite(v), `${name} @${ms}`).toBe(true);
        }
      }
    }
  });
});
