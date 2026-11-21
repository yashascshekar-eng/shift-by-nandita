import type { MealSlot, Targets } from './nutrition';

export interface Client {
  id: string;
  user_id: string | null;
  phone: string;
  name: string | null;
  sex: 'f' | 'm' | null;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight: number | null;
  activity: string | null;
  goal: 'lose' | 'maintain' | 'gain' | null;
  diet: string | null;
  notes: string | null;
  status: 'lead' | 'active' | 'paused' | 'ended';
  plan_name: string | null;
  plan_ends: string | null;
  payment_link: string | null;
  targets: Targets | null;
  coach_note: string | null;
  meal_plan: { meal: string; items: string }[];
  diet_chart: ChartMeal[];
  workout_plan: WorkoutPlan;
  last_inbound_at: string | null;
  last_log_date: string | null;
  created_at: string;
}

export interface Log {
  id?: string;
  client_id: string;
  date: string;
  weight: number | null;
  water: number | null;
  steps: number | null;
  energy: number | null;
  workout: 'done' | 'partial' | 'skipped' | null;
  note: string | null;
  coach_reply: string | null;
  coach_replied_at?: string | null;
}

export interface Meal {
  id?: string;
  client_id: string;
  date: string;
  slot: MealSlot;
  name: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  source: 'whatsapp' | 'web' | 'coach';
  photo_path?: string | null;
  food_id?: string | null;
  qty?: number | null;
  unit?: string | null;
  created_at?: string;
}

export interface Session { state: string; data: Record<string, unknown> }

export interface Food {
  id: string;
  name: string;
  serving_qty: number;
  unit: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  food_type: 'veg' | 'egg' | 'nonveg';
  category: string;
  owner_client_id: string | null;
  archived?: boolean;
}

export interface ChartItem { food_id: string | null; name: string; qty: number; unit: string; kcal: number; p: number; c: number; f: number }
export interface ChartMeal { meal: string; time?: string; items: ChartItem[] }

export interface Measurement {
  id?: string;
  client_id: string;
  date: string;
  weight: number | null;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  arm: number | null;
  thigh: number | null;
  neck: number | null;
  body_fat: number | null;
  note?: string | null;
}

export interface WorkoutItem { n: string; s: string | number; r: string; rest?: string; note?: string }
export type WorkoutPlan = Record<string, WorkoutItem[]>;
export interface Exercise { id: string; name: string; muscle_group: string; equipment: string; cue: string | null; sort: number; archived: boolean; video_url: string | null }
export interface WorkoutTemplate { id: string; name: string; description: string | null; days: WorkoutPlan; is_demo: boolean }
