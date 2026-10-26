// Umumiy yordamchilar: DOM, API, til, ikonlar, bottom-sheet, toast.
export const tg = window.Telegram?.WebApp;
const qs = new URLSearchParams(location.search);

export const ctx = {
  bot: qs.get('b') || 'platform',          // 'platform' yoki bizning bot id
  admin: qs.get('admin') === '1',
  dev: qs.get('dev'),                      // lokal sinov: ?dev=1001
  go: qs.get('go'),                        // bildirishnoma tugmasidan to'g'ridan-to'g'ri sahifa: ?go=/admin/leads
  lang: 'uz',
};

if (tg) {
  tg.ready(); tg.expand();
  try { tg.setHeaderColor('#0d0c0b'); tg.setBackgroundColor('#0d0c0b'); tg.setBottomBarColor?.('#0d0c0b'); tg.disableVerticalSwipes?.(); } catch {}
}
const tgLang = tg?.initDataUnsafe?.user?.language_code;
ctx.lang = localStorage.getItem('lang') || (tgLang?.startsWith('ru') ? 'ru' : 'uz');

// ---------------------------------------------------------------- til (kalit = o'zbekcha matn)
const RU = {
  'Bugun': 'Сегодня', 'Jadval': 'Расписание', 'Jamoa': 'Команда', 'Xizmatlar': 'Услуги', 'Boshqa': 'Ещё', 'Bron qilish': 'Записаться',
  'Bronlarim': 'Мои записи', 'Boshqaruv': 'Управление', 'Mijozlar': 'Клиенты', 'Statistika': 'Статистика', 'Sozlamalar': 'Настройки',
  'Orqaga': 'Назад', 'Davom etish': 'Продолжить', 'Saqlash': 'Сохранить', 'Bekor qilish': 'Отменить', 'Yopish': 'Закрыть', "O'chirish": 'Удалить',
  'Tahrirlash': 'Изменить', "Qo'shish": 'Добавить', 'Xizmatni tanlang': 'Выберите услуги', 'Ustani tanlang': 'Выберите мастера',
  'Kun va vaqtni tanlang': 'Выберите день и время', 'Tasdiqlash': 'Подтверждение', 'Istalgan usta': 'Любой мастер', "Bo'sh usta avtomatik tanlanadi": 'Свободный мастер выберется автоматически',
  'Ismingiz': 'Ваше имя', 'Telefon raqam': 'Номер телефона', 'Izoh (ixtiyoriy)': 'Комментарий (необязательно)', 'Bronni tasdiqlash': 'Подтвердить запись',
  "so'm": 'сум', 'daqiqa': 'мин', 'soat': 'ч', 'Jami': 'Итого', 'Usta': 'Мастер', 'Vaqt': 'Время', 'Xizmat': 'Услуга', 'Narx': 'Цена', 'Davomiyligi': 'Длительность',
  'Bu kunga bo\'sh vaqt yo\'q': 'На этот день нет свободного времени', "Boshqa kunni tanlang yoki boshqa ustani ko'ring": 'Выберите другой день или другого мастера',
  'Bron qabul qilindi': 'Запись принята', "So'rov yuborildi": 'Заявка отправлена', 'Usta tasdiqlashi bilan xabar beramiz': 'Сообщим, когда мастер подтвердит',
  'Yaqinlashayotgan': 'Предстоящие', "O'tgan": 'Прошедшие', "Bronlar yo'q": 'Записей нет', "Ko'chirish": 'Перенести', 'Baholash': 'Оценить',
  'Manzil': 'Адрес', "Qo'ng'iroq": 'Позвонить', 'Xaritada ochish': 'Открыть на карте', 'Ustalarimiz': 'Наши мастера', 'Ishlarimiz': 'Наши работы',
  'Kutilmoqda': 'Ожидает', 'Tasdiqlangan': 'Подтверждена', 'Bajarildi': 'Выполнена', 'Kelmadi': 'Не пришёл', 'Mijoz bekor qildi': 'Отменил клиент', 'Usta bekor qildi': 'Отменил мастер',
  'Keldi': 'Пришёл', 'Tasdiqlash ': 'Подтвердить', 'Rad etish': 'Отклонить', "Qo'lda bron": 'Новая запись', 'Tasdiqlashni kutayotgan': 'Ждут подтверждения',
  'Bugungi bronlar': 'Записи сегодня', 'Kutilayotgan tushum': 'Ожидаемая выручка', 'Ustalar bandligi': 'Загрузка мастеров',
  'Hozircha bron yo\'q': 'Пока записей нет', 'Yangi bron': 'Новая запись', 'Mijoz': 'Клиент', 'Sana': 'Дата', 'Boshlanish': 'Начало',
  'Hammasi': 'Все', 'Ish vaqti': 'График работы', 'Tanaffus': 'Перерыв', 'Dam olish': 'Выходной', 'Ta\'til': 'Отпуск', 'Yopiq kunlar': 'Закрытые дни',
  'Dushanba': 'Понедельник', 'Seshanba': 'Вторник', 'Chorshanba': 'Среда', 'Payshanba': 'Четверг', 'Juma': 'Пятница', 'Shanba': 'Суббота', 'Yakshanba': 'Воскресенье',
  'Du': 'Пн', 'Se': 'Вт', 'Chor': 'Ср', 'Pay': 'Чт', 'Ju': 'Пт', 'Sha': 'Сб', 'Ya': 'Вс',
  'Yangi biznes': 'Новый бизнес', 'Biznes nomi': 'Название', 'Shahar': 'Город', 'Yaratish': 'Создать', 'Botni ulash': 'Подключить бота',
  'Bot tokeni': 'Токен бота', 'Ulash': 'Подключить', 'Ulangan botlar': 'Подключённые боты', 'Tavsif': 'Описание', 'Telefon': 'Телефон',
  "Mo'ljal": 'Ориентир', 'Joylashuv': 'Локация', "Qoidalar": 'Правила записи', 'Rasm': 'Фото', 'Til': 'Язык',
  'Narx (so\'m)': 'Цена (сум)', 'Nomi': 'Название', 'Toifa': 'Категория', 'Ism': 'Имя', 'Lavozim': 'Должность', 'Haqida': 'О мастере',
  'Taklif havolasi': 'Ссылка-приглашение', 'Nusxalash': 'Копировать', 'Nusxalandi': 'Скопировано', 'Saqlandi': 'Сохранено', 'Xatolik': 'Ошибка',
  'Daromad': 'Выручка', 'Bronlar': 'Записи', 'Yangi mijozlar': 'Новые клиенты', 'Kelmaganlar': 'Неявки', 'Eng ko\'p so\'ralgan': 'Популярные услуги',
  'Qidirish': 'Поиск', 'Tashrif': 'Визитов', 'Bloklash': 'Заблокировать', 'Blokdan chiqarish': 'Разблокировать', 'Eslatma': 'Заметка',
  'Hozir': 'Сейчас', 'Mijoz ko\'rinishi': 'Вид клиента', 'Bosh sahifa': 'Главная', 'Mening bronlarim': 'Мои записи',
};
export const _ = s => (ctx.lang === 'ru' ? RU[s] ?? s : s);
export function setLang(l) { ctx.lang = l; localStorage.setItem('lang', l); }

