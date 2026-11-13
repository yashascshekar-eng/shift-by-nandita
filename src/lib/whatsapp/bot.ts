// The SHIFT WhatsApp assistant: a small state machine over inbound messages.
import type { Store } from '../store';
import type { WhatsAppSender } from './api';
import type { Client, Session } from '../types';
import type { MealItem } from '../foods';
import { parseFoodText, sumItems, describeItems } from '../foods';
import { chartToText, chartTotal } from '../catalogue';
import type { Estimate } from '../ai';
import { ACTIVITY, draftTargets, ENERGY, r0, totals } from '../nutrition';
import { istDate, istHourMinute, slotForTime, weekdayShort, within24h } from '../dates';

export interface Inbound {
  id: string;
  from: string;
  name?: string;
  type: 'text' | 'button' | 'image' | 'other';
  text?: string;
  buttonId?: string;
  imageId?: string;
  caption?: string;
}

export interface BotDeps {
  store: Store;
  wa: WhatsAppSender;
  estimate: (input: { imageBase64?: string; mimeType?: string; text?: string; correction?: string; previous?: MealItem[] }) => Promise<Estimate>;
  now?: () => Date;
  coachName?: string;
  siteUrl?: string;
}

/** Turn Meta's webhook message object into an Inbound. */
export function normalize(m: Record<string, any>, contactName?: string): Inbound {
  const base = { id: String(m.id), from: String(m.from), name: contactName };
  switch (m.type) {
    case 'text':
      return { ...base, type: 'text', text: String(m.text?.body ?? '') };
    case 'interactive': {
      const r = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return { ...base, type: 'button', buttonId: r?.id, text: r?.title };
    }
    case 'button':
      return { ...base, type: 'button', buttonId: m.button?.payload || undefined, text: m.button?.text };
    case 'image':
      return { ...base, type: 'image', imageId: m.image?.id, caption: m.image?.caption };
    default:
      return { ...base, type: 'other' };
  }
}

const GREETING = /^(hi+|hello|hey|hii+|namaste|namaskara|start|menu|help)\b/i;
const MENU = [
  { id: 'menu_meal', title: 'Log a meal' },
  { id: 'menu_checkin', title: 'Evening check-in' },
  { id: 'menu_today', title: 'My day so far' },
];

