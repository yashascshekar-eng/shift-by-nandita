'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCoach, supabaseAdmin } from '@/lib/supabase/server';
import { makeRuntime } from '@/lib/whatsapp/factory';
import { sendCoachMessage } from '@/lib/whatsapp/bot';
import { draftPlan, aiEnabled } from '@/lib/ai';
import { targetsFor, ratioValid, WEEKDAYS, type Ratio, type SplitChoice } from '@/lib/nutrition';
import { chartItem, foodSchema } from '@/lib/catalogue';
import { tempPassword } from '@/lib/phone';
import { whatsappReady } from '@/lib/whatsapp/api';
import { istDate } from '@/lib/dates';
import type { ChartMeal, Client, Food } from '@/lib/types';

const COACH = () => process.env.COACH_NAME || 'Nandita';

async function getClient(id: string): Promise<Client> {
  const { data, error } = await supabaseAdmin().from('clients').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Client not found');
  return data as Client;
}

/** Send on WhatsApp; returns an error message instead of throwing so the save still counts. */
/** null = sent on WhatsApp; 'off' = WhatsApp isn't connected yet; otherwise an error message. */
async function notify(client: Client, text: string): Promise<string | null> {
  if (!whatsappReady()) return 'off';
  try {
    const { wa } = makeRuntime();
    await sendCoachMessage(wa, client, text, COACH());
    return null;
  } catch {
    return 'Saved, but the WhatsApp message failed to send. Check the number and the shift_coach_message template.';
  }
}

export type ActionResult = { ok: boolean; message: string };

const OFF_NOTE = 'They\u2019ll see it in their app. WhatsApp messages start once the number is connected.';
function result(err: string | null, sentMsg: string, savedMsg: string): ActionResult {
  if (err === 'off') return { ok: true, message: `${savedMsg} ${OFF_NOTE}` };
  return { ok: !err, message: err ?? sentMsg };
}

export async function replyToLog(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const id = String(form.get('client_id')), date = String(form.get('date')), text = String(form.get('reply') || '').trim().slice(0, 900);
  if (!text) return { ok: false, message: 'Write a reply first.' };
  const admin = supabaseAdmin();
  await admin.from('logs').upsert({ client_id: id, date, coach_reply: text, coach_replied_at: new Date().toISOString() }, { onConflict: 'client_id,date' });
  const err = await notify(await getClient(id), text);
  revalidatePath(`/coach/${id}`);
  return result(err, 'Reply saved and sent on WhatsApp.', 'Reply saved.');
}

export async function messageClient(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const id = String(form.get('client_id')), text = String(form.get('text') || '').trim().slice(0, 900);
  if (!text) return { ok: false, message: 'Write a message first.' };
  const client = await getClient(id);
  // Always keep the message on today's check-in, so the client sees it in the app too.
  const admin = supabaseAdmin();
  const today = istDate();
  const { data: log } = await admin.from('logs').select('coach_reply').eq('client_id', id).eq('date', today).maybeSingle();
  const reply = log?.coach_reply ? `${log.coach_reply}\n${text}` : text;
  await admin.from('logs').upsert({ client_id: id, date: today, coach_reply: reply, coach_replied_at: new Date().toISOString() }, { onConflict: 'client_id,date' });
  const err = await notify(client, text);
  revalidatePath(`/coach/${id}`);
  return result(err, 'Sent on WhatsApp and saved to today\u2019s check-in.', 'Saved to today\u2019s check-in.');
}

export async function saveTargets(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const s = z.object({
    client_id: z.string().uuid(), kcal: z.coerce.number().min(900).max(5000), split: z.enum(['high', 'moderate', 'zone', 'low', 'custom']),
    rc: z.coerce.number().optional(), rp: z.coerce.number().optional(), rf: z.coerce.number().optional(),
    water: z.coerce.number().min(1).max(20), steps: z.coerce.number().min(0).max(40000), coach_note: z.string().max(1500).default(''), notify: z.string().optional(),
  }).safeParse(Object.fromEntries(form));
  if (!s.success) return { ok: false, message: 'Check the numbers: calories 900–5,000, water 1–20 glasses.' };
  let ratio: Ratio | undefined;
  if (s.data.split === 'custom') {
    ratio = { c: Number(s.data.rc), p: Number(s.data.rp), f: Number(s.data.rf) };
    if (!ratioValid(ratio)) return { ok: false, message: 'Custom split: each between 5% and 80%, adding up to 100%.' };
  }
  const t = targetsFor(s.data.kcal, s.data.split as SplitChoice, s.data.water, s.data.steps, true, ratio);
  await supabaseAdmin().from('clients').update({ targets: t, coach_note: s.data.coach_note }).eq('id', s.data.client_id);
  revalidatePath(`/coach/${s.data.client_id}`);
  if (!s.data.notify) return { ok: true, message: 'Targets saved.' };
  const err = await notify(await getClient(s.data.client_id), `Your daily target is now ${t.kcal} kcal with ${t.p} g protein, ${t.c} g carbs and ${t.f} g fat.${s.data.coach_note ? ' ' + s.data.coach_note : ''}`);
  return result(err, 'Targets saved and sent on WhatsApp.', 'Targets saved.');
}

