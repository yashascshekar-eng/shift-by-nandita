import { describe, expect, it } from 'vitest';
import { macros, ratioValid, splitLabel, targetsFor } from '../src/lib/nutrition';

describe('custom macro split', () => {
  it('uses the coach ratio', () => {
    const t = targetsFor(1600, 'custom', 8, 8000, true, { c: 35, p: 40, f: 25 });
    expect(t).toMatchObject({ p: 160, c: 140, f: 44, ratio: { c: 35, p: 40, f: 25 } });
    expect(splitLabel(t)).toBe('Custom split · C 35% · P 40% · F 25%');
  });
  it('presets ignore a ratio', () => expect(macros(2000, 'moderate', { c: 10, p: 10, f: 80 })).toEqual({ p: 150, c: 250, f: 44 }));
  it('validates percentages', () => {
    expect(ratioValid({ c: 40, p: 30, f: 30 })).toBe(true);
    expect(ratioValid({ c: 40, p: 30, f: 20 })).toBe(false);
    expect(ratioValid({ c: 92, p: 4, f: 4 })).toBe(false);
  });
});
