'use client';
import { useFormState, useFormStatus } from 'react-dom';
import type { ActionResult } from '@/app/coach/actions';

type Action = (p: ActionResult | null, f: FormData) => Promise<ActionResult>;

export function SubmitButton({ children, className = 'btn', name, value }: { children: React.ReactNode; className?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} name={name} value={value}>{pending ? 'Saving…' : children}</button>;
}

/** A form that shows the server action's result message under it. */
export function ActionForm({ action, children, className = 'card' }: { action: Action; children: React.ReactNode; className?: string }) {
  const [state, run] = useFormState<ActionResult | null, FormData>(action, null);
  return (
    <form action={run} className={className}>
      {children}
      {state && <p className={`banner ${state.ok ? '' : 'err'}`} role="status">{state.message}</p>}
    </form>
  );
}