const ChartSchema = z.array(z.object({
  meal: z.string().trim().min(1).max(40), time: z.string().max(10).optional(),
  items: z.array(z.object({ food_id: z.string().nullable(), name: z.string().max(80), qty: z.number().min(0).max(5000), unit: z.string().max(12), kcal: z.number(), p: z.number(), c: z.number(), f: z.number() })).max(15),
})).max(8);

export async function saveDietChart(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
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
  await supabaseAdmin().from('clients').update({ diet_chart: chart }).eq('id', id);
  revalidatePath(`/coach/${id}`);
  if (!form.get('notify')) return { ok: true, message: 'Diet chart saved.' };
  const err = await notify(await getClient(id), 'Your diet chart has been updated. Open shiftbynandita.com/me to see it.');
  return result(err, 'Diet chart saved and the client was told on WhatsApp.', 'Diet chart saved.');
}

const WorkoutItemSchema = z.object({
  n: z.string().trim().min(1).max(80), s: z.union([z.string(), z.number()]).transform(String), r: z.string().max(30),
  rest: z.string().max(20).optional(), note: z.string().max(200).optional(),
});
const WorkoutSchema = z.record(z.enum(WEEKDAYS), z.array(WorkoutItemSchema).max(15));

function parseWorkout(json: string) {
  let raw: unknown;
  try { raw = JSON.parse(json || '{}'); } catch { return null; }
  const p = WorkoutSchema.safeParse(raw);
  if (!p.success) return null;
  const out: Record<string, z.infer<typeof WorkoutItemSchema>[]> = {};
  for (const d of WEEKDAYS) if (p.data[d]?.length) out[d] = p.data[d]!.map((e) => ({ ...e, s: e.s.slice(0, 10) }));
  return out;
}

export async function saveWorkout(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const id = String(form.get('client_id'));
  const plan = parseWorkout(String(form.get('workout') || '{}'));
  if (!plan) return { ok: false, message: 'The workout plan has an invalid entry. Check names, sets and reps.' };
  await supabaseAdmin().from('clients').update({ workout_plan: plan }).eq('id', id);
  revalidatePath(`/coach/${id}`);
  if (!form.get('notify')) return { ok: true, message: 'Workouts saved.' };
  const err = await notify(await getClient(id), 'Your workout plan has been updated. Open shiftbynandita.com/me to see this week.');
  return result(err, 'Workouts saved and the client was told on WhatsApp.', 'Workouts saved.');
}

/** Save the week being edited as a reusable template. */
export async function saveTemplate(name: string, description: string, workoutJson: string): Promise<ActionResult> {
  await requireCoach();
  const plan = parseWorkout(workoutJson);
  const n = name.trim().slice(0, 60);
  if (!plan || !Object.keys(plan).length) return { ok: false, message: 'Add at least one exercise before saving a template.' };
  if (!n) return { ok: false, message: 'Give the template a name.' };
  const { error } = await supabaseAdmin().from('workout_templates').insert({ name: n, description: description.trim().slice(0, 300), days: plan, is_demo: false });
  revalidatePath('/coach/exercises');
  return error ? { ok: false, message: 'Could not save the template.' } : { ok: true, message: `Saved "${n}" as a template.` };
}

export async function deleteTemplate(form: FormData) {
  await requireCoach();
  await supabaseAdmin().from('workout_templates').delete().eq('id', String(form.get('id')));
  revalidatePath('/coach/exercises');
}

// ---------- exercise library ----------
export async function saveExercise(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const s = z.object({
    id: z.string().optional(), name: z.string().trim().min(2).max(80), muscle_group: z.string().trim().min(2).max(30),
    equipment: z.string().trim().max(30).default('Bodyweight'), cue: z.string().max(300).default(''),
  }).safeParse(Object.fromEntries(form));
  if (!s.success) return { ok: false, message: 'Give the exercise a name and a muscle group.' };
  const { id, ...row } = s.data;
  const admin = supabaseAdmin();
  const { error } = id ? await admin.from('exercises').update(row).eq('id', id) : await admin.from('exercises').insert({ ...row, sort: 1000 });
  revalidatePath('/coach/exercises');
  if (error) return { ok: false, message: error.code === '23505' ? 'An exercise with that name already exists.' : 'Could not save the exercise.' };
  return { ok: true, message: id ? `Updated ${row.name}.` : `Added ${row.name}.` };
}

