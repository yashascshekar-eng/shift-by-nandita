'use client';
import { useFormState, useFormStatus } from 'react-dom';
import { loginStep, type LoginState } from './actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn block" disabled={pending}>{pending ? 'Please wait…' : children}</button>;
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useFormState<LoginState, FormData>(loginStep, { step: 'phone', next });
  return (
    <form action={action} className="card" key={state.step}>
      <input type="hidden" name="next" value={next ?? ''} />
      {state.step === 'phone' ? (
        <>
          <label className="f">Mobile number (the one you use on WhatsApp)
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" required />
          </label>
          {state.error && <p className="banner err">{state.error}</p>}
          <Submit>Send code on WhatsApp</Submit>
        </>
      ) : (
        <>
          <p className="small">We sent a 6-digit code to <b>{state.phone}</b> on WhatsApp.</p>
          <label className="f">Code<input id="code" name="code" className="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
          {state.error && <p className="banner err">{state.error}</p>}
          <Submit>Log in</Submit>
          <button className="linkbtn" name="restart" value="1" formNoValidate>Use a different number</button>
        </>
      )}
    </form>
  );
}
