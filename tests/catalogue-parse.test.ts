import { describe, expect, it } from 'vitest';
import { parseFoodText, type CatalogueFood } from '../src/lib/foods';

const cat = (rows: [string, number, string, number, number][]): CatalogueFood[] =>
  rows.map(([name, serving_qty, unit, kcal, p]) => ({ name, serving_qty, unit, kcal, p, c: 0, f: 0 }));
const C = cat([
  ['Chapati', 1, 'piece', 100, 3], ['Dal, cooked', 1, 'katori', 140, 9], ['Vegetable sabzi / palya', 1, 'katori', 110, 3],
  ['Paneer, high protein', 100, 'g', 200, 25], ['Paneer, 0% fat', 100, 'g', 72, 13], ['Greek yogurt', 100, 'g', 97, 9],
  ['Greek yogurt, 0% fat', 170, 'g', 100, 17], ['Milk for coffee / tea', 100, 'ml', 62, 3], ['Tea with milk', 1, 'cup', 60, 2],
]);

describe('typed meals against the coach catalogue', () => {
  it('uses catalogue values and built-in spellings', () => {
    const items = parseFoodText('3 rotis, daal and palya', C);
    expect(items.map((i) => [i.name, i.qty, i.kcal])).toEqual([['Chapati', 3, 300], ['Dal, cooked', 1, 140], ['Vegetable sabzi / palya', 1, 110]]);
  });
  it('scales gram foods and prefers exact names', () => {
    expect(parseFoodText('150 g high protein paneer', C)[0]).toMatchObject({ name: 'Paneer, high protein (150 g)', kcal: 300, p: 37.5 });
    expect(parseFoodText('greek yogurt', C)[0].name).toBe('Greek yogurt (100 g)');
  });
  it('does not guess between variants or steal short words', () => {
    expect(parseFoodText('paneer', C)[0].name).toBe('Paneer, 100 g'); // built-in, not a random variant
    expect(parseFoodText('tea', C)[0].name).toBe('Tea with milk');
  });
  it('converts ml for built-in foods', () => expect(parseFoodText('200 ml milk', C)[0]).toMatchObject({ name: 'Milk', qty: 0.8 }));
  it('still works with no catalogue', () => expect(parseFoodText('2 idli and sambar').map((i) => i.qty)).toEqual([2, 1]));
});
