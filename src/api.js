import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, tx } from './db.js';
import { verifyInitData, randomId } from './crypto.js';
import * as B from './booking.js';
import * as TG from './telegram.js';
import { addDays, tsToLocal, localToTs, isDate, nowTs } from './time.js';
import { normLang, esc } from './i18n.js';
import { parseTheme, cleanTheme } from './biz.js';
import { getSetting, setSetting, listPlans, subscriptionOf, staffLimit } from './subscriptions.js';

export class HttpError extends Error {
  constructor(status, code, extra = {}) { super(code); this.status = status; this.code = code; this.extra = extra; }
}
const bad = (code, extra) => new HttpError(400, code, extra);
const forbidden = () => new HttpError(403, 'forbidden');
const notFound = () => new HttpError(404, 'not_found');

// ------------------------------------------------------------------ yordamchilar
const int = (v, name, { min = -Infinity, max = Infinity, optional = false } = {}) => {
  if ((v === undefined || v === null || v === '') && optional) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad('invalid_' + name);
  return n;
};
const str = (v, name, { max = 200, optional = true, min = 0 } = {}) => {
  if (v === undefined || v === null) { if (optional) return ''; throw bad('invalid_' + name); }
  const s = String(v).trim();
  if (s.length < min || s.length > max) throw bad('invalid_' + name);
  return s;
};
const idList = v => [...new Set(String(v ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 12);
const normPhone = p => { const s = String(p || '').replace(/[^\d+]/g, ''); return s.length >= 9 && s.length <= 16 ? s : ''; };
const bool = v => (v ? 1 : 0);
const hhmmToMin = (v, name) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v)); if (!m || +m[1] > 24 || +m[2] > 59) throw bad('invalid_' + name); return +m[1] * 60 + +m[2]; };

// oddiy xotiradagi so'rovlar cheklovi (tg_id bo'yicha, daqiqada)
const buckets = new Map();
function rateLimit(id, limit, bucket = 'all') {
  const k = bucket + ':' + id, now = Date.now();
  const e = buckets.get(k);
  if (!e || now - e.t > 60000) { buckets.set(k, { t: now, n: 1 }); return; }
  if (++e.n > limit) throw new HttpError(429, 'too_many_requests');
}
setInterval(() => { const n = Date.now(); for (const [k, v] of buckets) if (n - v.t > 120000) buckets.delete(k); }, 60000).unref();

// ------------------------------------------------------------------ autentifikatsiya
function authenticate(req) {
  const h = req.headers.authorization || '';
  const botHeader = String(req.headers['x-bot'] || 'platform');
  const key = botHeader === 'platform' ? TG.PLATFORM : /^\d+$/.test(botHeader) ? 'b' + botHeader : null;
  if (!key) throw new HttpError(401, 'bad_bot');
  const bot = key === TG.PLATFORM ? null : db.prepare('SELECT * FROM bots WHERE id = ? AND active = 1').get(Number(key.slice(1)));
  if (key !== TG.PLATFORM && !bot) throw new HttpError(404, 'bot_not_found');

  let tgUser = null;
  if (h.startsWith('tma ')) {
    const token = TG.botToken(key);
    tgUser = verifyInitData(h.slice(4), token, config.initDataMaxAgeSec);
  } else if (config.dev && h.startsWith('dev ')) {
    const [id, name, lang] = h.slice(4).split('|');
    if (/^\d+$/.test(id)) tgUser = { id: Number(id), first_name: name || 'Dev', language_code: lang || 'uz' };
  }
  if (!tgUser) throw new HttpError(401, 'unauthorized');
  const user = TG.upsertUser(tgUser);
  rateLimit(user.tg_id, 240);
  return { user, key, bot, isAdmin: config.adminIds.includes(user.tg_id) };
}

/** Biznesdagi roli: owner | manager | master | null */
function access(ctx, bizId, roles) {
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(bizId);
  if (!biz) throw notFound();
  let role = null, me = null;
  if (biz.owner_id === ctx.user.id) role = 'owner';
  me = db.prepare('SELECT * FROM staff WHERE business_id = ? AND user_id = ? AND active = 1').get(biz.id, ctx.user.id);
  if (!role && me) role = me.role === 'owner' ? 'owner' : me.role;
  if (!role && ctx.isAdmin) role = 'owner';
  if (!role || (roles && !roles.includes(role))) throw forbidden();
  return { biz, role, me };
}
/** Master faqat o'z qatoriga tegadi */
function staffAccess(ctx, bizId, staffId) {
  const a = access(ctx, bizId, ['owner', 'manager', 'master']);
  const staff = db.prepare('SELECT * FROM staff WHERE id = ? AND business_id = ?').get(staffId, bizId);
  if (!staff) throw notFound();
  if (a.role === 'master' && a.me?.id !== staff.id) throw forbidden();
  return { ...a, staff };
}

// ------------------------------------------------------------------ serializatsiya
const url = f => (f ? '/uploads/' + f : null);
function ratingOf(staffId) {
  const r = db.prepare('SELECT AVG(rating) a, COUNT(*) c FROM reviews WHERE staff_id = ?').get(staffId);
  return { rating: r.c ? Math.round(r.a * 10) / 10 : null, reviews: r.c };
}
function pubBiz(b) {
  const city = b.city_id ? db.prepare('SELECT * FROM cities WHERE id = ?').get(b.city_id) : null;
  return {
    id: b.id, name: b.name, kind: b.kind, description: b.description, address: b.address, landmark: b.landmark,
    lat: b.lat, lng: b.lng, phone: b.phone, instagram: b.instagram, logo: url(b.logo), cover: url(b.cover),
    city: city ? { id: city.id, name_uz: city.name_uz, name_ru: city.name_ru } : null,
    currency: b.currency, timezone: b.timezone, cancel_before_min: b.cancel_before_min, max_advance_days: b.max_advance_days,
    auto_confirm: !!b.auto_confirm, slot_step_min: b.slot_step_min, open: B.acceptsBookings(b), theme: parseTheme(b.theme),
  };
}
function staffWithServices(s) {
  const svc = db.prepare(`SELECT ss.service_id, COALESCE(ss.price, sv.price) price, COALESCE(ss.duration_min, sv.duration_min) duration_min
                          FROM staff_services ss JOIN services sv ON sv.id = ss.service_id WHERE ss.staff_id = ? AND sv.active = 1`).all(s.id);
  return { id: s.id, name: s.name, title: s.title, bio: s.bio, photo: url(s.photo), role: s.role, active: !!s.active, accepts_online: !!s.accepts_online, services: svc, ...ratingOf(s.id) };
}
function bookingView(b) {
  return {
    id: b.id, staff_id: b.staff_id, staff_name: b.staff_name, client_id: b.client_id, client_name: b.client_name, client_phone: b.client_consent ? b.client_phone : '', client_consent: !!b.client_consent,
    start_ts: b.start_ts, end_ts: b.end_ts, status: b.status, total_price: b.total_price, note: b.note, source: b.source,
    items: b.items,
  };
}
const listBookings = (where, args) => db.prepare(`
  SELECT b.id FROM bookings b ${where} ORDER BY b.start_ts`).all(...args).map(r => bookingView(B.getBooking(db, r.id)));

function mapErr(e) {
  if (e instanceof HttpError) return e;
  if (e instanceof B.BookingError) {
    const status = ['not_found'].includes(e.code) ? 404 : 409;
    return new HttpError(status, e.code, e.code === 'too_late' ? { minutes: Number(e.message) } : {});
  }
  return e;
}

// ------------------------------------------------------------------ mijoz (bot kontekstida) endpointlari
function clientCtx(ctx) {
  if (!ctx.bot) throw bad('bot_required');
  const biz = B.getBusiness(db, ctx.bot.business_id);
  return { biz, lockedStaff: ctx.bot.staff_id || null };
}

const R = []; // [method, regex, handler]
const route = (method, p, h) => R.push([method, new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), h]);

