'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { codeStep, passwordStep, type LoginState } from './actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn block" disabled={pending}>{pending ? 'Please wait…' : children}</button>;
}

function PasswordForm({ next, signup }: { next?: string; signup: boolean }) {
  const [state, action] = useFormState<LoginState, FormData>(passwordStep, { mode: signup ? 'signup' : 'login', next });
  return (
    <form action={action} className="card">
      <input type="hidden" name="next" value={next ?? ''} />
      <input type="hidden" name="mode" value={signup ? 'signup' : 'login'} />
      <label className="f">WhatsApp number
        <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" defaultValue={state.phone ? state.phone.replace(/^91/, '') : ''} required />
      </label>
      <label className="f">{signup ? 'Choose a password (8+ characters)' : 'Password'}
        <input id="password" name="password" type="password" autoComplete={signup ? 'new-password' : 'current-password'} minLength={8} required />
      </label>
      {signup && <label className="f">Type the password again<input id="password2" name="password2" type="password" autoComplete="new-password" minLength={8} required /></label>}
      {state.error && <p className="banner err" role="alert">{state.error}</p>}
      <Submit>{signup ? 'Create account' : 'Log in'}</Submit>
      {signup && <p className="small muted">Use the number you have on WhatsApp. Your plan reminders and Nandita&rsquo;s messages will come there.</p>}
    </form>
  );
}

function CodeForm({ next }: { next?: string }) {
  const [state, action] = useFormState<LoginState, FormData>(codeStep, { mode: 'code', next });
  return (
    <form action={action} className="card" key={state.phone ?? 'phone'}>
      <input type="hidden" name="next" value={next ?? ''} />
      {!state.phone ? (
        <label className="f">WhatsApp number<input id="phone-code" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required /></label>
      ) : (<>
        <p className="small">We sent a 6-digit code to <b>+{state.phone}</b> on WhatsApp.</p>
        <label className="f">Code<input id="code" name="code" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
      </>)}
      {state.error && <p className="banner err" role="alert">{state.error}</p>}
      <Submit>{state.phone ? 'Log in' : 'Send code on WhatsApp'}</Submit>
    </form>
  );
}

export function LoginForm({ next, whatsappLogin, startWith }: { next?: string; whatsappLogin: boolean; startWith?: 'login' | 'signup' }) {
  const [tab, setTab] = useState<'login' | 'signup' | 'code'>(startWith ?? 'login');
  return (
    <div className="stack">
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-pressed={tab === 'login'} onClick={() => setTab('login')}>Log in</button>
        <button type="button" role="tab" aria-pressed={tab === 'signup'} onClick={() => setTab('signup')}>New to SHIFT</button>
        {whatsappLogin && <button type="button" role="tab" aria-pressed={tab === 'code'} onClick={() => setTab('code')}>Code on WhatsApp</button>}
      </div>
      {tab === 'code' ? <CodeForm next={next} /> : <PasswordForm key={tab} next={next} signup={tab === 'signup'} />}
      {tab === 'login' && <p className="small muted">Forgot your password? Message Nandita and she&rsquo;ll reset it for you.</p>}
    </div>
  );
}