export const WD = ['Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha', 'Ya'];
export const WD_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];
const MON = { uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'], ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'] };

// ---------------------------------------------------------------- vaqt (biznes vaqt mintaqasida)
let TZ = 'Asia/Tashkent';
export const setTz = z => { TZ = z || TZ; };
const dtf = new Map();
function parts(ts) {
  let f = dtf.get(TZ);
  if (!f) dtf.set(TZ, f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
  const o = {}; for (const p of f.formatToParts(new Date(ts * 1000))) o[p.type] = p.value;
  return o;
}
export const localDate = ts => { const p = parts(ts); return `${p.year}-${p.month}-${p.day}`; };
export const localTime = ts => { const p = parts(ts); return `${p.hour}:${p.minute}`; };
export const todayStr = () => localDate(Date.now() / 1000);
export const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); };
export const wdOf = d => { const [y, m, dd] = d.split('-').map(Number); return (new Date(Date.UTC(y, m - 1, dd)).getUTCDay() + 6) % 7; };
export const dayNum = d => Number(d.slice(8));
export function fmtDate(d, withWd = false) {
  const [, m, dd] = d.split('-').map(Number);
  const base = `${dd} ${MON[ctx.lang][m - 1]}`;
  return withWd ? `${_(WD[wdOf(d)])}, ${base}` : base;
}
export function fmtWhen(ts) {
  const d = localDate(ts), t = todayStr();
  const label = d === t ? _('Bugun') : d === addDays(t, 1) ? (ctx.lang === 'ru' ? 'Завтра' : 'Ertaga') : fmtDate(d, true);
  return `${label}, ${localTime(ts)}`;
}
export const hhmmMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
export const minHHMM = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const money = n => `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')}`;
export const price = n => `${money(n)} ${_("so'm")}`;
export function dur(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const H = ctx.lang === 'ru' ? 'ч' : 'soat', M = ctx.lang === 'ru' ? 'мин' : 'daq';
  return h ? (m ? `${h} ${H} ${m} ${M}` : `${h} ${H}`) : `${m} ${M}`;
}

