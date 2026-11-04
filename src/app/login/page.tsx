import { LoginForm } from './LoginForm';

export const metadata = { title: 'Log in' };

export default function Login({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <main className="narrow stack" style={{ maxWidth: 420, paddingTop: 24 }}>
      <h1 style={{ fontSize: 30 }}>Log in</h1>
      <p className="muted">No password. We send a code to your WhatsApp.</p>
      <LoginForm next={searchParams.next} />
    </main>
  );
}
