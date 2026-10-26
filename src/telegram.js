// Telegram qatlami: platforma boti + har bir biznesning o'z botlari (webhook yoki polling),
// bildirishnomalar va eslatmalar.
import crypto from 'node:crypto';
import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { config } from './config.js';
import { db } from './db.js';
import { encrypt, decrypt, randomId } from './crypto.js';
import { t, normLang, fmtWhen, fmtPrice, esc } from './i18n.js';
import { nowTs } from './time.js';
import * as B from './booking.js';
import { claimBusiness } from './biz.js';
import { runSubscriptionNotices } from './subscriptions.js';

const live = new Map(); // key -> { key, bot, row }
export const PLATFORM = 'platform';
const TOKEN_RE = /^\d{6,}:[\w-]{30,}$/;
const httpsApp = () => config.publicUrl.startsWith('https://');

export const botKey = row => (row ? 'b' + row.id : PLATFORM);
export const appUrl = (key, extra = '') => `${config.publicUrl}/app/?b=${key === PLATFORM ? 'platform' : key.slice(1)}${extra}`;
const platformSecret = () => crypto.createHmac('sha256', config.secret).update('platform-webhook').digest('hex').slice(0, 40);

export function getLive(key) { return live.get(key); }
export function botToken(key) {
  if (key === PLATFORM) return config.platformToken;
  const row = db.prepare('SELECT token_enc FROM bots WHERE id = ? AND active = 1').get(Number(key.slice(1)));
  return row ? decrypt(row.token_enc) : null;
}
export function webhookSecretFor(key) {
  if (key === PLATFORM) return platformSecret();
  return db.prepare('SELECT webhook_secret s FROM bots WHERE id = ?').get(Number(key.slice(1)))?.s;
}

// ---------------------------------------------------------------- foydalanuvchilar
export function upsertUser(from) {
  const now = nowTs();
  const ex = db.prepare('SELECT * FROM users WHERE tg_id = ?').get(from.id);
  if (ex) {
    db.prepare('UPDATE users SET first_name = ?, last_name = ?, username = ? WHERE id = ?')
      .run(from.first_name || '', from.last_name || '', from.username || '', ex.id);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(ex.id);
  }
  const r = db.prepare('INSERT INTO users (tg_id, first_name, last_name, username, lang, created_at) VALUES (?,?,?,?,?,?)')
    .run(from.id, from.first_name || '', from.last_name || '', from.username || '', normLang(from.language_code), now);
  return db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
}

function touchUserBot(userId, key) {
  const botId = key === PLATFORM ? 0 : Number(key.slice(1));
  db.prepare(`INSERT INTO user_bots (user_id, bot_id, can_msg, last_seen) VALUES (?,?,1,?)
              ON CONFLICT(user_id, bot_id) DO UPDATE SET can_msg = 1, last_seen = excluded.last_seen`).run(userId, botId, nowTs());
}

export const displayName = u => [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Mijoz';

// ---------------------------------------------------------------- yuborish
export async function sendTo(key, tgId, text, extra = {}) {
  const l = live.get(key);
  if (!l) return false;
  try {
    await l.bot.api.sendMessage(tgId, text, { parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...extra });
    return true;
  } catch (e) {
    if (e?.error_code === 403 || e?.error_code === 400) {
      const u = db.prepare('SELECT id FROM users WHERE tg_id = ?').get(tgId);
      if (u) db.prepare('UPDATE user_bots SET can_msg = 0 WHERE user_id = ? AND bot_id = ?').run(u.id, key === PLATFORM ? 0 : Number(key.slice(1)));
    } else console.error('[tg] send failed', key, e?.message);
    return false;
  }
}

/** Foydalanuvchiga xabar: avval berilgan botlar, so'ng u yozgan boshqa botlar (can_msg=1) */
export async function deliver(userId, text, extra = {}, preferKeys = []) {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!u) return false;
  const ok = new Set(db.prepare('SELECT bot_id FROM user_bots WHERE user_id = ? AND can_msg = 1').all(userId).map(r => (r.bot_id ? 'b' + r.bot_id : PLATFORM)));
  const order = [...preferKeys, ...ok].filter((k, i, a) => a.indexOf(k) === i && ok.has(k) && live.has(k));
  for (const k of order) if (await sendTo(k, u.tg_id, text, extra)) return true;
  return false;
}