// ---------------------------------------------------------------- DOM
export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; } }
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  const add = k => { if (Array.isArray(k)) k.forEach(add); else if (k !== null && k !== undefined && k !== false) el.append(k.nodeType ? k : document.createTextNode(k)); };
  kids.forEach(add);
  return el;
}

const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  trash: '<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  bot: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4M8 16h.01M16 16h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  zap: '<path d="M13 2L3 14h9l-1 8 10-12h-9z"/>',
  heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  phone2: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7"/>',
  map: '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z"/><path d="M8 2v16M16 6v16"/>',
  compass: '<circle cx="12" cy="12" r="10"/><path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
  award: '<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>',
  trend: '<path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6"/>',
  gift: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  play: '<path d="M5 3l14 9-14 9z"/>',
  coffee: '<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4zM6 1v3M10 1v3M14 1v3"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  sun: '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
};
export const icon = (n, cls = '') => h('span', { html: `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`, style: { display: 'inline-flex' } });

const HUES = ['#e6b05a', '#9ec7e8', '#a8d5a2', '#e8a0a0', '#c9b1e8', '#e8c9a0', '#8fd6cf'];
export const hueFor = id => HUES[Math.abs(Number(id) || 0) % HUES.length];
export function avatar(name, id, photo, cls = '') {
  return h('div', { class: 'avatar ' + cls, style: photo ? { backgroundImage: `url(${photo})` } : { background: hueFor(id) }, 'aria-hidden': 'true' }, photo ? '' : (name || '?').trim().charAt(0).toUpperCase());
}

// ---------------------------------------------------------------- API
export class ApiError extends Error { constructor(code, data, status) { super(code); this.code = code; this.data = data; this.status = status; } }

function authHeader() {
  if (tg?.initData) return 'tma ' + tg.initData;
  const dev = ctx.dev || localStorage.getItem('dev');
  if (dev) return `dev ${dev}|${localStorage.getItem('devname') || 'Dev'}|${ctx.lang}`;
  return '';
}
export const isDevSession = () => !tg?.initData;

