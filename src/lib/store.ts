// Data access used by the WhatsApp bot and the scheduled jobs.
// SupabaseStore is the real one; tests use MemoryStore.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Client, Log, Meal, Session } from './types';
import type { CatalogueFood } from './foods';

export interface Store {
  getClientByPhone(phone: string): Promise<Client | null>;
  getClient(id: string): Promise<Client | null>;
  createClient(c: Partial<Client> & { phone: string }): Promise<Client>;
  updateClient(id: string, patch: Partial<Client>): Promise<void>;
  listClients(): Promise<Client[]>;
  getSession(waId: string): Promise<Session>;
  setSession(waId: string, state: string, data?: Record<string, unknown>): Promise<void>;
  getLog(clientId: string, date: string): Promise<Log | null>;
  upsertLog(clientId: string, date: string, patch: Partial<Log>): Promise<void>;
  listLogs(clientId: string, fromDate: string): Promise<Log[]>;
  addMeal(m: Meal): Promise<void>;
  listMeals(clientId: string, date: string): Promise<Meal[]>;
  listMealsSince(clientId: string, fromDate: string): Promise<Meal[]>;
  /** Returns false if this inbound message id was already processed (webhook retry). */
  recordInbound(waMessageId: string, waId: string, clientId: string | null, kind: string, body: unknown): Promise<boolean>;
  recordOutbound(waId: string, clientId: string | null, kind: string, category: string, body: unknown): Promise<void>;
  uploadPhoto(path: string, data: Buffer, mimeType: string): Promise<string | null>;
  /** Nandita's food catalogue plus this client's own foods, for matching typed meals. */
  catalogue(clientId: string): Promise<CatalogueFood[]>;
}

export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}
  private foods = new Map<string, CatalogueFood[]>();

  async catalogue(clientId: string) {
    if (!this.foods.has(clientId)) {
      const { data } = await this.db.from('foods').select('name, serving_qty, unit, kcal, p, c, f')
        .eq('archived', false).or(`owner_client_id.is.null,owner_client_id.eq.${clientId}`);
      this.foods.set(clientId, ((data ?? []) as CatalogueFood[]).map((x) => ({ ...x, serving_qty: Number(x.serving_qty), kcal: Number(x.kcal), p: Number(x.p), c: Number(x.c), f: Number(x.f) })));
    }
    return this.foods.get(clientId)!;
  }

  async getClientByPhone(phone: string) {
    const { data } = await this.db.from('clients').select('*').eq('phone', phone).maybeSingle();
    return (data as Client) ?? null;
  }
  async getClient(id: string) {
    const { data } = await this.db.from('clients').select('*').eq('id', id).maybeSingle();
    return (data as Client) ?? null;
  }
  async createClient(c: Partial<Client> & { phone: string }) {
    const { data, error } = await this.db.from('clients').upsert(c, { onConflict: 'phone' }).select('*').single();
    if (error) throw error;
    return data as Client;
  }
  async updateClient(id: string, patch: Partial<Client>) {
    const { error } = await this.db.from('clients').update(patch).eq('id', id);
    if (error) throw error;
  }
  async listClients() {
    const { data } = await this.db.from('clients').select('*').order('created_at');
    return (data as Client[]) ?? [];
  }
  async getSession(waId: string) {
    const { data } = await this.db.from('wa_sessions').select('state,data,updated_at').eq('wa_id', waId).maybeSingle();
    if (!data) return { state: 'idle', data: {} };
    // Abandoned conversations reset after 6 hours.
    if (Date.now() - Date.parse(data.updated_at) > 6 * 3600e3) return { state: 'idle', data: {} };
    return { state: data.state, data: data.data ?? {} };
  }
  async setSession(waId: string, state: string, data: Record<string, unknown> = {}) {
    await this.db.from('wa_sessions').upsert({ wa_id: waId, state, data, updated_at: new Date().toISOString() });
  }
  async getLog(clientId: string, date: string) {
    const { data } = await this.db.from('logs').select('*').eq('client_id', clientId).eq('date', date).maybeSingle();
    return (data as Log) ?? null;
  }
  async upsertLog(clientId: string, date: string, patch: Partial<Log>) {
    const { error } = await this.db.from('logs').upsert({ client_id: clientId, date, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'client_id,date' });
    if (error) throw error;
    await this.db.from('clients').update({ last_log_date: date }).eq('id', clientId).or(`last_log_date.is.null,last_log_date.lt.${date}`);
  }
  async listLogs(clientId: string, fromDate: string) {
    const { data } = await this.db.from('logs').select('*').eq('client_id', clientId).gte('date', fromDate).order('date');
    return (data as Log[]) ?? [];
  }
  async addMeal(m: Meal) {
    const { error } = await this.db.from('meals').insert(m);
    if (error) throw error;
    await this.db.from('clients').update({ last_log_date: m.date }).eq('id', m.client_id).or(`last_log_date.is.null,last_log_date.lt.${m.date}`);
  }
  async listMeals(clientId: string, date: string) {
    const { data } = await this.db.from('meals').select('*').eq('client_id', clientId).eq('date', date).order('created_at');
    return (data as Meal[]) ?? [];
  }
  async listMealsSince(clientId: string, fromDate: string) {
    const { data } = await this.db.from('meals').select('*').eq('client_id', clientId).gte('date', fromDate);
    return (data as Meal[]) ?? [];
  }
  async recordInbound(waMessageId: string, waId: string, clientId: string | null, kind: string, body: unknown) {
    const { error } = await this.db.from('wa_messages').insert({ wa_message_id: waMessageId, wa_id: waId, client_id: clientId, direction: 'in', kind, body });
    if (error && error.code === '23505') return false; // duplicate → already handled
    if (clientId) await this.db.from('clients').update({ last_inbound_at: new Date().toISOString() }).eq('id', clientId);
    return true;
  }
  async recordOutbound(waId: string, clientId: string | null, kind: string, category: string, body: unknown) {
    await this.db.from('wa_messages').insert({ wa_id: waId, client_id: clientId, direction: 'out', kind, category, body });
  }
  async uploadPhoto(path: string, data: Buffer, mimeType: string) {
    const { error } = await this.db.storage.from('meal-photos').upload(path, data, { contentType: mimeType, upsert: false });
    return error ? null : path;
  }
}

