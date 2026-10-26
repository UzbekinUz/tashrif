import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  tg_id INTEGER UNIQUE NOT NULL,
  first_name TEXT, last_name TEXT, username TEXT,
  phone TEXT, lang TEXT DEFAULT 'uz',
  created_at INTEGER NOT NULL
);

-- Biznes (do'kon / salon). Bir egasi bir nechta biznesga ega bo'lishi mumkin.
CREATE TABLE IF NOT EXISTS businesses (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'barber',
  description TEXT DEFAULT '',
  city_id INTEGER, address TEXT DEFAULT '', landmark TEXT DEFAULT '',
  lat REAL, lng REAL,
  phone TEXT DEFAULT '', instagram TEXT DEFAULT '',
  logo TEXT, cover TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent',
  currency TEXT NOT NULL DEFAULT 'UZS',
  slot_step_min INTEGER NOT NULL DEFAULT 30,
  buffer_min INTEGER NOT NULL DEFAULT 0,
  min_notice_min INTEGER NOT NULL DEFAULT 60,
  max_advance_days INTEGER NOT NULL DEFAULT 30,
  cancel_before_min INTEGER NOT NULL DEFAULT 120,
  auto_confirm INTEGER NOT NULL DEFAULT 1,
  max_active_per_client INTEGER NOT NULL DEFAULT 3,
  noshow_limit INTEGER NOT NULL DEFAULT 3,
  reminders TEXT NOT NULL DEFAULT '1440,120',
  lang TEXT NOT NULL DEFAULT 'uz',
  status TEXT NOT NULL DEFAULT 'active',
  trial_ends INTEGER, paid_until INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY, name_uz TEXT NOT NULL, name_ru TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Tashkent'
);

-- Ulangan Telegram botlar. 'shop' = umumiy do'kon boti, 'staff' = bitta ustaning shaxsiy boti.
CREATE TABLE IF NOT EXISTS bots (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'shop',
  tg_bot_id INTEGER UNIQUE NOT NULL,
  username TEXT NOT NULL,
  token_enc TEXT NOT NULL,
  webhook_secret TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  title TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  photo TEXT,
  role TEXT NOT NULL DEFAULT 'master',
  active INTEGER NOT NULL DEFAULT 1,
  accepts_online INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0,
  invite_code TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_staff_user ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_biz ON staff(business_id);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT DEFAULT '',
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS staff_services (
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price INTEGER, duration_min INTEGER,
  PRIMARY KEY (staff_id, service_id)
);

-- weekday: 0 = Dushanba. Bir kunda bir nechta oraliq bo'lishi mumkin.
CREATE TABLE IF NOT EXISTS working_hours (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wh_staff ON working_hours(staff_id);

CREATE TABLE IF NOT EXISTS breaks (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  weekday INTEGER, start_min INTEGER NOT NULL, end_min INTEGER NOT NULL
);

-- start_min NULL = shu kuni dam olish; aks holda shu kun uchun maxsus soatlar
CREATE TABLE IF NOT EXISTS day_overrides (
  id INTEGER PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date TEXT NOT NULL, start_min INTEGER, end_min INTEGER, reason TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_do ON day_overrides(staff_id, date);

-- Ta'til / bayram. staff_id NULL = butun biznes yopiq
CREATE TABLE IF NOT EXISTS time_off (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
  from_date TEXT NOT NULL, to_date TEXT NOT NULL, reason TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL, phone TEXT DEFAULT '', note TEXT DEFAULT '',
  blocked INTEGER NOT NULL DEFAULT 0,
  visits INTEGER NOT NULL DEFAULT 0, no_shows INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE (business_id, user_id)
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  bot_id INTEGER REFERENCES bots(id) ON DELETE SET NULL,
  start_ts INTEGER NOT NULL, end_ts INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  total_price INTEGER NOT NULL DEFAULT 0,
  note TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'miniapp',
  rescheduled_from INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bk_staff_time ON bookings(staff_id, start_ts);
CREATE INDEX IF NOT EXISTS idx_bk_biz_time ON bookings(business_id, start_ts);
CREATE INDEX IF NOT EXISTS idx_bk_client ON bookings(client_id);

CREATE TABLE IF NOT EXISTS booking_items (
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id INTEGER, name TEXT NOT NULL, price INTEGER NOT NULL, duration_min INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER UNIQUE NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  business_id INTEGER NOT NULL, staff_id INTEGER NOT NULL,
  rating INTEGER NOT NULL, text TEXT DEFAULT '', created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gallery (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES staff(id) ON DELETE CASCADE,
  file TEXT NOT NULL, caption TEXT DEFAULT '', sort INTEGER DEFAULT 0, created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  send_at INTEGER NOT NULL, minutes_before INTEGER NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rem ON reminders(sent, send_at);

-- Foydalanuvchi qaysi botlarga yozgan. bot_id 0 = platforma boti.
CREATE TABLE IF NOT EXISTS user_bots (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bot_id INTEGER NOT NULL,
  can_msg INTEGER NOT NULL DEFAULT 1,
  last_seen INTEGER NOT NULL,
  PRIMARY KEY (user_id, bot_id)
);

-- Platforma daromadi: biznes to'lovlari (qo'lda kiritiladi, keyin Click/Payme bilan avtomatlashadi)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL DEFAULT 0, days INTEGER NOT NULL, note TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);

-- Platforma sotuv ofisi: ulanish so'rovlari
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL, phone TEXT NOT NULL, business_name TEXT DEFAULT '', city_id INTEGER, message TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',      -- new, contacted, progress, done, rejected
  note TEXT DEFAULT '', business_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, created_at);

-- Fikr-mulohazalar (biznes egalari va foydalanuvchilardan platforma egasiga)
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  business_id INTEGER,
  kind TEXT NOT NULL DEFAULT 'idea',       -- idea, bug, praise, other
  rating INTEGER, text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',      -- new, seen
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fb_status ON feedback(status, created_at);

-- Obuna tariflari (narx 0 = hali belgilanmagan). max_staff 0 = cheklovsiz
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, max_staff INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
-- Obuna eslatmalari: bir muddat uchun bir tur eslatma faqat bir marta
CREATE TABLE IF NOT EXISTS sub_notices (
  business_id INTEGER NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, until_ts INTEGER NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY (business_id, kind, until_ts)
);

CREATE TABLE IF NOT EXISTS chat_state (
  tg_id INTEGER NOT NULL, bot_id INTEGER NOT NULL,
  state TEXT NOT NULL, data TEXT DEFAULT '{}', updated_at INTEGER NOT NULL,
  PRIMARY KEY (tg_id, bot_id)
);
`;

const CITIES = [
  ['Toshkent', 'Ташкент'], ['Samarqand', 'Самарканд'], ['Buxoro', 'Бухара'], ['Andijon', 'Андижан'],
  ["Farg'ona", 'Фергана'], ['Namangan', 'Наманган'], ['Qarshi', 'Карши'], ['Nukus', 'Нукус'],
  ['Urganch', 'Ургенч'], ['Termiz', 'Термез'], ['Jizzax', 'Джизак'], ['Guliston', 'Гулистан'],
  ['Navoiy', 'Навои'], ["Qo'qon", 'Коканд'], ['Margilon', 'Маргилан'],
];

export function openDb(file = config.dbFile) {
  const d = new DatabaseSync(file);
  d.exec(SCHEMA);
  if (d.prepare('SELECT COUNT(*) c FROM cities').get().c === 0) {
    const ins = d.prepare('INSERT INTO cities (name_uz, name_ru) VALUES (?, ?)');
    for (const c of CITIES) ins.run(...c);
  }
  // Yengil migratsiya: eski bazalarga yangi ustunlar
  const cols = d.prepare('PRAGMA table_info(clients)').all().map(c => c.name);
  if (!cols.includes('call_consent')) {
    d.exec('ALTER TABLE clients ADD COLUMN call_consent INTEGER NOT NULL DEFAULT 0');
    d.exec('ALTER TABLE clients ADD COLUMN consent_at INTEGER');
  }
  const bcols = d.prepare('PRAGMA table_info(businesses)').all().map(c => c.name);
  if (!bcols.includes('theme')) d.exec('ALTER TABLE businesses ADD COLUMN theme TEXT');
  if (!bcols.includes('claim_code')) d.exec('ALTER TABLE businesses ADD COLUMN claim_code TEXT');
  if (!bcols.includes('plan_id')) d.exec('ALTER TABLE businesses ADD COLUMN plan_id INTEGER');
  d.exec('CREATE INDEX IF NOT EXISTS idx_biz_claim ON businesses(claim_code)');
  if (d.prepare('SELECT COUNT(*) c FROM plans').get().c === 0) {
    const p = d.prepare('INSERT INTO plans (name, price, max_staff, sort) VALUES (?,?,?,?)');
    p.run("Boshlang'ich", 0, 1, 1); p.run('Standart', 0, 5, 2); p.run('Katta', 0, 30, 3);
  }
  return d;
}

/** BEGIN IMMEDIATE: yozuv qulfi — ikki bron bir vaqtda bitta slotga tushmasligi uchun */
export function tx(d, fn) {
  d.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    d.exec('COMMIT');
    return r;
  } catch (e) {
    try { d.exec('ROLLBACK'); } catch {}
    throw e;
  }
}

export const db = process.env.NO_DEFAULT_DB === '1' || process.env.NODE_TEST_CONTEXT ? null : openDb();
