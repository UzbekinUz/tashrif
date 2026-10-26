import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import * as B from '../src/booking.js';
import { localToTs } from '../src/time.js';

const TZ = 'Asia/Tashkent';
const DATE = '2030-03-05';           // Seshanba (weekday 1)
const NOW = localToTs('2030-03-01', 600, TZ);

function setup(over = {}) {
  const db = openDb(':memory:');
  const t = 1;
  db.prepare("INSERT INTO users (tg_id, first_name, created_at) VALUES (1,'Egasi',?)").run(t);
  db.prepare("INSERT INTO users (tg_id, first_name, created_at) VALUES (2,'Mijoz',?)").run(t);
  db.prepare("INSERT INTO users (tg_id, first_name, created_at) VALUES (3,'Mijoz2',?)").run(t);
  const cols = { slot_step_min: 30, buffer_min: 0, min_notice_min: 60, ...over };
  db.prepare(`INSERT INTO businesses (owner_id, name, timezone, slot_step_min, buffer_min, min_notice_min, auto_confirm, max_active_per_client, cancel_before_min, noshow_limit, created_at)
              VALUES (1,'Test','${TZ}',?,?,?,?,?,?,?,?)`)
    .run(cols.slot_step_min, cols.buffer_min, cols.min_notice_min, cols.auto_confirm ?? 1, cols.max_active ?? 3, cols.cancel_before ?? 120, cols.noshow_limit ?? 3, t);
  for (const [n, sort] of [['Ali', 0], ['Vali', 1]]) {
    const r = db.prepare("INSERT INTO staff (business_id, name, sort, created_at) VALUES (1,?,?,?)").run(n, sort, t);
    db.prepare('INSERT INTO working_hours (staff_id, weekday, start_min, end_min) VALUES (?,?,?,?)').run(r.lastInsertRowid, 1, 600, 1080); // 10:00-18:00
  }
  db.prepare("INSERT INTO services (business_id, name, price, duration_min) VALUES (1,'Soch olish',80000,30)").run();
  db.prepare("INSERT INTO services (business_id, name, price, duration_min) VALUES (1,'Soqol',50000,30)").run();
  db.prepare("INSERT INTO services (business_id, name, price, duration_min) VALUES (1,'Kompleks',120000,60)").run();
  for (const st of [1, 2]) for (const sv of [1, 2, 3]) db.prepare('INSERT INTO staff_services (staff_id, service_id) VALUES (?,?)').run(st, sv);
  return db;
}
const biz = db => B.getBusiness(db, 1);
const times = slots => slots.map(s => s.time);

test('bo\'sh kun slotlari ish soatlariga mos', () => {
  const db = setup();
  const s = B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW });
  assert.equal(s[0].time, '10:00');
  assert.equal(s.at(-1).time, '17:30');
  assert.equal(s.length, 16);
});

test('davomiylik: 60 daqiqalik xizmat oxirgi slotni qisqartiradi', () => {
  const db = setup();
  const s = B.getSlots(db, biz(db), { staffId: 1, serviceIds: [3], date: DATE, now: NOW });
  assert.equal(s.at(-1).time, '17:00');
});

test('bir nechta xizmat davomiyligi yig\'iladi', () => {
  const db = setup();
  const s = B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1, 2], date: DATE, now: NOW });
  assert.equal(s[0].staff[0].duration, 60);
  assert.equal(s.at(-1).time, '17:00');
  assert.equal(s[0].staff[0].price, 130000);
});

test('band vaqt slotdan chiqadi, qo\'shni vaqt qoladi', () => {
  const db = setup();
  const ts = localToTs(DATE, 660, TZ); // 11:00
  B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [3], startTs: ts, userId: 2, name: 'Mijoz', now: NOW });
  const t = times(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW }));
  assert.ok(!t.includes('11:00') && !t.includes('11:30'));
  assert.ok(t.includes('10:30') && t.includes('12:00'));
});

test('bir slotga ikki marta bron — ikkinchisi rad etiladi', () => {
  const db = setup();
  const ts = localToTs(DATE, 660, TZ);
  B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts, userId: 2, name: 'A', now: NOW });
  assert.throws(() => B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts, userId: 3, name: 'B', now: NOW }),
    e => e.code === 'slot_taken');
});

test('tanaffus (tushlik) slot bermaydi, xizmat tanaffusga sig\'masa ham', () => {
  const db = setup();
  db.prepare('INSERT INTO breaks (staff_id, weekday, start_min, end_min) VALUES (1, NULL, 780, 840)').run(); // 13:00-14:00
  const t = times(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [3], date: DATE, now: NOW }));
  assert.ok(!t.includes('12:30') && !t.includes('13:00') && !t.includes('13:30'));
  assert.ok(t.includes('12:00') && t.includes('14:00'));
});

