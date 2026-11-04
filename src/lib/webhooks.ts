import crypto from 'node:crypto';

/** Standard Webhooks signature check (what Supabase auth hooks use). */
export function verifyStandardWebhook(raw: string, headers: Headers, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  const id = headers.get('webhook-id');
  const ts = headers.get('webhook-timestamp');
  const sigs = headers.get('webhook-signature');
  if (!id || !ts || !sigs || !secret) return false;
  if (Math.abs(nowSec - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${raw}`).digest('base64');
  return sigs.split(' ').some((s) => {
    const v = s.split(',')[1] ?? '';
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

