// Lokal sinov uchun demo ma'lumot (haqiqiy Telegram botisiz). Ishlatish: node scripts/seed-dev.mjs
// Keyin: DEV_MODE=1 node src/server.js  va  http://localhost:3000/app/?b=1&dev=<tg_id>  ochiladi.
import { db } from '../src/db.js';
import { encrypt } from '../src/crypto.js';
import * as B from '../src/booking.js';
import { addDays, localToTs, tsToLocal, nowTs } from '../src/time.js';

if (db.prepare('SELECT COUNT(*) c FROM businesses').get().c) { console.log('Baza bo\'sh emas — seed o\'tkazib yuborildi.'); process.exit(0); }
const now = nowTs();
const user = (tg, name) => Number(db.prepare('INSERT INTO users (tg_id, first_name, lang, created_at) VALUES (?,?,?,?)').run(tg, name, 'uz', now).lastInsertRowid);
const owner = user(1001, 'Dilshod'), akmal = user(1002, 'Akmal'), mijoz = user(2001, 'Bekzod');

const biz = Number(db.prepare(`INSERT INTO businesses (owner_id, name, description, city_id, address, landmark, lat, lng, phone, instagram, trial_ends, created_at)
  VALUES (?,?,?,1,?,?,?,?,?,?,?,?)`).run(owner, 'Barber House', 'Erkaklar sartaroshxonasi: soch, soqol, bolalar soch olishi. Choy-kofe bepul.',
  'Amir Temur ko\'chasi 45', 'Mega Planet ro\'parasi', 41.3111, 69.2797, '+998901234567', '@barberhouse', now + 14 * 86400, now).lastInsertRowid);

db.prepare('INSERT INTO bots (business_id, kind, tg_bot_id, username, token_enc, webhook_secret, created_at) VALUES (?,?,?,?,?,?,?)')
  .run(biz, 'shop', 111, 'barberhouse_demo_bot', encrypt('111:demo'), 'x', now);

const mk = (uid, name, title, role) => Number(db.prepare('INSERT INTO staff (business_id, user_id, name, title, role, sort, created_at) VALUES (?,?,?,?,?,?,?)').run(biz, uid, name, title, role, 0, now).lastInsertRowid);
const s1 = mk(owner, 'Dilshod', 'Bosh barber', 'owner');
const s2 = mk(akmal, 'Akmal', 'Barber', 'master');
const s3 = mk(null, 'Sardor', 'Yosh barber', 'master');

const svc = (cat, name, price, dur) => Number(db.prepare('INSERT INTO services (business_id, category, name, price, duration_min) VALUES (?,?,?,?,?)').run(biz, cat, name, price, dur).lastInsertRowid);
const v = [svc('Soch', 'Erkaklar soch olishi', 80000, 45), svc('Soch', 'Bolalar soch olishi', 60000, 30), svc('Soqol', 'Soqol shakllantirish', 50000, 30),
  svc('Kombo', 'Soch + soqol', 120000, 75), svc('Qo\'shimcha', 'Yuz parvarishi', 70000, 30)];
for (const s of [s1, s2, s3]) {
  for (const x of v) db.prepare('INSERT INTO staff_services (staff_id, service_id) VALUES (?,?)').run(s, x);
  for (let w = 0; w < 6; w++) db.prepare('INSERT INTO working_hours (staff_id, weekday, start_min, end_min) VALUES (?,?,?,?)').run(s, w, 600, 1200);
  db.prepare('INSERT INTO breaks (staff_id, weekday, start_min, end_min) VALUES (?,NULL,840,900)').run(s);
}
db.prepare('UPDATE staff_services SET price = 100000 WHERE staff_id = ? AND service_id = ?').run(s1, v[0]);
db.prepare("UPDATE staff SET invite_code = 'demo-invite' WHERE id = ?").run(s3);

const tz = 'Asia/Tashkent', today = tsToLocal(now, tz).date;
const people = [['Bekzod', '+998901112233', mijoz], ['Otabek', '+998935556677', null], ['Javlon', '+998977778899', null], ['Sherzod', '+998909990011', null]];
let i = 0;
for (const d of [today, addDays(today, 1), addDays(today, 2)]) {
  for (const [slot, st] of [[660, s1], [720, s2], [780, s1], [1020, s3], [900, s2]]) {
    const [name, phone, uid] = people[i++ % people.length];
    try {
      B.createBooking(db, { businessId: biz, staffId: st, serviceIds: [v[i % 5]], startTs: localToTs(d, slot, tz), userId: uid, clientId: uid ? undefined : B.upsertClient(db, biz, { name, phone }).id, name, phone, manual: true, now });
    } catch {}
  }
}
console.log('Demo tayyor. Egasi: tg 1001, usta: 1002, mijoz: 2001. Bot id = 1');