route('GET', '/api/c/shop', ctx => {
  const { biz, lockedStaff } = clientCtx(ctx);
  const staffRows = db.prepare('SELECT * FROM staff WHERE business_id = ? AND active = 1 AND accepts_online = 1 ORDER BY sort, id').all(biz.id)
    .filter(s => !lockedStaff || s.id === lockedStaff);
  const staff = staffRows.map(staffWithServices).filter(s => s.services.length);
  const used = new Set(staff.flatMap(s => s.services.map(x => x.service_id)));
  const services = db.prepare('SELECT id, category, name, description, price, duration_min FROM services WHERE business_id = ? AND active = 1 ORDER BY sort, id')
    .all(biz.id).filter(s => used.has(s.id));
  const gallery = db.prepare('SELECT id, file, caption, staff_id FROM gallery WHERE business_id = ? ORDER BY sort, id DESC LIMIT 40').all(biz.id)
    .filter(g => !lockedStaff || g.staff_id === lockedStaff || g.staff_id === null).map(g => ({ ...g, url: url(g.file) }));
  const client = db.prepare('SELECT name, phone, blocked FROM clients WHERE business_id = ? AND user_id = ?').get(biz.id, ctx.user.id);
  const mem = db.prepare('SELECT role FROM staff WHERE business_id = ? AND user_id = ? AND active = 1').get(biz.id, ctx.user.id);
  const role = biz.owner_id === ctx.user.id ? 'owner' : mem?.role || null;
  return {
    business: pubBiz(biz), staff, services, gallery, locked_staff: lockedStaff,
    me: { id: ctx.user.id, name: client?.name || [ctx.user.first_name, ctx.user.last_name].filter(Boolean).join(' '), phone: client?.phone || ctx.user.phone || '', blocked: !!client?.blocked, lang: ctx.user.lang, role },
    bot: { username: ctx.bot.username },
  };
});

function slotArgs(ctx, q) {
  const { biz, lockedStaff } = clientCtx(ctx);
  const serviceIds = idList(q.get('services'));
  if (!serviceIds.length) throw bad('no_services');
  let staffId = q.get('staff') && q.get('staff') !== 'any' ? int(q.get('staff'), 'staff', { min: 1 }) : null;
  if (lockedStaff) staffId = lockedStaff;
  return { biz, serviceIds, staffId };
}

route('GET', '/api/c/slots', (ctx, { q }) => {
  const { biz, serviceIds, staffId } = slotArgs(ctx, q);
  const date = q.get('date');
  if (!isDate(date)) throw bad('bad_date');
  const exclude = int(q.get('exclude'), 'exclude', { optional: true, min: 1 }) || 0;
  let slots = B.getSlots(db, biz, { staffId, serviceIds, date, excludeBookingId: exclude });
  // mijozning o'zida shu vaqtda boshqa bron bo'lsa, o'sha vaqtni ko'rsatmaymiz
  const mine = db.prepare(`SELECT b.start_ts, b.end_ts FROM bookings b JOIN clients c ON c.id = b.client_id
                           WHERE c.business_id = ? AND c.user_id = ? AND b.status IN ('pending','confirmed') AND b.id != ? AND b.end_ts > ?`)
    .all(biz.id, ctx.user.id, exclude, nowTs());
  if (mine.length) slots = slots.filter(s => !mine.some(m => s.ts < m.end_ts && s.ts + Math.min(...s.staff.map(x => x.duration)) * 60 > m.start_ts));
  return { date, slots: slots.map(s => ({ time: s.time, ts: s.ts, staff: s.staff })) };
});

route('GET', '/api/c/days', (ctx, { q }) => {
  const { biz, serviceIds, staffId } = slotArgs(ctx, q);
  const today = tsToLocal(nowTs(), biz.timezone).date;
  const from = isDate(q.get('from')) && q.get('from') > today ? q.get('from') : today;
  const days = Math.min(42, int(q.get('days') || 31, 'days', { min: 1 }));
  return { days: B.availableDays(db, biz, { staffId, serviceIds, from, days }) };
});

route('POST', '/api/c/profile', (ctx, { body }) => {
  const phone = normPhone(body.phone);
  const lang = body.lang ? normLang(body.lang) : ctx.user.lang;
  db.prepare('UPDATE users SET phone = COALESCE(NULLIF(?, \'\'), phone), lang = ? WHERE id = ?').run(phone, lang, ctx.user.id);
  return { ok: true };
});

route('POST', '/api/c/book', async (ctx, { body }) => {
  rateLimit(ctx.user.tg_id, 12, 'book');
  const { biz, lockedStaff } = clientCtx(ctx);
  const phone = normPhone(body.phone);
  if (!phone) throw bad('invalid_phone');
  if (body.consent !== true) throw bad('consent_required');
  const name = str(body.name, 'name', { max: 60, min: 1, optional: false });
  const serviceIds = [...new Set((body.services || []).map(Number).filter(Number.isInteger))].slice(0, 12);
  const staffId = lockedStaff || (body.staff ? int(body.staff, 'staff', { min: 1 }) : null);
  db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, ctx.user.id);
  const booking = B.createBooking(db, {
    businessId: biz.id, staffId, serviceIds, startTs: int(body.startTs, 'startTs'), userId: ctx.user.id,
    name, phone, consent: true, note: str(body.note, 'note', { max: 300 }), botId: ctx.bot.id, source: 'miniapp',
  });
  TG.notifyCreated(booking);
  return { booking: bookingView(booking) };
});

function myClient(ctx) {
  const { biz } = clientCtx(ctx);
  return { biz, client: db.prepare('SELECT * FROM clients WHERE business_id = ? AND user_id = ?').get(biz.id, ctx.user.id) };
}

route('GET', '/api/c/my', ctx => {
  const { client } = myClient(ctx);
  if (!client) return { upcoming: [], past: [] };
  const now = nowTs();
  const all = listBookings('WHERE b.client_id = ?', [client.id]).reverse();
  const reviewed = new Set(db.prepare('SELECT booking_id FROM reviews WHERE booking_id IN (SELECT id FROM bookings WHERE client_id = ?)').all(client.id).map(r => r.booking_id));
  const upcoming = all.filter(b => ['pending', 'confirmed'].includes(b.status) && b.end_ts > now).reverse();
  const past = all.filter(b => !upcoming.includes(b)).slice(0, 30).map(b => ({ ...b, reviewed: reviewed.has(b.id) }));
  return { upcoming, past };
});

route('POST', '/api/c/my/:id/cancel', async (ctx, { params }) => {
  const { client } = myClient(ctx);
  const nb = B.cancelByClient(db, Number(params.id), client?.id ?? -1);
  TG.notifyStaffChange(nb, 'cancelled');
  return { booking: bookingView(nb) };
});

route('POST', '/api/c/my/:id/reschedule', async (ctx, { params, body }) => {
  const { client } = myClient(ctx);
  const staffId = ctx.bot.staff_id || (body.staff ? int(body.staff, 'staff', { min: 1 }) : null);
  const nb = B.rescheduleByClient(db, Number(params.id), client?.id ?? -1, { startTs: int(body.startTs, 'startTs'), staffId });
  TG.notifyMoved(nb);
  return { booking: bookingView(nb) };
});

route('POST', '/api/c/my/:id/review', (ctx, { params, body }) => {
  const { client } = myClient(ctx);
  const b = B.getBooking(db, Number(params.id));
  if (!b || b.client_id !== client?.id || b.status !== 'completed') throw notFound();
  const rating = int(body.rating, 'rating', { min: 1, max: 5 });
  db.prepare(`INSERT INTO reviews (booking_id, business_id, staff_id, rating, text, created_at) VALUES (?,?,?,?,?,?)
              ON CONFLICT(booking_id) DO UPDATE SET rating = excluded.rating, text = excluded.text`)
    .run(b.id, b.business_id, b.staff_id, rating, str(body.text, 'text', { max: 500 }), nowTs());
  return { ok: true };
});

// ------------------------------------------------------------------ boshqaruv: umumiy
route('GET', '/api/cities', () => ({ cities: db.prepare('SELECT * FROM cities ORDER BY id').all() }));

route('GET', '/api/a/me', ctx => {
  const u = ctx.user;
  const owned = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').all(u.id).map(r => r.id);
  const member = db.prepare('SELECT business_id FROM staff WHERE user_id = ? AND active = 1').all(u.id).map(r => r.business_id);
  const ids = [...new Set([...owned, ...member])];
  const list = ids.map(id => {
    const b = db.prepare('SELECT * FROM businesses WHERE id = ?').get(id);
    const me = db.prepare('SELECT id, role FROM staff WHERE business_id = ? AND user_id = ? AND active = 1').get(id, u.id);
    const bots = db.prepare('SELECT id, kind, username, staff_id FROM bots WHERE business_id = ?').all(id);
    return { ...pubBiz(b), role: b.owner_id === u.id ? 'owner' : me?.role, my_staff_id: me?.id || null, bots, trial_ends: b.trial_ends, paid_until: b.paid_until, status: b.status };
  });
  return { user: { id: u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' '), lang: u.lang, phone: u.phone }, businesses: list, is_admin: ctx.isAdmin, platform_bot: ctx.key === TG.PLATFORM, platform_bot_username: TG.getLive(TG.PLATFORM)?.bot.botInfo?.username || null };
});