test('bufer: bronlar orasida tanaffus', () => {
  const db = setup({ buffer_min: 15 });
  B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: localToTs(DATE, 600, TZ), userId: 2, name: 'A', now: NOW });
  const t = times(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW }));
  assert.ok(!t.includes('10:30')); // 10:30 < 10:30 + 15 bufer
  assert.ok(t.includes('11:00'));
});

test('minimal oldindan ogohlantirish va o\'tgan vaqt', () => {
  const db = setup({ min_notice_min: 120 });
  const now = localToTs(DATE, 600, TZ); // shu kuni 10:00
  const t = times(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now }));
  assert.equal(t[0], '12:00');
  assert.deepEqual(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: '2030-03-04', now }), []);
});

test('maksimal muddatdan keyingi kun yopiq', () => {
  const db = setup();
  db.prepare('UPDATE businesses SET max_advance_days = 3').run();
  assert.deepEqual(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW }), []);
});

test('ta\'til, biznes yopiq kuni va maxsus kun', () => {
  const db = setup();
  db.prepare("INSERT INTO time_off (business_id, staff_id, from_date, to_date) VALUES (1, 1, '2030-03-04', '2030-03-06')").run();
  assert.equal(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW }).length, 0);
  assert.ok(B.getSlots(db, biz(db), { staffId: 2, serviceIds: [1], date: DATE, now: NOW }).length > 0);
  db.prepare("INSERT INTO time_off (business_id, staff_id, from_date, to_date) VALUES (1, NULL, '2030-03-05', '2030-03-05')").run();
  assert.equal(B.getSlots(db, biz(db), { staffId: 2, serviceIds: [1], date: DATE, now: NOW }).length, 0);
  // maxsus kun: Vali 2030-03-12 (Seshanba) faqat 12:00-14:00
  db.prepare("INSERT INTO day_overrides (staff_id, date, start_min, end_min) VALUES (2, '2030-03-12', 720, 840)").run();
  const t = times(B.getSlots(db, biz(db), { staffId: 2, serviceIds: [1], date: '2030-03-12', now: NOW }));
  assert.deepEqual(t, ['12:00', '12:30', '13:00', '13:30']);
});

test('"istalgan usta": bir vaqtga ikki usta, band bo\'lsa bittasi, kam bandi tanlanadi', () => {
  const db = setup();
  const ts = localToTs(DATE, 600, TZ);
  let s = B.getSlots(db, biz(db), { serviceIds: [1], date: DATE, now: NOW });
  assert.equal(s[0].staff.length, 2);
  const b1 = B.createBooking(db, { businessId: 1, serviceIds: [1], startTs: ts, userId: 2, name: 'A', now: NOW });
  const b2 = B.createBooking(db, { businessId: 1, serviceIds: [1], startTs: ts, userId: 3, name: 'B', now: NOW });
  assert.notEqual(b1.staff_id, b2.staff_id);
  assert.throws(() => B.createBooking(db, { businessId: 1, serviceIds: [1], startTs: ts, userId: 3, name: 'B', now: NOW }), e => ['slot_taken', 'client_overlap'].includes(e.code));
});

test('ustalar xizmat qila olmasa slot yo\'q', () => {
  const db = setup();
  db.prepare('DELETE FROM staff_services WHERE staff_id = 1 AND service_id = 2').run();
  assert.deepEqual(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [2], date: DATE, now: NOW }), []);
  assert.ok(B.getSlots(db, biz(db), { serviceIds: [2], date: DATE, now: NOW }).length > 0); // Vali qila oladi
});

test('ustaga xos narx va davomiylik', () => {
  const db = setup();
  db.prepare('UPDATE staff_services SET price = 100000, duration_min = 45 WHERE staff_id = 2 AND service_id = 1').run();
  const p = B.priceForStaff(db, 2, [1]);
  assert.equal(p.price, 100000); assert.equal(p.duration, 45);
});

test('mijoz o\'zi bir vaqtda ikki joyda bo\'la olmaydi; faol bronlar chegarasi', () => {
  const db = setup({ max_active: 2 });
  const ts = localToTs(DATE, 600, TZ);
  B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts, userId: 2, name: 'A', now: NOW });
  assert.throws(() => B.createBooking(db, { businessId: 1, staffId: 2, serviceIds: [1], startTs: ts, userId: 2, name: 'A', now: NOW }), e => e.code === 'client_overlap');
  B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts + 3600, userId: 2, name: 'A', now: NOW });
  assert.throws(() => B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts + 7200, userId: 2, name: 'A', now: NOW }), e => e.code === 'too_many_active');
});

test('mijoz bekor qilishi: chegaradan keyin mumkin emas, oldin mumkin; slot qaytadi', () => {
  const db = setup();
  const ts = localToTs(DATE, 600, TZ);
  const b = B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts, userId: 2, name: 'A', now: NOW });
  assert.throws(() => B.cancelByClient(db, b.id, b.client_id, ts - 3600), e => e.code === 'too_late');
  assert.throws(() => B.cancelByClient(db, b.id, 999, NOW), e => e.code === 'not_found');
  B.cancelByClient(db, b.id, b.client_id, NOW);
  assert.ok(times(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW })).includes('10:00'));
  assert.equal(db.prepare('SELECT COUNT(*) c FROM reminders WHERE booking_id = ?').get(b.id).c, 0);
});

