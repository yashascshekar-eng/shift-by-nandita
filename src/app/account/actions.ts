'use server';
import { currentUser, supabaseUser } from '@/lib/supabase/server';

export type PwState = { ok?: boolean; message?: string } | null;

export async function changePassword(_p: PwState, form: FormData): Promise<PwState> {
  if (!(await currentUser())) return { ok: false, message: 'Please log in again.' };
  const pw = String(form.get('password') || '');
  if (pw.length < 8) return { ok: false, message: 'Use at least 8 characters.' };
  if (pw !== String(form.get('password2') || '')) return { ok: false, message: 'The two passwords don’t match.' };
  const { error } = await supabaseUser().auth.updateUser({ password: pw });
  return error ? { ok: false, message: 'Could not change the password. Try again.' } : { ok: true, message: 'Password changed.' };
}
