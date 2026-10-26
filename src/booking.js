// Bron qilish mexanizmi (yadro). Hech qanday Telegram yoki HTTP bilan bog'liq emas —
// shuning uchun to'liq test qilinadi (tests/booking.test.js).
import { tx } from './db.js';
import { addDays, localToTs, tsToLocal, weekdayOf, hhmm, isDate, nowTs } from './time.js';

export class BookingError extends Error {
  constructor(code, message = code) { super(message); this.code = code; }
}

export const ACTIVE = ['pending', 'confirmed'];

export function getBusiness(db, id) {
  const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
  if (!b) throw new BookingError('business_not_found');
  return b;
}

/** Biznes bron qabul qila oladimi (holat + sinov/to'lov muddati) */
export function acceptsBookings(biz, now = nowTs()) {
  if (biz.status !== 'active') return false;
  const until = Math.max(biz.trial_ends || 0, biz.paid_until || 0);
  return until === 0 || until > now;
}

/**
 * Tanlangan xizmatlar shu usta uchun: umumiy davomiylik va narx.
 * Usta xizmatlardan birortasini qilmasa — null.
 */
export function priceForStaff(db, staffId, serviceIds) {
  if (!serviceIds?.length) return null;
  const items = [];
  for (const sid of [...new Set(serviceIds)]) {
    const r = db.prepare(`
      SELECT s.id service_id, s.name, s.active,
             COALESCE(ss.price, s.price) price, COALESCE(ss.duration_min, s.duration_min) duration_min
      FROM services s JOIN staff_services ss ON ss.service_id = s.id AND ss.staff_id = ?
      WHERE s.id = ?`).get(staffId, sid);
    if (!r || !r.active) return null;
    items.push({ service_id: r.service_id, name: r.name, price: r.price, duration_min: r.duration_min });
  }
  return {
    items,
    duration: items.reduce((a, i) => a + i.duration_min, 0),
    price: items.reduce((a, i) => a + i.price, 0),
  };
}

function subtract(intervals, cut) {
  const out = [];
  for (const [a, b] of intervals) {
    if (cut[1] <= a || cut[0] >= b) { out.push([a, b]); continue; }
    if (cut[0] > a) out.push([a, cut[0]]);
    if (cut[1] < b) out.push([cut[1], b]);
  }
  return out;
}

/** Ustaning shu kundagi bo'sh ish oraliqlari (tanaffus, ta'til, maxsus kunlar hisobga olingan) */
export function workIntervals(db, biz, staffId, date) {
  const closed = db.prepare(`SELECT 1 FROM time_off WHERE business_id = ? AND (staff_id IS NULL OR staff_id = ?)
                             AND from_date <= ? AND to_date >= ? LIMIT 1`).get(biz.id, staffId, date, date);
  if (closed) return [];

  const ov = db.prepare('SELECT start_min, end_min FROM day_overrides WHERE staff_id = ? AND date = ?').all(staffId, date);
  let base;
  if (ov.length) {
    base = ov.filter(o => o.start_min !== null).map(o => [o.start_min, o.end_min]); // hammasi NULL bo'lsa — dam olish
  } else {
    base = db.prepare('SELECT start_min, end_min FROM working_hours WHERE staff_id = ? AND weekday = ? ORDER BY start_min')
      .all(staffId, weekdayOf(date)).map(r => [r.start_min, r.end_min]);
  }
  const wd = weekdayOf(date);
  const brks = db.prepare('SELECT start_min, end_min FROM breaks WHERE staff_id = ? AND (weekday IS NULL OR weekday = ?)').all(staffId, wd);
  let free = base;
  for (const br of brks) free = subtract(free, [br.start_min, br.end_min]);
  return free.filter(([a, b]) => b > a);
}

function busyIntervals(db, staffId, fromTs, toTs, excludeId = 0) {
  return db.prepare(`SELECT start_ts, end_ts FROM bookings
                     WHERE staff_id = ? AND status IN ('pending','confirmed') AND id != ?
                       AND end_ts > ? AND start_ts < ?`).all(staffId, excludeId, fromTs, toTs);
}

