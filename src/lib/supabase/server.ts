import { createServerClient } from '@supabase/ssr';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Client } from '../types';
import { coachPhone } from '../phone';

/** Supabase client acting as the signed-in user (RLS applies). */
export function supabaseUser() {
  const store = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a Server Component */ }
      },
    },
  });
}

/** Service-role client. Server-only: bypasses RLS, so callers must check identity first. */
export function supabaseAdmin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function currentUser() {
  const { data } = await supabaseUser().auth.getUser();
  return data.user ?? null;
}

export type Me = { userId: string; phone: string; phoneVerified: boolean; role: 'client' | 'coach' };

/**
 * Who is signed in. `phone` comes from the profile, which is written only by our own
 * server code (password sign-up) or by the database trigger after a WhatsApp code is
 * confirmed. `phoneVerified` is true only for the WhatsApp-code route.
 */
export async function currentRole(): Promise<Me | null> {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabaseAdmin().from('profiles').select('role, phone').eq('id', user.id).maybeSingle();
  const phoneVerified = Boolean(user.phone_confirmed_at);
  const phone = data?.phone ?? (phoneVerified ? user.phone ?? '' : '');
  let role = (data?.role as 'client' | 'coach') ?? 'client';
  if (role !== 'coach' && phoneVerified && phone === coachPhone()) {
    await supabaseAdmin().from('profiles').update({ role: 'coach' }).eq('id', user.id);
    role = 'coach';
  }
  return { userId: user.id, phone, phoneVerified, role };
}

export async function requireCoach() {
  const me = await currentRole();
  if (!me) redirect('/login?next=/coach');
  if (me.role !== 'coach') redirect('/me');
  return me;
}

/** The signed-in client's record. */
export async function requireClient(): Promise<{ me: Me; client: Client | null }> {
  const me = await currentRole();
  if (!me) redirect('/login?next=/me');
  const admin = supabaseAdmin();
  let { data } = await admin.from('clients').select('*').eq('user_id', me.userId).maybeSingle();
  // Auto-link to a WhatsApp-created record only when the number was proved with a code.
  // Password sign-ups are linked by Nandita from her dashboard instead.
  if (!data && me.phone && me.phoneVerified) {
    const linked = await admin.from('clients').update({ user_id: me.userId }).eq('phone', me.phone).is('user_id', null).select('*').maybeSingle();
    data = linked.data;
  }
  return { me, client: (data as Client) ?? null };
}
