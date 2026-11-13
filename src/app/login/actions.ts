'use server';
import { redirect } from 'next/navigation';
import { supabaseUser, supabaseAdmin } from '@/lib/supabase/server';
import { phoneDigits, loginEmail } from '@/lib/phone';

export type LoginState = { mode: 'login' | 'signup' | 'code'; phone?: string; error?: string; next?: string };

const safeNext = (n?: string) => (n && /^\/(me|coach)(\/[\w-]*)?(\?[\w=&-]*)?$/.test(n) ? n : null);

async function goHome(userId: string, next?: string): Promise<never> {
  const { data: profile } = await supabaseAdmin().from('profiles').select('role').eq('id', userId).maybeSingle();
  redirect(safeNext(next) ?? (profile?.role === 'coach' ? '/coach' : '/me'));
}

/** WhatsApp number + password. Sign-up creates the account server-side, so no email or SMS is ever sent. */
export async function passwordStep(prev: LoginState, form: FormData): Promise<LoginState> {
  const mode = form.get('mode') === 'signup' ? 'signup' : 'login';
  const next = String(form.get('next') || prev.next || '');
  const digits = phoneDigits(String(form.get('phone') || ''));
  const password = String(form.get('password') || '');
  if (!digits) return { mode, next, error: 'Enter your 10-digit WhatsApp number.' };
  if (password.length < 8) return { mode, next, phone: digits, error: 'The password needs at least 8 characters.' };
  const email = loginEmail(digits);

  if (mode === 'signup') {
    if (password !== String(form.get('password2') || '')) return { mode, next, phone: digits, error: 'The two passwords don’t match.' };
    const admin = supabaseAdmin();
    const { data: taken } = await admin.from('profiles').select('id').eq('phone', digits).maybeSingle();
    if (taken) return { mode: 'login', next, phone: digits, error: 'This number already has an account. Log in instead.' };
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phone: digits, login: 'password' } });
    if (error || !data.user) {
      const exists = /already|registered|exists/i.test(error?.message ?? '');
      return { mode: exists ? 'login' : 'signup', next, phone: digits, error: exists ? 'This number already has an account. Log in instead.' : 'We couldn’t create the account. Try again in a minute.' };
    }
    await admin.from('profiles').insert({ id: data.user.id, phone: digits });
  }

  const { data, error } = await supabaseUser().auth.signInWithPassword({ email, password });
  if (error || !data.user) return { mode: 'login', next, phone: digits, error: 'That number and password don’t match. Ask Nandita to reset your password if you’ve forgotten it.' };
  return goHome(data.user.id, next);
}

// ---------- WhatsApp code login (switched on with WHATSAPP_LOGIN=on once the shift_otp template is approved) ----------
export async function codeStep(prev: LoginState, form: FormData): Promise<LoginState> {
  const next = String(form.get('next') || prev.next || '');
  if (!prev.phone || prev.mode !== 'code') {
    const digits = phoneDigits(String(form.get('phone') || ''));
    if (!digits) return { mode: 'code', next, error: 'Enter your 10-digit WhatsApp number.' };
    const { error } = await supabaseUser().auth.signInWithOtp({ phone: '+' + digits });
    if (error) return { mode: 'code', next, error: 'We couldn’t send the code. Try again in a minute.' };
    return { mode: 'code', phone: digits, next };
  }
  const token = String(form.get('code') || '').replace(/\D/g, '');
  if (token.length !== 6) return { ...prev, error: 'Enter the 6-digit code from WhatsApp.' };
  const { data, error } = await supabaseUser().auth.verifyOtp({ phone: '+' + prev.phone, token, type: 'sms' });
  if (error || !data.user) return { ...prev, error: 'That code didn’t work. Check it or send a new one.' };
  return goHome(data.user.id, next);
}

export async function signOut() {
  await supabaseUser().auth.signOut();
  redirect('/');
}
