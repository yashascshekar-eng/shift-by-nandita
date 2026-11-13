import crypto from 'node:crypto';

// Phone numbers are stored as digits with the country code, e.g. 919742030111 (the same as WhatsApp's wa_id).
export function phoneDigits(input: string): string | null {
  const d = input.replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return '91' + d;
  if (d.length === 12 && d.startsWith('91') && /^[6-9]/.test(d.slice(2))) return d;
  if (d.length >= 11 && d.length <= 15 && !d.startsWith('91')) return d;
  return null;
}

/** Internal login address for number + password accounts. No mail is ever sent to it. */
export function loginEmail(digits: string): string {
  return `${digits}@login.shiftbynandita.com`;
}

export function prettyPhone(digits: string): string {
  return digits.startsWith('91') && digits.length === 12 ? `+91 ${digits.slice(2, 7)} ${digits.slice(7)}` : `+${digits}`;
}

/** A random temporary password for coach resets, easy to read out on WhatsApp. */
export function tempPassword(): string {
  const words = ['ragi', 'idli', 'dosa', 'curd', 'dal', 'paneer', 'mango', 'jowar', 'ghee', 'chai'];
  return `${words[crypto.randomInt(words.length)]}-${crypto.randomInt(1000, 9999)}-${words[crypto.randomInt(words.length)]}`;
}
