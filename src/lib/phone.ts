/**
 * Phone rules - the backend applies exactly the same ones (yourmentorsapp/src/lib/phone.js).
 *  - Egyptian mobile: 11 digits starting with 010, 011, 012 or 015. "010 1234 5678", "+20 10 1234 5678" and
 *    "00201012345678" are accepted and stored as "01012345678".
 *  - Clients abroad: "+" (or 00) followed by 8-15 digits, not +20.
 */
export const EGYPT_PHONE_HINT = 'Egyptian mobile: 11 digits starting with 010, 011, 012 or 015.';
export const CLIENT_PHONE_HINT = 'Egyptian mobile (010/011/012/015 + 8 digits) or an international number starting with +.';

export function normalizeEgyptianMobile(raw: string, { allowMissingZero = false } = {}): string | null {
  let d = String(raw ?? '').trim();
  if (!d || !/^[+\d\s().\-/]+$/.test(d)) return null;
  const plus = d.startsWith('+');
  d = d.replace(/\D/g, '');
  if (d.startsWith('0020')) d = `0${d.slice(4)}`;
  else if (d.startsWith('20') && d.length === 12) d = `0${d.slice(2)}`;
  else if (plus) return null;
  if (allowMissingZero && /^1[0125]\d{8}$/.test(d)) d = `0${d}`;
  return /^01[0125]\d{8}$/.test(d) ? d : null;
}

export function normalizeInternational(raw: string): string | null {
  const s = String(raw ?? '').trim();
  if (!/^(\+|00)[\d\s().\-/]+$/.test(s)) return null;
  const d = s.replace(/\D/g, '').replace(/^00/, '');
  if (d.startsWith('20')) return null;
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

export const normalizeClientPhone = (raw: string, opts?: { allowMissingZero?: boolean }) =>
  normalizeEgyptianMobile(raw, opts) ?? normalizeInternational(raw);

export type PhoneCheck = { ok: true; value: string } | { ok: false; message: string };

/**
 * Validates a phone field. `keep`: the stored value, accepted unchanged even if it predates the rules (legacy data).
 * `kind`: 'employee' (Egyptian mobile only) or 'client' (Egyptian mobile or international).
 */
export function checkPhone(raw: string, { required = true, keep, kind = 'client' }: { required?: boolean; keep?: string | null; kind?: 'employee' | 'client' } = {}): PhoneCheck {
  const value = String(raw ?? '').trim();
  if (!value) return required ? { ok: false, message: 'Phone number is required' } : { ok: true, value: '' };
  if (keep && value === keep) return { ok: true, value };
  const normalized = kind === 'employee' ? normalizeEgyptianMobile(value) : normalizeClientPhone(value);
  if (normalized) return { ok: true, value: normalized };
  return { ok: false, message: kind === 'employee' ? EGYPT_PHONE_HINT : CLIENT_PHONE_HINT };
}

/** "tel:" link value. */
export const telHref = (phone: string | null | undefined) => {
  const clean = String(phone ?? '').replace(/[^\d+]/g, '');
  return clean ? `tel:${clean}` : '';
};

/** wa.me link (WhatsApp needs the international form without "+"). */
export const whatsappHref = (phone: string | null | undefined) => {
  const egypt = normalizeEgyptianMobile(String(phone ?? ''));
  const digits = egypt ? `20${egypt.slice(1)}` : String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}` : '';
};
