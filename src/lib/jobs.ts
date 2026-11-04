// Scheduled WhatsApp messages. Each sends an approved utility template.
// Only clients with status "active" get them, so leads and paused clients cost nothing.
import type { Store } from './store';
import type { WhatsAppSender } from './whatsapp/api';
import type { Client } from './types';
import { addDays, daysBetween, istDate, weekdayShort } from './dates';
import { draftTargets, r1, totals } from './nutrition';

export type JobName = 'morning' | 'evening' | 'weekly' | 'quiet';
export interface JobResult { job: JobName; sent: number; skipped: number; failed: number }

const first = (c: Client) => (c.name ?? '').split(' ')[0] || 'there';

export async function runJob(job: JobName, store: Store, wa: WhatsAppSender, now = new Date()): Promise<JobResult> {
  const today = istDate(now);
  const clients = (await store.listClients()).filter((c) => c.status === 'active');
  const res: JobResult = { job, sent: 0, skipped: 0, failed: 0 };

  for (const c of clients) {
    try {
      const sent = await sendOne(job, c, store, wa, today);
      sent ? res.sent++ : res.skipped++;
    } catch (e) {
      console.error(`job ${job} failed for ${c.id}`, e);
      res.failed++;
    }
  }
  return res;
}

async function sendOne(job: JobName, c: Client, store: Store, wa: WhatsAppSender, today: string): Promise<boolean> {
  const T = c.targets ?? draftTargets(c);
  if (job === 'morning') {
    const wo = c.workout_plan?.[weekdayShort(today)] ?? [];
    const workout = wo.length ? wo.map((e) => `${e.n} ${e.s}×${e.r}`).join(', ') : 'Rest day, a 30 minute walk still counts';
    await wa.template(c.phone, 'shift_morning', [first(c), workout, String(T.kcal), String(T.p)], ['plan_meals', 'menu_meal']);
    return true;
  }
  if (job === 'evening') {
    const log = await store.getLog(c.id, today);
    if (log && log.weight !== null && log.energy !== null) return false; // already checked in
    await wa.template(c.phone, 'shift_checkin', [first(c)], ['ci_start']);
    return true;
  }
  if (job === 'quiet') {
    const last = c.last_log_date ?? c.created_at.slice(0, 10);
    if (daysBetween(last, today) !== 3) return false; // nudge once, on the third quiet day
    await wa.template(c.phone, 'shift_quiet', [first(c)], ['quiet_light', 'quiet_resume', 'quiet_call']);
    return true;
  }
  // weekly
  const from = addDays(today, -6);
  const [logs, meals] = await Promise.all([store.listLogs(c.id, addDays(today, -13)), store.listMealsSince(c.id, from)]);
  const weekLogs = logs.filter((l) => l.date >= from);
  const days = new Set([...weekLogs.map((l) => l.date), ...meals.map((m) => m.date)]);
  const byDay = new Map<string, typeof meals>();
  meals.forEach((m) => byDay.set(m.date, [...(byDay.get(m.date) ?? []), m]));
  const proteinDays = [...byDay.values()].filter((ms) => totals(ms).p >= T.p * 0.9).length;
  const weights = logs.filter((l) => l.weight !== null).map((l) => Number(l.weight));
  const change = weights.length >= 2 ? `${r1(weights[0])} → ${r1(weights[weights.length - 1])} kg` : 'log your weight to see the trend';
  await wa.template(c.phone, 'shift_weekly', [first(c), `${days.size} of 7`, change, `${proteinDays} of 7`], ['menu_today']);
  return true;
}
