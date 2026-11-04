// Supabase "Send SMS" auth hook: delivers web login codes on WhatsApp instead of SMS.
import { NextRequest, NextResponse } from 'next/server';
import { CloudApiSender } from '@/lib/whatsapp/api';
import { verifyStandardWebhook } from '@/lib/webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyStandardWebhook(raw, req.headers, process.env.SEND_SMS_HOOK_SECRET || '')) {
    return NextResponse.json({ error: { http_code: 401, message: 'Invalid signature' } }, { status: 401 });
  }
  const { user, sms } = JSON.parse(raw) as { user: { phone: string }; sms: { otp: string } };
  try {
    await new CloudApiSender().otp(String(user.phone).replace(/\D/g, ''), sms.otp);
    return NextResponse.json({});
  } catch {
    return NextResponse.json({ error: { http_code: 500, message: 'Could not send the code on WhatsApp' } }, { status: 500 });
  }
}
