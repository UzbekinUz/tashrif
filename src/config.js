import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');

// .env ni qo'lda o'qiymiz (qo'shimcha kutubxona kerak emas)
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) {
      let v = m[2];
      if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, ''); // qiymatdan keyingi "  # izoh" ni olib tashlaymiz
      process.env[m[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
}

fs.mkdirSync(path.join(root, 'data', 'uploads'), { recursive: true });

// Bot tokenlarini shifrlash kaliti: env yoki data/.secret (birinchi ishga tushishda yaratiladi)
function loadSecret() {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  const f = path.join(root, 'data', '.secret');
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(f, 'utf8').trim();
}

export const config = {
  root,
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '',                                   // production: 127.0.0.1 (faqat Caddy orqali)
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),   // https://domen.uz  (webhook + mini app uchun)
  platformToken: process.env.PLATFORM_BOT_TOKEN || '',             // "sotuvchi" bot tokeni
  adminIds: (process.env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean).map(Number),
  dev: process.env.DEV_MODE === '1',                               // faqat lokal sinov uchun
  dbFile: process.env.DB_FILE || path.join(root, 'data', 'app.db'),
  uploadDir: path.join(root, 'data', 'uploads'),
  secret: loadSecret(),
  trialDays: Number(process.env.TRIAL_DAYS || 14),
  initDataMaxAgeSec: 24 * 3600,
  maxUploadBytes: 5 * 1024 * 1024,
};