export async function api(method, path, body, raw) {
  const headers = { Authorization: authHeader(), 'X-Bot': ctx.bot };
  let payload;
  if (raw) { payload = raw; headers['Content-Type'] = 'application/octet-stream'; }
  else if (body !== undefined) { payload = JSON.stringify(body); headers['Content-Type'] = 'application/json'; }
  progress(+1);
  const slow = setTimeout(() => hint(ctx.lang === 'ru' ? 'Сервер отвечает медленно, подождите…' : 'Server sekin javob bermoqda, kuting…'), 5000);
  try {
    for (let attempt = 0; ; attempt++) {
      let res;
      try { res = await fetch(path, { method, headers, body: payload }); }
      catch {
        // GET xavfsiz takrorlanadi; yozuvchi so'rovlar takrorlanmaydi (ikki marta bron bo'lib qolmasin)
        if (method === 'GET' && attempt < 2) { await new Promise(r => setTimeout(r, 700 * (attempt + 1))); continue; }
        throw new ApiError('network', {}, 0);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (method === 'GET' && res.status >= 502 && res.status <= 504 && attempt < 2) { await new Promise(r => setTimeout(r, 900 * (attempt + 1))); continue; }
        throw new ApiError(data.error || 'error', data, res.status);
      }
      return data;
    }
  } finally { clearTimeout(slow); progress(-1); }
}

// ---------------------------------------------------------------- biznesning mini ilova ko'rinishi (tema)
export const GROUNDS = {
  warm: { ground: '#0d0c0b', surface: '#171615', raised: '#262422', control: '#3a3835', rule: '#1d1c1a' },
  black: { ground: '#000000', surface: '#111111', raised: '#2a2a2a', control: '#444444', rule: '#1a1a1a' },
  graphite: { ground: '#0f1114', surface: '#171a1e', raised: '#252a30', control: '#363c44', rule: '#1c2025' },
};
export const THEME_OPTIONS = {
  accents: ['#e6b05a', '#6aaef0', '#7fd6b0', '#f08a7a', '#f2994a', '#f08fb0', '#c6f24e', '#e8e8e8'],
  radii: { sharp: '8px', soft: '20px', round: '28px' },
};
// Platforma ("Tashrif") sahifalari uchun engil mavzu; bizneslar o'z qorong'u mavzusida qoladi
const LIGHT = { ground: '#eef3fa', surface: '#ffffff', raised: '#e6edf7', control: '#c8d3e3', rule: '#e1e8f2',
  text: '#0f1b2d', muted: '#4a5b73', faint: '#66768d', positive: '#15803d', negative: '#dc2626', blue: '#2f6df6',
  'inv-bg': '#0f1b2d', 'inv-ink': '#ffffff', scrim: 'rgba(15,27,45,.45)',
  'pill-pos-bg': '#dcf5e4', 'pill-pos-ink': '#0f6b34', 'pill-neg-bg': '#fde2e2', 'pill-neg-ink': '#b42323',
  'pill-warn-bg': '#fdeccb', 'pill-warn-ink': '#8a5a00', 'pill-blue-bg': '#dce8ff', 'pill-blue-ink': '#1d4fd1', 'pill-neu-bg': '#e6edf7', 'pill-neu-ink': '#0f1b2d' };
const DARK = { text: '#ffffff', muted: '#b4b4b4', faint: '#949494', positive: '#8fd694', negative: '#ef6a6f', blue: '#6aaef0',
  'inv-bg': '#ffffff', 'inv-ink': '#000000', scrim: 'rgba(0,0,0,.6)',
  'pill-pos-bg': '#1c2a1e', 'pill-pos-ink': '#8fd694', 'pill-neg-bg': '#2c1a1c', 'pill-neg-ink': '#ef6a6f',
  'pill-warn-bg': '#2d2515', 'pill-warn-ink': '#e6b05a', 'pill-blue-bg': '#15253a', 'pill-blue-ink': '#7db9f5', 'pill-neu-bg': '#262422', 'pill-neu-ink': '#ffffff' };

