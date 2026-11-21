import Link from 'next/link';

const ACRO = [
  ['S', 'Sustainable', 'Changes that can be maintained for life.'],
  ['H', 'Healthy', 'Evidence-informed nutrition and fitness.'],
  ['I', 'Individualised', 'Plans designed around each person’s needs.'],
  ['F', 'Fitness', 'Strength, movement and physical performance.'],
  ['T', 'Transformation', 'Measurable, lasting improvements.'],
];

export default function Home() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const start = wa && process.env.WHATSAPP_LIVE === 'on' ? `https://wa.me/${wa}?text=${encodeURIComponent('Hi! I want to start coaching')}` : '/login?new=1';
  return (
    <main>
      <section className="hero">
        <div>
          <div className="eyebrow">Fitness &amp; nutrition coaching · Bengaluru &amp; online</div>
          <div className="word" style={{ marginTop: 14 }}>SHIFT</div>
          <h1>Shift your habits. Transform your life.</h1>
          <p className="lede">One-on-one coaching with Nandita Rao, run on WhatsApp. Send a photo of your plate and it&rsquo;s logged. Your plan is built around the food you already eat at home, and adjusted every week from what you log.</p>
          <div className="cta">
            <a className="btn" href={start}>{start.startsWith('/') ? 'Join SHIFT' : 'Start on WhatsApp'}</a>
            <Link className="btn ghost" href="/tools">Work out your calories</Link>
          </div>
        </div>
        <div className="acro" aria-label="What SHIFT stands for">
          {ACRO.map(([l, t, d]) => <div key={l}><b>{l}</b><p><strong>{t}</strong><span>{d}</span></p></div>)}
        </div>
      </section>
      <section className="band"><div className="wrap">
        <div className="sec-h"><h2>How coaching works</h2><p className="muted">A change in mindset, habits and lifestyle.</p></div>
        <ol className="steps">
          <li><h3>Say hi on WhatsApp</h3><p>Answer a few quick questions about your body, routine and food. Takes two minutes.</p></li>
          <li><h3>Get your plan</h3><p>Nandita sets your calories and protein, then writes your meal plan and weekly workouts.</p></li>
          <li><h3>Log as you go</h3><p>Photo of your plate at lunch, a 30 second check-in at night. Your 7 am message has the day&rsquo;s plan.</p></li>
          <li><h3>Review every week</h3><p>Nandita reads your logs, replies to your notes and adjusts the plan as your body changes.</p></li>
        </ol>
      </div></section>
      <section className="gets wrap">
        <div className="get"><h3>Meal plans from your kitchen</h3><p>Idli, ragi mudde, dal, chapati, curd. No imported superfoods and no separate cooking.</p></div>
        <div className="get"><h3>Workouts for home or gym</h3><p>A day-by-day plan with sets and reps, scaled to your level and any pain you mention.</p></div>
        <div className="get"><h3>A coach who reads your log</h3><p>Your notes go straight to Nandita, and her replies come back on WhatsApp.</p></div>
      </section>
      <footer className="foot"><span>shiftbynandita.com</span><span>Instagram @nanditasrao</span><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/login">Log in</Link></footer>
    </main>
  );
}
