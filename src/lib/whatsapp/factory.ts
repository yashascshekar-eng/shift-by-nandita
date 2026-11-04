import { CloudApiSender } from './api';
import { ShiftBot } from './bot';
import { SupabaseStore } from '../store';
import { supabaseAdmin } from '../supabase/server';
import { estimateMeal } from '../ai';

/** Real store + sender, with every outbound message logged for cost tracking. */
export function makeRuntime() {
  const store = new SupabaseStore(supabaseAdmin());
  const wa = new CloudApiSender(undefined, undefined, undefined, async (to, kind, category, body) => {
    const client = await store.getClientByPhone(to);
    await store.recordOutbound(to, client?.id ?? null, kind, category, body);
  });
  const bot = new ShiftBot({ store, wa, estimate: estimateMeal, coachName: process.env.COACH_NAME || 'Nandita', siteUrl: process.env.NEXT_PUBLIC_SITE_URL });
  return { store, wa, bot };
}