/** A one-time URL the coach's browser uploads a video to directly (videos are too big for a server action). */
export async function videoUploadUrl(exerciseId: string, contentType: string): Promise<{ url?: string; path?: string; error?: string }> {
  await requireCoach();
  const ext = contentType === 'video/quicktime' ? 'mov' : contentType === 'video/webm' ? 'webm' : 'mp4';
  if (!/^video\/(mp4|quicktime|webm)$/.test(contentType)) return { error: 'Use an MP4, MOV or WebM video.' };
  const path = `${exerciseId}/${Date.now()}.${ext}`;
  const { data, error } = await supabaseAdmin().storage.from('exercise-videos').createSignedUploadUrl(path);
  return error || !data ? { error: 'Could not start the upload.' } : { url: data.signedUrl, path };
}

export async function setExerciseVideo(exerciseId: string, path: string | null): Promise<ActionResult> {
  await requireCoach();
  const admin = supabaseAdmin();
  const { data: ex } = await admin.from('exercises').select('video_url').eq('id', exerciseId).maybeSingle();
  const old = ex?.video_url?.split('/exercise-videos/')[1];
  const url = path ? admin.storage.from('exercise-videos').getPublicUrl(path).data.publicUrl : null;
  await admin.from('exercises').update({ video_url: url }).eq('id', exerciseId);
  if (old && old !== path) await admin.storage.from('exercise-videos').remove([old]);
  revalidatePath('/coach/exercises');
  return { ok: true, message: path ? 'Video saved. Clients see it instead of the animation.' : 'Video removed. Clients see the animation again.' };
}

export async function setExerciseArchived(form: FormData) {
  await requireCoach();
  await supabaseAdmin().from('exercises').update({ archived: form.get('archived') === '1' }).eq('id', String(form.get('id')));
  revalidatePath('/coach/exercises');
}

export async function draftPlanWithAI(clientId: string): Promise<{ chart: ChartMeal[] | null; message: string }> {
  await requireCoach();
  if (!aiEnabled()) return { chart: null, message: 'Add an ANTHROPIC_API_KEY to use AI drafts.' };
  const c = await getClient(clientId);
  const t = c.targets ?? targetsFor(1600, 'moderate', 8, 8000, false);
  const allowed = c.diet === 'nonveg' ? ['veg', 'egg', 'nonveg'] : c.diet === 'egg' ? ['veg', 'egg'] : ['veg'];
  const { data } = await supabaseAdmin().from('foods').select('*').eq('archived', false).or(`owner_client_id.is.null,owner_client_id.eq.${c.id}`).in('food_type', allowed).order('category');
  const catalogue = ((data ?? []) as Food[]).slice(0, 250);
  const draft = await draftPlan(c as unknown as Record<string, unknown>, t.kcal, t.p, catalogue);
  if (!draft) return { chart: null, message: 'The AI draft failed. Try again in a moment.' };
  const chart: ChartMeal[] = draft.diet_chart.map((m) => ({
    meal: m.meal, time: m.time,
    items: m.items.map((i) => { const f = catalogue[Number(i.id.replace(/\D/g, ''))]; return f ? chartItem(f, i.qty) : null; }).filter(Boolean) as ChartMeal['items'],
  }));
  return { chart, message: 'Draft ready. Review the amounts, then save.' };
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
  if (err === 'off') return { ok: false, message: 'WhatsApp isn\u2019t connected yet. Copy the link and send it from your own WhatsApp for now.' };
  return { ok: !err, message: err ?? 'Payment link sent on WhatsApp.' };
}

// ---------- web logins ----------
/** Connect a number + password login to this client's record (same WhatsApp number). */
export async function linkLogin(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const c = await getClient(String(form.get('client_id')));
  const admin = supabaseAdmin();
  const { data: prof } = await admin.from('profiles').select('id').eq('phone', c.phone).maybeSingle();
  if (!prof) return { ok: false, message: `No login found for +${c.phone}. Ask them to create one at shiftbynandita.com/login with this number.` };
  const { data: other } = await admin.from('clients').select('id,name').eq('user_id', prof.id).maybeSingle();
  if (other && other.id !== c.id) return { ok: false, message: `That login is already connected to ${other.name ?? 'another client'}.` };
  await admin.from('clients').update({ user_id: prof.id }).eq('id', c.id);
  revalidatePath(`/coach/${c.id}`);
  return { ok: true, message: 'Login connected. They’ll see this plan when they log in.' };
}

/** Set a new temporary password for this client's login and show it to the coach. */
export async function resetClientPassword(_p: ActionResult | null, form: FormData): Promise<ActionResult> {
  await requireCoach();
  const c = await getClient(String(form.get('client_id')));
  if (!c.user_id) return { ok: false, message: 'This client has no web login connected yet.' };
  const pw = tempPassword();
  const { error } = await supabaseAdmin().auth.admin.updateUserById(c.user_id, { password: pw });
  if (error) return { ok: false, message: 'Could not reset the password. Try again.' };
  return { ok: true, message: `New password: ${pw}  Send it to them on WhatsApp; they can keep using it.` };
}
