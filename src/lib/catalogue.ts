// Food catalogue maths: scale a catalogue food to the amount eaten, total a diet chart.
import { z } from 'zod';
import type { ChartItem, ChartMeal, Food } from './types';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Macros for `qty` of a food, where qty is in the food's own unit (g, ml, piece…). */
export function scaleFood(food: Pick<Food, 'serving_qty' | 'kcal' | 'p' | 'c' | 'f'>, qty: number) {
  const k = qty / (Number(food.serving_qty) || 1);
  return { kcal: Math.round(Number(food.kcal) * k), p: round1(Number(food.p) * k), c: round1(Number(food.c) * k), f: round1(Number(food.f) * k) };
}

export function chartItem(food: Food, qty: number): ChartItem {
  return { food_id: food.id, name: food.name, qty, unit: food.unit, ...scaleFood(food, qty) };
}

export function itemsTotal(items: Pick<ChartItem, 'kcal' | 'p' | 'c' | 'f'>[]) {
  const t = items.reduce((a, i) => ({ kcal: a.kcal + Number(i.kcal || 0), p: a.p + Number(i.p || 0), c: a.c + Number(i.c || 0), f: a.f + Number(i.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
  return { kcal: Math.round(t.kcal), p: round1(t.p), c: round1(t.c), f: round1(t.f) };
}

export function chartTotal(chart: ChartMeal[]) {
  return itemsTotal(chart.flatMap((m) => m.items));
}

export function servingLabel(qty: number, unit: string) {
  if (unit === 'piece') return `${qty} ${qty === 1 ? 'piece' : 'pieces'}`;
  if (['g', 'ml'].includes(unit)) return `${qty} ${unit}`;
  return `${qty} ${unit}${qty !== 1 && !unit.endsWith('s') ? 's' : ''}`;
}

export const UNITS = ['g', 'ml', 'piece', 'cup', 'katori', 'glass', 'scoop', 'plate', 'bowl', 'ball', 'tbsp', 'tsp'] as const;
export const CATEGORIES = ['Home meals', 'Grains', 'Pulses', 'Vegetables', 'Fruits', 'Dairy', 'Eggs', 'Meat & fish', 'Protein', 'Fats & nuts', 'Sweets', 'Sweeteners', 'Drinks', 'Other'] as const;

/** Plain-text version of the diet chart for WhatsApp. */
export function chartToText(chart: ChartMeal[]): string {
  return chart
    .filter((m) => m.items.length)
    .map((m) => `*${m.meal}*${m.time ? ` (${m.time})` : ''}\n${m.items.map((i) => `• ${i.name}, ${servingLabel(i.qty, i.unit)}`).join('\n')}`)
    .join('\n\n');
}

/** Validation for a catalogue or custom food. */
export const foodSchema = z.object({
  name: z.string().trim().min(2).max(80), serving_qty: z.number().positive().max(5000), unit: z.string().min(1).max(12),
  kcal: z.number().min(0).max(5000), p: z.number().min(0).max(500), c: z.number().min(0).max(1000), f: z.number().min(0).max(500),
  food_type: z.enum(['veg', 'egg', 'nonveg']), category: z.string().max(30),
});