test('ko\'chirish: yangi vaqt bo\'sh bo\'lsa eski bo\'shaydi, bo\'sh bo\'lmasa hech narsa o\'zgarmaydi', () => {
  const db = setup();
  const t10 = localToTs(DATE, 600, TZ), t11 = localToTs(DATE, 660, TZ);
  const a = B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: t10, userId: 2, name: 'A', now: NOW });
  B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: t11, userId: 3, name: 'B', now: NOW });
  assert.throws(() => B.rescheduleByClient(db, a.id, a.client_id, { startTs: t11 }, NOW), e => e.code === 'slot_taken');
  assert.equal(B.getBooking(db, a.id).start_ts, t10);
  const moved = B.rescheduleByClient(db, a.id, a.client_id, { startTs: t10 + 1800 }, NOW); // 10:30 — o'z vaqti bilan ustma-ust, lekin o'zi hisoblanmaydi
  assert.equal(moved.start_ts, t10 + 1800);
});

test('usta holatni o\'zgartiradi: no-show soni va avtomatik bloklash', () => {
  const db = setup({ noshow_limit: 2 });
  const now = localToTs('2030-03-10', 600, TZ);
  const mk = (day, uid) => B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: localToTs(day, 600, TZ), userId: uid, name: 'A', now: NOW });
  const b = mk(DATE, 2);
  assert.throws(() => B.changeStatus(db, b.id, 'no_show', NOW), e => e.code === 'not_started');
  B.changeStatus(db, b.id, 'no_show', now);
  assert.throws(() => B.changeStatus(db, b.id, 'completed', now), e => e.code === 'bad_transition');
  db.prepare("INSERT INTO working_hours (staff_id, weekday, start_min, end_min) VALUES (1, 2, 600, 1080)").run();
  const b2 = mk('2030-03-06', 2);
  B.changeStatus(db, b2.id, 'no_show', now);
  assert.equal(db.prepare('SELECT blocked FROM clients WHERE id = ?').get(b.client_id).blocked, 1);
  assert.throws(() => mk('2030-03-06', 2), e => e.code === 'client_blocked');
});

test('qo\'lda bron: minimal ogohlantirishsiz, lekin ustma-ust tushmaydi', () => {
  const db = setup();
  const now = localToTs(DATE, 600, TZ);
  const c = B.upsertClient(db, 1, { name: 'Yurib kelgan', phone: '+998901112233' });
  const ts = now + 600; // 10 daqiqadan keyin; min_notice=60 bo'lsa oddiy bron o'tmasdi
  const ts30 = localToTs(DATE, 630, TZ);
  const b = B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts30, clientId: c.id, manual: true, now });
  assert.equal(b.source, 'manual');
  assert.throws(() => B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts30, clientId: c.id, manual: true, now }), e => e.code === 'slot_taken');
  assert.ok(ts > 0);
});

test('tasdiqlash rejimi: bron pending, slotni band qiladi', () => {
  const db = setup({ auto_confirm: 0 });
  const ts = localToTs(DATE, 600, TZ);
  const b = B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: ts, userId: 2, name: 'A', now: NOW });
  assert.equal(b.status, 'pending');
  assert.ok(!times(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW })).includes('10:00'));
  B.changeStatus(db, b.id, 'confirmed', NOW);
});

test('eslatmalar rejalashadi, o\'tib ketganlari qo\'shilmaydi', () => {
  const db = setup();
  const near = localToTs(DATE, 600, TZ);
  const now = near - 3 * 3600; // 3 soat qoldi: 24 soatlik eslatma o'tib ketgan, 2 soatlik bor
  const b = B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: near, userId: 2, name: 'A', now });
  const r = db.prepare('SELECT minutes_before FROM reminders WHERE booking_id = ?').all(b.id).map(x => x.minutes_before);
  assert.deepEqual(r, [120]);
});

test('yopiq biznes (sinov muddati tugagan) bron qabul qilmaydi', () => {
  const db = setup();
  db.prepare('UPDATE businesses SET trial_ends = ?').run(NOW - 10);
  assert.deepEqual(B.getSlots(db, biz(db), { staffId: 1, serviceIds: [1], date: DATE, now: NOW }), []);
  assert.throws(() => B.createBooking(db, { businessId: 1, staffId: 1, serviceIds: [1], startTs: localToTs(DATE, 600, TZ), userId: 2, name: 'A', now: NOW }), e => e.code === 'business_closed');
});

test('availableDays faqat bo\'sh kunlarni qaytaradi', () => {
  const db = setup();
  const days = B.availableDays(db, biz(db), { staffId: 1, serviceIds: [1], from: '2030-03-01', days: 14, now: NOW });
  assert.deepEqual(days, ['2030-03-05', '2030-03-12']);
});
