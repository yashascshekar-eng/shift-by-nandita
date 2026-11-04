import { createServerClient } from '@supabase/ssr';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Client } from '../types';

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

export async function currentRole(): Promise<{ userId: string; phone: string; role: 'client' | 'coach' } | null> {
  const user = await currentUser();
  if (!user) return null;
  const { data } = await supabaseAdmin().from('profiles').select('role, phone').eq('id', user.id).maybeSingle();
  // Only a confirmed phone may be used to find or link a client record.
  const phone = user.phone_confirmed_at ? (data?.phone ?? user.phone ?? '') : '';
  return { userId: user.id, phone, role: (data?.role as 'client' | 'coach') ?? 'client' };
}

export async function requireCoach() {
  const me = await currentRole();
  if (!me) redirect('/login?next=/coach');
  if (me.role !== 'coach') redirect('/me');
  return me;
}

/** The signed-in client's record, linking it by phone if the trigger hasn't. */
export async function requireClient(): Promise<{ me: NonNullable<Awaited<ReturnType<typeof currentRole>>>; client: Client | null }> {
  const me = await currentRole();
  if (!me) redirect('/login?next=/me');
  const admin = supabaseAdmin();
  let { data } = await admin.from('clients').select('*').eq('user_id', me.userId).maybeSingle();
  if (!data && me.phone) {
    const linked = await admin.from('clients').update({ user_id: me.userId }).eq('phone', me.phone).is('user_id', null).select('*').maybeSingle();
    data = linked.data;
  }
  return { me, client: (data as Client) ?? null };
}