// Foydalanuvchining shaxsiy tanlovi (qurilmada): 'light' | 'dark' | yo'q = biznes/standart rejim
export const getModeOverride = () => { try { const v = localStorage.getItem('ui.mode'); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } };
export const setModeOverride = v => { try { v ? localStorage.setItem('ui.mode', v) : localStorage.removeItem('ui.mode'); } catch {} };
let lastTheme = {};
export const currentMode = () => document.documentElement.dataset.mode || 'dark';

/** Rang ustida o'qiladigan matn rangi (qora yoki oq) */
export function inkOn(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#000000' : '#ffffff';
}

/**
 * Mavzuni qo'llaydi. Rejim: foydalanuvchining shaxsiy tanlovi > biznes tanlovi > qorong'u.
 * preview=true — shaxsiy tanlovni e'tiborsiz qoldiradi (egasi o'z sozlamasini ko'rayotganda).
 */
export function applyTheme(t, { preview = false } = {}) {
  t = t || {};
  lastTheme = t;
  const mode = (preview ? null : getModeOverride()) || t.mode || 'dark';
  const light = mode === 'light';
  const st = document.documentElement.style;
  const g = light ? LIGHT : { ...DARK, ...(GROUNDS[t.ground] || GROUNDS.warm) };
  const accent = t.platform || THEME_OPTIONS.accents.includes(t.accent) ? (t.accent || '#e6b05a') : (light ? '#2f6df6' : '#e6b05a');
  for (const [k, v] of Object.entries(g)) st.setProperty('--' + k, v);
  st.setProperty('--accent', accent);
  st.setProperty('--r-card', THEME_OPTIONS.radii[t.radius] || '20px');
  if (t.button === 'accent') { st.setProperty('--primary-bg', accent); st.setProperty('--primary-ink', inkOn(accent)); }
  else { st.removeProperty('--primary-bg'); st.removeProperty('--primary-ink'); }
  document.documentElement.dataset.mode = light ? 'light' : 'dark';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', light ? LIGHT.ground : g.ground);
  try { tg?.setHeaderColor?.(g.ground); tg?.setBackgroundColor?.(g.ground); } catch {}
  window.dispatchEvent(new Event('themechange'));
}
/** Foydalanuvchi uslubni almashtiradi (yorqin <-> qorong'u) va tanlov eslab qolinadi */
export function toggleMode() {
  const next = currentMode() === 'light' ? 'dark' : 'light';
  setModeOverride(next);
  const root = document.documentElement;
  root.classList.add('theme-anim');
  applyTheme(lastTheme);
  setTimeout(() => root.classList.remove('theme-anim'), 500);
  return next;
}
export const PLATFORM_THEME = { mode: 'light', platform: true, accent: '#2f6df6', button: 'accent', radius: 'soft' };

// matn tanlash: uzbekcha | ruscha
export const L = (uz, ru) => (ctx.lang === 'ru' ? ru : uz);

