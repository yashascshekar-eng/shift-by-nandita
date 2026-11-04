# SHIFT by Nandita

Coaching platform for Nandita Rao. Clients log on **WhatsApp** (meal photos, evening check-ins, daily plan nudges). Their data shows up in the **web app** (shiftbynandita.com), where Nandita sets targets, writes diet and workout plans, and replies.

| Part | Where |
| --- | --- |
| Landing page, calculators | `/`, `/tools` |
| Client app: today, meals, check-in, plan, progress | `/me` |
| Coach dashboard: clients, check-ins, targets, plans, WhatsApp, payment status | `/coach` |
| WhatsApp bot (Meta Cloud API webhook) | `/api/whatsapp` |
| Login codes sent on WhatsApp (Supabase auth hook) | `/api/auth/send-sms` |
| Scheduled messages (morning plan, evening check-in, Sunday summary, quiet nudge) | `/api/cron/*` via `vercel.json` |

Stack: Next.js 14 · Supabase (Postgres, phone login, storage) · Vercel · WhatsApp Cloud API · Claude (optional, for meal-photo estimates and plan drafts).

---

## Setup (about an hour)

### 1. Supabase
1. Create a project at supabase.com (region: Mumbai).
2. **SQL Editor** → paste and run `supabase/migrations/0001_init.sql`.
3. **Authentication → Providers → Phone**: turn on. You don't need an SMS provider.
4. Copy **Project URL**, **anon key** and **service_role key** from Project Settings → API.

### 2. Deploy on Vercel
1. Import this repo in Vercel.
2. Add every variable from `.env.example` (Settings → Environment Variables). Generate `WHATSAPP_VERIFY_TOKEN` and `CRON_SECRET` as long random strings.
3. Deploy, then add the domain `shiftbynandita.com` under Settings → Domains and follow the DNS steps.

### 3. WhatsApp (Meta)
1. **Meta App → WhatsApp → Configuration → Webhook**
   - Callback URL: `https://shiftbynandita.com/api/whatsapp`
   - Verify token: the `WHATSAPP_VERIFY_TOKEN` you set
   - Subscribe to the **messages** field.
2. Create a **System User** in Business Settings with `whatsapp_business_messaging`, and generate a permanent token → `WHATSAPP_TOKEN`.
3. Copy the SHIFT number's **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`, and the **App secret** → `WHATSAPP_APP_SECRET`.
4. Submit the templates below in **WhatsApp Manager → Message templates**. Names must match exactly. Language: English (`en`).

### 4. Login codes on WhatsApp
1. Supabase → **Authentication → Hooks → Send SMS hook** → HTTPS → `https://shiftbynandita.com/api/auth/send-sms`.
2. Generate the secret and paste it into Vercel as `SEND_SMS_HOOK_SECRET` (format `v1,whsec_...`). Redeploy.

### 5. Make Nandita the coach
Nandita logs in once at `/login` with her phone. Then run in the SQL Editor:
```sql
update public.profiles set role = 'coach' where phone = '91XXXXXXXXXX';
```
She now sees **Clients** in the menu.

### 6. Move her existing students
Each student says **hi** to the SHIFT number and answers the questions (about 2 minutes). They appear in `/coach`. Set each to **Active** under *Profile & plan* to switch on the daily messages.

---

## WhatsApp templates to submit

Quick-reply button text is up to you. The **payloads are set by the app**, so keep the buttons in this order.

| Name | Category | Body | Buttons (quick reply) |
| --- | --- | --- | --- |
| `shift_morning` | Utility | Good morning {{1}} ☀️ Today's workout: {{2}}. Food target: {{3}} kcal with {{4}} g protein. | Today's meals · Log a meal |
| `shift_checkin` | Utility | Evening check-in, {{1}} 🌙 Takes 30 seconds: weight, water, steps and how the day went. | Start check-in |
| `shift_weekly` | Utility | Your week, {{1}} 📊 Days logged: {{2}}. Weight: {{3}}. Protein target hit: {{4}}. Your next week's plan is ready. | My day so far |
| `shift_quiet` | Utility | Hi {{1}}, your SHIFT plan has been quiet for a few days. What would help this week? | Lighter plan please · I'm back · Talk to Nandita |
| `shift_coach_message` | Utility | Message from {{1}}, your SHIFT coach: {{2}} | — |
| `shift_otp` | Authentication | *(Meta's fixed text)* {{1}} is your verification code. | Copy code |

Sample values for review: `Priya`, `Goblet squat 3×12, Glute bridge 3×15`, `1500`, `113`.

Meta can reclassify a utility template as marketing (about 7× the price) if it reads as promotional. Keep these about the client's own plan.

---

## How the WhatsApp bot works

- **New number** → asks name, sex, age, height, weight, goal, diet, activity and notes, then creates the client with draft targets (Mifflin–St Jeor, 20% deficit for fat loss). Nandita confirms targets in the dashboard.
- **Photo** → stored privately, estimated by Claude (Indian home portions), shown with Confirm / Change something / Discard.
- **Typed food** ("2 idli and sambar") → estimated the same way. Without an AI key it's matched against the built-in Indian food table (`src/lib/foods.ts`).
- **Check-in** → one message `68.2, 7, 8200` (weight, water, steps), then workout and energy buttons, then an optional note to Nandita.
- **Commands**: `hi` / `menu`, `today`, `plan`, `check in`.
- **Coach messages** go as normal replies inside WhatsApp's 24-hour window, otherwise as `shift_coach_message`.
- Meta's duplicate webhook deliveries are ignored (deduped by message id), and abandoned conversations reset after 6 hours.

Scheduled messages go only to clients with status **Active**. Times (IST): 7:00 plan, 19:00 quiet check (third quiet day only), 20:30 check-in (skipped if already done), Sunday 10:00 weekly summary.

**On Vercel Hobby, each job fires at some point within its scheduled hour** (so the 7:00 plan arrives between 7:00 and 7:59). Vercel Pro ($20/month) runs them on the minute.

## Privacy and security

- Row Level Security on every table: a client can read only their own data, and the coach can read everything. Browsers can't write directly. Every write goes through server code that checks who is signed in first.
- Meal photos sit in a private storage bucket. Only the coach sees them, through links that expire after an hour.
- Webhooks are verified: Meta's `X-Hub-Signature-256`, Supabase's Standard Webhooks signature, and the Vercel cron secret.

## Costs (pilot of 10 clients)

- Vercel Hobby and Supabase Free: ₹0. Upgrade to Supabase Pro (about $25 a month) before paying clients depend on it, for backups.
- WhatsApp: about ₹30–45 per active client per month at current India rates. The dashboard shows this month's message count and estimated cost.
- Claude meal estimates: a fraction of a rupee per photo.

## Development

```bash
npm install
cp .env.example .env.local   # fill in
npm run dev
npm test                     # bot, parsers, maths, signature checks
```
To test the bot locally, expose `localhost:3000` with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and point a Meta *test* number's webhook at it.

## Not in v1
- Razorpay checkout. For now, paste a Razorpay payment link per client and send it from the dashboard, then mark the client Active when paid.
- Native store apps. The web app installs to the home screen, and can be wrapped with Capacitor later.
- Multiple coaches. The schema is single-coach; adding a `coach_id` column is the main change.
