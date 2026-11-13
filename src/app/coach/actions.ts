'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach, supabaseAdmin } from '@/lib/supabase/server';
import { makeRuntime } from '@/lib/whatsapp/factory';
import { sendCoachMessage } from '@/lib/whatsapp/bot';
import { draftPlan, aiEnabled } from '@/lib/ai';
import { targetsFor, WEEKDAYS, type SplitKey } from '@/lib/nutrition';
import { chartItem, foodSchema } from '@/lib/catalogue';
import type { ChartMeal, Client, Food } from '@/lib/types';

const COACH = () => process.env.COACH_NAME || 'Nandita';

async function getClient(id: string): Promise<Client> {
  const { data, error } = await supabaseAdmin().from('clients').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Client not found');
  return data as Client;
}

/** Send on WhatsApp; returns an error message instead of throwing so the save still counts. */
async function notify(client: Client, text: string): Promise<string | null> {
  try {
    const { wa } = makeRuntime();
    await sendCoachMessage(wa, client, text, COACH());
    return null;
  } catch {
    return 'Saved, but the WhatsApp message failed to send. Check the number and the shift_coach_message template.';
  }
}

export type ActionResult = { ok: boolean; message: string };

export async function replyToLog(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const id = String(form.get('client_id')), date = String(form.get('date')), text = String(form.get('reply') || '').trim().slice(0, 900);
  if (!text) return { ok: false, message: 'Write a reply first.' };
  const admin = supabaseAdmin();
  await admin.from('logs').upsert({ client_id: id, date, coach_reply: text, coach_replied_at: new Date().toISOString() }, { onConflict: 'client_id,date' });
  const err = await notify(await getClient(id), text);
  revalidatePath(`/coach/${id}`);
  return { ok: !err, message: err ?? 'Reply sent on WhatsApp.' };
}

export async function messageClient(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const id = String(form.get('client_id')), text = String(form.get('text') || '').trim().slice(0, 900);
  if (!text) return { ok: false, message: 'Write a message first.' };
  const err = await notify(await getClient(id), text);
  revalidatePath(`/coach/${id}`);
  return { ok: !err, message: err ?? 'Sent on WhatsApp.' };
}

export async function saveTargets(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const s = z.object({
    client_id: z.string().uuid(), kcal: z.coerce.number().min(900).max(5000), split: z.enum(['high', 'moderate', 'zone', 'low']),
    water: z.coerce.number().min(1).max(20), steps: z.coerce.number().min(0).max(40000), coach_note: z.string().max(1500).default(''), notify: z.string().optional(),
  }).safeParse(Object.fromEntries(form));
  if (!s.success) return { ok: false, message: 'Check the numbers: calories 900–5,000, water 1–20 glasses.' };
  const t = targetsFor(s.data.kcal, s.data.split as SplitKey, s.data.water, s.data.steps, true);
  await supabaseAdmin().from('clients').update({ targets: t, coach_note: s.data.coach_note }).eq('id', s.data.client_id);
  revalidatePath(`/coach/${s.data.client_id}`);
  if (!s.data.notify) return { ok: true, message: 'Targets saved.' };
  const err = await notify(await getClient(s.data.client_id), `Your daily target is now ${t.kcal} kcal with ${t.p} g protein, ${t.c} g carbs and ${t.f} g fat.${s.data.coach_note ? ' ' + s.data.coach_note : ''}`);
  return { ok: !err, message: err ?? 'Targets saved and sent on WhatsApp.' };
}

const ChartSchema = z.array(z.object({
  meal: z.string().trim().min(1).max(40), time: z.string().max(10).optional(),
  items: z.array(z.object({ food_id: z.string().nullable(), name: z.string().max(80), qty: z.number().min(0).max(5000), unit: z.string().max(12), kcal: z.number(), p: z.number(), c: z.number(), f: z.number() })).max(15),
})).max(8);

export async function savePlans(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const id = String(form.get('client_id'));
  let raw: unknown;
  try { raw = JSON.parse(String(form.get('diet_chart') || '[]')); } catch { raw = null; }
  const parsed = ChartSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, message: 'The diet chart has an invalid entry. Check meal names and amounts.' };
  // Recompute every item's macros from the catalogue so the saved chart can't drift from the foods.
  const ids = [...new Set(parsed.data.flatMap((m) => m.items.map((i) => i.food_id)).filter(Boolean))] as string[];
  const { data: foods } = ids.length ? await supabaseAdmin().from('foods').select('*').in('id', ids) : { data: [] };
  const byId = new Map(((foods ?? []) as Food[]).map((f) => [f.id, f]));
  const chart: ChartMeal[] = parsed.data
    .map((m) => ({ meal: m.meal, time: m.time || undefined, items: m.items.filter((i) => i.qty > 0).map((i) => (i.food_id && byId.get(i.food_id) ? chartItem(byId.get(i.food_id)!, i.qty) : i)) }))
    .filter((m) => m.items.length || m.meal);

  const workout: Record<string, { n: string; s: string; r: string }[]> = {};
  for (const d of WEEKDAYS) {
    const rows = String(form.get(`wo_${d}`) ?? '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0]);
    if (rows.length) workout[d] = rows.slice(0, 15).map((r) => ({ n: r[0].slice(0, 60), s: (r[1] || '3').slice(0, 10), r: (r[2] || '10').slice(0, 20) }));
  }
  await supabaseAdmin().from('clients').update({ diet_chart: chart, workout_plan: workout }).eq('id', id);
  revalidatePath(`/coach/${id}`);
  if (!form.get('notify')) return { ok: true, message: 'Plan saved.' };
  const err = await notify(await getClient(id), 'Your diet chart and workout plan have been updated. Reply "plan" to see today\u2019s, or open shiftbynandita.com/me.');
  return { ok: !err, message: err ?? 'Plan saved and the client was told on WhatsApp.' };
}