const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5].map(w => [w, 540, 1080]);

/**
 * Biznesni faqat platforma egasi yaratadi (sotuv ofisi modeli). Egalik havola (claim_code) orqali
 * mijozga topshiriladi: u t.me/<bot>?start=own_<kod> ni ochgach egasiga aylanadi.
 */
route('POST', '/api/a/business', (ctx, { body }) => {
  if (!ctx.isAdmin) throw forbidden();
  const name = str(body.name, 'name', { max: 80, min: 2, optional: false });
  const kind = ['barber', 'beauty', 'nails', 'clinic', 'other'].includes(body.kind) ? body.kind : 'barber';
  const city = body.city_id ? db.prepare('SELECT * FROM cities WHERE id = ?').get(Number(body.city_id)) : null;
  const lead = body.lead_id ? db.prepare('SELECT * FROM leads WHERE id = ?').get(Number(body.lead_id)) : null;
  const now = nowTs();
  const code = randomId(9);
  const id = tx(db, () => {
    const r = db.prepare(`INSERT INTO businesses (owner_id, name, kind, city_id, timezone, lang, trial_ends, claim_code, created_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(ctx.user.id, name, kind, city?.id ?? null, city?.timezone || 'Asia/Tashkent', ctx.user.lang, now + config.trialDays * 86400, code, now);
    const bizId = Number(r.lastInsertRowid);
    if (lead) db.prepare("UPDATE leads SET business_id = ?, status = CASE WHEN status IN ('new','contacted') THEN 'progress' ELSE status END WHERE id = ?").run(bizId, lead.id);
    return bizId;
  });
  return { id, claim_code: code };
});

route('POST', '/api/admin/businesses/:id/claim', (ctx, { params }) => {
  if (!ctx.isAdmin) throw forbidden();
  const biz = db.prepare('SELECT id FROM businesses WHERE id = ?').get(Number(params.id));
  if (!biz) throw notFound();
  const code = randomId(9);
  db.prepare('UPDATE businesses SET claim_code = ? WHERE id = ?').run(code, biz.id);
  return { claim_code: code };
});

route('GET', '/api/a/:biz', (ctx, { params }) => {
  const { biz, role, me } = access(ctx, Number(params.biz));
  const staffRows = db.prepare('SELECT * FROM staff WHERE business_id = ? ORDER BY active DESC, sort, id').all(biz.id);
  const visibleStaff = role === 'master' ? staffRows.filter(s => s.id === me.id) : staffRows;
  const services = db.prepare('SELECT * FROM services WHERE business_id = ? ORDER BY active DESC, sort, id').all(biz.id);
  const bots = role === 'owner' ? db.prepare('SELECT id, kind, username, staff_id, active FROM bots WHERE business_id = ?').all(biz.id) : [];
  const settings = role === 'owner' ? {
    slot_step_min: biz.slot_step_min, buffer_min: biz.buffer_min, min_notice_min: biz.min_notice_min, max_advance_days: biz.max_advance_days,
    cancel_before_min: biz.cancel_before_min, auto_confirm: !!biz.auto_confirm, max_active_per_client: biz.max_active_per_client,
    noshow_limit: biz.noshow_limit, reminders: biz.reminders, timezone: biz.timezone,
  } : null;
  return {
    role, my_staff_id: me?.id || null, business: { ...pubBiz(biz), status: biz.status, trial_ends: biz.trial_ends, paid_until: biz.paid_until },
    settings,
    staff: visibleStaff.map(s => ({ ...staffWithServices(s), photo: url(s.photo), user_linked: !!s.user_id, invite_code: role === 'owner' || role === 'manager' ? s.invite_code : null })),
    services, bots, platform_bot_username: TG.getLive(TG.PLATFORM)?.bot.botInfo?.username || null,
  };
});

route('PATCH', '/api/a/:biz', (ctx, { params, body }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner']);
  const set = {};
  if ('name' in body) set.name = str(body.name, 'name', { max: 80, min: 2, optional: false });
  if ('description' in body) set.description = str(body.description, 'description', { max: 600 });
  if ('address' in body) set.address = str(body.address, 'address', { max: 200 });
  if ('landmark' in body) set.landmark = str(body.landmark, 'landmark', { max: 200 });
  if ('phone' in body) set.phone = str(body.phone, 'phone', { max: 30 });
  if ('instagram' in body) set.instagram = str(body.instagram, 'instagram', { max: 60 });
  if ('kind' in body && ['barber', 'beauty', 'nails', 'clinic', 'other'].includes(body.kind)) set.kind = body.kind;
  if ('city_id' in body) {
    const c = body.city_id ? db.prepare('SELECT * FROM cities WHERE id = ?').get(Number(body.city_id)) : null;
    set.city_id = c?.id ?? null; if (c) set.timezone = c.timezone;
  }
  if ('lat' in body || 'lng' in body) {
    const lat = body.lat === null ? null : Number(body.lat), lng = body.lng === null ? null : Number(body.lng);
    if ((lat !== null && !(lat >= -90 && lat <= 90)) || (lng !== null && !(lng >= -180 && lng <= 180))) throw bad('invalid_location');
    set.lat = lat; set.lng = lng;
  }
  if ('slot_step_min' in body) set.slot_step_min = int(body.slot_step_min, 'slot_step_min', { min: 5, max: 240 });
  if ('buffer_min' in body) set.buffer_min = int(body.buffer_min, 'buffer_min', { min: 0, max: 120 });
  if ('min_notice_min' in body) set.min_notice_min = int(body.min_notice_min, 'min_notice_min', { min: 0, max: 7 * 1440 });
  if ('max_advance_days' in body) set.max_advance_days = int(body.max_advance_days, 'max_advance_days', { min: 1, max: 180 });
  if ('cancel_before_min' in body) set.cancel_before_min = int(body.cancel_before_min, 'cancel_before_min', { min: 0, max: 7 * 1440 });
  if ('max_active_per_client' in body) set.max_active_per_client = int(body.max_active_per_client, 'max_active_per_client', { min: 0, max: 20 });
  if ('noshow_limit' in body) set.noshow_limit = int(body.noshow_limit, 'noshow_limit', { min: 0, max: 20 });
  if ('auto_confirm' in body) set.auto_confirm = bool(body.auto_confirm);
  if ('reminders' in body) {
    const list = String(body.reminders).split(',').map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 7 * 1440).slice(0, 3);
    set.reminders = list.join(',');
  }
  if ('theme' in body) set.theme = JSON.stringify(cleanTheme(body.theme));
  if ('status' in body && ['active', 'paused'].includes(body.status) && biz.status !== 'blocked') set.status = body.status;
  const keys = Object.keys(set);
  if (keys.length) db.prepare(`UPDATE businesses SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => set[k]), biz.id);
  return { ok: true };
});

route('POST', '/api/a/:biz/bots', async (ctx, { params, body }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner']);
  const kind = body.kind === 'staff' ? 'staff' : 'shop';
  const count = db.prepare('SELECT COUNT(*) c FROM bots WHERE business_id = ?').get(biz.id).c;
  if (count >= 20) throw new HttpError(409, 'too_many_bots');
  try {
    const row = await TG.connectBot({ token: body.token, businessId: biz.id, kind, staffId: kind === 'staff' ? Number(body.staff_id) : null });
    return { bot: { id: row.id, kind: row.kind, username: row.username, staff_id: row.staff_id } };
  } catch (e) {
    if (e.code) throw new HttpError(e.code === 'already_used' ? 409 : 400, e.code);
    throw e;
  }
});

route('DELETE', '/api/a/:biz/bots/:id', async (ctx, { params }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner']);
  const b = db.prepare('SELECT id FROM bots WHERE id = ? AND business_id = ?').get(Number(params.id), biz.id);
  if (!b) throw notFound();
  await TG.disconnectBot(b.id);
  return { ok: true };
});

route('POST', '/api/a/:biz/request-location', async (ctx, { params }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner']);
  TG.askForState(ctx.user.tg_id, 'await_location', { bizId: biz.id });
  await TG.promptLocation(ctx.user.tg_id, ctx.user.lang);
  return { ok: true };
});

route('POST', '/api/a/:biz/request-token', async (ctx, { params, body }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner']);
  TG.askForState(ctx.user.tg_id, 'await_token', { bizId: biz.id, kind: body.kind === 'staff' ? 'staff' : 'shop', staffId: body.staff_id ? Number(body.staff_id) : null });
  return { ok: true };
});

// ------------------------------------------------------------------ xodimlar
route('POST', '/api/a/:biz/staff', (ctx, { params, body }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager']);
  const n = db.prepare('SELECT COUNT(*) c FROM staff WHERE business_id = ? AND active = 1').get(biz.id).c;
  if (n >= 30) throw new HttpError(409, 'too_many_staff');
  const lim = staffLimit(db, biz);
  if (!lim.ok) throw new HttpError(409, 'plan_limit', { max: lim.max });
  const role = ['master', 'manager'].includes(body.role) ? body.role : 'master';
  const r = db.prepare('INSERT INTO staff (business_id, name, title, bio, role, invite_code, sort, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(biz.id, str(body.name, 'name', { max: 60, min: 1, optional: false }), str(body.title, 'title', { max: 60 }), str(body.bio, 'bio', { max: 400 }), role, randomId(9), n, nowTs());
  const sid = Number(r.lastInsertRowid);
  for (const [w, a, b] of DEFAULT_HOURS) db.prepare('INSERT INTO working_hours (staff_id, weekday, start_min, end_min) VALUES (?,?,?,?)').run(sid, w, a, b);
  // yangi usta hamma faol xizmatlarni qiladi (keyin o'zgartiriladi)
  db.prepare('INSERT INTO staff_services (staff_id, service_id) SELECT ?, id FROM services WHERE business_id = ? AND active = 1').run(sid, biz.id);
  return { id: sid };
});

route('GET', '/api/a/:biz/staff/:sid', (ctx, { params }) => {
  const { staff } = staffAccess(ctx, Number(params.biz), Number(params.sid));
  const sid = staff.id;
  return {
    staff: { ...staffWithServices(staff), user_linked: !!staff.user_id, invite_code: staff.invite_code },
    hours: db.prepare('SELECT weekday, start_min, end_min FROM working_hours WHERE staff_id = ? ORDER BY weekday, start_min').all(sid),
    breaks: db.prepare('SELECT id, weekday, start_min, end_min FROM breaks WHERE staff_id = ? ORDER BY start_min').all(sid),
    overrides: db.prepare('SELECT id, date, start_min, end_min, reason FROM day_overrides WHERE staff_id = ? AND date >= ? ORDER BY date, start_min').all(sid, addDays(new Date().toISOString().slice(0, 10), -1)),
    time_off: db.prepare('SELECT id, staff_id, from_date, to_date, reason FROM time_off WHERE business_id = ? AND (staff_id = ? OR staff_id IS NULL) AND to_date >= ? ORDER BY from_date').all(staff.business_id, sid, addDays(new Date().toISOString().slice(0, 10), -1)),
    offered: db.prepare('SELECT service_id, price, duration_min FROM staff_services WHERE staff_id = ?').all(sid),
  };
});

route('PATCH', '/api/a/:biz/staff/:sid', async (ctx, { params, body }) => {
  const { staff, role } = staffAccess(ctx, Number(params.biz), Number(params.sid));
  const set = {};
  if ('name' in body) set.name = str(body.name, 'name', { max: 60, min: 1, optional: false });
  if ('title' in body) set.title = str(body.title, 'title', { max: 60 });
  if ('bio' in body) set.bio = str(body.bio, 'bio', { max: 400 });
  if ('accepts_online' in body) set.accepts_online = bool(body.accepts_online);
  if (role !== 'master') {
    if ('sort' in body) set.sort = int(body.sort, 'sort', { min: 0, max: 1000 });
    if ('role' in body && staff.role !== 'owner' && ['master', 'manager'].includes(body.role)) set.role = body.role;
    if ('active' in body && staff.role !== 'owner') {
      set.active = bool(body.active);
      if (set.active && !staff.active) {
        const lim = staffLimit(db, db.prepare('SELECT * FROM businesses WHERE id = ?').get(staff.business_id));
        if (!lim.ok) throw new HttpError(409, 'plan_limit', { max: lim.max });
      }
      if (!set.active) {
        const future = db.prepare("SELECT id FROM bookings WHERE staff_id = ? AND status IN ('pending','confirmed') AND start_ts > ?").all(staff.id, nowTs());
        if (future.length && !body.cancel_future) throw new HttpError(409, 'has_future_bookings', { count: future.length });
        for (const f of future) { const nb = B.changeStatus(db, f.id, 'cancelled_staff'); TG.notifyClientStatus(nb); }
      }
    }
  }
  const keys = Object.keys(set);
  if (keys.length) db.prepare(`UPDATE staff SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => set[k]), staff.id);
  return { ok: true };
});

route('POST', '/api/a/:biz/staff/:sid/invite', (ctx, { params }) => {
  const { staff } = staffAccess(ctx, Number(params.biz), Number(params.sid));
  access(ctx, Number(params.biz), ['owner', 'manager']);
  if (staff.user_id) throw new HttpError(409, 'already_linked');
  const code = randomId(9);
  db.prepare('UPDATE staff SET invite_code = ? WHERE id = ?').run(code, staff.id);
  return { code };
});

route('PUT', '/api/a/:biz/staff/:sid/hours', (ctx, { params, body }) => {
  const { staff } = staffAccess(ctx, Number(params.biz), Number(params.sid));
  const rows = [];
  for (const h of body.hours || []) {
    const w = int(h.weekday, 'weekday', { min: 0, max: 6 }), a = hhmmToMin(h.start, 'start'), b = hhmmToMin(h.end, 'end');
    if (b <= a || b > 1440) throw bad('invalid_interval');
    rows.push([w, a, b]);
  }
  const brk = [];
  for (const h of body.breaks || []) {
    const w = h.weekday === null || h.weekday === undefined || h.weekday === '' ? null : int(h.weekday, 'weekday', { min: 0, max: 6 });
    const a = hhmmToMin(h.start, 'start'), b = hhmmToMin(h.end, 'end');
    if (b <= a) throw bad('invalid_interval');
    brk.push([w, a, b]);
  }
  // bir kunda ustma-ust tushgan oraliqlar taqiqlanadi
  for (let w = 0; w < 7; w++) {
    const d = rows.filter(r => r[0] === w).sort((x, y) => x[1] - y[1]);
    for (let i = 1; i < d.length; i++) if (d[i][1] < d[i - 1][2]) throw bad('overlapping_intervals');
  }
  tx(db, () => {
    db.prepare('DELETE FROM working_hours WHERE staff_id = ?').run(staff.id);
    db.prepare('DELETE FROM breaks WHERE staff_id = ?').run(staff.id);
    for (const r of rows) db.prepare('INSERT INTO working_hours (staff_id, weekday, start_min, end_min) VALUES (?,?,?,?)').run(staff.id, ...r);
    for (const r of brk) db.prepare('INSERT INTO breaks (staff_id, weekday, start_min, end_min) VALUES (?,?,?,?)').run(staff.id, ...r);
  });
  return { ok: true };
});

route('PUT', '/api/a/:biz/staff/:sid/services', (ctx, { params, body }) => {
  const { staff, biz } = staffAccess(ctx, Number(params.biz), Number(params.sid));
  const valid = new Set(db.prepare('SELECT id FROM services WHERE business_id = ?').all(biz.id).map(r => r.id));
  tx(db, () => {
    db.prepare('DELETE FROM staff_services WHERE staff_id = ?').run(staff.id);
    for (const s of body.services || []) {
      const sid = Number(s.service_id);
      if (!valid.has(sid)) throw bad('invalid_service');
      const price = s.price === null || s.price === undefined || s.price === '' ? null : int(s.price, 'price', { min: 0, max: 1e9 });
      const dur = s.duration_min === null || s.duration_min === undefined || s.duration_min === '' ? null : int(s.duration_min, 'duration', { min: 5, max: 600 });
      db.prepare('INSERT INTO staff_services (staff_id, service_id, price, duration_min) VALUES (?,?,?,?)').run(staff.id, sid, price, dur);
    }
  });
  return { ok: true };
});

route('POST', '/api/a/:biz/staff/:sid/override', (ctx, { params, body }) => {
  const { staff } = staffAccess(ctx, Number(params.biz), Number(params.sid));
  if (!isDate(body.date)) throw bad('bad_date');
  const reason = str(body.reason, 'reason', { max: 100 });
  tx(db, () => {
    db.prepare('DELETE FROM day_overrides WHERE staff_id = ? AND date = ?').run(staff.id, body.date);
    if (body.off) db.prepare('INSERT INTO day_overrides (staff_id, date, start_min, end_min, reason) VALUES (?,?,NULL,NULL,?)').run(staff.id, body.date, reason);
    else {
      for (const h of body.hours || []) {
        const a = hhmmToMin(h.start, 'start'), b = hhmmToMin(h.end, 'end');
        if (b <= a || b > 1440) throw bad('invalid_interval');
        db.prepare('INSERT INTO day_overrides (staff_id, date, start_min, end_min, reason) VALUES (?,?,?,?,?)').run(staff.id, body.date, a, b, reason);
      }
    }
  });
  const conflicts = B.conflictingBookings(db, staff.id, body.date, body.date, db.prepare('SELECT timezone FROM businesses WHERE id = ?').get(staff.business_id).timezone).length;
  return { ok: true, conflicts };
});
route('DELETE', '/api/a/:biz/staff/:sid/override/:date', (ctx, { params }) => {
  const { staff } = staffAccess(ctx, Number(params.biz), Number(params.sid));
  db.prepare('DELETE FROM day_overrides WHERE staff_id = ? AND date = ?').run(staff.id, params.date);
  return { ok: true };
});

route('POST', '/api/a/:biz/time-off', (ctx, { params, body }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  let staffId = body.staff_id ? Number(body.staff_id) : null;
  if (role === 'master') staffId = me.id;
  else if (!staffId && role !== 'owner') throw forbidden();   // butun biznesni yopish — faqat egasi
  if (staffId && !db.prepare('SELECT 1 FROM staff WHERE id = ? AND business_id = ?').get(staffId, biz.id)) throw notFound();
  if (!isDate(body.from) || !isDate(body.to) || body.to < body.from) throw bad('bad_date');
  const r = db.prepare('INSERT INTO time_off (business_id, staff_id, from_date, to_date, reason) VALUES (?,?,?,?,?)')
    .run(biz.id, staffId, body.from, body.to, str(body.reason, 'reason', { max: 100 }));
  let conflicts = [];
  if (staffId) conflicts = B.conflictingBookings(db, staffId, body.from, body.to, biz.timezone);
  else for (const s of db.prepare('SELECT id FROM staff WHERE business_id = ?').all(biz.id)) conflicts.push(...B.conflictingBookings(db, s.id, body.from, body.to, biz.timezone));
  return { id: Number(r.lastInsertRowid), conflicts: conflicts.length };
});
route('DELETE', '/api/a/:biz/time-off/:id', (ctx, { params }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const t = db.prepare('SELECT * FROM time_off WHERE id = ? AND business_id = ?').get(Number(params.id), biz.id);
  if (!t) throw notFound();
  if (role === 'master' && t.staff_id !== me.id) throw forbidden();
  if (!t.staff_id && role !== 'owner') throw forbidden();
  db.prepare('DELETE FROM time_off WHERE id = ?').run(t.id);
  return { ok: true };
});

// ------------------------------------------------------------------ xizmatlar
function serviceBody(body, partial = false) {
  const o = {};
  if (!partial || 'name' in body) o.name = str(body.name, 'name', { max: 80, min: 1, optional: false });
  if (!partial || 'category' in body) o.category = str(body.category, 'category', { max: 40 });
  if (!partial || 'description' in body) o.description = str(body.description, 'description', { max: 300 });
  if (!partial || 'price' in body) o.price = int(body.price ?? 0, 'price', { min: 0, max: 1e9 });
  if (!partial || 'duration_min' in body) o.duration_min = int(body.duration_min, 'duration', { min: 5, max: 600 });
  if ('active' in body) o.active = bool(body.active);
  return o;
}
route('POST', '/api/a/:biz/services', (ctx, { params, body }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager']);
  const o = serviceBody(body);
  const id = tx(db, () => {
    const r = db.prepare('INSERT INTO services (business_id, category, name, description, price, duration_min, sort) VALUES (?,?,?,?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM services WHERE business_id = ?))')
      .run(biz.id, o.category, o.name, o.description, o.price, o.duration_min, biz.id);
    const sid = Number(r.lastInsertRowid);
    const targets = Array.isArray(body.staff_ids) ? body.staff_ids.map(Number) : db.prepare('SELECT id FROM staff WHERE business_id = ? AND active = 1').all(biz.id).map(x => x.id);
    for (const st of targets) if (db.prepare('SELECT 1 FROM staff WHERE id = ? AND business_id = ?').get(st, biz.id)) db.prepare('INSERT OR IGNORE INTO staff_services (staff_id, service_id) VALUES (?,?)').run(st, sid);
    return sid;
  });
  return { id };
});
route('PATCH', '/api/a/:biz/services/:id', (ctx, { params, body }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager']);
  if (!db.prepare('SELECT 1 FROM services WHERE id = ? AND business_id = ?').get(Number(params.id), biz.id)) throw notFound();
  const o = serviceBody(body, true);
  const keys = Object.keys(o);
  if (keys.length) db.prepare(`UPDATE services SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => o[k]), Number(params.id));
  return { ok: true };
});
route('DELETE', '/api/a/:biz/services/:id', (ctx, { params }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager']);
  const s = db.prepare('SELECT id FROM services WHERE id = ? AND business_id = ?').get(Number(params.id), biz.id);
  if (!s) throw notFound();
  const used = db.prepare('SELECT 1 FROM booking_items WHERE service_id = ? LIMIT 1').get(s.id);
  if (used) db.prepare('UPDATE services SET active = 0 WHERE id = ?').run(s.id); else db.prepare('DELETE FROM services WHERE id = ?').run(s.id);
  return { ok: true, archived: !!used };
});

// ------------------------------------------------------------------ bronlar
route('GET', '/api/a/:biz/bookings', (ctx, { params, q }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const from = q.get('from'), to = q.get('to') || from;
  if (!isDate(from) || !isDate(to) || to < from) throw bad('bad_date');
  if ((Date.parse(to) - Date.parse(from)) / 86400000 > 93) throw bad('range_too_large');
  const a = localToTs(from, 0, biz.timezone), b = localToTs(addDays(to, 1), 0, biz.timezone);
  let where = 'WHERE b.business_id = ? AND b.start_ts >= ? AND b.start_ts < ?';
  const args = [biz.id, a, b];
  if (role === 'master') { where += ' AND b.staff_id = ?'; args.push(me.id); }
  else if (q.get('staff')) { where += ' AND b.staff_id = ?'; args.push(int(q.get('staff'), 'staff', { min: 1 })); }
  if (q.get('status')) { where += ' AND b.status = ?'; args.push(q.get('status')); }
  return { bookings: listBookings(where, args) };
});

route('POST', '/api/a/:biz/bookings', (ctx, { params, body }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const staffId = role === 'master' ? me.id : int(body.staff_id, 'staff', { min: 1 });
  const serviceIds = [...new Set((body.services || []).map(Number).filter(Number.isInteger))];
  let clientId = body.client_id ? Number(body.client_id) : null;
  if (!clientId) {
    const c = B.upsertClient(db, biz.id, { name: str(body.name, 'name', { max: 60, min: 1, optional: false }), phone: normPhone(body.phone) });
    clientId = c.id;
    if (!c.user_id) { /* Telegram'siz mijoz: har safar yangi yozuv yaratilmasligi uchun telefon bo'yicha qidiramiz */ }
  }
  const booking = B.createBooking(db, { businessId: biz.id, staffId, serviceIds, startTs: int(body.startTs, 'startTs'), clientId, manual: true, note: str(body.note, 'note', { max: 300 }), source: 'manual' });
  TG.notifyCreated(booking);
  return { booking: bookingView(booking) };
});

route('POST', '/api/a/:biz/bookings/:id/status', (ctx, { params, body }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const b = B.getBooking(db, Number(params.id));
  if (!b || b.business_id !== biz.id) throw notFound();
  if (role === 'master' && b.staff_id !== me.id) throw forbidden();
  const nb = B.changeStatus(db, b.id, String(body.status));
  TG.notifyClientStatus(nb);
  return { booking: bookingView(nb) };
});

route('POST', '/api/a/:biz/bookings/:id/move', (ctx, { params, body }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const b = B.getBooking(db, Number(params.id));
  if (!b || b.business_id !== biz.id) throw notFound();
  if (role === 'master' && b.staff_id !== me.id) throw forbidden();
  const staffId = role === 'master' ? null : (body.staff_id ? int(body.staff_id, 'staff', { min: 1 }) : null);
  const nb = B.moveByStaff(db, b.id, { startTs: int(body.startTs, 'startTs'), staffId });
  TG.notifyMoved(nb);
  return { booking: bookingView(nb) };
});

/** Ustaning qo'lda bron kiritishi uchun slotlar (minimal ogohlantirishsiz) */
route('GET', '/api/a/:biz/slots', (ctx, { params, q }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const staffId = role === 'master' ? me.id : int(q.get('staff'), 'staff', { min: 1 });
  const date = q.get('date');
  if (!isDate(date)) throw bad('bad_date');
  const serviceIds = idList(q.get('services'));
  const p = B.priceForStaff(db, staffId, serviceIds);
  if (!p) throw bad('staff_cannot_do');
  const exclude = int(q.get('exclude'), 'exclude', { optional: true, min: 1 }) || 0;
  const slots = B.slotsForStaff(db, biz, staffId, date, p.duration, { ignoreNotice: true, ignoreAdvance: true, excludeBookingId: exclude });
  return { slots: slots.map(s => ({ time: `${String(Math.floor(s.min / 60)).padStart(2, '0')}:${String(s.min % 60).padStart(2, '0')}`, ts: s.ts })), duration: p.duration, price: p.price };
});

// ------------------------------------------------------------------ mijozlar
route('GET', '/api/a/:biz/clients', (ctx, { params, q }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const s = '%' + (q.get('q') || '').replace(/[%_]/g, '') + '%';
  const rows = db.prepare(`SELECT c.id, c.name, CASE WHEN c.call_consent = 1 THEN c.phone ELSE '' END phone, c.call_consent consent, c.note, c.blocked, c.visits, c.no_shows, c.user_id,
                                  (SELECT MAX(start_ts) FROM bookings WHERE client_id = c.id AND status = 'completed') last_visit
                           FROM clients c WHERE c.business_id = ? AND (c.name LIKE ? OR (c.call_consent = 1 AND c.phone LIKE ?))
                           ORDER BY c.visits DESC, c.id DESC LIMIT 100`).all(biz.id, s, s);
  return { clients: rows };
});
route('PATCH', '/api/a/:biz/clients/:id', (ctx, { params, body }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager']);
  if (!db.prepare('SELECT 1 FROM clients WHERE id = ? AND business_id = ?').get(Number(params.id), biz.id)) throw notFound();
  const set = {};
  if ('note' in body) set.note = str(body.note, 'note', { max: 500 });
  if ('blocked' in body) set.blocked = bool(body.blocked);
  if ('name' in body) set.name = str(body.name, 'name', { max: 60, min: 1, optional: false });
  if ('phone' in body) set.phone = normPhone(body.phone);
  if (body.blocked === false) set.no_shows = 0;
  const keys = Object.keys(set);
  if (keys.length) db.prepare(`UPDATE clients SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => set[k]), Number(params.id));
  return { ok: true };
});

// ------------------------------------------------------------------ statistika
route('GET', '/api/a/:biz/stats', (ctx, { params, q }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const today = tsToLocal(nowTs(), biz.timezone).date;
  const to = isDate(q.get('to')) ? q.get('to') : today;
  const from = isDate(q.get('from')) ? q.get('from') : addDays(to, -29);
  const a = localToTs(from, 0, biz.timezone), b = localToTs(addDays(to, 1), 0, biz.timezone);
  const sf = role === 'master' ? ' AND staff_id = ' + Number(me.id) : '';
  const base = `FROM bookings WHERE business_id = ? AND start_ts >= ? AND start_ts < ?${sf}`;
  const by = Object.fromEntries(db.prepare(`SELECT status, COUNT(*) c ${base} GROUP BY status`).all(biz.id, a, b).map(r => [r.status, r.c]));
  const revenue = db.prepare(`SELECT COALESCE(SUM(total_price),0) s ${base} AND status = 'completed'`).get(biz.id, a, b).s;
  const upcomingRevenue = db.prepare(`SELECT COALESCE(SUM(total_price),0) s ${base} AND status IN ('pending','confirmed') AND start_ts > ?`).get(biz.id, a, b, nowTs()).s;
  const perStaff = db.prepare(`SELECT s.id, s.name, COUNT(*) bookings, COALESCE(SUM(CASE WHEN b.status='completed' THEN b.total_price END),0) revenue,
                                      SUM(b.status='no_show') no_shows
                               FROM bookings b JOIN staff s ON s.id = b.staff_id WHERE b.business_id = ? AND b.start_ts >= ? AND b.start_ts < ?${role === 'master' ? ' AND b.staff_id = ' + Number(me.id) : ''}
                               GROUP BY s.id ORDER BY revenue DESC`).all(biz.id, a, b);
  const topServices = db.prepare(`SELECT i.name, COUNT(*) c, SUM(i.price) revenue FROM booking_items i JOIN bookings b ON b.id = i.booking_id
                                  WHERE b.business_id = ? AND b.start_ts >= ? AND b.start_ts < ? AND b.status IN ('confirmed','completed')${role === 'master' ? ' AND b.staff_id = ' + Number(me.id) : ''}
                                  GROUP BY i.name ORDER BY c DESC LIMIT 6`).all(biz.id, a, b);
  const days = db.prepare(`SELECT start_ts, status ${base}`).all(biz.id, a, b);
  const perDay = {};
  for (const d of days) { if (['cancelled_client', 'cancelled_staff'].includes(d.status)) continue; const k = tsToLocal(d.start_ts, biz.timezone).date; perDay[k] = (perDay[k] || 0) + 1; }
  const newClients = db.prepare('SELECT COUNT(*) c FROM clients WHERE business_id = ? AND created_at >= ? AND created_at < ?').get(biz.id, a, b).c;
  const done = (by.completed || 0) + (by.no_show || 0);
  return { from, to, by_status: by, revenue, upcoming_revenue: upcomingRevenue, per_staff: perStaff, top_services: topServices, per_day: perDay, new_clients: newClients, no_show_rate: done ? Math.round(((by.no_show || 0) / done) * 1000) / 10 : null };
});

// ------------------------------------------------------------------ rasmlar
const MAGIC = [[Buffer.from([0xff, 0xd8, 0xff]), 'jpg'], [Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'png'], [Buffer.from('RIFF'), 'webp']];
function sniff(buf) {
  for (const [m, ext] of MAGIC) if (buf.subarray(0, m.length).equals(m)) { if (ext === 'webp' && buf.subarray(8, 12).toString() !== 'WEBP') continue; return ext; }
  return null;
}
route('POST', '/api/a/:biz/upload', (ctx, { params, q, raw }) => {
  const target = q.get('target') || '';
  const m = /^(logo|cover|gallery|staff)(?::(\d+))?$/.exec(target);
  if (!m) throw bad('bad_target');
  const bizId = Number(params.biz);
  if (m[1] === 'logo' || m[1] === 'cover') access(ctx, bizId, ['owner']);
  else if (m[1] === 'staff') staffAccess(ctx, bizId, Number(m[2]));
  else access(ctx, bizId, ['owner', 'manager', 'master']);
  if (!raw?.length) throw bad('empty');
  const ext = sniff(raw);
  if (!ext) throw bad('bad_image');
  const name = randomId(12).replace(/[^\w]/g, 'x') + '.' + ext;
  fs.writeFileSync(path.join(config.uploadDir, name), raw);
  const prevSql = { logo: 'SELECT logo f FROM businesses WHERE id = ?', cover: 'SELECT cover f FROM businesses WHERE id = ?' };
  if (m[1] === 'logo' || m[1] === 'cover') {
    const prev = db.prepare(prevSql[m[1]]).get(bizId)?.f;
    db.prepare(`UPDATE businesses SET ${m[1]} = ? WHERE id = ?`).run(name, bizId);
    if (prev) fs.rm(path.join(config.uploadDir, prev), () => {});
  } else if (m[1] === 'staff') {
    const prev = db.prepare('SELECT photo f FROM staff WHERE id = ?').get(Number(m[2]))?.f;
    db.prepare('UPDATE staff SET photo = ? WHERE id = ?').run(name, Number(m[2]));
    if (prev) fs.rm(path.join(config.uploadDir, prev), () => {});
  } else {
    const n = db.prepare('SELECT COUNT(*) c FROM gallery WHERE business_id = ?').get(bizId).c;
    if (n >= 40) throw new HttpError(409, 'gallery_full');
    const { role, me } = access(ctx, bizId, ['owner', 'manager', 'master']);
    db.prepare('INSERT INTO gallery (business_id, staff_id, file, created_at) VALUES (?,?,?,?)').run(bizId, role === 'master' ? me.id : (m[2] ? Number(m[2]) : null), name, nowTs());
  }
  return { url: url(name) };
});
route('DELETE', '/api/a/:biz/gallery/:id', (ctx, { params }) => {
  const { biz, role, me } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  const g = db.prepare('SELECT * FROM gallery WHERE id = ? AND business_id = ?').get(Number(params.id), biz.id);
  if (!g) throw notFound();
  if (role === 'master' && g.staff_id !== me.id) throw forbidden();
  db.prepare('DELETE FROM gallery WHERE id = ?').run(g.id);
  fs.rm(path.join(config.uploadDir, g.file), () => {});
  return { ok: true };
});
route('GET', '/api/a/:biz/gallery', (ctx, { params }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager', 'master']);
  return { gallery: db.prepare('SELECT id, file, staff_id FROM gallery WHERE business_id = ? ORDER BY id DESC').all(biz.id).map(g => ({ ...g, url: url(g.file) })) };
});

// ------------------------------------------------------------------ platforma administratori
route('GET', '/api/admin/overview', ctx => {
  if (!ctx.isAdmin) throw forbidden();
  const now = nowTs(), d30 = now - 30 * 86400, d7 = now - 7 * 86400;
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const totals = {
    users: one('SELECT COUNT(*) c FROM users').c,
    businesses: one('SELECT COUNT(*) c FROM businesses').c,
    paying: one('SELECT COUNT(*) c FROM businesses WHERE paid_until > ?', now).c,
    trial: one('SELECT COUNT(*) c FROM businesses WHERE COALESCE(paid_until,0) <= ? AND trial_ends > ?', now, now).c,
    expired: one('SELECT COUNT(*) c FROM businesses WHERE COALESCE(paid_until,0) <= ? AND COALESCE(trial_ends,0) <= ?', now, now).c,
    bots: one('SELECT COUNT(*) c FROM bots WHERE active = 1').c,
    staff: one('SELECT COUNT(*) c FROM staff WHERE active = 1').c,
    clients: one('SELECT COUNT(*) c FROM clients').c,
    bookings_total: one('SELECT COUNT(*) c FROM bookings').c,
    bookings_30: one('SELECT COUNT(*) c FROM bookings WHERE created_at >= ?', d30).c,
    bookings_7: one('SELECT COUNT(*) c FROM bookings WHERE created_at >= ?', d7).c,
    gmv_30: one("SELECT COALESCE(SUM(total_price),0) s FROM bookings WHERE status = 'completed' AND start_ts >= ?", d30).s,
    revenue_30: one('SELECT COALESCE(SUM(amount),0) s FROM payments WHERE created_at >= ?', d30).s,
    revenue_total: one('SELECT COALESCE(SUM(amount),0) s FROM payments').s,
    leads_new: one("SELECT COUNT(*) c FROM leads WHERE status = 'new'").c,
    leads_total: one('SELECT COUNT(*) c FROM leads').c,
    feedback_new: one("SELECT COUNT(*) c FROM feedback WHERE status = 'new'").c,
    feedback_avg: one('SELECT AVG(rating) a FROM feedback WHERE rating IS NOT NULL').a,
  };
  // oxirgi 30 kun (Toshkent vaqti bo'yicha): kunlik bronlar va yangi bizneslar
  const day = col => Object.fromEntries(db.prepare(`SELECT strftime('%Y-%m-%d', ${col} + 18000, 'unixepoch') d, COUNT(*) c FROM ${col === 'b.created_at' ? 'bookings b' : 'businesses'}
    WHERE ${col === 'b.created_at' ? 'b.created_at' : 'created_at'} >= ? GROUP BY d`).all(d30).map(r => [r.d, r.c]));
  const perBook = day('b.created_at'), perBiz = day('created_at');
  const today = tsToLocal(now, 'Asia/Tashkent').date;
  const series = Array.from({ length: 30 }, (_x, i) => { const d = addDays(today, i - 29); return { date: d, bookings: perBook[d] || 0, businesses: perBiz[d] || 0 }; });
  const rows = db.prepare(`SELECT b.id, b.name, b.status, b.created_at, b.trial_ends, b.paid_until, b.claim_code, b.plan_id, (SELECT name FROM plans WHERE id = b.plan_id) plan_name, u.first_name owner, u.username owner_username,
      (SELECT COUNT(*) FROM bookings WHERE business_id = b.id AND created_at >= ?) bookings_30,
      (SELECT COUNT(*) FROM bookings WHERE business_id = b.id) bookings_total,
      (SELECT COUNT(*) FROM staff WHERE business_id = b.id AND active = 1) staff,
      (SELECT COUNT(*) FROM bots WHERE business_id = b.id) bots,
      (SELECT MAX(created_at) FROM bookings WHERE business_id = b.id) last_booking
    FROM businesses b JOIN users u ON u.id = b.owner_id ORDER BY b.id DESC LIMIT 300`).all(d30)
    .map(r => ({ ...r, state: r.paid_until > now ? 'paid' : r.trial_ends > now ? 'trial' : 'expired', until: Math.max(r.paid_until || 0, r.trial_ends || 0) }));
  return { totals, series, businesses: rows, now, platform_bot_username: TG.getLive(TG.PLATFORM)?.bot.botInfo?.username || null };
});

// ------------------------------------------------------------------ sotuv ofisi: ulanish so'rovi va fikr-mulohaza
route('POST', '/api/p/lead', (ctx, { body }) => {
  if (body.consent !== true) throw bad('consent_required');
  const phone = normPhone(body.phone);
  if (!phone) throw bad('invalid_phone');
  const recent = db.prepare('SELECT COUNT(*) c FROM leads WHERE user_id = ? AND created_at > ?').get(ctx.user.id, nowTs() - 86400).c;
  if (recent >= 3) throw new HttpError(429, 'too_many_requests');
  const name = str(body.name, 'name', { max: 60, min: 1, optional: false });
  const bizName = str(body.business_name, 'business_name', { max: 80 });
  const city = body.city_id ? db.prepare('SELECT * FROM cities WHERE id = ?').get(Number(body.city_id)) : null;
  const message = str(body.message, 'message', { max: 500 });
  const r = db.prepare('INSERT INTO leads (user_id, name, phone, business_name, city_id, message, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(ctx.user.id, name, phone, bizName, city?.id ?? null, message, nowTs());
  db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, ctx.user.id);
  TG.notifyAdmins(`🆕 <b>Yangi ulanish so'rovi</b>\n👤 ${esc(name)} ${esc(phone)}${ctx.user.username ? ' (@' + esc(ctx.user.username) + ')' : ''}\n🏪 ${esc(bizName) || '—'}${city ? ' · ' + esc(city.name_uz) : ''}${message ? '\n💬 ' + esc(message) : ''}`, '/admin/leads');
  return { id: Number(r.lastInsertRowid) };
});

route('POST', '/api/feedback', (ctx, { body }) => {
  const text = str(body.text, 'text', { max: 1000, min: 3, optional: false });
  const kind = ['idea', 'bug', 'praise', 'other'].includes(body.kind) ? body.kind : 'idea';
  const rating = body.rating ? int(body.rating, 'rating', { min: 1, max: 5 }) : null;
  const recent = db.prepare('SELECT COUNT(*) c FROM feedback WHERE user_id = ? AND created_at > ?').get(ctx.user.id, nowTs() - 86400).c;
  if (recent >= 10) throw new HttpError(429, 'too_many_requests');
  let bizId = null;
  if (body.business_id) { access(ctx, Number(body.business_id)); bizId = Number(body.business_id); }
  db.prepare('INSERT INTO feedback (user_id, business_id, kind, rating, text, created_at) VALUES (?,?,?,?,?,?)').run(ctx.user.id, bizId, kind, rating, text, nowTs());
  const biz = bizId ? db.prepare('SELECT name FROM businesses WHERE id = ?').get(bizId) : null;
  TG.notifyAdmins(`💬 <b>Yangi fikr</b>${rating ? ' · ' + '★'.repeat(rating) : ''}\n${esc([ctx.user.first_name, ctx.user.last_name].filter(Boolean).join(' '))}${biz ? ' · ' + esc(biz.name) : ''}\n${esc(text)}`, '/admin/feedback');
  return { ok: true };
});

route('GET', '/api/admin/leads', (ctx, { q }) => {
  if (!ctx.isAdmin) throw forbidden();
  const st = q.get('status');
  const rows = db.prepare(`SELECT l.*, c.name_uz city, u.username, u.tg_id FROM leads l LEFT JOIN cities c ON c.id = l.city_id JOIN users u ON u.id = l.user_id
    ${st ? 'WHERE l.status = ?' : ''} ORDER BY l.created_at DESC LIMIT 200`).all(...(st ? [st] : []));
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM leads GROUP BY status').all().map(r => [r.status, r.c]));
  return { leads: rows, counts };
});
route('PATCH', '/api/admin/leads/:id', (ctx, { params, body }) => {
  if (!ctx.isAdmin) throw forbidden();
  const set = {};
  if ('status' in body && ['new', 'contacted', 'progress', 'done', 'rejected'].includes(body.status)) set.status = body.status;
  if ('note' in body) set.note = str(body.note, 'note', { max: 500 });
  const keys = Object.keys(set);
  if (keys.length) db.prepare(`UPDATE leads SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => set[k]), Number(params.id));
  return { ok: true };
});
route('GET', '/api/admin/feedback', (ctx, { q }) => {
  if (!ctx.isAdmin) throw forbidden();
  const st = q.get('status');
  const rows = db.prepare(`SELECT f.*, u.first_name, u.last_name, u.username, b.name business FROM feedback f JOIN users u ON u.id = f.user_id LEFT JOIN businesses b ON b.id = f.business_id
    ${st ? 'WHERE f.status = ?' : ''} ORDER BY f.created_at DESC LIMIT 200`).all(...(st ? [st] : []));
  const counts = Object.fromEntries(db.prepare('SELECT status, COUNT(*) c FROM feedback GROUP BY status').all().map(r => [r.status, r.c]));
  return { feedback: rows, counts };
});
route('PATCH', '/api/admin/feedback/:id', (ctx, { params, body }) => {
  if (!ctx.isAdmin) throw forbidden();
  if (['new', 'seen'].includes(body.status)) db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(body.status, Number(params.id));
  return { ok: true };
});

// ------------------------------------------------------------------ tariflar va obuna
route('GET', '/api/plans', () => ({ plans: listPlans(db), payment_note: getSetting(db, 'payment_note'), support_contact: getSetting(db, 'support_contact') }));

route('GET', '/api/a/:biz/subscription', (ctx, { params }) => {
  const { biz } = access(ctx, Number(params.biz), ['owner', 'manager']);
  return { subscription: subscriptionOf(db, biz), staff: staffLimit(db, biz), plans: listPlans(db), payment_note: getSetting(db, 'payment_note'), support_contact: getSetting(db, 'support_contact') };
});

route('GET', '/api/admin/plans', ctx => { if (!ctx.isAdmin) throw forbidden(); return { plans: listPlans(db, false), payment_note: getSetting(db, 'payment_note'), support_contact: getSetting(db, 'support_contact') }; });
route('POST', '/api/admin/plans', (ctx, { body }) => {
  if (!ctx.isAdmin) throw forbidden();
  const r = db.prepare('INSERT INTO plans (name, price, max_staff, sort) VALUES (?,?,?,(SELECT COALESCE(MAX(sort),0)+1 FROM plans))')
    .run(str(body.name, 'name', { max: 40, min: 1, optional: false }), int(body.price ?? 0, 'price', { min: 0, max: 1e10 }), int(body.max_staff ?? 0, 'max_staff', { min: 0, max: 1000 }));
  return { id: Number(r.lastInsertRowid) };
});
route('PATCH', '/api/admin/plans/:id', (ctx, { params, body }) => {
  if (!ctx.isAdmin) throw forbidden();
  const set = {};
  if ('name' in body) set.name = str(body.name, 'name', { max: 40, min: 1, optional: false });
  if ('price' in body) set.price = int(body.price, 'price', { min: 0, max: 1e10 });
  if ('max_staff' in body) set.max_staff = int(body.max_staff, 'max_staff', { min: 0, max: 1000 });
  if ('active' in body) set.active = bool(body.active);
  const keys = Object.keys(set);
  if (keys.length) db.prepare(`UPDATE plans SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => set[k]), Number(params.id));
  return { ok: true };
});
route('PUT', '/api/admin/settings', (ctx, { body }) => {
  if (!ctx.isAdmin) throw forbidden();
  if ('payment_note' in body) setSetting(db, 'payment_note', str(body.payment_note, 'payment_note', { max: 500 }));
  if ('support_contact' in body) setSetting(db, 'support_contact', str(body.support_contact, 'support_contact', { max: 100 }));
  return { ok: true };
});
route('PATCH', '/api/admin/businesses/:id/plan', (ctx, { params, body }) => {
  if (!ctx.isAdmin) throw forbidden();
  const plan = body.plan_id ? db.prepare('SELECT id FROM plans WHERE id = ?').get(Number(body.plan_id)) : null;
  if (body.plan_id && !plan) throw bad('invalid_plan');
  db.prepare('UPDATE businesses SET plan_id = ? WHERE id = ?').run(plan?.id ?? null, Number(params.id));
  return { ok: true };
});

route('POST', '/api/admin/businesses/:id/extend', (ctx, { params, body }) => {
  if (!ctx.isAdmin) throw forbidden();
  const biz = db.prepare('SELECT * FROM businesses WHERE id = ?').get(Number(params.id));
  if (!biz) throw notFound();
  const days = int(body.days, 'days', { min: 1, max: 3650 });
  const plan = body.plan_id ? db.prepare('SELECT id FROM plans WHERE id = ?').get(Number(body.plan_id)) : null;
  if (body.plan_id && !plan) throw bad('invalid_plan');
  const amount = int(body.amount ?? 0, 'amount', { min: 0, max: 1e10 });
  const now = nowTs();
  const from = Math.max(now, biz.paid_until || 0);
  const until = from + days * 86400;
  tx(db, () => {
    db.prepare('UPDATE businesses SET paid_until = ?, plan_id = COALESCE(?, plan_id) WHERE id = ?').run(until, plan?.id ?? null, biz.id);
    db.prepare('INSERT INTO payments (business_id, amount, days, note, created_at) VALUES (?,?,?,?,?)').run(biz.id, amount, days, str(body.note, 'note', { max: 200 }), now);
  });
  return { paid_until: until };
});

route('PATCH', '/api/admin/businesses/:id', (ctx, { params, body }) => {
  if (!ctx.isAdmin) throw forbidden();
  const set = {};
  if ('status' in body && ['active', 'paused', 'blocked'].includes(body.status)) set.status = body.status;
  if ('paid_until' in body) set.paid_until = body.paid_until === null ? null : int(body.paid_until, 'paid_until', { min: 0 });
  if ('trial_ends' in body) set.trial_ends = body.trial_ends === null ? null : int(body.trial_ends, 'trial_ends', { min: 0 });
  const keys = Object.keys(set);
  if (keys.length) db.prepare(`UPDATE businesses SET ${keys.map(k => k + ' = ?').join(', ')} WHERE id = ?`).run(...keys.map(k => set[k]), Number(params.id));
  return { ok: true };
});

// ------------------------------------------------------------------ kirish nuqtasi
export async function handleApi(req, res, urlObj, readBody) {
  const send = (status, obj) => {
    const data = JSON.stringify(obj);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(data);
  };
  try {
    const method = req.method;
    let matched = null, params = {};
    for (const [m, re, h] of R) {
      if (m !== method) continue;
      const mm = re.exec(urlObj.pathname);
      if (mm) { matched = h; params = mm.groups || {}; break; }
    }
    if (!matched) return send(404, { error: 'not_found' });
    const ctx = authenticate(req);
    const isUpload = urlObj.pathname.endsWith('/upload');
    const payload = await readBody(req, isUpload ? config.maxUploadBytes : 100 * 1024);
    let body = {}, raw = null;
    if (isUpload) raw = payload;
    else if (payload.length) { try { body = JSON.parse(payload.toString('utf8')); } catch { throw bad('bad_json'); } }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) body = {};
    const out = await matched(ctx, { params, q: urlObj.searchParams, body, raw });
    send(200, out ?? { ok: true });
  } catch (e0) {
    const e = mapErr(e0);
    if (e instanceof HttpError) return send(e.status, { error: e.code, ...e.extra });
    console.error('[api]', e0);
    send(500, { error: 'server_error' });
  }
}
