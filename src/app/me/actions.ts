'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireClient, supabaseAdmin } from '@/lib/supabase/server';
import { FOODS } from '@/lib/foods';
import { addDays, istDate } from '@/lib/dates';
import { draftTargets, MEAL_SLOTS } from '@/lib/nutrition';
import type { Food, ChartMeal } from '@/lib/types';
import { scaleFood, foodSchema } from '@/lib/catalogue';


const optNum = (min: number, max: number) => z.preprocess((v) => (v === '' || v === null ? null : Number(v)), z.number().min(min).max(max).nullable());
const dateOk = (d: string) => d <= istDate() && d >= addDays(istDate(), -60);

export async function saveIntake(form: FormData) {
  const { me, client } = await requireClient();
  if (client) redirect('/me');
  if (!me.phone) redirect('/login?next=/me');
  const s = z.object({
    name: z.string().trim().min(2).max(40), sex: z.enum(['f', 'm']), age: z.coerce.number().int().min(14).max(90),
    height_cm: z.coerce.number().min(120).max(220), weight_kg: z.coerce.number().min(30).max(250),
    target_weight: optNum(30, 250), goal: z.enum(['lose', 'maintain', 'gain']), diet: z.enum(['veg', 'egg', 'nonveg']),
    activity: z.enum(['sed', 'light', 'mod', 'high', 'ath']), notes: z.string().max(1000).default(''),
  }).safeParse(Object.fromEntries(form));
  if (!s.success) redirect('/me?error=intake');
  const admin = supabaseAdmin();
  const { data: c } = await admin.from('clients').insert({ ...s.data, phone: me.phone, user_id: me.userId, targets: draftTargets(s.data) }).select('id').single();
  if (c) await admin.from('logs').upsert({ client_id: c.id, date: istDate(), weight: s.data.weight_kg }, { onConflict: 'client_id,date' });
  revalidatePath('/me');
  redirect('/me');
}

export async function addMeal(form: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/me');
  const date = String(form.get('date') || istDate());
  const slot = String(form.get('slot'));
  if (!dateOk(date) || !(MEAL_SLOTS as readonly string[]).includes(slot)) return;
  let row: { name: string; kcal: number; p: number; c: number; f: number };
  const customName = String(form.get('custom_name') || '').trim();
  if (customName) {
    const kcal = Number(form.get('custom_kcal')) || 0;
    if (!(kcal > 0 && kcal < 3000)) return;
    row = { name: customName.slice(0, 120), kcal, p: Number(form.get('custom_p')) || 0, c: Number(form.get('custom_c')) || 0, f: Number(form.get('custom_f')) || 0 };
  } else {
    const food = FOODS.find((f) => f.key === form.get('food'));
    const qty = Math.min(20, Math.max(0.5, Number(form.get('qty')) || 1));
    if (!food) return;
    row = { name: qty !== 1 ? `${qty} × ${food.name}` : food.name, kcal: Math.round(food.kcal * qty), p: Math.round(food.p * qty), c: Math.round(food.c * qty), f: Math.round(food.f * qty) };
  }
  const admin = supabaseAdmin();
  await admin.from('meals').insert({ client_id: client.id, date, slot, source: 'web', ...row });
  await admin.from('clients').update({ last_log_date: date }).eq('id', client.id).or(`last_log_date.is.null,last_log_date.lt.${date}`);
  revalidatePath('/me');
}

export async function deleteMeal(form: FormData) {
  const { client } = await requireClient();
  if (!client) return;
  await supabaseAdmin().from('meals').delete().eq('id', String(form.get('id'))).eq('client_id', client.id);
  revalidatePath('/me');
}

export async function saveCheckin(form: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/me');
  const s = z.object({
    date: z.string().refine(dateOk), weight: optNum(30, 250), water: optNum(0, 30), steps: optNum(0, 100000), energy: optNum(1, 5),
    workout: z.preprocess((v) => (v === '' ? null : v), z.enum(['done', 'partial', 'skipped']).nullable()), note: z.string().max(1000).default(''),
  }).safeParse(Object.fromEntries(form));
  if (!s.success) redirect(`/me?error=checkin`);
  const { date, ...rest } = s.data;
  const admin = supabaseAdmin();
  await admin.from('logs').upsert({ client_id: client.id, date, ...rest, updated_at: new Date().toISOString() }, { onConflict: 'client_id,date' });
  await admin.from('clients').update({ last_log_date: date }).eq('id', client.id).or(`last_log_date.is.null,last_log_date.lt.${date}`);
  revalidatePath('/me');
  redirect(`/me?date=${date}&saved=1`);
}