// ---------------------------------------------------------------- klaviaturalar
function webAppKb(key, text, extra = '') {
  if (!httpsApp()) return undefined;
  return new InlineKeyboard().webApp(text, appUrl(key, extra));
}

function staffActionKb(lang, b) {
  const kb = new InlineKeyboard();
  if (b.status === 'pending') kb.text(t(lang, 'btn.confirm'), `bk:confirmed:${b.id}`).text(t(lang, 'btn.decline'), `bk:cancelled_staff:${b.id}`);
  else if (b.status === 'confirmed') kb.text(t(lang, 'btn.done'), `bk:completed:${b.id}`).text(t(lang, 'btn.noshow'), `bk:no_show:${b.id}`).row().text(t(lang, 'btn.cancel'), `bk:cancelled_staff:${b.id}`);
  return kb;
}

/** Platforma egalariga (ADMIN_TG_IDS) xabar; tugma bosilganda dashboardning kerakli sahifasi ochiladi */
export async function notifyAdmins(text, go = '/admin') {
  const kb = webAppKb(PLATFORM, 'Dashboard', `&go=${encodeURIComponent(go)}`);
  for (const id of config.adminIds) await sendTo(PLATFORM, id, text, kb ? { reply_markup: kb } : {});
}

// ---------------------------------------------------------------- bildirishnomalar
function ctxFor(booking) {
  const biz = B.getBusiness(db, booking.business_id);
  const staff = db.prepare('SELECT * FROM staff WHERE id = ?').get(booking.staff_id);
  const client = db.prepare('SELECT c.*, u.id uid, u.lang ulang FROM clients c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(booking.client_id);
  return { biz, staff, client };
}

const servicesText = b => b.items.map(i => esc(i.name)).join(', ');
const botKeyOfBooking = b => (b.bot_id ? 'b' + b.bot_id : null);

/** Mijoz va usta/egasiga yangi bron haqida xabar */
export async function notifyCreated(booking) {
  try {
    const { biz, staff, client } = ctxFor(booking);
    const vars = l => ({ biz: esc(biz.name), staff: esc(staff.name), when: fmtWhen(booking.start_ts, biz.timezone, l), services: servicesText(booking), price: fmtPrice(booking.total_price, biz.currency) });
    if (client.uid) {
      const l = client.ulang || 'uz';
      await deliver(client.uid, t(l, booking.status === 'pending' ? 'bk.client.pending' : 'bk.client.created', vars(l)), {}, [botKeyOfBooking(booking)].filter(Boolean));
    }
    const rcpt = new Set();
    if (staff.user_id) rcpt.add(staff.user_id); else rcpt.add(biz.owner_id);
    if (booking.source !== 'manual') for (const uid of rcpt) {
      if (uid === client.uid) continue;
      const u = db.prepare('SELECT lang FROM users WHERE id = ?').get(uid);
      const l = u?.lang || 'uz';
      const txt = t(l, 'bk.staff.new', { ...vars(l), client: esc(client.name), phone: client.call_consent ? esc(client.phone) : '', note: booking.note ? '📝 ' + esc(booking.note) : '' });
      await deliver(uid, txt, { reply_markup: staffActionKb(l, booking) }, [PLATFORM, botKeyOfBooking(booking)].filter(Boolean));
    }
  } catch (e) { console.error('[notifyCreated]', e); }
}

export async function notifyClientStatus(booking) {
  try {
    const { biz, staff, client } = ctxFor(booking);
    if (!client.uid) return;
    const l = client.ulang || 'uz';
    const vars = { staff: esc(staff.name), when: fmtWhen(booking.start_ts, biz.timezone, l) };
    const keys = [botKeyOfBooking(booking)].filter(Boolean);
    if (booking.status === 'confirmed') await deliver(client.uid, t(l, 'bk.client.confirmed', vars), {}, keys);
    else if (booking.status === 'cancelled_staff') await deliver(client.uid, t(l, 'bk.client.cancelled_staff', vars), {}, keys);
    else if (booking.status === 'completed') {
      const kb = new InlineKeyboard();
      for (let i = 1; i <= 5; i++) kb.text(`⭐${i}`, `rv:${booking.id}:${i}`);
      await deliver(client.uid, t(l, 'bk.review'), { reply_markup: kb }, keys);
    }
  } catch (e) { console.error('[notifyClientStatus]', e); }
}

export async function notifyStaffChange(booking, kind) { // 'cancelled' | 'moved'
  try {
    const { biz, staff, client } = ctxFor(booking);
    const uid = staff.user_id || biz.owner_id;
    const u = db.prepare('SELECT lang FROM users WHERE id = ?').get(uid);
    const l = u?.lang || 'uz';
    await deliver(uid, t(l, kind === 'cancelled' ? 'bk.staff.cancelled' : 'bk.staff.moved', { client: esc(client.name), when: fmtWhen(booking.start_ts, biz.timezone, l) }), {}, [PLATFORM]);
  } catch (e) { console.error('[notifyStaffChange]', e); }
}

export async function notifyMoved(booking) {
  try {
    const { biz, staff, client } = ctxFor(booking);
    if (client.uid) {
      const l = client.ulang || 'uz';
      await deliver(client.uid, t(l, 'bk.client.moved', { staff: esc(staff.name), when: fmtWhen(booking.start_ts, biz.timezone, l) }), {}, [botKeyOfBooking(booking)].filter(Boolean));
    }
    await notifyStaffChange(booking, 'moved');
  } catch (e) { console.error('[notifyMoved]', e); }
}

/** Eslatmalar ishchisi (har 30 soniyada) */
export async function runReminders(now = nowTs()) {
  const due = db.prepare(`SELECT r.id rid, r.booking_id FROM reminders r JOIN bookings b ON b.id = r.booking_id
                          WHERE r.sent = 0 AND r.send_at <= ? AND b.status IN ('pending','confirmed') AND b.start_ts > ? LIMIT 50`).all(now, now);
  for (const r of due) {
    db.prepare('UPDATE reminders SET sent = 1 WHERE id = ?').run(r.rid); // oldin belgilaymiz: ikki marta yuborilmasin
    try {
      const b = B.getBooking(db, r.booking_id);
      const { biz, staff, client } = ctxFor(b);
      if (!client.uid) continue;
      const l = client.ulang || 'uz';
      const addr = [biz.address, biz.landmark].filter(Boolean).join(', ') || biz.name;
      await deliver(client.uid, t(l, 'bk.reminder', { when: fmtWhen(b.start_ts, biz.timezone, l), staff: esc(staff.name), addr: esc(addr) }), {}, [botKeyOfBooking(b)].filter(Boolean));
    } catch (e) { console.error('[reminder]', e); }
  }
  db.prepare('DELETE FROM reminders WHERE sent = 1 AND send_at < ?').run(now - 7 * 86400);
}

// ---------------------------------------------------------------- umumiy handlerlar (ikkala bot turi uchun)
function installCommon(bot, key) {
  bot.use(async (ctx, next) => {
    if (ctx.from && !ctx.from.is_bot) {
      ctx.user = upsertUser(ctx.from);
      touchUserBot(ctx.user.id, key);
      ctx.lang = ctx.user.lang || 'uz';
    }
    return next();
  });

  bot.command('lang', async ctx => {
    const next = ctx.lang === 'uz' ? 'ru' : 'uz';
    db.prepare('UPDATE users SET lang = ? WHERE id = ?').run(next, ctx.user.id);
    await ctx.reply(t(next, 'lang.set'));
  });

  // Usta/egasi: bron holatini tugmalar orqali o'zgartirish
  bot.callbackQuery(/^bk:(\w+):(\d+)$/, async ctx => {
    const [, status, id] = ctx.match;
    const b = B.getBooking(db, Number(id));
    if (!b) return ctx.answerCallbackQuery({ text: '—' });
    const biz = B.getBusiness(db, b.business_id);
    const me = db.prepare('SELECT * FROM staff WHERE business_id = ? AND user_id = ? AND active = 1').get(biz.id, ctx.user.id);
    const allowed = biz.owner_id === ctx.user.id || me?.role === 'manager' || me?.id === b.staff_id;
    if (!allowed) return ctx.answerCallbackQuery({ text: '⛔' });
    try {
      const nb = B.changeStatus(db, b.id, status);
      await ctx.answerCallbackQuery({ text: t(ctx.lang, 'bk.status.done', { s: t(ctx.lang, 'st.' + nb.status) }) });
      await ctx.editMessageReplyMarkup({ reply_markup: staffActionKb(ctx.lang, nb) }).catch(() => {});
      notifyClientStatus(nb);
    } catch (e) {
      await ctx.answerCallbackQuery({ text: e.code || t(ctx.lang, 'err.generic') });
    }
  });

  // Mijoz bahosi
  bot.callbackQuery(/^rv:(\d+):([1-5])$/, async ctx => {
    const b = B.getBooking(db, Number(ctx.match[1]));
    const client = b && db.prepare('SELECT * FROM clients WHERE id = ?').get(b.client_id);
    if (!b || client?.user_id !== ctx.user.id || b.status !== 'completed') return ctx.answerCallbackQuery();
    db.prepare(`INSERT INTO reviews (booking_id, business_id, staff_id, rating, created_at) VALUES (?,?,?,?,?)
                ON CONFLICT(booking_id) DO UPDATE SET rating = excluded.rating`).run(b.id, b.business_id, b.staff_id, Number(ctx.match[2]), nowTs());
    await ctx.answerCallbackQuery({ text: t(ctx.lang, 'bk.review.thanks') });
    await ctx.editMessageText(t(ctx.lang, 'bk.review.thanks')).catch(() => {});
  });

  bot.catch(err => console.error(`[bot ${key}]`, err.error?.message || err.message));
}

// ---------------------------------------------------------------- biznes (tenant) boti
function installTenant(bot, key, row) {
  const biz = () => B.getBusiness(db, row.business_id);
  const roleOf = (u) => {
    const b = biz();
    if (b.owner_id === u.id) return 'owner';
    return db.prepare('SELECT role FROM staff WHERE business_id = ? AND user_id = ? AND active = 1').get(b.id, u.id)?.role || null;
  };

  bot.command('start', async ctx => {
    const b = biz();
    const staff = row.staff_id ? db.prepare('SELECT * FROM staff WHERE id = ?').get(row.staff_id) : null;
    const text = staff
      ? t(ctx.lang, 'start.staff', { staff: esc(staff.name), name: esc(b.name) })
      : t(ctx.lang, 'start.client', { name: esc(b.name), desc: esc(b.description) });
    const kb = webAppKb(key, t(ctx.lang, 'btn.book'));
    if (kb && roleOf(ctx.user)) kb.row().webApp(t(ctx.lang, 'btn.admin'), appUrl(key, '&admin=1'));
    if (!kb) return ctx.reply(text + `\n\n${appUrl(key)}`, { parse_mode: 'HTML' });
    return ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
  });

  bot.command('my', async ctx => {
    const client = db.prepare('SELECT id FROM clients WHERE business_id = ? AND user_id = ?').get(row.business_id, ctx.user.id);
    const list = client ? db.prepare(`SELECT b.id FROM bookings b WHERE b.client_id = ? AND b.status IN ('pending','confirmed') AND b.end_ts > ? ORDER BY b.start_ts`).all(client.id, nowTs()) : [];
    if (!list.length) return ctx.reply(t(ctx.lang, 'my.none'));
    const b0 = biz();
    await ctx.reply(t(ctx.lang, 'my.title'));
    for (const { id } of list) {
      const b = B.getBooking(db, id);
      const kb = new InlineKeyboard().text(t(ctx.lang, 'btn.cancel'), `cb:${b.id}`);
      await ctx.reply(`🗓 ${fmtWhen(b.start_ts, b0.timezone, ctx.lang)}\n👤 ${esc(b.staff_name)}\n💈 ${servicesText(b)}\n💵 ${fmtPrice(b.total_price, b0.currency)}\n${t(ctx.lang, 'st.' + b.status)}`, { parse_mode: 'HTML', reply_markup: kb });
    }
  });

  bot.callbackQuery(/^cb:(\d+)$/, async ctx => {
    const client = db.prepare('SELECT id FROM clients WHERE business_id = ? AND user_id = ?').get(row.business_id, ctx.user.id);
    try {
      const nb = B.cancelByClient(db, Number(ctx.match[1]), client?.id ?? -1);
      await ctx.answerCallbackQuery({ text: t(ctx.lang, 'st.cancelled_client') });
      await ctx.editMessageText(t(ctx.lang, 'st.cancelled_client')).catch(() => {});
      notifyStaffChange(nb, 'cancelled');
    } catch (e) {
      await ctx.answerCallbackQuery({ text: e.code === 'too_late' ? `⏳ ${Math.round(Number(e.message) / 60)}h` : t(ctx.lang, 'err.generic'), show_alert: true });
    }
  });

  const sendLocation = async ctx => {
    const b = biz();
    const addr = [b.address, b.landmark].filter(Boolean).join('\n');
    if (b.lat != null && b.lng != null) await ctx.replyWithLocation(b.lat, b.lng);
    await ctx.reply([`<b>${esc(b.name)}</b>`, esc(addr) || t(ctx.lang, 'loc.none'), b.phone ? '📞 ' + esc(b.phone) : '', b.instagram ? '📷 ' + esc(b.instagram) : ''].filter(Boolean).join('\n'), { parse_mode: 'HTML' });
  };
  bot.command('location', sendLocation);
  bot.command('contacts', sendLocation);

  bot.command('book', async ctx => {
    const kb = webAppKb(key, t(ctx.lang, 'btn.book'));
    await ctx.reply(kb ? t(ctx.lang, 'btn.book') : appUrl(key), kb ? { reply_markup: kb } : {});
  });

  bot.on('message', ctx => {
    const kb = webAppKb(key, t(ctx.lang, 'btn.book'));
    return ctx.reply(kb ? t(ctx.lang, 'btn.book') + ' 👇' : appUrl(key), kb ? { reply_markup: kb } : {});
  });
}

// ---------------------------------------------------------------- platforma ("sotuvchi") boti
function getState(tgId, botId = 0) {
  const r = db.prepare('SELECT state, data FROM chat_state WHERE tg_id = ? AND bot_id = ?').get(tgId, botId);
  return r ? { state: r.state, data: JSON.parse(r.data || '{}') } : null;
}
function setState(tgId, state, data = {}) {
  db.prepare(`INSERT INTO chat_state (tg_id, bot_id, state, data, updated_at) VALUES (?,0,?,?,?)
              ON CONFLICT(tg_id, bot_id) DO UPDATE SET state = excluded.state, data = excluded.data, updated_at = excluded.updated_at`).run(tgId, state, JSON.stringify(data), nowTs());
}
const clearState = tgId => db.prepare('DELETE FROM chat_state WHERE tg_id = ? AND bot_id = 0').run(tgId);

/** Ustani taklif havolasi orqali jamoaga ulash */
export function acceptInvite(user, code) {
  const s = db.prepare('SELECT * FROM staff WHERE invite_code = ? AND user_id IS NULL AND active = 1').get(code);
  if (!s) return null;
  const taken = db.prepare('SELECT 1 FROM staff WHERE business_id = ? AND user_id = ?').get(s.business_id, user.id);
  if (taken) return null;
  db.prepare('UPDATE staff SET user_id = ?, invite_code = NULL WHERE id = ?').run(user.id, s.id);
  return db.prepare('SELECT * FROM staff WHERE id = ?').get(s.id);
}

function installPlatform(bot) {
  bot.command('start', async ctx => {
    clearState(ctx.from.id);
    const payload = (ctx.match || '').trim();
    if (payload.startsWith('inv_')) {
      const s = acceptInvite(ctx.user, payload.slice(4));
      if (!s) return ctx.reply(t(ctx.lang, 'invite.bad'));
      const biz = B.getBusiness(db, s.business_id);
      await ctx.reply(t(ctx.lang, 'invite.ok', { biz: esc(biz.name), staff: esc(s.name) }), { parse_mode: 'HTML', reply_markup: webAppKb(PLATFORM, t(ctx.lang, 'btn.open')) });
      const owner = db.prepare('SELECT lang FROM users WHERE id = ?').get(biz.owner_id);
      await deliver(biz.owner_id, t(owner?.lang || 'uz', 'invite.owner', { user: esc(displayName(ctx.user)), staff: esc(s.name) }), {}, [PLATFORM]);
      return;
    }
    if (payload.startsWith('own_')) {
      const b = claimBusiness(db, ctx.user, payload.slice(4));
      if (!b) return ctx.reply(t(ctx.lang, 'claim.bad'));
      const adminKb = webAppKb(PLATFORM, t(ctx.lang, 'btn.connect'), `&go=${encodeURIComponent('/a/' + b.id + '/bot')}`);
      await ctx.reply(t(ctx.lang, 'claim.ok', { biz: esc(b.name) }), { parse_mode: 'HTML', reply_markup: adminKb });
      await notifyAdmins(`✅ ${esc(displayName(ctx.user))}${ctx.user.username ? ' (@' + ctx.user.username + ')' : ''} «${esc(b.name)}» biznesini qabul qildi.`);
      return;
    }
    const kb = webAppKb(PLATFORM, t(ctx.lang, 'btn.open'));
    await ctx.reply(t(ctx.lang, 'platform.sales') + (kb ? '' : `\n\n${appUrl(PLATFORM)}`), { parse_mode: 'HTML', reply_markup: kb });
  });
  bot.command('help', ctx => ctx.reply(t(ctx.lang, 'platform.help')));

  // Ilovadan "botni bot orqali ulash" bosilganda holat o'rnatiladi; egasi tokenni shu yerga tashlaydi
  bot.on('message:text', async ctx => {
    const text = ctx.message.text.trim();
    if (!TOKEN_RE.test(text)) return ctx.reply(t(ctx.lang, 'platform.help'));
    const st = getState(ctx.from.id);
    let target = st?.state === 'await_token' ? st.data : null;
    if (!target) {
      const mine = db.prepare('SELECT id FROM businesses WHERE owner_id = ?').all(ctx.user.id);
      if (mine.length !== 1) return ctx.reply(t(ctx.lang, 'platform.help'));
      target = { bizId: mine[0].id, kind: 'shop' };
    }
    const biz = db.prepare('SELECT * FROM businesses WHERE id = ? AND owner_id = ?').get(target.bizId, ctx.user.id);
    if (!biz) return ctx.reply(t(ctx.lang, 'token.bad'));
    ctx.deleteMessage().catch(() => {}); // token chatda qolmasin
    try {
      const r = await connectBot({ token: text, businessId: biz.id, kind: target.kind || 'shop', staffId: target.staffId || null });
      clearState(ctx.from.id);
      await ctx.reply(t(ctx.lang, 'token.ok', { bot: r.username }));
    } catch (e) {
      await ctx.reply(t(ctx.lang, e.code === 'already_used' ? 'token.used' : 'token.bad'));
    }
  });

  bot.on('message:location', async ctx => {
    const st = getState(ctx.from.id);
    if (st?.state !== 'await_location') return;
    const biz = db.prepare('SELECT id FROM businesses WHERE id = ? AND owner_id = ?').get(st.data.bizId, ctx.user.id);
    if (!biz) return;
    db.prepare('UPDATE businesses SET lat = ?, lng = ? WHERE id = ?').run(ctx.message.location.latitude, ctx.message.location.longitude, biz.id);
    clearState(ctx.from.id);
    await ctx.reply(t(ctx.lang, 'loc.saved'), { reply_markup: { remove_keyboard: true } });
  });
}

export function askForState(tgId, state, data) { setState(tgId, state, data); }
export async function promptLocation(tgId, lang) {
  await sendTo(PLATFORM, tgId, '📍', { reply_markup: new Keyboard().requestLocation('📍 ' + (lang === 'ru' ? 'Отправить локацию' : 'Joylashuvni yuborish')).resized().oneTime() });
}

// ---------------------------------------------------------------- boshqaruv
async function configureBot(bot, key, title) {
  try {
    await bot.api.setMyCommands(key === PLATFORM
      ? [{ command: 'start', description: 'Start' }, { command: 'lang', description: 'Til / Язык' }, { command: 'help', description: 'Help' }]
      : [{ command: 'book', description: 'Bron qilish / Записаться' }, { command: 'my', description: 'Mening bronlarim / Мои записи' },
         { command: 'location', description: 'Manzil / Адрес' }, { command: 'lang', description: 'Til / Язык' }]);
    if (httpsApp()) {
      await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: title, web_app: { url: appUrl(key) } } });
    }
  } catch (e) { console.error('[configure]', key, e.message); }
}

