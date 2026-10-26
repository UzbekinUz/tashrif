// Zaxira nusxa: ishlayotgan bazadan xavfsiz nusxa (VACUUM INTO) + eskilarini o'chirish.
//   node scripts/backup.mjs            -> backups/app-YYYYMMDD-HHMM.db
// cron (har kuni 03:30):  30 3 * * * cd /srv/tashrif && /usr/bin/node scripts/backup.mjs >> data/backup.log 2>&1
// DIQQAT: data/.secret (bot tokenlarini shifrlash kaliti) bu nusxada YO'Q. Uni alohida, xavfsiz joyda saqlang:
// kalitsiz zaxira bazadagi bot tokenlarini ocha olmaydi.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(import.meta.dirname, '..');
const dbFile = process.env.DB_FILE || path.join(root, 'data', 'app.db');
const dir = process.env.BACKUP_DIR || path.join(root, 'backups');
const keep = Number(process.env.BACKUP_KEEP || 14);

if (!fs.existsSync(dbFile)) { console.error('Baza topilmadi:', dbFile); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });

const d = new Date();
const p = n => String(n).padStart(2, '0');
const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
const out = path.join(dir, `app-${stamp}.db`);

const db = new DatabaseSync(dbFile, { readOnly: true });
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();

// butunlikni tekshirish
const chk = new DatabaseSync(out, { readOnly: true });
const ok = chk.prepare('PRAGMA integrity_check').get();
chk.close();
if (Object.values(ok)[0] !== 'ok') { console.error('Zaxira butunligi buzilgan:', ok); process.exit(2); }

// eskilarini o'chirish
const old = fs.readdirSync(dir).filter(f => /^app-\d{8}-\d{4}\.db$/.test(f)).sort().reverse().slice(keep);
for (const f of old) fs.rmSync(path.join(dir, f));
console.log(`[${d.toISOString()}] zaxira: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB), eski o'chirildi: ${old.length}`);
