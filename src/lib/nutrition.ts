// Calorie and macro maths shared by the web app, the WhatsApp bot and the calculators.

export type Sex = 'f' | 'm';
export type Goal = 'lose' | 'maintain' | 'gain';
export type SplitKey = 'high' | 'moderate' | 'zone' | 'low';

export const SPLITS: Record<SplitKey, { label: string; c: number; p: number; f: number }> = {
  high: { label: 'High carb', c: 60, p: 25, f: 15 },
  moderate: { label: 'Moderate carb', c: 50, p: 30, f: 20 },
  zone: { label: 'Zone', c: 40, p: 30, f: 30 },
  low: { label: 'Low carb', c: 25, p: 35, f: 40 },
};

export const ACTIVITY = [
  { key: 'sed', label: 'Desk job, little exercise', mult: 1.2 },
  { key: 'light', label: '1–3 workouts a week', mult: 1.375 },
  { key: 'mod', label: '3–5 workouts a week', mult: 1.55 },
  { key: 'high', label: '6–7 workouts a week', mult: 1.725 },
  { key: 'ath', label: 'Athlete or physical job', mult: 1.9 },
] as const;

export const GOALS: Record<Goal, string> = { lose: 'Lose fat', maintain: 'Maintain & tone', gain: 'Build muscle' };
export const DIETS: Record<string, string> = { veg: 'Vegetarian', egg: 'Eggetarian', nonveg: 'Non-vegetarian' };
export const MEAL_SLOTS = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snacks', dinner: 'Dinner' };
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const ENERGY = ['Drained', 'Low', 'Okay', 'Good', 'Great'] as const;

export interface Targets { kcal: number; p: number; c: number; f: number; split: SplitKey; water: number; steps: number; confirmed: boolean }

export function activityMult(key?: string | null): number {
  return (ACTIVITY.find((a) => a.key === key) ?? ACTIVITY[1]).mult;
}

/** Mifflin–St Jeor, or Katch–McArdle when body fat % is known. */
export function bmr(o: { sex: Sex; weightKg: number; heightCm: number; age: number; bodyFat?: number }): number {
  if (o.bodyFat && o.bodyFat > 0) return 370 + 21.6 * o.weightKg * (1 - o.bodyFat / 100);
  return 10 * o.weightKg + 6.25 * o.heightCm - 5 * o.age + (o.sex === 'f' ? -161 : 5);
}

/** US Navy tape-measure body fat estimate (cm). Returns NaN for impossible inputs. */
export function navyBodyFat(sex: Sex, waist: number, neck: number, heightCm: number, hip = 0): number {
  if (!(waist > 0 && neck > 0 && heightCm > 0)) return NaN;
  if (sex === 'f') {
    const x = waist + hip - neck;
    if (!(hip > 0) || x <= 0) return NaN;
    return 495 / (1.29579 - 0.35004 * Math.log10(x) + 0.221 * Math.log10(heightCm)) - 450;
  }
  const x = waist - neck;
  if (x <= 0) return NaN;
  return 495 / (1.0324 - 0.19077 * Math.log10(x) + 0.15456 * Math.log10(heightCm)) - 450;
}

export function macros(kcal: number, split: SplitKey = 'moderate') {
  const s = SPLITS[split] ?? SPLITS.moderate;
  return { p: Math.round((kcal * s.p) / 400), c: Math.round((kcal * s.c) / 400), f: Math.round((kcal * s.f) / 900) };
}

export function draftTargets(c: { sex?: string | null; weight_kg?: number | null; height_cm?: number | null; age?: number | null; activity?: string | null; goal?: string | null }): Targets {
  const b = bmr({ sex: (c.sex as Sex) || 'f', weightKg: Number(c.weight_kg) || 60, heightCm: Number(c.height_cm) || 160, age: Number(c.age) || 30 });
  const tdee = b * activityMult(c.activity);
  const factor = c.goal === 'lose' ? 0.8 : c.goal === 'gain' ? 1.1 : 1;
  const kcal = Math.round((tdee * factor) / 50) * 50;
  return { kcal, split: 'moderate', ...macros(kcal, 'moderate'), water: 8, steps: 8000, confirmed: false };
}

export function targetsFor(kcal: number, split: SplitKey, water = 8, steps = 8000, confirmed = true): Targets {
  return { kcal: Math.round(kcal), split, ...macros(kcal, split), water, steps, confirmed };
}

export interface MealLike { kcal: number | string; p: number | string; c: number | string; f: number | string }
export function totals(meals: MealLike[]) {
  return meals.reduce<{ kcal: number; p: number; c: number; f: number }>(
    (a, m) => ({ kcal: a.kcal + Number(m.kcal || 0), p: a.p + Number(m.p || 0), c: a.c + Number(m.c || 0), f: a.f + Number(m.f || 0) }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
}

export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => Math.round(n * 10) / 10;
