import { NextRequest, NextResponse } from 'next/server';
import { verifySignature } from '@/lib/whatsapp/api';
import { normalize } from '@/lib/whatsapp/bot';
import { makeRuntime } from '@/lib/whatsapp/factory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Meta's one-time webhook verification. */
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(p.get('hub.challenge') ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'), process.env.WHATSAPP_APP_SECRET || '')) {
    return new NextResponse('Bad signature', { status: 401 });
  }
  let body: any;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  const { bot } = makeRuntime();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const v = change.value ?? {};
      if (v.metadata?.phone_number_id && v.metadata.phone_number_id !== process.env.WHATSAPP_PHONE_NUMBER_ID) continue;
      const names = new Map<string, string>((v.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]));
      for (const m of v.messages ?? []) {
        try {
          await bot.handle(normalize(m, names.get(m.from)));
        } catch (e) {
          console.error('bot.handle failed', e); // still 200, so Meta doesn't retry a message that will keep failing
        }
      }
    }
  }
  return NextResponse.json({ ok: true });
}
