// Biznesni egasiga topshirish (claim) va umumiy biznes yordamchilari.
import { tx } from './db.js';
import { nowTs } from './time.js';

export const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5].map(w => [w, 540, 1080]);

/** Egasiga ustalar ro'yxatida o'z qatori (standart jadval va tushlik bilan) */
export function createOwnerStaff(db, bizId, userId, name) {
  const s = db.prepare("INSERT INTO staff (business_id, user_id, name, role, created_at) VALUES (?,?,?,'owner',?)").run(bizId, userId, name, nowTs());
  for (const [w, a, b] of DEFAULT_HOURS) db.prepare('INSERT INTO working_hours (staff_id, weekday, start_min, end_min) VALUES (?,?,?,?)').run(s.lastInsertRowid, w, a, b);
  db.prepare('INSERT INTO breaks (staff_id, weekday, start_min, end_min) VALUES (?,NULL,780,840)').run(s.lastInsertRowid);
  return Number(s.lastInsertRowid);
}

/**
 * Taklif kodi bo'yicha biznesni foydalanuvchiga egalik qilib berish.
 * Kod bir martalik: ishlatilgach o'chiriladi (ikkinchi odam ololmaydi).
 * @returns biznes yoki null (kod yaroqsiz)
 */
export function claimBusiness(db, user, code) {
  if (!code || code.length < 6) return null;
  return tx(db, () => {
    const b = db.prepare('SELECT * FROM businesses WHERE claim_code = ?').get(code);
    if (!b) return null;
    db.prepare('UPDATE businesses SET owner_id = ?, claim_code = NULL WHERE id = ?').run(user.id, b.id);
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || b.name;
    const own = db.prepare("SELECT id FROM staff WHERE business_id = ? AND role = 'owner'").get(b.id);
    if (own) db.prepare('UPDATE staff SET user_id = ? WHERE id = ?').run(user.id, own.id);
    else if (!db.prepare('SELECT 1 FROM staff WHERE business_id = ? AND user_id = ?').get(b.id, user.id)) createOwnerStaff(db, b.id, user.id, name);
    return db.prepare('SELECT * FROM businesses WHERE id = ?').get(b.id);
  });
}

// ---------------------------------------------------------------- mini ilova ko'rinishi (faqat ruxsat etilgan variantlar)
export const THEME = {
  accents: ['#e6b05a', '#6aaef0', '#7fd6b0', '#f08a7a', '#f2994a', '#f08fb0', '#c6f24e', '#e8e8e8'],
  grounds: ['warm', 'black', 'graphite'],
  radii: ['sharp', 'soft', 'round'],
  buttons: ['white', 'accent'],
  modes: ['dark', 'light'],
};
export const DEFAULT_THEME = { mode: 'dark', accent: '#e6b05a', ground: 'warm', radius: 'soft', button: 'white' };

export function cleanTheme(t) {
  t = t && typeof t === 'object' ? t : {};
  return {
    mode: THEME.modes.includes(t.mode) ? t.mode : DEFAULT_THEME.mode,
    accent: THEME.accents.includes(t.accent) ? t.accent : DEFAULT_THEME.accent,
    ground: THEME.grounds.includes(t.ground) ? t.ground : DEFAULT_THEME.ground,
    radius: THEME.radii.includes(t.radius) ? t.radius : DEFAULT_THEME.radius,
    button: THEME.buttons.includes(t.button) ? t.button : DEFAULT_THEME.button,
  };
}
export function parseTheme(json) {
  try { return cleanTheme(json ? JSON.parse(json) : {}); } catch { return { ...DEFAULT_THEME }; }
}
