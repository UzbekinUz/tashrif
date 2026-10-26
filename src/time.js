// Vaqt mintaqasi yordamchilari. Bazada hamma vaqt UTC epoch sekundda saqlanadi,
// hisob-kitob esa biznesning mahalliy vaqtida (IANA tz) bajariladi.

const fmtCache = new Map();
function fmt(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

function parts(ms, tz) {
  const o = {};
  for (const p of fmt(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}

/** tz ning UTC dan farqi (daqiqada) shu paytda */
export function tzOffsetMin(ms, tz) {
  const p = parts(ms, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** 'YYYY-MM-DD' + kun boshidan daqiqa  ->  UTC epoch sekund */
export function localToTs(date, minutes, tz) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let ts = guess - tzOffsetMin(guess, tz) * 60000;
  const off2 = tzOffsetMin(ts, tz);
  ts = guess - off2 * 60000;
  return Math.floor(ts / 1000);
}

/** UTC epoch sekund -> { date, minutes, weekday(0=Dushanba) } mahalliy vaqtda */
export function tsToLocal(ts, tz) {
  const p = parts(ts * 1000, tz);
  const date = `${p.year}-${p.month}-${p.day}`;
  const minutes = +p.hour * 60 + +p.minute;
  return { date, minutes, weekday: weekdayOf(date) };
}

export function weekdayOf(date) {
  const [y, m, d] = date.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
export const hhmm = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
export const parseHHMM = s => { const m = /^(\d{1,2}):(\d{2})$/.exec(s); return m ? (+m[1]) * 60 + +m[2] : NaN; };
export const nowTs = () => Math.floor(Date.now() / 1000);
