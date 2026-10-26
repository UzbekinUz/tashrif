import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { subscriptionOf, staffLimit, runSubscriptionNotices, setSetting, listPlans } from '../src/subscriptions.js';

const DAY = 86400;
const NOW = 1_800_000_000;

function setup(over = {}) {
  const db = openDb(':memory:');
  db.prepare("INSERT INTO users (tg_id, first_name, lang, created_at) VALUES (1, 'Egasi', 'uz', 1)").run();
  const b = { trial_ends: NOW + 10 * DAY, paid_until: null, claim_code: null, plan_id: null, ...over };
  db.prepare("INSERT INTO businesses (owner_id, name, trial_ends, paid_until, claim_code, plan_id, created_at) VALUES (1, 'Barber', ?, ?, ?, ?, 1)").run(b.trial_ends, b.paid_until, b.claim_code, b.plan_id);
  return db;
}
const biz = db => db.prepare('SELECT * FROM businesses WHERE id = 1').get();
const recorder = () => { const out = { owner: [], admin: [] }; return { out, send: async (uid, t) => out.owner.push([uid, t]), notifyAdmins: async t => out.admin.push(t) }; };

test('standart tariflar yaratiladi va narx hali belgilanmagan (0)', () => {
  const db = setup();
  const p = listPlans(db);
  assert.equal(p.length, 3);
  assert.deepEqual(p.map(x => x.max_staff), [1, 5, 30]);
  assert.ok(p.every(x => x.price === 0));
});

test('obuna holati: sinov, to\'langan, tugagan', () => {
  const db = setup();
  assert.equal(subscriptionOf(db, biz(db), NOW).state, 'trial');
  db.prepare('UPDATE businesses SET paid_until = ?').run(NOW + 30 * DAY);
  assert.equal(subscriptionOf(db, biz(db), NOW).state, 'paid');
  db.prepare('UPDATE businesses SET paid_until = ?, trial_ends = ?').run(NOW - DAY, NOW - 5 * DAY);
  const s = subscriptionOf(db, biz(db), NOW);
  assert.equal(s.state, 'expired');
  assert.ok(s.days_left <= 0);
});

test('ustalar chegarasi: tarif yo\'q bo\'lsa cheklov yo\'q, bor bo\'lsa to\'lganda rad', () => {
  const db = setup();
  const add = n => { for (let i = 0; i < n; i++) db.prepare("INSERT INTO staff (business_id, name, created_at) VALUES (1, 'U', 1)").run(); };
  add(3);
  assert.equal(staffLimit(db, biz(db)).ok, true);                 // tarif belgilanmagan
  db.prepare('UPDATE businesses SET plan_id = 1').run();           // Boshlang'ich: 1 usta
  const l = staffLimit(db, biz(db));
  assert.deepEqual([l.max, l.used, l.ok], [1, 3, false]);
  db.prepare('UPDATE businesses SET plan_id = 2').run();           // Standart: 5
  assert.equal(staffLimit(db, biz(db)).ok, true);
  add(2);
  assert.equal(staffLimit(db, biz(db)).ok, false);
});

test('eslatmalar: 3 kun, 1 kun, tugadi; har biri faqat bir marta', async () => {
  const db = setup({ trial_ends: NOW + 2 * DAY });
  setSetting(db, 'support_contact', '@tashrif_support');
  const r = recorder();
  assert.deepEqual((await runSubscriptionNotices(db, r, NOW)).map(x => x.kind), ['d3']);
  assert.deepEqual(await runSubscriptionNotices(db, r, NOW + 3600), []);                       // takror yuborilmaydi
  assert.deepEqual((await runSubscriptionNotices(db, r, NOW + 2 * DAY - 3600)).map(x => x.kind), ['d1']);
  assert.deepEqual((await runSubscriptionNotices(db, r, NOW + 2 * DAY + 10)).map(x => x.kind), ['expired']);
  assert.equal(r.out.owner.length, 3);
  assert.ok(r.out.owner[0][1].includes('@tashrif_support'));
  assert.equal(r.out.admin.length, 2);                                                         // adminga faqat d3 va expired
});

test('muddat uzaytirilsa eslatmalar yangi muddat uchun qayta ishlaydi', async () => {
  const db = setup({ trial_ends: NOW + 2 * DAY });
  const r = recorder();
  await runSubscriptionNotices(db, r, NOW);
  db.prepare('UPDATE businesses SET paid_until = ?').run(NOW + 32 * DAY);
  assert.deepEqual(await runSubscriptionNotices(db, r, NOW + 1000), []);                       // 30 kun qoldi: jim
  assert.deepEqual((await runSubscriptionNotices(db, r, NOW + 30 * DAY)).map(x => x.kind), ['d3']);
});

test('egasiga topshirilmagan, to\'xtatilgan yoki 7 kundan oldin tugagan bizneslarga eslatma yuborilmaydi', async () => {
  const r = recorder();
  assert.deepEqual(await runSubscriptionNotices(setup({ trial_ends: NOW + DAY, claim_code: 'abc123xyz' }), r, NOW), []);
  const paused = setup({ trial_ends: NOW + DAY }); paused.prepare("UPDATE businesses SET status = 'paused'").run();
  assert.deepEqual(await runSubscriptionNotices(paused, r, NOW), []);
  assert.deepEqual(await runSubscriptionNotices(setup({ trial_ends: NOW - 8 * DAY }), r, NOW), []);
  assert.equal(r.out.owner.length, 0);
});
