import { daysBetween, istDate } from './dates';
import type { Client } from './types';

export function clientStatus(c: Client, today = istDate()): { label: string; tone: '' | 'good' | 'warn' | 'bad'; rank: number } {
  if (!c.last_log_date) return { label: 'No logs yet', tone: 'warn', rank: 50 };
  const gap = daysBetween(c.last_log_date, today);
  if (gap <= 0) return { label: 'Logged today', tone: 'good', rank: 0 };
  if (gap === 1) return { label: 'Logged yesterday', tone: '', rank: 1 };
  return { label: `Quiet ${gap} days`, tone: gap >= 3 ? 'bad' : 'warn', rank: gap };
}

