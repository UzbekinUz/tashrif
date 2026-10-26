import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyInitData, encrypt, decrypt } from '../src/crypto.js';
import { localToTs, tsToLocal, addDays } from '../src/time.js';

function sign(user, token, authDate) {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAH', user: JSON.stringify(user) });
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

const TOKEN = '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
const now = Math.floor(Date.now() / 1000);

test('to\'g\'ri imzolangan initData qabul qilinadi', () => {
  const u = verifyInitData(sign({ id: 42, first_name: 'Ali' }, TOKEN, now), TOKEN, 3600);
  assert.equal(u.id, 42);
});

test('boshqa bot tokeni bilan imzolangan initData rad etiladi (bot almashtirib yuborish hujumi)', () => {
  assert.equal(verifyInitData(sign({ id: 42 }, TOKEN, now), '999:other_token_value_that_is_long_enough_xx', 3600), null);
});

test('o\'zgartirilgan yoki eskirgan initData rad etiladi', () => {
  const ok = sign({ id: 42, first_name: 'Ali' }, TOKEN, now);
  assert.equal(verifyInitData(ok.replace('42', '43'), TOKEN, 3600), null);
  assert.equal(verifyInitData(sign({ id: 42 }, TOKEN, now - 7200), TOKEN, 3600), null);
  assert.equal(verifyInitData('', TOKEN, 3600), null);
  assert.equal(verifyInitData('hash=zz', TOKEN, 3600), null);
});

test('bot tokeni shifrlanib qayta ochiladi, har safar boshqacha shifrmatn', () => {
  const t = '123456:SECRET';
  const a = encrypt(t), b = encrypt(t);
  assert.notEqual(a, b);
  assert.equal(decrypt(a), t);
  assert.throws(() => decrypt(a.slice(0, -4) + 'AAAA'));
});

test('vaqt mintaqasi: DST bor mintaqada ham mahalliy soat to\'g\'ri', () => {
  const ts = localToTs('2030-07-01', 600, 'America/New_York'); // EDT = UTC-4
  assert.equal(new Date(ts * 1000).toISOString(), '2030-07-01T14:00:00.000Z');
  assert.deepEqual(tsToLocal(ts, 'America/New_York'), { date: '2030-07-01', minutes: 600, weekday: 0 });
  assert.equal(addDays('2030-02-28', 1), '2030-03-01');
});