async function startBot(key, bot, row) {
  installCommon(bot, key);
  if (key === PLATFORM) installPlatform(bot); else installTenant(bot, key, row);
  await bot.init();
  live.set(key, { key, bot, row });
  if (httpsApp()) {
    await ensureWebhook(key, bot, row);
  } else {
    await bot.api.deleteWebhook().catch(() => {});
    bot.start({ allowed_updates: ['message', 'callback_query'] }).catch(e => console.error('[polling]', key, e.message));
    await configureBot(bot, key, key === PLATFORM ? 'Bron' : 'Bron qilish');
  }
}

const webhookUrl = key => `${config.publicUrl}/tg/${key}`;
const webhookSecret = (key, row) => (key === PLATFORM ? platformSecret() : row.webhook_secret);

/**
 * Webhookni o'rnatish. Yangi tunnel manzili internetda darrov tanilmasligi mumkin ("Failed to resolve host"),
 * shuning uchun bir martalik urinish bilan to'xtamaymiz: muvaffaqiyatli bo'lguncha orqa fonda qayta uramiz.
 */
async function ensureWebhook(key, bot, row, attempt = 0) {
  try {
    await bot.api.setWebhook(webhookUrl(key), { secret_token: webhookSecret(key, row), allowed_updates: ['message', 'callback_query'] });
    await configureBot(bot, key, key === PLATFORM ? 'Bron' : 'Bron qilish');
    if (attempt) console.log(`[tg] ${key}: webhook ${attempt + 1}-urinishda o'rnatildi`);
  } catch (e) {
    if (!live.has(key)) return;                       // bot o'chirilgan
    if (attempt >= 30) { console.error(`[tg] ${key}: webhook o'rnatilmadi, urinish to'xtatildi: ${e.message}`); return; }
    const wait = Math.min(30000, 3000 * (attempt + 1));
    console.error(`[tg] ${key}: webhook o'rnatilmadi (${e.message}), ${Math.round(wait / 1000)} soniyadan keyin qayta uriniladi`);
    setTimeout(() => ensureWebhook(key, bot, row, attempt + 1), wait).unref();
  }
}

