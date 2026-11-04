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
  workout_plan: Record<string, { n: string; s: string | number; r: string }[]>;
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
  created_at?: string;
}

export interface Session { state: string; data: Record<string, unknown> }
