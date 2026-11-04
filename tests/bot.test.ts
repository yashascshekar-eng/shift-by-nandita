import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { MemoryStore } from '@/lib/store';
import { ShiftBot, normalize, parseCheckinNumbers, parseHeightCm, sendCoachMessage, type Inbound } from '@/lib/whatsapp/bot';
import type { WhatsAppSender, Button, ListRow } from '@/lib/whatsapp/api';
import { verifySignature, cleanParam } from '@/lib/whatsapp/api';
import { verifyStandardWebhook } from '@/lib/webhooks';
import { runJob } from '@/lib/jobs';
import { parseFoodText } from '@/lib/foods';
import { bmr, draftTargets, macros, navyBodyFat } from '@/lib/nutrition';
import { slotForTime, istDate } from '@/lib/dates';

type Sent = { to: string; kind: string; body: string; buttons?: string[]; template?: string; params?: string[]; payloads?: string[] };
class FakeWA implements WhatsAppSender {
  sent: Sent[] = [];
  async text(to: string, body: string) { this.sent.push({ to, kind: 'text', body }); }
  async buttons(to: string, body: string, b: Button[]) { this.sent.push({ to, kind: 'buttons', body, buttons: b.map((x) => x.id) }); }
  async list(to: string, body: string, _l: string, rows: ListRow[]) { this.sent.push({ to, kind: 'list', body, buttons: rows.map((r) => r.id) }); }
  async template(to: string, name: string, params: string[], payloads: string[] = []) { this.sent.push({ to, kind: 'template', body: '', template: name, params, payloads }); }
  async downloadMedia() { return { data: Buffer.from('fake'), mimeType: 'image/jpeg' }; }
  get last() { return this.sent[this.sent.length - 1]; }
}

const PHONE = '919800000001';
// 13:15 IST on 4 Nov 2026 → lunch slot
const NOW = new Date('2026-11-04T07:45:00Z');
let n = 0;
const text = (t: string): Inbound => ({ id: 'm' + ++n, from: PHONE, type: 'text', text: t });
const btn = (id: string): Inbound => ({ id: 'm' + ++n, from: PHONE, type: 'button', buttonId: id });

function setup(estimate: any = async () => null) {
  const store = new MemoryStore();
  const wa = new FakeWA();
  const bot = new ShiftBot({ store, wa, estimate, now: () => NOW });
  return { store, wa, bot };
}

async function onboard(bot: ShiftBot) {
  for (const m of [text('hi'), text('Priya Sharma'), btn('sex_f'), text('31'), text('5 3'), text('68.4'), btn('goal_lose'), btn('diet_veg'), btn('act_light'), btn('notes_skip')]) await bot.handle(m);
}

describe('onboarding', () => {
  it('collects intake and creates a client with draft targets', async () => {
    const { store, wa, bot } = setup();
    await onboard(bot);
    const c = await store.getClientByPhone(PHONE);
    expect(c?.name).toBe('Priya Sharma');
    expect(c?.height_cm).toBe(160);
    expect(c?.targets?.confirmed).toBe(false);
    expect(c?.targets?.kcal).toBeGreaterThan(1100);
    expect(wa.last.body).toContain('starting target');
    expect((await store.getLog(c!.id, istDate(NOW)))?.weight).toBe(68.4);
  });

  it('re-asks on invalid input without advancing', async () => {
    const { store, wa, bot } = setup();
    await bot.handle(text('hi'));
    await bot.handle(text('Priya'));
    await bot.handle(btn('sex_f'));
    await bot.handle(text('three hundred'));
    expect(wa.last.body).toMatch(/age as a number/);
    expect((await store.getSession(PHONE)).state).toBe('intake:age');
  });

  it('ignores Meta webhook retries of the same message id', async () => {
    const { wa, bot } = setup();
    const m = text('hi');
    await bot.handle(m);
    await bot.handle(m);
    expect(wa.sent).toHaveLength(1);
  });
});