/** Har 5 daqiqada: webhook yo'qolgan yoki boshqa manzilga qarab qolgan bo'lsa, qayta o'rnatadi */
async function webhookWatchdog() {
  if (!httpsApp()) return;
  for (const l of live.values()) {
    try {
      const info = await l.bot.api.getWebhookInfo();
      if (info.url !== webhookUrl(l.key)) { console.log(`[tg] ${l.key}: webhook mos emas (${info.url || 'yo\'q'}), tuzatilmoqda`); await ensureWebhook(l.key, l.bot, l.row); }
    } catch (e) { console.error('[tg] watchdog', l.key, e.message); }
  }
}

export async function connectBot({ token, businessId, kind = 'shop', staffId = null }) {
  token = String(token || '').trim();
  if (!TOKEN_RE.test(token)) throw Object.assign(new Error('bad_token'), { code: 'bad_token' });
  if (token === config.platformToken) throw Object.assign(new Error('bad_token'), { code: 'bad_token' });
  if (kind === 'staff') {
    const s = db.prepare('SELECT id FROM staff WHERE id = ? AND business_id = ?').get(staffId, businessId);
    if (!s) throw Object.assign(new Error('bad_staff'), { code: 'bad_staff' });
  }
  const probe = new Bot(token);
  let me;
  try { me = await probe.api.getMe(); } catch { throw Object.assign(new Error('bad_token'), { code: 'bad_token' }); }
  if (db.prepare('SELECT 1 FROM bots WHERE tg_bot_id = ?').get(me.id)) throw Object.assign(new Error('already_used'), { code: 'already_used' });
  const r = db.prepare('INSERT INTO bots (business_id, staff_id, kind, tg_bot_id, username, token_enc, webhook_secret, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(businessId, kind === 'staff' ? staffId : null, kind, me.id, me.username, encrypt(token), randomId(24), nowTs());
  const row = db.prepare('SELECT * FROM bots WHERE id = ?').get(r.lastInsertRowid);
  const bot = new Bot(token);
  await startBot(botKey(row), bot, row);
  return row;
}

export async function disconnectBot(botId) {
  const key = 'b' + botId;
  const l = live.get(key);
  if (l) {
    try { await l.bot.stop(); } catch {}
    await l.bot.api.deleteWebhook().catch(() => {});
    await l.bot.api.setChatMenuButton({ menu_button: { type: 'default' } }).catch(() => {});
    live.delete(key);
  }
  db.prepare('DELETE FROM bots WHERE id = ?').run(botId);
}

export async function initTelegram() {
  if (config.platformToken) {
    try { await startBot(PLATFORM, new Bot(config.platformToken), null); console.log('[tg] platforma boti tayyor'); }
    catch (e) { console.error('[tg] platforma botini ishga tushirib bo\'lmadi:', e.message); }
  } else console.log('[tg] PLATFORM_BOT_TOKEN yo\'q — faqat HTTP API/mini ilova ishlaydi');
  for (const row of db.prepare('SELECT * FROM bots WHERE active = 1').all()) {
    try { await startBot(botKey(row), new Bot(decrypt(row.token_enc)), row); console.log('[tg] bot @' + row.username); }
    catch (e) { console.error('[tg] bot ishga tushmadi', row.username, e.message); }
  }
  setInterval(() => runReminders().catch(e => console.error('[reminders]', e)), 30000).unref();
  setInterval(() => webhookWatchdog().catch(() => {}), 5 * 60 * 1000).unref();
  const subJob = () => runSubscriptionNotices(db, { send: (uid, text) => deliver(uid, text, {}, [PLATFORM]), notifyAdmins: text => notifyAdmins(text) }).catch(e => console.error('[sub notices]', e));
  setTimeout(subJob, 60 * 1000).unref();
  setInterval(subJob, 30 * 60 * 1000).unref();
}

export async function handleWebhook(key, secretHeader, update) {
  const l = live.get(key);
  if (!l) return 404;
  if (secretHeader !== webhookSecretFor(key)) return 403;
  // Xato bo'lsa ham 200 qaytaramiz: aks holda Telegram shu xabarni qayta-qayta yuborib, navbatni tiqib qo'yadi
  try { await l.bot.handleUpdate(update); }
  catch (e) { console.error(`[bot ${key}] update ${update?.update_id} xatosi:`, e?.error?.message || e?.message || e); }
  return 200;
}
