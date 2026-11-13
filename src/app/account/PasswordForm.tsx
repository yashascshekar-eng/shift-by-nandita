'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { changePassword, type PwState } from './actions';

function Submit() { const { pending } = useFormStatus(); return <button className="btn" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button>; }

export function PasswordForm() {
  const [state, action] = useFormState<PwState, FormData>(changePassword, null);
  return (
    <form action={action} className="card">
      <h3>Change password</h3>
      <label className="f">New password (8+ characters)<input id="np" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="f">Type it again<input id="np2" name="password2" type="password" autoComplete="new-password" minLength={8} required /></label>
      {state && <p className={`banner ${state.ok ? '' : 'err'}`} role="status">{state.message}</p>}
      <Submit />
    </form>
  );
}