describe('meal logging', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(async () => { ctx = setup(); await onboard(ctx.bot); });

  it('logs typed food via the fallback table when AI is off', async () => {
    await ctx.bot.handle(text('2 chapati, dal and 1 cup curd'));
    expect(ctx.wa.last.buttons).toEqual(['meal_ok', 'meal_edit', 'meal_no']);
    expect(ctx.wa.last.body).toMatch(/Lunch/);
    await ctx.bot.handle(btn('meal_ok'));
    const meals = ctx.store.meals;
    expect(meals).toHaveLength(1);
    expect(meals[0].kcal).toBe(2 * 105 + 150 + 150);
    expect(meals[0].source).toBe('whatsapp');
    expect(ctx.wa.last.body).toContain('Logged');
  });

  it('accepts a typed correction while confirming', async () => {
    await ctx.bot.handle(text('2 chapati'));
    await ctx.bot.handle(text('3 chapati and dal'));
    await ctx.bot.handle(btn('meal_ok'));
    expect(ctx.store.meals[0].kcal).toBe(3 * 105 + 150);
  });

  it('uses the AI estimate for photos and stores the photo path', async () => {
    const c = setup(async () => ({ items: [{ name: '2 chapati, dal, salad', qty: 1, kcal: 520, p: 18, c: 72, f: 16 }], notFood: false }));
    await onboard(c.bot);
    await c.bot.handle({ id: 'img1', from: PHONE, type: 'image', imageId: 'media1' });
    await c.bot.handle(btn('meal_ok'));
    expect(c.store.meals[0].kcal).toBe(520);
    expect(c.store.meals[0].photo_path).toMatch(/img1\.jpg$/);
  });

  it('asks what is on the plate when the photo cannot be estimated', async () => {
    await ctx.bot.handle({ id: 'img2', from: PHONE, type: 'image', imageId: 'media2' });
    expect(ctx.wa.last.body).toMatch(/What.s on the plate/);
    await ctx.bot.handle(text('2 idli and sambar'));
    await ctx.bot.handle(btn('meal_ok'));
    expect(ctx.store.meals[0].kcal).toBe(2 * 60 + 130);
  });

  it('discards on request', async () => {
    await ctx.bot.handle(text('2 chapati'));
    await ctx.bot.handle(btn('meal_no'));
    expect(ctx.store.meals).toHaveLength(0);
  });
});

describe('evening check-in', () => {
  it('saves numbers, workout, energy and note', async () => {
    const { store, wa, bot } = setup();
    await onboard(bot);
    const c = (await store.getClientByPhone(PHONE))!;
    c.workout_plan = { Wed: [{ n: 'Goblet squat', s: 3, r: '12' }] }; // 4 Nov 2026 is a Wednesday
    await bot.handle(btn('ci_start'));
    await bot.handle(text('68.2, 7, 8200'));
    expect(wa.last.buttons).toEqual(['wo_done', 'wo_partial', 'wo_skipped']);
    await bot.handle(btn('wo_done'));
    await bot.handle(btn('en_4'));
    await bot.handle(text('Craved sweets after dinner'));
    const log = await store.getLog(c.id, istDate(NOW));
    expect(log).toMatchObject({ weight: 68.2, water: 7, steps: 8200, workout: 'done', energy: 4, note: 'Craved sweets after dinner' });
    expect(wa.last.body).toContain('Check-in saved');
  });
});

describe('global buttons', () => {
  it('starts check-in from the template even mid-meal', async () => {
    const { store, wa, bot } = setup();
    await onboard(bot);
    await bot.handle(text('2 chapati'));
    await bot.handle(btn('ci_start'));
    expect((await store.getSession(PHONE)).state).toBe('checkin:numbers');
    expect(wa.last.body).toContain('Evening check-in');
  });
});

describe('coach messages', () => {
  it('uses a normal message inside 24 hours and a template outside', async () => {
    const wa = new FakeWA();
    const base = { phone: PHONE } as any;
    await sendCoachMessage(wa, { ...base, last_inbound_at: new Date(NOW.getTime() - 3600e3).toISOString() }, 'Great week!', 'Nandita', NOW);
    expect(wa.last.kind).toBe('text');
    await sendCoachMessage(wa, { ...base, last_inbound_at: new Date(NOW.getTime() - 30 * 3600e3).toISOString() }, 'Great week!\nKeep going', 'Nandita', NOW);
    expect(wa.last).toMatchObject({ kind: 'template', template: 'shift_coach_message' });
  });
});