// ---------------------------------------------------------------- yuklanish ko'rsatkichi (foydalanuvchi "qotib qoldi" deb o'ylamasligi uchun)
let pending = 0, barTimer, barEl;
function progress(d) {
  pending = Math.max(0, pending + d);
  clearTimeout(barTimer);
  if (pending > 0) {
    barTimer = setTimeout(() => { if (!barEl) { barEl = h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Loading' }, h('i')); document.body.append(barEl); } }, 120);
  } else { barEl?.remove(); barEl = null; }
}
let hintEl;
export function hint(msg) {
  hintEl?.remove();
  hintEl = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(hintEl);
  setTimeout(() => hintEl?.remove(), 3500);
}
export const GET = (p) => api('GET', p);
export const POST = (p, b) => api('POST', p, b ?? {});
export const PATCH = (p, b) => api('PATCH', p, b);
export const PUT = (p, b) => api('PUT', p, b);
export const DEL = (p) => api('DELETE', p);

const ERR = {
  slot_taken: ['Bu vaqt band bo\'lib qoldi, boshqasini tanlang', 'Это время уже занято, выберите другое'],
  client_overlap: ['Shu vaqtda sizda boshqa bron bor', 'У вас уже есть запись на это время'],
  too_many_active: ['Faol bronlar soni chegaradan oshdi', 'Слишком много активных записей'],
  client_blocked: ['Bron qilish cheklangan', 'Запись ограничена'],
  business_closed: ['Hozircha bron qabul qilinmaydi', 'Запись временно не принимается'],
  too_late: ['Bekor qilish muddati o\'tgan', 'Срок отмены прошёл'],
  lead_exists: ['So\'rov allaqachon yuborilgan', 'Заявка уже отправлена'],
  plan_limit: ["Tarifdagi ustalar chegarasiga yetdingiz. Obunani yangilang", 'Достигнут лимит мастеров по тарифу. Обновите подписку'],
  invalid_plan: ['Tarif topilmadi', 'Тариф не найден'],
  consent_required: ['Davom etish uchun aloqaga rozilik bering', 'Для продолжения дайте согласие на связь'],
  invalid_phone: ['Telefon raqamni to\'g\'ri kiriting', 'Введите корректный номер телефона'],
  invalid_name: ['Ismni kiriting', 'Введите имя'],
  bad_token: ['Token noto\'g\'ri', 'Неверный токен'],
  already_used: ['Bu bot allaqachon ulangan', 'Этот бот уже подключён'],
  has_future_bookings: ['Ustada kelgusi bronlar bor', 'У мастера есть будущие записи'],
  not_started: ['Bron vaqti hali boshlanmagan', 'Время записи ещё не наступило'],
  forbidden: ['Ruxsat yo\'q', 'Нет доступа'],
  too_many_requests: ['Juda tez-tez, biroz kuting', 'Слишком часто, подождите'],
  network: ['Internet aloqasi yo\'q', 'Нет соединения'],
  overlapping_intervals: ['Ish soatlari ustma-ust tushgan', 'Интервалы пересекаются'],
  invalid_interval: ['Vaqt oralig\'i noto\'g\'ri', 'Неверный интервал'],
};
export const errText = e => { const m = ERR[e?.code]; return m ? m[ctx.lang === 'ru' ? 1 : 0] : _('Xatolik') + (e?.code ? ` (${e.code})` : ''); };

// ---------------------------------------------------------------- toast / sheet / confirm
let toastEl;
export function toast(msg, isErr) {
  toastEl?.remove();
  toastEl = h('div', { class: 'toast' + (isErr ? ' err' : ''), role: 'status' }, msg);
  document.body.append(toastEl);
  setTimeout(() => toastEl?.remove(), 2600);
  tg?.HapticFeedback?.notificationOccurred(isErr ? 'error' : 'success');
}

export function sheet(build) {
  const scrim = h('div', { class: 'scrim' });
  const el = h('div', { class: 'sheet', role: 'dialog' });
  const close = () => { scrim.remove(); el.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', close);
  el.append(h('div', { class: 'grab' }), ...[].concat(build(close)).flat(Infinity).filter(k => k !== undefined && k !== null && k !== false));
  document.body.append(scrim, el);
  return close;
}

export const confirmSheet = (title, text, okLabel, danger = true) => new Promise(res => {
  let done = false;
  const fin = (v, close) => { if (!done) { done = true; res(v); } close?.(); };
  sheet(close => [
    h('h2', {}, title), text && h('p', { class: 'muted', style: { marginBottom: '18px' } }, text),
    h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onclick: () => fin(false, close) }, _('Yopish')),
      h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => fin(true, close) }, okLabel)),
  ]);
});

export async function busy(btn, fn) {
  if (btn?.classList.contains('loading')) return new Promise(() => {}); // ikki marta bosilishdan himoya
  btn?.classList.add('loading'); btn?.setAttribute('aria-busy', 'true');
  try { return await fn(); }
  catch (e) { toast(errText(e), true); throw e; }
  finally { btn?.classList.remove('loading'); btn?.removeAttribute('aria-busy'); }
}

