import { LoginForm } from './LoginForm';

export const metadata = { title: 'Log in' };

export default function Login({ searchParams }: { searchParams: { next?: string; new?: string } }) {
  return (
    <main className="narrow stack" style={{ maxWidth: 420, paddingTop: 24 }}>
      <h1 style={{ fontSize: 30 }}>{searchParams.new ? 'Join SHIFT' : 'Log in'}</h1>
      <LoginForm next={searchParams.next} whatsappLogin={process.env.WHATSAPP_LOGIN === 'on'} startWith={searchParams.new ? 'signup' : 'login'} />
    </main>
  );
}
