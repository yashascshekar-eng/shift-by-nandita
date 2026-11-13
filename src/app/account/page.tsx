import { redirect } from 'next/navigation';
import { currentRole } from '@/lib/supabase/server';
import { prettyPhone } from '@/lib/phone';
import { PasswordForm } from './PasswordForm';

export const metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

export default async function Account() {
  const me = await currentRole();
  if (!me) redirect('/login?next=/me');
  return (
    <main className="narrow stack" style={{ maxWidth: 460 }}>
      <h1 style={{ fontSize: 28 }}>Account</h1>
      <div className="card"><span className="small muted">WhatsApp number</span><b>{me.phone ? prettyPhone(me.phone) : '–'}</b><span className="small muted">{me.role === 'coach' ? 'Coach account' : 'Client account'}</span></div>
      <PasswordForm />
    </main>
  );
}
