// Obuna: tariflar, ustalar chegarasi, sozlamalar va muddat tugashi haqida eslatmalar.
// Telegram/HTTP'dan mustaqil: yuboruvchi funksiyalar tashqaridan beriladi (test qilish oson).
import { t, fmtWhen, esc } from './i18n.js';
import { nowTs } from './time.js';

export const getSetting = (db, key, fallback = '') => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? fallback;
export const setSetting = (db, key, value) => db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value ?? ''));

export const listPlans = (db, onlyActive = true) => db.prepare(`SELECT id, name, price, max_staff, active, sort FROM plans ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY sort, id`).all();

/** Biznesning obuna holati: muddat, turi (sinov / to'langan / tugagan) va tarif */
export function subscriptionOf(db, biz, now = nowTs()) {
  const until = Math.max(biz.trial_ends || 0, biz.paid_until || 0);
  const paid = (biz.paid_until || 0) > now;
  const state = paid ? 'paid' : (biz.trial_ends || 0) > now ? 'trial' : 'expired';
  const plan = biz.plan_id ? db.prepare('SELECT id, name, price, max_staff FROM plans WHERE id = ?').get(biz.plan_id) : null;
  return { state, until, plan, days_left: until ? Math.ceil((until - now) / 86400) : null };
}

/** Faol ustalar soni tarif chegarasidan oshmasligini tekshiradi. Tarif belgilanmagan bo'lsa — cheklov yo'q. */
export function staffLimit(db, biz) {
  const plan = biz.plan_id ? db.prepare('SELECT max_staff FROM plans WHERE id = ?').get(biz.plan_id) : null;
  const max = plan?.max_staff || 0;
  const used = db.prepare('SELECT COUNT(*) c FROM staff WHERE business_id = ? AND active = 1').get(biz.id).c;
  return { max, used, ok: !max || used < max };
}

const DAY = 86400;

/**
 * Muddati tugayotgan/tugagan bizneslar egalariga bir martalik eslatma.
 * kind: d3 (3 kun qoldi), d1 (1 kun qoldi), expired (tugadi). Kalit (biznes, tur, muddat) bo'yicha takrorlanmaydi;
 * muddat uzaytirilsa yangi muddat uchun eslatmalar qayta ishga tushadi.
 * @returns yuborilgan eslatmalar ro'yxati
 */
export async function runSubscriptionNotices(db, { send, notifyAdmins }, now = nowTs()) {
  const rows = db.prepare(`SELECT b.*, u.lang owner_lang FROM businesses b JOIN users u ON u.id = b.owner_id
                           WHERE b.status = 'active' AND b.claim_code IS NULL`).all(); // egasiga topshirilmaganlarga eslatma yo'q
  const sent = [];
  const contact = getSetting(db, 'support_contact');
  for (const b of rows) {
    const until = Math.max(b.trial_ends || 0, b.paid_until || 0);
    if (!until) continue;
    const left = until - now;
    let kind = null;
    if (left <= 0 && left > -7 * DAY) kind = 'expired';
    else if (left > 0 && left <= DAY) kind = 'd1';
    else if (left > DAY && left <= 3 * DAY) kind = 'd3';
    if (!kind) continue;
    const ins = db.prepare('INSERT OR IGNORE INTO sub_notices (business_id, kind, until_ts, created_at) VALUES (?,?,?,?)').run(b.id, kind, until, now);
    if (!ins.changes) continue;
    const lang = b.owner_lang || 'uz';
    const text = t(lang, 'sub.' + kind, { biz: esc(b.name), date: fmtWhen(until, b.timezone, lang), contact: esc(contact) || '—' });
    await send(b.owner_id, text);
    if (kind === 'd3' || kind === 'expired') await notifyAdmins(`⏰ «${esc(b.name)}»: ${kind === 'expired' ? 'obuna muddati tugadi' : '3 kundan kam qoldi'} (${fmtWhen(until, b.timezone, 'uz')})`);
    sent.push({ business_id: b.id, kind });
  }
  return sent;
}