/** Bitta usta, bitta kun uchun slotlar: [{ min, ts }] */
export function slotsForStaff(db, biz, staffId, date, durationMin, opts = {}) {
  const now = opts.now ?? nowTs();
  const tz = biz.timezone;
  const today = tsToLocal(now, tz).date;
  if (date < today) return [];
  if (!opts.ignoreAdvance && date > addDays(today, biz.max_advance_days)) return [];

  const intervals = workIntervals(db, biz, staffId, date);
  if (!intervals.length) return [];

  const dayStart = localToTs(date, 0, tz), dayEnd = localToTs(addDays(date, 1), 0, tz);
  const buf = biz.buffer_min * 60;
  const busy = busyIntervals(db, staffId, dayStart - 86400, dayEnd + 86400, opts.excludeBookingId);
  const earliest = opts.ignoreNotice ? 0 : now + biz.min_notice_min * 60;
  const step = Math.max(5, biz.slot_step_min);

  const out = [];
  for (const [a, b] of intervals) {
    for (let m = a; m + durationMin <= b; m += step) {
      const ts = localToTs(date, m, tz);
      if (ts < earliest) continue;
      const end = ts + durationMin * 60;
      if (busy.some(x => ts < x.end_ts + buf && end + buf > x.start_ts)) continue;
      out.push({ min: m, ts });
    }
  }
  return out;
}

/** Ish kunida ish borligi uchun xizmat ko'rsata oladigan faol ustalar */
export function eligibleStaff(db, biz, serviceIds, staffId = null) {
  const rows = staffId
    ? db.prepare('SELECT * FROM staff WHERE id = ? AND business_id = ? AND active = 1 AND accepts_online = 1').all(staffId, biz.id)
    : db.prepare('SELECT * FROM staff WHERE business_id = ? AND active = 1 AND accepts_online = 1 ORDER BY sort, id').all(biz.id);
  const res = [];
  for (const s of rows) {
    const p = priceForStaff(db, s.id, serviceIds);
    if (p) res.push({ staff: s, ...p });
  }
  return res;
}

/**
 * Kun bo'yicha slotlar. staffId yo'q bo'lsa — "istalgan usta": bir xil vaqt bir nechta ustada bo'sh bo'lishi mumkin.
 * -> [{ time:'10:00', ts, staff:[{id, price, duration}] }]
 */
export function getSlots(db, biz, { staffId = null, serviceIds, date, now, excludeBookingId = 0 }) {
  if (!isDate(date)) throw new BookingError('bad_date');
  if (!acceptsBookings(biz, now)) return [];
  const map = new Map();
  for (const e of eligibleStaff(db, biz, serviceIds, staffId)) {
    for (const s of slotsForStaff(db, biz, e.staff.id, date, e.duration, { now, excludeBookingId })) {
      let row = map.get(s.ts);
      if (!row) map.set(s.ts, row = { time: hhmm(s.min), ts: s.ts, staff: [] });
      row.staff.push({ id: e.staff.id, price: e.price, duration: e.duration });
    }
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

/** Oy kalendari uchun: qaysi kunlarda kamida bitta bo'sh slot bor */
export function availableDays(db, biz, { staffId = null, serviceIds, from, days = 31, now }) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    if (getSlots(db, biz, { staffId, serviceIds, date: d, now }).length) out.push(d);
  }
  return out;
}

export function upsertClient(db, businessId, { userId = null, name, phone = '' }) {
  const now = nowTs();
  if (userId) {
    const c = db.prepare('SELECT * FROM clients WHERE business_id = ? AND user_id = ?').get(businessId, userId);
    if (c) {
      if (phone && phone !== c.phone) db.prepare('UPDATE clients SET phone = ? WHERE id = ?').run(phone, c.id);
      return db.prepare('SELECT * FROM clients WHERE id = ?').get(c.id);
    }
  }
  const r = db.prepare('INSERT INTO clients (business_id, user_id, name, phone, created_at) VALUES (?,?,?,?,?)')
    .run(businessId, userId, name || 'Mijoz', phone, now);
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(r.lastInsertRowid);
}

function scheduleReminders(db, biz, bookingId, startTs, now) {
  db.prepare('DELETE FROM reminders WHERE booking_id = ? AND sent = 0').run(bookingId);
  for (const m of String(biz.reminders || '').split(',').map(Number).filter(n => n > 0)) {
    const at = startTs - m * 60;
    if (at > now) db.prepare('INSERT INTO reminders (booking_id, send_at, minutes_before) VALUES (?,?,?)').run(bookingId, at, m);
  }
}