// ---------- catalogue ----------

async function visibleFood(foodId: string, clientId: string): Promise<Food | null> {
  const { data } = await supabaseAdmin().from('foods').select('*').eq('id', foodId).maybeSingle();
  if (!data || (data.owner_client_id && data.owner_client_id !== clientId)) return null;
  return data as Food;
}

async function insertMeal(clientId: string, row: Record<string, unknown> & { date: string }) {
  const admin = supabaseAdmin();
  await admin.from('meals').insert({ client_id: clientId, source: 'web', ...row });
  await admin.from('clients').update({ last_log_date: row.date }).eq('id', clientId).or(`last_log_date.is.null,last_log_date.lt.${row.date}`);
}

export async function logFood(foodId: string, qty: number, slot: string, date: string) {
  const { client } = await requireClient();
  if (!client || !dateOk(date) || !(MEAL_SLOTS as readonly string[]).includes(slot) || !(qty > 0 && qty < 5000)) return;
  const food = await visibleFood(foodId, client.id);
  if (!food) return;
  await insertMeal(client.id, { date, slot, name: food.name, food_id: food.id, qty, unit: food.unit, ...scaleFood(food, qty) });
  revalidatePath('/me');
}

export async function toggleFavourite(foodId: string) {
  const { client } = await requireClient();
  if (!client || !(await visibleFood(foodId, client.id))) return;
  const admin = supabaseAdmin();
  const { data } = await admin.from('favourites').select('food_id').eq('client_id', client.id).eq('food_id', foodId).maybeSingle();
  if (data) await admin.from('favourites').delete().eq('client_id', client.id).eq('food_id', foodId);
  else await admin.from('favourites').insert({ client_id: client.id, food_id: foodId });
}

export async function createCustomFood(input: unknown): Promise<Food | null> {
  const { client } = await requireClient();
  const s = foodSchema.safeParse(input);
  if (!client || !s.success) return null;
  const { data } = await supabaseAdmin().from('foods').insert({ ...s.data, owner_client_id: client.id }).select('*').single();
  return (data as Food) ?? null;
}

/** Log every item of one meal from the client's diet chart, as planned. */
export async function logChartMeal(form: FormData) {
  const { client } = await requireClient();
  if (!client) return;
  const date = String(form.get('date') || istDate());
  const idx = Number(form.get('meal'));
  const meal = (client.diet_chart as ChartMeal[] | null)?.[idx];
  if (!meal || !dateOk(date)) return;
  const slot = String(form.get('slot'));
  if (!(MEAL_SLOTS as readonly string[]).includes(slot)) return;
  for (const i of meal.items) {
    await insertMeal(client.id, { date, slot, name: i.name, food_id: i.food_id, qty: i.qty, unit: i.unit, kcal: i.kcal, p: i.p, c: i.c, f: i.f });
  }
  revalidatePath('/me');
  redirect(`/me?date=${date}&saved=meal`);
}

// ---------- measurements ----------
export async function saveMeasurement(form: FormData) {
  const { client } = await requireClient();
  if (!client) redirect('/me');
  const s = z.object({
    date: z.string().refine(dateOk), weight: optNum(30, 250), waist: optNum(30, 250), hip: optNum(30, 250), chest: optNum(30, 250),
    arm: optNum(10, 80), thigh: optNum(20, 120), neck: optNum(20, 70), body_fat: optNum(2, 70), note: z.string().max(300).default(''),
  }).safeParse(Object.fromEntries(form));
  if (!s.success) redirect('/me?tab=progress&error=measure');
  const admin = supabaseAdmin();
  await admin.from('measurements').upsert({ client_id: client.id, ...s.data }, { onConflict: 'client_id,date' });
  if (s.data.weight) await admin.from('logs').upsert({ client_id: client.id, date: s.data.date, weight: s.data.weight }, { onConflict: 'client_id,date' });
  revalidatePath('/me');
  redirect('/me?tab=progress&saved=measure');
}

export async function deleteMeasurement(form: FormData) {
  const { client } = await requireClient();
  if (!client) return;
  await supabaseAdmin().from('measurements').delete().eq('id', String(form.get('id'))).eq('client_id', client.id);
  revalidatePath('/me');
}

export async function saveBodyFat(value: number) {
  const { client } = await requireClient();
  if (!client || !(value > 2 && value < 70)) return false;
  await supabaseAdmin().from('measurements').upsert({ client_id: client.id, date: istDate(), body_fat: Math.round(value * 10) / 10 }, { onConflict: 'client_id,date' });
  revalidatePath('/me');
  return true;
}
