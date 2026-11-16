// Thin client for the WhatsApp Cloud API.
import crypto from 'node:crypto';

const GRAPH = 'https://graph.facebook.com/v21.0';

/** True once the WhatsApp number's token and phone number ID are configured. */
export const whatsappReady = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

export interface Button { id: string; title: string }
export interface ListRow { id: string; title: string; description?: string }
export type TemplateParam = string;

/** What the bot needs from WhatsApp. Swapped for a fake in tests. */
export interface WhatsAppSender {
  text(to: string, body: string): Promise<void>;
  buttons(to: string, body: string, buttons: Button[]): Promise<void>;
  list(to: string, body: string, buttonLabel: string, rows: ListRow[]): Promise<void>;
  template(to: string, name: string, bodyParams: TemplateParam[], buttonPayloads?: string[]): Promise<void>;
  downloadMedia(mediaId: string): Promise<{ data: Buffer; mimeType: string } | null>;
}

/** Template params may not contain newlines, tabs or 4+ spaces. */
export function cleanParam(s: string): string {
  return String(s).replace(/[\n\t]+/g, ' · ').replace(/ {4,}/g, '   ').slice(0, 1000) || '-';
}

export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header || !header.startsWith('sha256=') || !appSecret) return false;
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
  const got = header.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(got)) return false;
  return crypto.timingSafeEqual(Buffer.from(got, 'hex'), Buffer.from(expected, 'hex'));
}

export class CloudApiSender implements WhatsAppSender {
  constructor(
    private token = process.env.WHATSAPP_TOKEN || '',
    private phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    private lang = process.env.WHATSAPP_TEMPLATE_LANG || 'en',
    private onSent?: (to: string, kind: string, category: string, body: unknown) => Promise<void>,
  ) {}

  private async post(to: string, payload: Record<string, unknown>, kind: string, category: string) {
    const res = await fetch(`${GRAPH}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, ...payload }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('WhatsApp send failed', res.status, err);
      throw new Error(`WhatsApp send failed (${res.status})`);
    }
    await this.onSent?.(to, kind, category, payload).catch(() => {});
  }

  text(to: string, body: string) {
    return this.post(to, { type: 'text', text: { body: body.slice(0, 4096), preview_url: true } }, 'text', 'service');
  }

  buttons(to: string, body: string, buttons: Button[]) {
    return this.post(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.slice(0, 1024) },
        action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
      },
    }, 'interactive', 'service');
  }

  list(to: string, body: string, buttonLabel: string, rows: ListRow[]) {
    return this.post(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body.slice(0, 1024) },
        action: { button: buttonLabel.slice(0, 20), sections: [{ title: 'Options', rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: r.title.slice(0, 24), description: r.description?.slice(0, 72) })) }] },
      },
    }, 'interactive', 'service');
  }

  template(to: string, name: string, bodyParams: TemplateParam[], buttonPayloads: string[] = []) {
    const components: Record<string, unknown>[] = [];
    if (bodyParams.length) components.push({ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: cleanParam(t) })) });
    buttonPayloads.forEach((payload, i) => components.push({ type: 'button', sub_type: 'quick_reply', index: String(i), parameters: [{ type: 'payload', payload }] }));
    return this.post(to, { type: 'template', template: { name, language: { code: this.lang }, components } }, 'template', name === 'shift_otp' ? 'authentication' : 'utility');
  }

  /** Authentication template with a copy-code button. */
  otp(to: string, code: string) {
    return this.post(to, {
      type: 'template',
      template: {
        name: 'shift_otp',
        language: { code: this.lang },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }, 'template', 'authentication');
  }

  async downloadMedia(mediaId: string) {
    try {
      const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${this.token}` } });
      if (!meta.ok) return null;
      const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
      const file = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
      if (!file.ok) return null;
      return { data: Buffer.from(await file.arrayBuffer()), mimeType: mime_type || 'image/jpeg' };
    } catch {
      return null;
    }
  }
}
