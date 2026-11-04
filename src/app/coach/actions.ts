'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach, supabaseAdmin } from '@/lib/supabase/server';
import { makeRuntime } from '@/lib/whatsapp/factory';
import { sendCoachMessage } from '@/lib/whatsapp/bot';
import { draftPlan, aiEnabled, type PlanDraft } from '@/lib/ai';
import { targetsFor, WEEKDAYS, type SplitKey } from '@/lib/nutrition';
import type { Client } from '@/lib/types';

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

export async function savePlans(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const id = String(form.get('client_id'));
  const meals: { meal: string; items: string }[] = [];
  for (let i = 0; i < 8; i++) {
    const meal = String(form.get(`meal_${i}`) ?? '').trim(), items = String(form.get(`items_${i}`) ?? '').trim();
    if (meal || items) meals.push({ meal: meal.slice(0, 40) || 'Meal', items: items.slice(0, 600) });
  }
  const workout: Record<string, { n: string; s: string; r: string }[]> = {};
  for (const d of WEEKDAYS) {
    const rows = String(form.get(`wo_${d}`) ?? '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((r) => r[0]);
    if (rows.length) workout[d] = rows.slice(0, 15).map((r) => ({ n: r[0].slice(0, 60), s: (r[1] || '3').slice(0, 10), r: (r[2] || '10').slice(0, 20) }));
  }
  await supabaseAdmin().from('clients').update({ meal_plan: meals, workout_plan: workout }).eq('id', id);
  revalidatePath(`/coach/${id}`);
  if (!form.get('notify')) return { ok: true, message: 'Plan saved.' };
  const err = await notify(await getClient(id), 'Your meal and workout plan has been updated. Reply "plan" to see today’s, or open shiftbynandita.com/me.');
  return { ok: !err, message: err ?? 'Plan saved and the client was told on WhatsApp.' };
}

export async function draftPlanWithAI(clientId: string): Promise<{ draft: PlanDraft | null; message: string }> {
  await requireCoach();
  if (!aiEnabled()) return { draft: null, message: 'Add an ANTHROPIC_API_KEY to use AI drafts.' };
  const c = await getClient(clientId);
  const t = c.targets ?? targetsFor(1600, 'moderate', 8, 8000, false);
  const draft = await draftPlan(c as unknown as Record<string, unknown>, t.kcal, t.p);
  return draft ? { draft, message: 'Draft ready. Review and edit it, then save.' } : { draft: null, message: 'The AI draft failed. Try again in a moment.' };
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
