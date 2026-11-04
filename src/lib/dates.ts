// All "today" logic runs in India time, whatever the server's timezone is.
const TZ = 'Asia/Kolkata';

export function istDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function istHourMinute(d: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 100 + m;
}

export function addDays(ds: string, n: number): string {
  const d = new Date(ds + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}

export function weekdayShort(ds: string): 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun' {
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const)[new Date(ds + 'T00:00:00Z').getUTCDay()] as never;
}

export function prettyDate(ds: string): string {
  return new Date(ds + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Meal slot from the time of day in India. */
export function slotForTime(hm: number): 'breakfast' | 'lunch' | 'snacks' | 'dinner' {
  if (hm < 1100) return 'breakfast';
  if (hm < 1530) return 'lunch';
  if (hm < 1900) return 'snacks';
  return 'dinner';
}

export function within24h(iso?: string | null, now: Date = new Date()): boolean {
  if (!iso) return false;
  return now.getTime() - Date.parse(iso) < 24 * 3600 * 1000 - 5 * 60 * 1000; // 5 min safety margin
}
