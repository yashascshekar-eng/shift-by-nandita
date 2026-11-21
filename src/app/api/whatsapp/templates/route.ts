// Approval status of SHIFT's WhatsApp templates (names and statuses only, nothing private).
import { NextResponse } from 'next/server';

export const revalidate = 300;

export async function GET() {
  const token = process.env.WHATSAPP_TOKEN, waba = process.env.WHATSAPP_WABA_ID;
  if (!token || !waba) return NextResponse.json({ error: 'WhatsApp is not configured' }, { status: 503 });
  const res = await fetch(`https://graph.facebook.com/v21.0/${waba}/message_templates?fields=name,status,category&limit=50`, {
    headers: { Authorization: `Bearer ${token}` }, next: { revalidate: 300 },
  });
  if (!res.ok) return NextResponse.json({ error: `Meta returned ${res.status}` }, { status: 502 });
  const { data } = (await res.json()) as { data: { name: string; status: string; category: string }[] };
  const templates = data.filter((t) => t.name.startsWith('shift_')).map(({ name, status, category }) => ({ name, status, category }));
  return NextResponse.json({ checked: new Date().toISOString(), templates });
}