describe('scheduled jobs', () => {
  it('only messages active clients and skips evening if already checked in', async () => {
    const { store, wa, bot } = setup();
    await onboard(bot);
    const c = (await store.getClientByPhone(PHONE))!;
    let r = await runJob('morning', store, wa, NOW);
    expect(r.sent).toBe(0); // still a lead
    c.status = 'active';
    r = await runJob('morning', store, wa, NOW);
    expect(r.sent).toBe(1);
    expect(wa.last.params?.[0]).toBe('Priya');
    await store.upsertLog(c.id, istDate(NOW), { weight: 68, energy: 3 });
    r = await runJob('evening', store, wa, NOW);
    expect(r).toMatchObject({ sent: 0, skipped: 1 });
  });
});

describe('parsers and maths', () => {
  it('parses Indian foods with quantities', () => {
    const items = parseFoodText('2 idli, sambar and one masala dosa');
    expect(items.map((i) => [i.name, i.qty])).toEqual([['Idli', 2], ['Sambar', 1], ['Masala dosa', 1]]);
  });
  it('parses heights and check-in numbers', () => {
    expect(parseHeightCm('162')).toBe(162);
    expect(parseHeightCm("5'4")).toBe(163);
    expect(parseCheckinNumbers('68.2, -, 9000')).toEqual({ weight: 68.2, water: null, steps: 9000 });
    expect(parseCheckinNumbers('5000')).toBeNull();
  });
  it('computes BMR, macros and body fat', () => {
    expect(Math.round(bmr({ sex: 'f', weightKg: 62, heightCm: 162, age: 30 }))).toBe(1322);
    expect(macros(2000, 'moderate')).toEqual({ p: 150, c: 250, f: 44 });
    expect(Math.round(navyBodyFat('m', 85, 38, 175))).toBe(17);
    expect(draftTargets({ sex: 'f', weight_kg: 62, height_cm: 162, age: 30, activity: 'light', goal: 'lose' }).kcal).toBe(1450);
  });
  it('maps time of day to meal slots', () => {
    expect([700, 1315, 1700, 2100].map(slotForTime)).toEqual(['breakfast', 'lunch', 'snacks', 'dinner']);
  });
});

describe('security', () => {
  it('verifies Meta webhook signatures', () => {
    const body = '{"a":1}';
    const sig = 'sha256=' + crypto.createHmac('sha256', 'secret').update(body).digest('hex');
    expect(verifySignature(body, sig, 'secret')).toBe(true);
    expect(verifySignature(body + ' ', sig, 'secret')).toBe(false);
    expect(verifySignature(body, null, 'secret')).toBe(false);
  });
  it('verifies Supabase hook signatures', () => {
    const key = crypto.randomBytes(24);
    const secret = 'v1,whsec_' + key.toString('base64');
    const body = '{"user":{"phone":"919800000001"},"sms":{"otp":"123456"}}';
    const ts = '1700000000';
    const sig = crypto.createHmac('sha256', key).update(`msg_1.${ts}.${body}`).digest('base64');
    const h = new Headers({ 'webhook-id': 'msg_1', 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}` });
    expect(verifyStandardWebhook(body, h, secret, 1700000010)).toBe(true);
    expect(verifyStandardWebhook(body, h, secret, 1700009999)).toBe(false); // stale
  });
  it('cleans template params', () => {
    expect(cleanParam('a\nb     c')).toBe('a · b   c');
  });
  it('normalizes Meta message shapes', () => {
    expect(normalize({ id: '1', from: '9', type: 'interactive', interactive: { button_reply: { id: 'meal_ok', title: 'Confirm' } } }).buttonId).toBe('meal_ok');
    expect(normalize({ id: '1', from: '9', type: 'button', button: { payload: 'ci_start', text: 'Start check-in' } }).buttonId).toBe('ci_start');
    expect(normalize({ id: '1', from: '9', type: 'image', image: { id: 'x', caption: 'lunch' } })).toMatchObject({ type: 'image', imageId: 'x', caption: 'lunch' });
  });
});
