'use server';
import { redirect } from 'next/navigation';
import { supabaseUser, supabaseAdmin } from '@/lib/supabase/server';

export type LoginState = { step: 'phone' | 'code'; phone?: string; error?: string; next?: string };

function toE164(input: string): string | null {
  const d = input.replace(/\D/g, '');
  if (d.length === 10) return '+91' + d;
  if (d.length === 12 && d.startsWith('91')) return '+' + d;
  if (d.length >= 11 && d.length <= 15) return '+' + d;
  return null;
}

export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const next = String(form.get('next') || '');
  const phone = toE164(String(form.get('phone') || ''));
  if (!phone) return { step: 'phone', error: 'Enter your 10-digit mobile number.', next };
  const { error } = await supabaseUser().auth.signInWithOtp({ phone });
  if (error) return { step: 'phone', error: 'We couldn’t send the code. Check the number and try again in a minute.', next };
  return { step: 'code', phone, next };
}

export async function verifyCode(prev: LoginState, form: FormData): Promise<LoginState> {
  const token = String(form.get('code') || '').replace(/\D/g, '');
  if (!prev.phone || token.length !== 6) return { ...prev, error: 'Enter the 6-digit code from WhatsApp.' };
  const sb = supabaseUser();
  const { data, error } = await sb.auth.verifyOtp({ phone: prev.phone, token, type: 'sms' });
  if (error || !data.user) return { ...prev, error: 'That code didn’t work. Check it or send a new one.' };
  const { data: profile } = await supabaseAdmin().from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  const dest = prev.next && prev.next.startsWith('/') ? prev.next : profile?.role === 'coach' ? '/coach' : '/me';
  redirect(dest);
}

export async function signOut() {
  await supabaseUser().auth.signOut();
  redirect('/');
}

/** One action for both steps, so the form keeps its state between them. */
export async function loginStep(prev: LoginState, form: FormData): Promise<LoginState> {
  if (form.get('restart')) return { step: 'phone', next: prev.next };
  return prev.step === 'phone' ? sendCode(prev, form) : verifyCode(prev, form);
}