export async function draftPlanWithAI(clientId: string): Promise<{ chart: ChartMeal[] | null; workout: Record<string, unknown> | null; message: string }> {
  await requireCoach();
  if (!aiEnabled()) return { chart: null, workout: null, message: 'Add an ANTHROPIC_API_KEY to use AI drafts.' };
  const c = await getClient(clientId);
  const t = c.targets ?? targetsFor(1600, 'moderate', 8, 8000, false);
  const allowed = c.diet === 'nonveg' ? ['veg', 'egg', 'nonveg'] : c.diet === 'egg' ? ['veg', 'egg'] : ['veg'];
  const { data } = await supabaseAdmin().from('foods').select('*').eq('archived', false).or(`owner_client_id.is.null,owner_client_id.eq.${c.id}`).in('food_type', allowed).order('category');
  const catalogue = ((data ?? []) as Food[]).slice(0, 250);
  const draft = await draftPlan(c as unknown as Record<string, unknown>, t.kcal, t.p, catalogue);
  if (!draft) return { chart: null, workout: null, message: 'The AI draft failed. Try again in a moment.' };
  const chart: ChartMeal[] = draft.diet_chart.map((m) => ({
    meal: m.meal, time: m.time,
    items: m.items.map((i) => { const f = catalogue[Number(i.id.replace(/\D/g, ''))]; return f ? chartItem(f, i.qty) : null; }).filter(Boolean) as ChartMeal['items'],
  }));
  return { chart, workout: draft.workout_plan, message: 'Draft ready. Review the amounts, then save.' };
}

// ---------- catalogue management ----------
export async function saveFood(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const num = (k: string) => Number(form.get(k));
  const s = foodSchema.safeParse({
    name: String(form.get('name') || ''), serving_qty: num('serving_qty'), unit: String(form.get('unit') || 'g'),
    kcal: num('kcal'), p: num('p') || 0, c: num('c') || 0, f: num('f') || 0,
    food_type: String(form.get('food_type') || 'veg'), category: String(form.get('category') || 'Other'),
  });
  if (!s.success) return { ok: false, message: 'Check the name, quantity and calories.' };
  const id = String(form.get('id') || '');
  const admin = supabaseAdmin();
  const { error } = id ? await admin.from('foods').update(s.data).eq('id', id) : await admin.from('foods').insert({ ...s.data, owner_client_id: null });
  revalidatePath('/coach/foods');
  return error ? { ok: false, message: 'Could not save the food.' } : { ok: true, message: id ? `Updated ${s.data.name}.` : `Added ${s.data.name} to the catalogue.` };
}

export async function setFoodArchived(form: FormData) {
  await requireCoach();
  await supabaseAdmin().from('foods').update({ archived: form.get('archived') === '1' }).eq('id', String(form.get('id')));
  revalidatePath('/coach/foods');
}

/** Make a client's custom food part of the shared catalogue. */
export async function promoteFood(form: FormData) {
  await requireCoach();
  await supabaseAdmin().from('foods').update({ owner_client_id: null }).eq('id', String(form.get('id')));
  revalidatePath('/coach/foods');
}

export async function saveStatus(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const s = z.object({
    client_id: z.string().uuid(), status: z.enum(['lead', 'active', 'paused', 'ended']),
    plan_name: z.string().max(60).default(''), plan_ends: z.string().default(''), payment_link: z.union([z.string().url(), z.literal('')]).default(''),
  }).safeParse(Object.fromEntries(form));
  if (!s.success) return { ok: false, message: 'Check the payment link: it must be a full https:// address.' };
  const { client_id, plan_ends, payment_link, plan_name, status } = s.data;
  await supabaseAdmin().from('clients').update({ status, plan_name: plan_name || null, plan_ends: plan_ends || null, payment_link: payment_link || null }).eq('id', client_id);
  revalidatePath(`/coach/${client_id}`);
  revalidatePath('/coach');
  return { ok: true, message: status === 'active' ? 'Saved. Daily WhatsApp messages are on for this client.' : 'Saved. Scheduled WhatsApp messages are off for this client.' };
}

export async function sendPaymentLink(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const c = await getClient(String(form.get('client_id')));
  if (!c.payment_link) return { ok: false, message: 'Save a payment link first.' };
  const err = await notify(c, `To start your ${c.plan_name || 'SHIFT'} plan, pay here: ${c.payment_link}`);
  return { ok: !err, message: err ?? 'Payment link sent on WhatsApp.' };
}