export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', {}, label), input, hint && h('div', { class: 'hint' }, hint));
}
export const input = (attrs = {}) => h('input', { class: 'input', ...attrs });
export function toggle(on, onchange) {
  const el = h('button', { class: 'switch', role: 'switch', 'aria-checked': String(!!on), type: 'button' });
  el.onclick = () => { const v = el.getAttribute('aria-checked') !== 'true'; el.setAttribute('aria-checked', String(v)); onchange?.(v); };
  Object.defineProperty(el, 'value', { get: () => el.getAttribute('aria-checked') === 'true' });
  return el;
}
export const mapUrl = b => (b.lat != null ? `https://www.google.com/maps?q=${b.lat},${b.lng}` : b.address ? `https://www.google.com/maps/search/${encodeURIComponent(b.address + ' ' + (b.city?.name_uz || ''))}` : null);
export function openLink(u) {
  if (tg && /^https:\/\/t\.me\//.test(u)) tg.openTelegramLink(u);
  else if (tg) tg.openLink(u); else window.open(u, '_blank', 'noopener');
}
/** Shartlar va maxfiylik siyosati havolalari (rozilik joylari va pastki qism uchun) */
export function legalLinks() {
  const go = f => e => { e.preventDefault(); openLink(location.origin + '/app/legal/' + f); };
  return h('span', { class: 'legal' },
    h('a', { href: '/app/legal/terms.html', onclick: go('terms.html') }, ctx.lang === 'ru' ? 'Условия' : 'Shartlar'), ' · ',
    h('a', { href: '/app/legal/privacy.html', onclick: go('privacy.html') }, ctx.lang === 'ru' ? 'Конфиденциальность' : 'Maxfiylik siyosati'));
}
export function copyText(txt) {
  navigator.clipboard?.writeText(txt).then(() => toast(_('Nusxalandi')), () => toast(txt));
}
export const statusPill = s => {
  const m = { pending: ['warn', 'Kutilmoqda'], confirmed: ['pos', 'Tasdiqlangan'], completed: ['blue', 'Bajarildi'], no_show: ['neg', 'Kelmadi'], cancelled_client: ['', 'Mijoz bekor qildi'], cancelled_staff: ['', 'Usta bekor qildi'] }[s] || ['', s];
  return h('span', { class: 'pill ' + m[0] }, _(m[1]));
};
export const skeleton = () => h('div', { class: 'screen', 'aria-busy': 'true', 'aria-label': 'Loading' },
  h('div', { class: 'top' }, h('div', { class: 'skeleton', style: { height: '26px', width: '48%' } })),
  h('div', { class: 'skeleton', style: { height: '92px', borderRadius: '20px' } }),
  h('div', { class: 'skeleton', style: { height: '18px', width: '34%', margin: '26px 0 12px' } }),
  h('div', { class: 'skeleton', style: { height: '150px', borderRadius: '20px' } }),
  h('div', { class: 'skeleton', style: { height: '18px', width: '28%', margin: '26px 0 12px' } }),
  ...[0, 1, 2].map(() => h('div', { class: 'skeleton', style: { height: '56px', borderRadius: '16px', marginBottom: '10px' } })));

// ---------------------------------------------------------------- yo'naltirish
export const nav = {
  go: p => { location.hash = p; },
  // Telegram URL oxiriga #tgWebAppData=... qo'shadi — faqat "#/" bilan boshlanganini yo'l deb olamiz
  path: () => (location.hash.startsWith('#/') ? location.hash.slice(1) : '/'),
};
export function setBack(fn) {
  if (!tg?.BackButton) return;
  tg.BackButton.offClick(setBack._f || (() => {}));
  if (fn) { setBack._f = fn; tg.BackButton.onClick(fn); tg.BackButton.show(); } else tg.BackButton.hide();
}