/**
 * Bron yaratish. Hamma tekshiruv va yozuv bitta tranzaksiyada (BEGIN IMMEDIATE),
 * shuning uchun bir vaqtda kelgan ikki so'rovdan faqat biri o'tadi.
 *
 * manual=true — ustaning o'zi kiritgan bron (yurib kelgan mijoz, telefon orqali):
 * minimal oldindan ogohlantirish va muddat chegarasi tekshirilmaydi, lekin ustma-ust tushish taqiqlanadi.
 */
export function createBooking(db, p) {
  const now = p.now ?? nowTs();
  return tx(db, () => {
    const biz = getBusiness(db, p.businessId);
    if (!p.manual && !acceptsBookings(biz, now)) throw new BookingError('business_closed');
    if (!Number.isInteger(p.startTs)) throw new BookingError('bad_time');
    if (!p.serviceIds?.length) throw new BookingError('no_services');

    const client = p.clientId
      ? db.prepare('SELECT * FROM clients WHERE id = ? AND business_id = ?').get(p.clientId, biz.id)
      : upsertClient(db, biz.id, { userId: p.userId, name: p.name, phone: p.phone });
    if (!client) throw new BookingError('client_not_found');
    if (client.blocked && !p.manual) throw new BookingError('client_blocked');
    // Qo'ng'iroq/aloqa roziligi: mijoz o'zi bergan yoki ustaning o'zi kiritgan (Telegram'siz) mijoz
    if (p.consent || (p.manual && !client.user_id)) {
      db.prepare('UPDATE clients SET call_consent = 1, consent_at = COALESCE(consent_at, ?) WHERE id = ?').run(now, client.id);
    }

    const local = tsToLocal(p.startTs, biz.timezone);
    const cands = eligibleStaff(db, biz, p.serviceIds, p.staffId);
    if (p.manual && p.staffId && !cands.length) throw new BookingError('staff_cannot_do');
    if (!cands.length) throw new BookingError('no_staff');

    // Slot haqiqatan bo'shmi? (mijoz yuborgan vaqtga ishonmaymiz)
    const ok = [];
    for (const c of cands) {
      const opts = { now, ignoreNotice: p.manual, ignoreAdvance: p.manual };
      const found = slotsForStaff(db, biz, c.staff.id, local.date, c.duration, opts).some(s => s.ts === p.startTs);
      if (found) ok.push(c);
    }
    if (!ok.length) throw new BookingError('slot_taken');

    // "Istalgan usta": shu kuni eng kam band ustani tanlaymiz
    let chosen = ok[0];
    if (ok.length > 1) {
      const dayStart = localToTs(local.date, 0, biz.timezone), dayEnd = localToTs(addDays(local.date, 1), 0, biz.timezone);
      const load = id => db.prepare(`SELECT COUNT(*) c FROM bookings WHERE staff_id = ? AND status IN ('pending','confirmed')
                                     AND start_ts >= ? AND start_ts < ?`).get(id, dayStart, dayEnd).c;
      chosen = ok.map(c => ({ c, l: load(c.staff.id) })).sort((a, b) => a.l - b.l || a.c.staff.sort - b.c.staff.sort)[0].c;
    }
    const endTs = p.startTs + chosen.duration * 60;

    if (!p.manual) {
      // mijozning o'zi bir vaqtda ikki joyda bo'lolmaydi + faol bronlar chegarasi
      const overlap = db.prepare(`SELECT 1 FROM bookings WHERE client_id = ? AND status IN ('pending','confirmed')
                                  AND start_ts < ? AND end_ts > ? LIMIT 1`).get(client.id, endTs, p.startTs);
      if (overlap) throw new BookingError('client_overlap');
      const active = db.prepare(`SELECT COUNT(*) c FROM bookings WHERE client_id = ? AND status IN ('pending','confirmed') AND end_ts > ?`)
        .get(client.id, now).c;
      if (biz.max_active_per_client > 0 && active >= biz.max_active_per_client) throw new BookingError('too_many_active');
    }

    const status = p.manual || biz.auto_confirm ? 'confirmed' : 'pending';
    const r = db.prepare(`INSERT INTO bookings (business_id, staff_id, client_id, bot_id, start_ts, end_ts, status, total_price, note, source, rescheduled_from, created_at, updated_at)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(biz.id, chosen.staff.id, client.id, p.botId ?? null, p.startTs, endTs, status, chosen.price,
        (p.note || '').slice(0, 300), p.source || (p.manual ? 'manual' : 'miniapp'), p.rescheduledFrom ?? null, now, now);
    const id = Number(r.lastInsertRowid);
    for (const it of chosen.items) {
      db.prepare('INSERT INTO booking_items (booking_id, service_id, name, price, duration_min) VALUES (?,?,?,?,?)')
        .run(id, it.service_id, it.name, it.price, it.duration_min);
    }
    scheduleReminders(db, biz, id, p.startTs, now);
    return getBooking(db, id);
  });
}

export function getBooking(db, id) {
  const b = db.prepare(`
    SELECT b.*, s.name staff_name, c.name client_name, c.phone client_phone, c.user_id client_user_id, c.call_consent client_consent
    FROM bookings b JOIN staff s ON s.id = b.staff_id JOIN clients c ON c.id = b.client_id WHERE b.id = ?`).get(id);
  if (!b) return null;
  b.items = db.prepare('SELECT service_id, name, price, duration_min FROM booking_items WHERE booking_id = ?').all(id);
  return b;
}

const STAFF_TRANSITIONS = {
  pending: ['confirmed', 'cancelled_staff'],
  confirmed: ['completed', 'no_show', 'cancelled_staff'],
};

/** Usta/egasi tomonidan holat o'zgartirish */
export function changeStatus(db, bookingId, newStatus, now = nowTs()) {
  return tx(db, () => {
    const b = getBooking(db, bookingId);
    if (!b) throw new BookingError('not_found');
    if (!STAFF_TRANSITIONS[b.status]?.includes(newStatus)) throw new BookingError('bad_transition');
    if ((newStatus === 'completed' || newStatus === 'no_show') && b.start_ts > now) throw new BookingError('not_started');
    db.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(newStatus, now, bookingId);
    if (newStatus === 'completed') db.prepare('UPDATE clients SET visits = visits + 1 WHERE id = ?').run(b.client_id);
    if (newStatus === 'no_show') {
      db.prepare('UPDATE clients SET no_shows = no_shows + 1 WHERE id = ?').run(b.client_id);
      const biz = getBusiness(db, b.business_id);
      if (biz.noshow_limit > 0) {
        db.prepare('UPDATE clients SET blocked = 1 WHERE id = ? AND no_shows >= ?').run(b.client_id, biz.noshow_limit);
      }
    }
    if (newStatus.startsWith('cancelled')) db.prepare('DELETE FROM reminders WHERE booking_id = ? AND sent = 0').run(bookingId);
    return getBooking(db, bookingId);
  });
}

/** Mijoz bekor qilishi: faqat o'zining bronini va faqat chegaradan oldin */
export function cancelByClient(db, bookingId, clientId, now = nowTs()) {
  return tx(db, () => {
    const b = getBooking(db, bookingId);
    if (!b || b.client_id !== clientId) throw new BookingError('not_found');
    if (!ACTIVE.includes(b.status)) throw new BookingError('bad_transition');
    const biz = getBusiness(db, b.business_id);
    if (b.start_ts - now < biz.cancel_before_min * 60) throw new BookingError('too_late', String(biz.cancel_before_min));
    db.prepare("UPDATE bookings SET status = 'cancelled_client', updated_at = ? WHERE id = ?").run(now, bookingId);
    db.prepare('DELETE FROM reminders WHERE booking_id = ? AND sent = 0').run(bookingId);
    return getBooking(db, bookingId);
  });
}

/** Mijoz bronni ko'chiradi (xuddi shu xizmatlar, yangi vaqt). Eski vaqt faqat yangisi bo'sh bo'lsa bo'shaydi. */
export function rescheduleByClient(db, bookingId, clientId, { startTs, staffId = null }, now = nowTs()) {
  return tx(db, () => {
    const b = getBooking(db, bookingId);
    if (!b || b.client_id !== clientId) throw new BookingError('not_found');
    if (!ACTIVE.includes(b.status)) throw new BookingError('bad_transition');
    const biz = getBusiness(db, b.business_id);
    if (b.start_ts - now < biz.cancel_before_min * 60) throw new BookingError('too_late', String(biz.cancel_before_min));
    const serviceIds = b.items.map(i => i.service_id).filter(Boolean);
    const sid = staffId ?? b.staff_id;
    const p = priceForStaff(db, sid, serviceIds);
    if (!p) throw new BookingError('staff_cannot_do');
    const local = tsToLocal(startTs, biz.timezone);
    const found = slotsForStaff(db, biz, sid, local.date, p.duration, { now, excludeBookingId: b.id }).some(s => s.ts === startTs);
    if (!found) throw new BookingError('slot_taken');
    const overlap = db.prepare(`SELECT 1 FROM bookings WHERE client_id = ? AND id != ? AND status IN ('pending','confirmed')
                                AND start_ts < ? AND end_ts > ? LIMIT 1`).get(clientId, b.id, startTs + p.duration * 60, startTs);
    if (overlap) throw new BookingError('client_overlap');

    const status = biz.auto_confirm ? 'confirmed' : 'pending';
    db.prepare('UPDATE bookings SET staff_id = ?, start_ts = ?, end_ts = ?, status = ?, total_price = ?, updated_at = ? WHERE id = ?')
      .run(sid, startTs, startTs + p.duration * 60, status, p.price, now, b.id);
    db.prepare('DELETE FROM booking_items WHERE booking_id = ?').run(b.id);
    for (const it of p.items) {
      db.prepare('INSERT INTO booking_items (booking_id, service_id, name, price, duration_min) VALUES (?,?,?,?,?)')
        .run(b.id, it.service_id, it.name, it.price, it.duration_min);
    }
    scheduleReminders(db, biz, b.id, startTs, now);
    return getBooking(db, b.id);
  });
}

/** Ustani nofaol qilish/ta'til qo'yishda: shu davrga to'g'ri kelgan faol bronlar ro'yxati (egasi qaror qiladi) */
export function conflictingBookings(db, staffId, fromDate, toDate, tz) {
  const a = localToTs(fromDate, 0, tz), b = localToTs(addDays(toDate, 1), 0, tz);
  return db.prepare(`SELECT id FROM bookings WHERE staff_id = ? AND status IN ('pending','confirmed') AND start_ts >= ? AND start_ts < ?`)
    .all(staffId, a, b).map(r => r.id);
}

/** Usta/egasi bronni boshqa vaqtga (yoki boshqa ustaga) ko'chiradi: minimal ogohlantirish tekshirilmaydi */
export function moveByStaff(db, bookingId, { startTs, staffId = null }, now = nowTs()) {
  return tx(db, () => {
    const b = getBooking(db, bookingId);
    if (!b) throw new BookingError('not_found');
    if (!ACTIVE.includes(b.status)) throw new BookingError('bad_transition');
    const biz = getBusiness(db, b.business_id);
    const sid = staffId ?? b.staff_id;
    let duration = b.items.reduce((a, i) => a + i.duration_min, 0), price = b.total_price, items = null;
    if (sid !== b.staff_id) {
      const p = priceForStaff(db, sid, b.items.map(i => i.service_id).filter(Boolean));
      if (!p) throw new BookingError('staff_cannot_do');
      duration = p.duration; price = p.price; items = p.items;
    }
    const local = tsToLocal(startTs, biz.timezone);
    const found = slotsForStaff(db, biz, sid, local.date, duration, { now, excludeBookingId: b.id, ignoreNotice: true, ignoreAdvance: true })
      .some(s => s.ts === startTs);
    if (!found) throw new BookingError('slot_taken');
    db.prepare('UPDATE bookings SET staff_id = ?, start_ts = ?, end_ts = ?, total_price = ?, updated_at = ? WHERE id = ?')
      .run(sid, startTs, startTs + duration * 60, price, now, b.id);
    if (items) {
      db.prepare('DELETE FROM booking_items WHERE booking_id = ?').run(b.id);
      for (const it of items) db.prepare('INSERT INTO booking_items (booking_id, service_id, name, price, duration_min) VALUES (?,?,?,?,?)')
        .run(b.id, it.service_id, it.name, it.price, it.duration_min);
    }
    scheduleReminders(db, biz, b.id, startTs, now);
    return getBooking(db, b.id);
  });
}
