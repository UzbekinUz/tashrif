import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { claimBusiness, cleanTheme, parseTheme, DEFAULT_THEME } from '../src/biz.js';

function setup() {
  const db = openDb(':memory:');
  const ins = (tg, name) => Number(db.prepare("INSERT INTO users (tg_id, first_name, created_at) VALUES (?,?,1)").run(tg, name).lastInsertRowid);
  const admin = ins(1, 'Admin'), client = ins(2, 'Sartarosh'), other = ins(3, 'Boshqa');
  db.prepare("INSERT INTO businesses (owner_id, name, claim_code, created_at) VALUES (?, 'Barber House', 'abc123xyz', 1)").run(admin);
  return { db, admin, client, other };
}

test('egalik havolasi biznesni mijozga topshiradi va o\'ziga ustalar qatorini yaratadi', () => {
  const { db, client } = setup();
  const b = claimBusiness(db, { id: client, first_name: 'Sartarosh' }, 'abc123xyz');
  assert.equal(b.owner_id, client);
  assert.equal(b.claim_code, null);
  const s = db.prepare("SELECT * FROM staff WHERE business_id = ? AND role = 'owner'").get(b.id);
  assert.equal(s.user_id, client);
  assert.ok(db.prepare('SELECT COUNT(*) c FROM working_hours WHERE staff_id = ?').get(s.id).c >= 6);
});

test('havola bir martalik: ikkinchi odam olaolmaydi, noto\'g\'ri kod rad etiladi', () => {
  const { db, client, other } = setup();
  assert.ok(claimBusiness(db, { id: client, first_name: 'A' }, 'abc123xyz'));
  assert.equal(claimBusiness(db, { id: other, first_name: 'B' }, 'abc123xyz'), null);
  assert.equal(claimBusiness(db, { id: other, first_name: 'B' }, 'xxxxxxxxx'), null);
  assert.equal(claimBusiness(db, { id: other, first_name: 'B' }, ''), null);
  assert.equal(db.prepare('SELECT owner_id FROM businesses WHERE id = 1').get().owner_id, client);
});

test('egalik qayta topshirilganda eski egasining qatori yangisiga o\'tadi (dublikat yo\'q)', () => {
  const { db, client, other } = setup();
  claimBusiness(db, { id: client, first_name: 'A' }, 'abc123xyz');
  db.prepare("UPDATE businesses SET claim_code = 'second123' WHERE id = 1").run();
  claimBusiness(db, { id: other, first_name: 'B' }, 'second123');
  const rows = db.prepare("SELECT user_id FROM staff WHERE business_id = 1 AND role = 'owner'").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, other);
});

test('tema: faqat ruxsat etilgan qiymatlar o\'tadi, qolgani standartga qaytadi', () => {
  assert.deepEqual(cleanTheme({ mode: 'light', accent: '#6aaef0', ground: 'black', radius: 'sharp', button: 'accent' }), { mode: 'light', accent: '#6aaef0', ground: 'black', radius: 'sharp', button: 'accent' });
  assert.deepEqual(cleanTheme({ mode: 'neon', accent: 'url(javascript:alert(1))', ground: '<script>', radius: 9, button: null }), DEFAULT_THEME);
  assert.deepEqual(cleanTheme(null), DEFAULT_THEME);
  assert.deepEqual(parseTheme('not json'), DEFAULT_THEME);
  assert.deepEqual(parseTheme(null), DEFAULT_THEME);
});
