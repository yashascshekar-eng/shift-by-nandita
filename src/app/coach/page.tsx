import Link from 'next/link';
import { requireCoach, supabaseUser } from '@/lib/supabase/server';
import { istDate } from '@/lib/dates';
import { GOALS } from '@/lib/nutrition';
import type { Client } from '@/lib/types';
import { clientStatus } from '@/lib/status';

export const metadata = { title: 'Clients' };
export const dynamic = 'force-dynamic';

const STATUS_ORDER = { active: 0, lead: 1, paused: 2, ended: 3 } as const;

export default async function Coach({ searchParams }: { searchParams: { show?: string } }) {
  await requireCoach();
  const sb = supabaseUser();
  const monthStart = istDate().slice(0, 8) + '01';
  const [{ data }, { data: msgs }] = await Promise.all([
    sb.from('clients').select('*'),
    sb.from('wa_messages').select('category').eq('direction', 'out').gte('created_at', monthStart),
  ]);
  const all = (data ?? []) as Client[];
  const show = searchParams.show === 'all' ? 'all' : 'current';
  const clients = all
    .filter((c) => show === 'all' || c.status !== 'ended')
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || clientStatus(b).rank - clientStatus(a).rank);
  const review = all.filter((c) => c.status !== 'ended' && !c.targets?.confirmed).length;
  const quiet = all.filter((c) => c.status === 'active' && clientStatus(c).rank >= 2).length;
  const cat = (k: string) => (msgs ?? []).filter((m) => m.category === k).length;
  const cost = (cat('utility') + cat('authentication') + Math.max(0, cat('service') - 1000)) * 0.115 * 1.18;

  return (
    <main className="wrap stack" style={{ paddingBottom: 48 }}>
      <div className="row between">
        <div><h1 style={{ fontSize: 28 }}>Clients</h1><p className="small muted">{all.filter((c) => c.status === 'active').length} active · {review} to review · {quiet} quiet 2+ days</p></div>
        <div className="seg"><Link href="/coach/foods">Food catalogue</Link><Link href="/coach" aria-current={show === 'current' ? 'page' : undefined}>Current</Link><Link href="/coach?show=all" aria-current={show === 'all' ? 'page' : undefined}>All</Link></div>
      </div>
      {clients.length ? (
        <div className="roster">{clients.map((c) => {
          const st = clientStatus(c);
          return (
            <Link key={c.id} href={`/coach/${c.id}`} className="client">
              <span><b>{c.name || c.phone}</b> <span className="pill">{c.status}</span><br />
                <span className="small muted">{GOALS[c.goal ?? 'lose']} · {c.weight_kg} kg at intake{!c.targets?.confirmed && <b style={{ color: 'var(--warn)' }}> · targets to review</b>}</span></span>
              <span className={`pill ${st.tone}`}>{st.label}</span>
            </Link>
          );
        })}</div>
      ) : (
        <div className="card"><b>No clients yet</b><p className="small muted">When someone says hi to the SHIFT WhatsApp number and finishes the questions, they appear here.</p></div>
      )}
      <p className="small muted num">WhatsApp this month: {cat('utility')} templates, {cat('service')} replies ({Math.min(1000, cat('service'))} free), {cat('authentication')} login codes · about ₹{Math.round(cost)} incl. GST</p>
    </main>
  );
}
