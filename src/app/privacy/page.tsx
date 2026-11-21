export const metadata = { title: 'Privacy policy' };

export default function Privacy() {
  return (
    <main className="wrap stack" style={{ maxWidth: 720, paddingBottom: 48 }}>
      <h1 style={{ fontSize: 30 }}>Privacy policy</h1>
      <p className="small muted">SHIFT by Nandita · last updated 21 November 2026</p>
      <p>SHIFT by Nandita is a fitness and nutrition coaching service run by Nandita Rao in Bengaluru, India. This page explains what we collect when you use shiftbynandita.com or message SHIFT on WhatsApp, and what we do with it.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Your name and WhatsApp number, and a password if you log in on the website.</li>
        <li>The details you give at sign-up: age, sex, height, weight, goal, diet type, activity level and any notes you share with your coach.</li>
        <li>What you log: meals (including photos), weight, body measurements, water, steps, workouts, energy and check-in notes.</li>
        <li>Messages you exchange with SHIFT on WhatsApp.</li>
      </ul>
      <h2>How we use it</h2>
      <p>Only to coach you: to set your targets, build your diet chart and workouts, show your progress, send the reminders you signed up for, and let Nandita reply to you. We don&rsquo;t sell your data or use it for advertising.</p>
      <h2>Who processes it for us</h2>
      <ul>
        <li><b>Meta (WhatsApp Business Platform)</b> delivers WhatsApp messages.</li>
        <li><b>Supabase</b> stores your account and logs.</li>
        <li><b>Vercel</b> hosts the website.</li>
        <li><b>Anthropic</b> estimates calories from meal photos and descriptions. Photos are sent only for that estimate.</li>
      </ul>
      <h2>Who can see it</h2>
      <p>You and your coach. Meal photos are stored privately and only your coach can open them.</p>
      <h2>Keeping and deleting your data</h2>
      <p>We keep your data while you&rsquo;re coached by SHIFT. To get a copy, correct something or have everything deleted, message us on WhatsApp at <b>+91 81471 05770</b>. We&rsquo;ll do it within 30 days.</p>
      <h2>Messages</h2>
      <p>You can stop scheduled WhatsApp messages at any time by telling your coach.</p>
    </main>
  );
}