export function parseHeightCm(s: string): number | null {
  const ft = s.match(/(\d)\s*(?:ft|feet|'|’|\s)\s*(\d{1,2})?/i);
  if (ft && !/^\s*\d{3}/.test(s)) {
    const cm = Number(ft[1]) * 30.48 + Number(ft[2] || 0) * 2.54;
    return cm >= 120 && cm <= 220 ? Math.round(cm) : null;
  }
  const n = parseFloat(s);
  if (n >= 120 && n <= 220) return Math.round(n);
  if (n >= 1.2 && n <= 2.2) return Math.round(n * 100);
  return null;
}

/** "68.2, 7, 8200" → weight, water, steps. "-" skips a value. */
export function parseCheckinNumbers(s: string): { weight: number | null; water: number | null; steps: number | null } | null {
  // "8,200" → 8200 and "68,2" → 68.2 before splitting on commas.
  const norm = s.replace(/(\d),(\d{3})\b/g, '$1$2').replace(/\b(\d{2,3}),(\d)\b(?!\d)/, '$1.$2');
  const parts = norm.split(/[,\s/;]+/).filter(Boolean).slice(0, 3);
  if (!parts.length) return null;
  const val = (p?: string) => (p === undefined || p === '-' ? null : Number(p.replace(/[^\d.]/g, '')));
  const [w, wa, st] = [val(parts[0]), val(parts[1]), val(parts[2])];
  if (w !== null && !(w >= 30 && w <= 250)) return null;
  if (wa !== null && !(wa >= 0 && wa <= 30)) return null;
  if (st !== null && !(st >= 0 && st <= 100000)) return null;
  return { weight: w, water: wa, steps: st };
}

export class ShiftBot {
  private store: Store;
  private wa: WhatsAppSender;
  private now: () => Date;
  private coach: string;
  private site: string;

  constructor(private deps: BotDeps) {
    this.store = deps.store;
    this.wa = deps.wa;
    this.now = deps.now ?? (() => new Date());
    this.coach = deps.coachName ?? 'Nandita';
    this.site = deps.siteUrl ?? 'https://shiftbynandita.com';
  }

  async handle(msg: Inbound): Promise<void> {
    const client = await this.store.getClientByPhone(msg.from);
    const fresh = await this.store.recordInbound(msg.id, msg.from, client?.id ?? null, msg.type, msg);
    if (!fresh) return;
    if (msg.type === 'other') return; // reactions, stickers, locations, etc.
    const session = await this.store.getSession(msg.from);
    const text = (msg.text ?? '').trim();

    // Not yet a client (or intake unfinished) → onboarding.
    if (!client || !client.name || !client.weight_kg) {
      if (!session.state.startsWith('intake:')) return this.startIntake(msg);
      return this.intake(msg, session, client);
    }

    if (msg.type === 'text' && GREETING.test(text) && text.split(/\s+/).length <= 3) {
      await this.store.setSession(msg.from, 'idle');
      return this.wa.buttons(msg.from, `Hi ${firstName(client)}! What would you like to do?\nYou can also just send a photo of your meal.`, MENU);
    }
    if (msg.type === 'image') return this.estimateFromImage(msg, client);
    // Buttons from templates and menus work from any state (e.g. the 8:30 pm check-in
    // arriving while a meal is still waiting for confirmation).
    if (msg.buttonId && /^(menu_|ci_start|plan_meals|quiet_)/.test(msg.buttonId)) {
      await this.store.setSession(msg.from, 'idle');
      return this.idle(msg, client);
    }

    switch (true) {
      case session.state === 'meal:confirm': return this.mealConfirm(msg, session, client);
      case session.state === 'meal:edit': return this.mealEdit(msg, session, client);
      case session.state.startsWith('checkin:'): return this.checkin(msg, session, client);
    }
    return this.idle(msg, client);
  }

  // ---------- idle ----------
  private async idle(msg: Inbound, client: Client) {
    const id = msg.buttonId ?? '';
    const t = (msg.text ?? '').trim().toLowerCase();
    if (id === 'menu_meal') return this.wa.text(msg.from, 'Send a photo of your plate, or type what you ate, e.g. "2 chapati, dal and curd".');
    if (id === 'menu_checkin' || id === 'ci_start' || /^check ?-?in$/.test(t)) return this.startCheckin(msg, client);
    if (id === 'menu_today' || /^(today|summary|status)$/.test(t)) return this.sendToday(msg.from, client);
    if (id === 'plan_meals' || /^(plan|meals|my plan|workout)$/.test(t)) return this.sendPlan(msg.from, client);
    if (id.startsWith('quiet_')) return this.quietReply(msg, client, id);
    if (msg.type === 'text' && t.length >= 2) return this.estimateFromText(msg, client, msg.text!);
    return this.wa.buttons(msg.from, 'What would you like to do?', MENU);
  }

  // ---------- onboarding ----------
  private async startIntake(msg: Inbound) {
    await this.store.setSession(msg.from, 'intake:name', {});
    await this.wa.text(msg.from, `Welcome to SHIFT by ${this.coach} 🌱\nShift your habits. Transform your life.\n\nI'll set up your plan in about 2 minutes. What's your name?`);
  }

  private async intake(msg: Inbound, s: Session, existing: Client | null) {
    const t = (msg.text ?? '').trim();
    const id = msg.buttonId ?? '';
    const d = { ...s.data } as Record<string, any>;
    const next = (state: string) => this.store.setSession(msg.from, state, d);
    switch (s.state) {
      case 'intake:name':
        if (t.length < 2 || t.length > 40) return this.wa.text(msg.from, 'Please type your name.');
        d.name = t.replace(/\s+/g, ' ');
        await next('intake:sex');
        return this.wa.buttons(msg.from, `Nice to meet you, ${d.name.split(' ')[0]}! For the calorie formula, are you:`, [{ id: 'sex_f', title: 'Female' }, { id: 'sex_m', title: 'Male' }]);
      case 'intake:sex': {
        const sex = id === 'sex_m' || /^m(ale)?$/i.test(t) ? 'm' : id === 'sex_f' || /^f(emale)?$/i.test(t) ? 'f' : null;
        if (!sex) return this.wa.buttons(msg.from, 'Please pick one:', [{ id: 'sex_f', title: 'Female' }, { id: 'sex_m', title: 'Male' }]);
        d.sex = sex;
        await next('intake:age');
        return this.wa.text(msg.from, 'How old are you?');
      }
      case 'intake:age': {
        const age = parseInt(t, 10);
        if (!(age >= 14 && age <= 90)) return this.wa.text(msg.from, 'Please send your age as a number, e.g. 31.');
        d.age = age;
        await next('intake:height');
        return this.wa.text(msg.from, 'Your height? In cm (e.g. 162) or feet (e.g. 5 4).');
      }
      case 'intake:height': {
        const h = parseHeightCm(t);
        if (!h) return this.wa.text(msg.from, 'I didn’t get that. Try 162 or 5 4.');
        d.height_cm = h;
        await next('intake:weight');
        return this.wa.text(msg.from, 'Your current weight in kg?');
      }
      case 'intake:weight': {
        const w = parseFloat(t.replace(',', '.'));
        if (!(w >= 30 && w <= 250)) return this.wa.text(msg.from, 'Please send your weight in kg, e.g. 68.5.');
        d.weight_kg = w;
        await next('intake:goal');
        return this.wa.buttons(msg.from, 'What’s your main goal?', [{ id: 'goal_lose', title: 'Lose fat' }, { id: 'goal_maintain', title: 'Maintain & tone' }, { id: 'goal_gain', title: 'Build muscle' }]);
      }
      case 'intake:goal': {
        const g = id.replace('goal_', '');
        if (!['lose', 'maintain', 'gain'].includes(g)) return this.wa.buttons(msg.from, 'Please pick your goal:', [{ id: 'goal_lose', title: 'Lose fat' }, { id: 'goal_maintain', title: 'Maintain & tone' }, { id: 'goal_gain', title: 'Build muscle' }]);
        d.goal = g;
        await next('intake:diet');
        return this.wa.buttons(msg.from, 'Your food preference?', [{ id: 'diet_veg', title: 'Vegetarian' }, { id: 'diet_egg', title: 'Eggetarian' }, { id: 'diet_nonveg', title: 'Non-vegetarian' }]);
      }
      case 'intake:diet': {
        const dt = id.replace('diet_', '');
        if (!['veg', 'egg', 'nonveg'].includes(dt)) return this.wa.buttons(msg.from, 'Please pick one:', [{ id: 'diet_veg', title: 'Vegetarian' }, { id: 'diet_egg', title: 'Eggetarian' }, { id: 'diet_nonveg', title: 'Non-vegetarian' }]);
        d.diet = dt;
        await next('intake:activity');
        return this.wa.list(msg.from, 'How active are you right now?', 'Choose', ACTIVITY.map((a) => ({ id: 'act_' + a.key, title: a.label.slice(0, 24) })));
      }
      case 'intake:activity': {
        const a = id.replace('act_', '');
        if (!ACTIVITY.some((x) => x.key === a)) return this.wa.list(msg.from, 'Please choose your activity level:', 'Choose', ACTIVITY.map((x) => ({ id: 'act_' + x.key, title: x.label.slice(0, 24) })));
        d.activity = a;
        await next('intake:notes');
        return this.wa.buttons(msg.from, `Last one. Anything ${this.coach} should know? Work routine, injuries, foods you avoid, medical conditions.\n\nType it, or tap Skip.`, [{ id: 'notes_skip', title: 'Skip' }]);
      }
      case 'intake:notes': {
        d.notes = id === 'notes_skip' ? '' : t.slice(0, 1000);
        const targets = draftTargets(d);
        const c = await this.store.createClient({ phone: msg.from, name: d.name, sex: d.sex, age: d.age, height_cm: d.height_cm, weight_kg: d.weight_kg, goal: d.goal, diet: d.diet, activity: d.activity, notes: d.notes, targets, status: existing?.status ?? 'lead', last_inbound_at: this.now().toISOString() });
        await this.store.upsertLog(c.id, istDate(this.now()), { weight: d.weight_kg });
        await this.store.setSession(msg.from, 'idle');
        return this.wa.buttons(
          msg.from,
          `Thanks ${d.name.split(' ')[0]}! 🎉\n\nYour starting target is about *${targets.kcal} kcal* a day with *${targets.p} g protein*.\n\n${this.coach} will review it and send your meal and workout plan. Meanwhile, send me a photo of any meal and I'll log it.`,
          [{ id: 'menu_meal', title: 'Log a meal' }],
        );
      }
    }
    return this.startIntake(msg);
  }

  // ---------- meals ----------
  private async estimateFromImage(msg: Inbound, client: Client) {
    const media = msg.imageId ? await this.wa.downloadMedia(msg.imageId) : null;
    let photoPath: string | null = null;
    if (media) {
      photoPath = await this.store.uploadPhoto(`${client.id}/${istDate(this.now())}/${msg.id}.jpg`, media.data, media.mimeType);
    }
    const est = media ? await this.deps.estimate({ imageBase64: media.data.toString('base64'), mimeType: media.mimeType, text: msg.caption }) : null;
    if (!est || !est.items.length) {
      if (est?.notFood) return this.wa.text(msg.from, 'That doesn’t look like food. Send a photo of your plate, or type what you ate.');
      const fallback = msg.caption ? parseFoodText(msg.caption) : [];
      if (fallback.length) return this.proposeMeal(msg.from, client, fallback, photoPath);
      await this.store.setSession(msg.from, 'meal:edit', { items: [], photo_path: photoPath, slot: this.slot() });
      return this.wa.text(msg.from, 'Got your photo 📷 What’s on the plate? e.g. "2 chapati, dal, bhindi, salad"');
    }
    return this.proposeMeal(msg.from, client, est.items, photoPath);
  }

  private async estimateFromText(msg: Inbound, client: Client, text: string) {
    const est = await this.deps.estimate({ text });
    const items = est?.items.length ? est.items : parseFoodText(text);
    if (!items.length) {
      return this.wa.buttons(msg.from, 'I couldn’t match that to food. Send a photo or list what you ate, e.g. "2 idli and sambar".', MENU);
    }
    return this.proposeMeal(msg.from, client, items, null);
  }

  private async proposeMeal(to: string, _client: Client, items: MealItem[], photoPath: string | null, slot: string = this.slot()) {
    const t = sumItems(items);
    await this.store.setSession(to, 'meal:confirm', { items, photo_path: photoPath, slot });
    const lines = items.map((i) => `• ${i.qty !== 1 ? i.qty + ' × ' : ''}${i.name} · ${r0(i.kcal)} kcal`).join('\n');
    return this.wa.buttons(
      to,
      `${slotLabel(slot)}:\n${lines}\n\n≈ *${r0(t.kcal)} kcal* · P ${r0(t.p)} g · C ${r0(t.c)} g · F ${r0(t.f)} g`,
      [{ id: 'meal_ok', title: 'Confirm' }, { id: 'meal_edit', title: 'Change something' }, { id: 'meal_no', title: 'Discard' }],
    );
  }

  private async mealConfirm(msg: Inbound, s: Session, client: Client) {
    const id = msg.buttonId ?? '';
    const t = (msg.text ?? '').trim();
    const d = s.data as { items: MealItem[]; photo_path: string | null; slot: string };
    if (id === 'meal_ok' || /^(yes|ok|okay|confirm|done|y)$/i.test(t)) {
      const tot = sumItems(d.items);
      const date = istDate(this.now());
      await this.store.addMeal({ client_id: client.id, date, slot: d.slot as never, name: describeItems(d.items).slice(0, 200), kcal: r0(tot.kcal), p: r0(tot.p), c: r0(tot.c), f: r0(tot.f), source: 'whatsapp', photo_path: d.photo_path });
      await this.store.setSession(msg.from, 'idle');
      return this.sendToday(msg.from, client, 'Logged ✅');
    }
    if (id === 'meal_no' || /^(no|discard|cancel)$/i.test(t)) {
      await this.store.setSession(msg.from, 'idle');
      return this.wa.text(msg.from, 'Discarded. Nothing was logged.');
    }
    if (id === 'meal_edit') {
      await this.store.setSession(msg.from, 'meal:edit', d);
      return this.wa.text(msg.from, 'What’s different? e.g. "3 chapati, not 2" or "no rice, add curd"');
    }
    if (/^(today|summary|status|plan|meals|my plan|workout|check ?-?in)$/i.test(t)) {
      await this.store.setSession(msg.from, 'idle'); // a command, not a correction
      return this.idle(msg, client);
    }
    if (t) return this.mealEdit(msg, { state: 'meal:edit', data: d }, client); // typed a correction directly
    return this.proposeMeal(msg.from, client, d.items, d.photo_path, d.slot);
  }

  private async mealEdit(msg: Inbound, s: Session, client: Client) {
    const d = s.data as { items: MealItem[]; photo_path: string | null; slot: string };
    const t = (msg.text ?? '').trim();
    if (!t) return this.wa.text(msg.from, 'Type what’s on the plate, e.g. "2 chapati, dal, salad"');
    const est = d.items.length ? await this.deps.estimate({ correction: t, previous: d.items }) : await this.deps.estimate({ text: t });
    let items = est?.items.length ? est.items : parseFoodText(t);
    if (!items.length) items = d.items;
    if (!items.length) return this.wa.text(msg.from, 'I couldn’t match that to food. Try "2 idli, sambar, 1 cup curd".');
    return this.proposeMeal(msg.from, client, items, d.photo_path, d.slot);
  }

  // ---------- check-in ----------
  private async startCheckin(msg: Inbound, client: Client) {
    await this.store.setSession(msg.from, 'checkin:numbers', {});
    return this.wa.text(msg.from, `Evening check-in 🌙\n\nSend your *weight, water glasses and steps* in one message, e.g.\n68.2, 7, 8200\n\nUse - for anything you didn’t track.`);
  }

  private async checkin(msg: Inbound, s: Session, client: Client) {
    const id = msg.buttonId ?? '';
    const t = (msg.text ?? '').trim();
    const date = istDate(this.now());
    const d = { ...s.data } as Record<string, any>;
    if (s.state === 'checkin:numbers') {
      const n = parseCheckinNumbers(t);
      if (!n) return this.wa.text(msg.from, 'Please send it like this: 68.2, 7, 8200 (weight kg, water glasses, steps). Use - to skip one.');
      const patch: Record<string, number> = {};
      if (n.weight !== null) patch.weight = n.weight;
      if (n.water !== null) patch.water = n.water;
      if (n.steps !== null) patch.steps = n.steps;
      await this.store.upsertLog(client.id, date, patch);
      const todays = client.workout_plan?.[weekdayShort(date)] ?? [];
      if (todays.length) {
        await this.store.setSession(msg.from, 'checkin:workout', d);
        return this.wa.buttons(msg.from, `Did you do today’s workout? (${todays.map((e) => e.n).join(', ')})`, [{ id: 'wo_done', title: 'All done' }, { id: 'wo_partial', title: 'Partly' }, { id: 'wo_skipped', title: 'Skipped' }]);
      }
      await this.store.setSession(msg.from, 'checkin:energy', d);
      return this.askEnergy(msg.from);
    }
    if (s.state === 'checkin:workout') {
      const w = id.replace('wo_', '');
      if (!['done', 'partial', 'skipped'].includes(w)) return this.wa.buttons(msg.from, 'Did you do today’s workout?', [{ id: 'wo_done', title: 'All done' }, { id: 'wo_partial', title: 'Partly' }, { id: 'wo_skipped', title: 'Skipped' }]);
      await this.store.upsertLog(client.id, date, { workout: w as never });
      await this.store.setSession(msg.from, 'checkin:energy', d);
      return this.askEnergy(msg.from);
    }
    if (s.state === 'checkin:energy') {
      const e = Number(id.replace('en_', ''));
      if (!(e >= 1 && e <= 5)) return this.askEnergy(msg.from);
      await this.store.upsertLog(client.id, date, { energy: e });
      await this.store.setSession(msg.from, 'checkin:note', d);
      return this.wa.buttons(msg.from, `Anything to tell ${this.coach}? Cravings, missed meals, pain, a win. Type it, or tap Skip.`, [{ id: 'note_skip', title: 'Skip' }]);
    }
    if (s.state === 'checkin:note') {
      const note = id === 'note_skip' ? '' : t.slice(0, 1000);
      if (note) await this.store.upsertLog(client.id, date, { note });
      await this.store.setSession(msg.from, 'idle');
      return this.sendToday(msg.from, client, `Check-in saved ✅${note ? `\nYour note went to ${this.coach}.` : ''}`);
    }
  }

  private askEnergy(to: string) {
    return this.wa.list(to, 'How was your energy today?', 'Choose', ENERGY.map((l, i) => ({ id: `en_${i + 1}`, title: l })));
  }

  // ---------- re-engagement replies ----------
  private async quietReply(msg: Inbound, client: Client, id: string) {
    const date = istDate(this.now());
    const prev = (await this.store.getLog(client.id, date))?.note ?? '';
    const add = (n: string) => this.store.upsertLog(client.id, date, { note: prev ? `${prev}\n${n}` : n });
    if (id === 'quiet_light') { await add('Asked for a lighter plan this week.'); return this.wa.text(msg.from, `Done. ${this.coach} will send a lighter plan. Keep logging meals when you can.`); }
    if (id === 'quiet_call') { await add('Asked for a call.'); return this.wa.text(msg.from, `${this.coach} has been asked to call you.`); }
    return this.wa.buttons(msg.from, 'Welcome back! 💪 Send a photo of your next meal to get going.', MENU);
  }

  // ---------- summaries ----------
  async sendToday(to: string, client: Client, prefix = '') {
    const date = istDate(this.now());
    const meals = await this.store.listMeals(client.id, date);
    const t = totals(meals);
    const T = client.targets ?? draftTargets(client);
    const left = T.kcal - t.kcal;
    const tip = t.p < T.p * 0.5 && istHourMinute(this.now()) > 1500 ? '\nProtein is low today. Add curd, sprouts, paneer or eggs.' : '';
    return this.wa.text(
      to,
      `${prefix ? prefix + '\n\n' : ''}Today: *${r0(t.kcal)} / ${T.kcal} kcal* · ${r0(t.p)} / ${T.p} g protein\n${left >= 0 ? `${r0(left)} kcal left` : `${r0(-left)} kcal over`}${tip}\n\nFull view: ${this.site}/me`,
    );
  }

  async sendPlan(to: string, client: Client) {
    const date = istDate(this.now());
    const wo = client.workout_plan?.[weekdayShort(date)] ?? [];
    const chart = client.diet_chart ?? [];
    const meals = chartToText(chart) || (client.meal_plan ?? []).map((x) => `*${x.meal}* ${x.items}`).join('\n');
    if (!meals && !wo.length) return this.wa.text(to, `${this.coach} is still preparing your plan. You\u2019ll get it here soon.`);
    const total = chart.length ? chartTotal(chart) : null;
    const w = wo.length ? wo.map((e) => `• ${e.n} ${e.s} × ${e.r}`).join('\n') : 'Rest day. A 30 minute walk still counts.';
    return this.wa.text(to, `${meals ? 'Today\u2019s diet chart\n\n' + meals + (total ? `\n\nTotal ≈ ${total.kcal} kcal · ${Math.round(total.p)} g protein` : '') + '\n\n' : ''}Workout (${weekdayShort(date)})\n${w}`);
  }

  private slot() { return slotForTime(istHourMinute(this.now())); }
}

function firstName(c: Client) { return (c.name ?? '').split(' ')[0] || 'there'; }
function slotLabel(s: string) { return ({ breakfast: 'Breakfast', lunch: 'Lunch', snacks: 'Snack', dinner: 'Dinner' } as Record<string, string>)[s] ?? 'Meal'; }

/**
 * Send a message from the coach. Inside WhatsApp's 24-hour window it goes as a
 * normal message; outside it must use the approved utility template.
 */
export async function sendCoachMessage(wa: WhatsAppSender, client: Client, text: string, coachName = 'Nandita', now = new Date()) {
  if (within24h(client.last_inbound_at, now)) return wa.text(client.phone, `*${coachName}:* ${text}`);
  return wa.template(client.phone, 'shift_coach_message', [coachName, text]);
}