/** In-memory store for tests and local experiments. */
export class MemoryStore implements Store {
  clients: Client[] = [];
  sessions = new Map<string, Session>();
  logs: Log[] = [];
  meals: Meal[] = [];
  seen = new Set<string>();
  foods: CatalogueFood[] = [];
  async catalogue() { return this.foods; }
  outbound: { waId: string; kind: string; category: string; body: unknown }[] = [];

  async getClientByPhone(phone: string) { return this.clients.find((c) => c.phone === phone) ?? null; }
  async getClient(id: string) { return this.clients.find((c) => c.id === id) ?? null; }
  async createClient(c: Partial<Client> & { phone: string }) {
    const existing = await this.getClientByPhone(c.phone);
    if (existing) { Object.assign(existing, c); return existing; }
    const row = { id: 'c' + (this.clients.length + 1), user_id: null, status: 'lead', meal_plan: [], diet_chart: [], workout_plan: {}, created_at: new Date().toISOString(), last_inbound_at: null, last_log_date: null, ...c } as Client;
    this.clients.push(row);
    return row;
  }
  async updateClient(id: string, patch: Partial<Client>) { Object.assign((await this.getClient(id)) ?? {}, patch); }
  async listClients() { return this.clients; }
  async getSession(waId: string) { return this.sessions.get(waId) ?? { state: 'idle', data: {} }; }
  async setSession(waId: string, state: string, data: Record<string, unknown> = {}) { this.sessions.set(waId, { state, data }); }
  async getLog(clientId: string, date: string) { return this.logs.find((l) => l.client_id === clientId && l.date === date) ?? null; }
  async upsertLog(clientId: string, date: string, patch: Partial<Log>) {
    const l = await this.getLog(clientId, date);
    if (l) Object.assign(l, patch);
    else this.logs.push({ client_id: clientId, date, weight: null, water: null, steps: null, energy: null, workout: null, note: '', coach_reply: null, ...patch });
    const c = await this.getClient(clientId);
    if (c && (!c.last_log_date || c.last_log_date < date)) c.last_log_date = date;
  }
  async listLogs(clientId: string, fromDate: string) { return this.logs.filter((l) => l.client_id === clientId && l.date >= fromDate).sort((a, b) => a.date.localeCompare(b.date)); }
  async addMeal(m: Meal) {
    this.meals.push(m);
    const c = await this.getClient(m.client_id);
    if (c && (!c.last_log_date || c.last_log_date < m.date)) c.last_log_date = m.date;
  }
  async listMeals(clientId: string, date: string) { return this.meals.filter((m) => m.client_id === clientId && m.date === date); }
  async listMealsSince(clientId: string, fromDate: string) { return this.meals.filter((m) => m.client_id === clientId && m.date >= fromDate); }
  async recordInbound(id: string, _waId: string, clientId: string | null) {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    const c = clientId ? await this.getClient(clientId) : null;
    if (c) c.last_inbound_at = new Date().toISOString();
    return true;
  }
  async recordOutbound(waId: string, _c: string | null, kind: string, category: string, body: unknown) { this.outbound.push({ waId, kind, category, body }); }
  async uploadPhoto(path: string) { return path; }
}
