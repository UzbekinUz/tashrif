// Platforma "sotuv ofisi": xizmat haqida, ulanish so'rovi, fikr-mulohaza va platforma egasi uchun
// so'rovlar / fikrlar / biznes yaratish ekranlari.
import { h, _, ctx, GET, POST, PATCH, icon, money, fmtDate, localDate, localTime, errText, toast, sheet, busy, field, input, toggle, nav, copyText, openLink, confirmSheet, L, legalLinks } from './lib.js';
import { startTour } from './tour.js';
import { top, A } from './admin.js';

const ru = () => ctx.lang === 'ru';
let meCache = null;
export async function getMe(force) { if (!meCache || force) meCache = await GET('/api/a/me'); return meCache; }
export const claimLink = (username, code) => `https://t.me/${username}?start=own_${code}`;

const when = ts => `${fmtDate(localDate(ts))}, ${localTime(ts)}`;

// ---------------------------------------------------------------- Xizmat haqida (sotuv sahifasi + qo'llanma)
const TILES = () => [
  ['message', L('Botda bron', 'Запись в боте'), L("Mijoz o'zi yoziladi, qo'ng'iroq shart emas", 'Клиент записывается сам, звонки не нужны'), 'mint'],
  ['clock', L("Ustaning jadvali", 'График мастера'), L("Ish vaqti, tanaffus, ta'til, narxlar", 'Часы, перерывы, отпуск, цены'), 'blue'],
  ['bell', L('Eslatmalar', 'Напоминания'), L("Mijozga 24 va 2 soat oldin xabar", 'Клиенту за 24 и 2 часа'), 'coral'],
  ['chart', L('Statistika', 'Статистика'), L('Daromad, kelmaganlar, mashhur xizmatlar', 'Выручка, неявки, популярные услуги'), 'amber'],
  ['image', L("O'z ko'rinishingiz", 'Свой вид'), L('Rang va uslubni brendingizga moslang', 'Цвета и стиль под ваш бренд'), 'pink'],
  ['shield', L('Xavfsizlik', 'Безопасность'), L("Token shifrlangan, mijoz roziligi so'raladi", 'Токен зашифрован, согласие клиента'), 'teal'],
];

const ROAD = () => [
  ['send', L("So'rov yuboring", 'Оставьте заявку'), L('Ism, telefon va biznes nomi. Bir daqiqa.', 'Имя, телефон и название. Одна минута.'), L("Pastdagi tugma bilan so'rov qoldirasiz. Hech narsa to'lamaysiz: 14 kun bepul sinov.", 'Кнопкой внизу оставляете заявку. Платить ничего не нужно: 14 дней бесплатно.')],
  ['phone', L("Biz bog'lanamiz", 'Мы свяжемся'), L('Shartlarni kelishamiz', 'Согласуем условия'), L("Sizga qo'ng'iroq qilamiz, biznesingizni tizimda yaratamiz va egalik havolasini yuboramiz.", 'Позвоним, создадим бизнес в системе и отправим ссылку владельца.')],
  ['bot', L("O'z botingizni yarating", 'Создайте своего бота'), L('@BotFather, bir daqiqa', '@BotFather, одна минута'), L("@BotFather'da /newbot yuborasiz, nom va username berasiz. Olingan tokenni ilovada o'zingiz kiritasiz.", 'В @BotFather отправляете /newbot, задаёте имя и username. Полученный токен вставляете в приложении сами.')],
  ['sliders', L('Sozlang', 'Настройте'), L('Xizmat, usta, jadval, rang', 'Услуги, мастера, график, цвет'), L("Xizmatlar va narxlar, ustalar va ularning ish vaqti, manzil, rasmlar va ilova ko'rinishi.", 'Услуги и цены, мастера и их график, адрес, фото и вид приложения.')],
  ['calendar', L('Mijozlar yoziladi', 'Клиенты записываются'), L('Havolani ulashing', 'Поделитесь ссылкой'), L("Bot havolasini Instagram, Telegram yoki do'kon eshigiga qo'ying. Mijozlar ustani tanlab yoziladi.", 'Разместите ссылку на бота в Instagram, Telegram или на двери. Клиенты выбирают мастера и записываются.')],
  ['chart', L('Nazorat qiling', 'Контролируйте'), L('Kun va daromad bir joyda', 'День и доход в одном месте'), L("Bugungi bronlar, ustalar bandligi, daromad va kelmaganlar. Hammasi ilovada.", 'Записи на сегодня, загрузка мастеров, выручка и неявки. Всё в приложении.')],
];

const GUIDES = () => ({
  client: [['link', L('Bot havolasini oching', 'Откройте ссылку на бота'), L("«Bron qilish» tugmasini bosing.", 'Нажмите «Записаться».')], ['scissors', L('Xizmatni belgilang', 'Отметьте услугу'), L("Bir nechtasini tanlash mumkin.", 'Можно несколько.')], ['users', L('Ustani tanlang', 'Выберите мастера'), L("Yoki «Istalgan usta».", 'Или «Любой мастер».')], ['calendar', L('Kun va vaqt', 'День и время'), L("Faqat bo'sh vaqtlar ko'rinadi.", 'Видно только свободное.')], ['check', L('Tasdiqlang', 'Подтвердите'), L("Telefon va rozilik, so'ng eslatma keladi.", 'Телефон и согласие, затем придёт напоминание.')]],
  master: [['link', L('Taklif havolasi', 'Ссылка-приглашение'), L("Egasi yuborgan havola orqali kiring.", 'Войдите по ссылке от владельца.')], ['calendar', L('Jadval', 'Расписание'), L("Kunlik bronlaringizni ko'rasiz.", 'Видите свои записи на день.')], ['check', L('Keldi / Kelmadi', 'Пришёл / Не пришёл'), L("Tashrifdan keyin belgilang.", 'Отметьте после визита.')], ['clock', L('Ish vaqti', 'График'), L("O'z jadvalingiz, tanaffus va ta'tilingizni o'zingiz sozlang.", 'Настройте свой график, перерывы и отпуск.')]],
  owner: [['link', L('Egalikni oling', 'Получите владение'), L("Biz yuborgan havolani oching.", 'Откройте ссылку от нас.')], ['bot', L('Botni ulang', 'Подключите бота'), L("Tokenni o'zingiz kiritasiz.", 'Токен вставляете сами.')], ['scissors', L("Xizmat va ustalar", 'Услуги и мастера'), L("Narx, davomiylik, ish vaqti.", 'Цена, длительность, график.')], ['image', L("Ko'rinish", 'Внешний вид'), L("Rang va uslubni tanlang.", 'Выберите цвет и стиль.')], ['chart', L('Statistika', 'Статистика'), L("Daromad va mijozlarni kuzating.", 'Следите за доходом и клиентами.')]],
});

export async function about() {
  const [me, planData] = await Promise.all([getMe(true), GET('/api/plans').catch(() => ({ plans: [] }))]);
  const pricedPlans = planData.plans.filter(x => x.price > 0);
  const mine = me.businesses.length > 0;
  const current = mine ? 2 : 0;
  let tab = 'client';

  const mock = h('div', { class: 'mock', 'aria-hidden': 'true' },
    h('div', { class: 'mock-top' }, h('i', {}), h('b', {}, 'Barber House'), h('span', {}, icon('star', 'sm'), ' 4.9')),
    ...[['10:00', 'Jasur', L('Soch olish', 'Стрижка')], ['11:30', 'Otabek', L('Soch + soqol', 'Стрижка + борода')], ['14:00', 'Sardor', L('Soqol', 'Борода')]].map(([t, n, sv], i) =>
      h('div', { class: 'mock-row', style: { animationDelay: 0.5 + i * 0.7 + 's' } }, h('span', { class: 'mt' }, t), h('span', { class: 'mn' }, n + ' · ' + sv), icon('check', 'sm'))),
    h('div', { class: 'mock-btn' }, icon('calendar', 'sm'), L('Bron qilish', 'Записаться')));

  const rotor = h('div', { class: 'rotor', 'aria-hidden': 'true' }, [L('Sartaroshxona', 'Барбершоп'), L('Go\'zallik saloni', 'Салон красоты'), L('Klinika', 'Клиника')].map((w, i) => h('span', { style: { animationDelay: i * 2.4 + 's' } }, w)));

  const road = h('div', { class: 'roadmap', 'data-tour': 'roadmap' }, ROAD().map(([ic, title, short, more], i) => {
    const state = i < current ? 'done' : i === current ? 'now' : 'next';
    const node = h('button', { class: 'rm-node ' + state, 'aria-expanded': 'false', onclick: () => { const open = node.getAttribute('aria-expanded') === 'true'; document.querySelectorAll('.rm-node').forEach(n => n.setAttribute('aria-expanded', 'false')); node.setAttribute('aria-expanded', String(!open)); } },
      h('span', { class: 'rm-ic' }, icon(state === 'done' ? 'check' : ic), state === 'now' && h('i', { class: 'ring' })),
      h('span', { class: 'rm-body' }, h('b', {}, title), state === 'now' && h('span', { class: 'pill blue', style: { marginLeft: '8px' } }, L('Siz shu yerdasiz', 'Вы здесь')), h('span', { class: 'rm-short' }, short), h('span', { class: 'rm-more' }, more)),
      h('span', { class: 'rm-chev' }, icon('right', 'sm')));
    return node;
  }));

  const guideBox = h('div', { class: 'about-list' });
  const drawGuide = () => guideBox.replaceChildren(...GUIDES()[tab].map(([ic, t, d], i) => h('div', { class: 'gd', style: { animationDelay: i * 70 + 'ms' } }, h('span', { class: 'gd-ic' }, icon(ic, 'sm')), h('div', {}, h('b', {}, t), h('span', {}, d)))));
  const seg = h('div', { class: 'seg', style: { marginBottom: '10px' } }, [['client', L('Mijoz', 'Клиент')], ['master', L('Usta', 'Мастер')], ['owner', L('Egasi', 'Владелец')]].map(([k, l]) =>
    h('button', { 'aria-pressed': String(tab === k), onclick: e => { tab = k; [...seg.children].forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget))); drawGuide(); } }, l)));
  drawGuide();

  return h('div', { class: 'screen about' },
    top('Tashrif', null, mine || me.is_admin ? h('button', { class: 'btn sm', onclick: () => nav.go(me.is_admin ? '/admin' : '/?mine=1') }, me.is_admin ? L('Panel', 'Панель') : L('Bizneslarim', 'Мои бизнесы')) : null),
    h('section', { 'data-tour': 'hero' },
      h('h2', { class: 'about-hero' }, L("Telegram'da o'z bron botingiz", 'Онлайн-запись в вашем Telegram-боте')), rotor,
      h('p', { class: 'muted', style: { marginTop: '10px' } }, L("Mijozlar ustaga o'zi yoziladi, siz esa butun kunni bir joyda ko'rasiz.", 'Клиенты записываются сами, а вы видите весь день в одном месте.')),
      h('button', { class: 'btn sm', style: { marginTop: '14px' }, onclick: () => startTour('platform.about', { force: true }) }, icon('play', 'sm'), L("Qo'llanmani boshlash", 'Запустить инструкцию')),
      mock),
    h('div', { class: 'section-h' }, h('h2', {}, L('Nima olasiz', 'Что вы получаете'))),
    h('div', { class: 'about-grid', 'data-tour': 'features' }, TILES().map(([ic, t, d, c]) => h('div', { class: 'about-tile' }, h('span', { class: 'ti ' + c }, icon(ic)), h('b', {}, t), h('span', {}, d)))),
    h('div', { class: 'section-h' }, h('h2', {}, L("Yo'l xaritasi", 'Карта пути')), h('span', { class: 'muted', style: { fontSize: '13px' } }, L('Nuqtaga bosing', 'Нажмите на точку'))),
    road,
    h('div', { class: 'section-h' }, h('h2', {}, L('Kim uchun nima', 'Кто что делает'))),
    h('div', { class: 'card', 'data-tour': 'guide' }, seg, guideBox),
    h('div', { class: 'section-h' }, h('h2', {}, L('Narx', 'Стоимость'))),
    h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, L('14 kun bepul sinov', '14 дней бесплатно')),
      pricedPlans.length
        ? h('div', { class: 'list', style: { marginTop: '8px' } }, pricedPlans.map(pl => h('div', { class: 'item', style: { minHeight: '56px' } }, h('div', { class: 'grow' }, h('div', { class: 't' }, pl.name), h('div', { class: 'd' }, pl.max_staff ? L('eng ko\'pi ' + pl.max_staff + ' usta', 'до ' + pl.max_staff + ' мастеров') : L('cheklovsiz', 'без ограничений'))), h('div', { class: 'r num', style: { fontWeight: 500 } }, money(pl.price) + ' ' + _("so'm") + L('/oy', '/мес')))))
        : h('p', { class: 'muted', style: { marginTop: '4px' } }, L("Keyin — oylik to'lov. Shartlarni bog'langanimizda aytamiz.", 'Дальше — ежемесячная оплата. Условия назовём, когда свяжемся.'))),
    h('button', { class: 'textbtn', style: { margin: '16px 0 4px' }, onclick: () => feedbackSheet() }, L('Xizmat haqida fikr bildirish', 'Отправить отзыв о сервисе')),
    h('p', { class: 'hint', style: { margin: '0 0 96px' } }, legalLinks()),
    h('div', { class: 'dock', 'data-tour': 'cta' }, h('div', { class: 'dock-in' }, h('button', { class: 'btn primary block', onclick: () => leadSheet(me) }, icon('send', 'sm'), L("Ulanish so'rovini yuborish", 'Отправить заявку на подключение')))));
}

async function leadSheet(me) {
  const { cities } = await GET('/api/cities');
  const name = input({ value: me.user.name || '', maxlength: 60, autocomplete: 'name' });
  const phone = input({ value: me.user.phone || '', type: 'tel', inputmode: 'tel', placeholder: '+998 90 123 45 67', autocomplete: 'tel' });
  const biz = input({ maxlength: 80, placeholder: ru() ? 'Например: Barber House' : 'Masalan: Barber House' });
  const city = h('select', { class: 'input' }, h('option', { value: '' }, '—'), ...cities.map(c => h('option', { value: c.id }, ru() ? c.name_ru : c.name_uz)));
  const msg = h('textarea', { class: 'input', maxlength: 500, placeholder: ru() ? 'Сколько мастеров, что важно' : "Nechta usta, nima muhim" });
  const consent = toggle(false);
  const closeFn = sheet(() => [h('h2', {}, ru() ? 'Заявка на подключение' : "Ulanish so'rovi"), h('p', { class: 'muted', style: { marginBottom: '8px' } }, ru() ? 'Мы свяжемся с вами и всё настроим.' : "Biz siz bilan bog'lanib, hammasini sozlab beramiz."),
    field(ru() ? 'Ваше имя' : 'Ismingiz', name), field(_('Telefon raqam'), phone), field(ru() ? 'Название бизнеса' : 'Biznes nomi', biz), field(_('Shahar'), city), field(ru() ? 'Комментарий' : 'Izoh', msg),
    h('div', { class: 'line', style: { marginTop: '10px', alignItems: 'flex-start' } }, h('div', { class: 'grow d muted' }, ru() ? 'Согласен(на), что со мной свяжутся по указанному номеру.' : "Ko'rsatilgan raqam orqali men bilan bog'lanishlariga roziman."), consent),
    h('p', { class: 'hint' }, legalLinks()),
    h('button', { class: 'btn primary block', style: { marginTop: '14px' }, onclick: async e => {
      if (name.value.trim().length < 1) return toast(errText({ code: 'invalid_name' }), true);
      if (phone.value.replace(/\D/g, '').length < 9) return toast(errText({ code: 'invalid_phone' }), true);
      if (!consent.value) return toast(errText({ code: 'consent_required' }), true);
      await busy(e.currentTarget, () => POST('/api/p/lead', { name: name.value, phone: phone.value, business_name: biz.value, city_id: city.value || null, message: msg.value, consent: true }));
      closeFn();
      sheet(close2 => [h('div', { class: 'success', style: { padding: '24px 0' } }, h('div', { class: 'big' }, icon('check')), h('h1', {}, ru() ? 'Заявка принята' : "So'rov qabul qilindi"), h('p', { class: 'muted' }, ru() ? 'Скоро свяжемся с вами.' : "Tez orada siz bilan bog'lanamiz.")), h('button', { class: 'btn block', onclick: close2 }, _('Yopish'))]);
    } }, ru() ? 'Отправить' : 'Yuborish')]);
}

// ---------------------------------------------------------------- Fikr-mulohaza (hamma uchun)
export function feedbackSheet(businessId) {
  let kind = 'idea', rating = 0;
  const KINDS = [['idea', ru() ? 'Идея' : "G'oya"], ['bug', ru() ? 'Ошибка' : 'Xato'], ['praise', ru() ? 'Спасибо' : 'Rahmat'], ['other', ru() ? 'Другое' : 'Boshqa']];
  const seg = h('div', { class: 'chips' });
  const stars = h('div', { class: 'chips' });
  const drawSeg = () => seg.replaceChildren(...KINDS.map(([k, l]) => h('button', { class: 'chip' + (k === kind ? ' on' : ''), onclick: () => { kind = k; drawSeg(); } }, l)));
  const drawStars = () => stars.replaceChildren(...[1, 2, 3, 4, 5].map(i => h('button', { class: 'chip' + (i <= rating ? ' on' : ''), onclick: () => { rating = rating === i ? 0 : i; drawStars(); } }, icon('star', 'sm'), ' ' + i)));
  drawSeg(); drawStars();
  const text = h('textarea', { class: 'input', maxlength: 1000, placeholder: ru() ? 'Расскажите, что улучшить или что понравилось' : "Nimani yaxshilash kerak yoki nima yoqdi" });
  const closeFn = sheet(() => [h('h2', {}, ru() ? 'Отзыв о сервисе' : 'Fikr-mulohaza'), h('p', { class: 'muted', style: { marginBottom: '12px' } }, ru() ? 'Читаем каждое сообщение.' : "Har bir xabarni o'qiymiz."),
    seg, h('div', { style: { height: '8px' } }), stars, h('div', { style: { height: '12px' } }), text, h('div', { style: { height: '14px' } }),
    h('button', { class: 'btn primary block', onclick: async e => {
      if (text.value.trim().length < 3) return toast(ru() ? 'Напишите пару слов' : "Bir-ikki so'z yozing", true);
      await busy(e.currentTarget, () => POST('/api/feedback', { kind, rating: rating || null, text: text.value, business_id: businessId || undefined }));
      closeFn(); toast(ru() ? 'Спасибо!' : 'Rahmat!');
    } }, ru() ? 'Отправить' : 'Yuborish')]);
}

// ---------------------------------------------------------------- Platforma egasi: so'rovlar
const LEAD_ST = { new: ['Yangi', 'Новая'], contacted: ["Bog'lanildi", 'Связались'], progress: ['Jarayonda', 'В работе'], done: ['Bajarildi', 'Готово'], rejected: ['Rad etildi', 'Отклонена'] };
const stLabel = s => LEAD_ST[s][ru() ? 1 : 0];

export async function leadsScreen() {
  let filter = 'new';
  const box = h('div', {});
  const seg = h('div', { class: 'chips', style: { marginBottom: '12px' } });
  const draw = async () => {
    const r = await GET('/api/admin/leads' + (filter ? '?status=' + filter : ''));
    const all = await GET('/api/admin/leads').catch(() => ({ counts: r.counts }));
    seg.replaceChildren(...[['new', 'new'], ['progress', 'progress'], ['done', 'done'], ['', 'all']].map(([k, key]) => h('button', { class: 'chip', 'aria-pressed': String(filter === k), onclick: () => { filter = k; draw(); } },
      key === 'all' ? (ru() ? 'Все' : 'Hammasi') : stLabel(k), key !== 'all' && all.counts[k] ? h('span', { class: 'pill' }, all.counts[k]) : null)));
    box.replaceChildren(...(r.leads.length ? r.leads.map(l => leadCard(l, draw)) : [h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, ru() ? 'Заявок нет' : "So'rovlar yo'q"), ru() ? 'Когда кто-то оставит заявку, она появится здесь.' : "Kimdir so'rov qoldirsa, shu yerda ko'rinadi."))]));
  };
  await draw();
  return h('div', { class: 'screen' }, top(ru() ? 'Заявки' : "So'rovlar", '/admin'), seg, h('div', { class: 'stack' }, box));
}

function leadCard(l, onChange) {
  const note = h('textarea', { class: 'input', style: { minHeight: '56px' }, maxlength: 500, placeholder: ru() ? 'Заметка' : 'Eslatma' }, l.note || '');
  note.onchange = async () => { await PATCH('/api/admin/leads/' + l.id, { note: note.value }); toast(_('Saqlandi')); };
  const set = (status, label, cls = '') => h('button', { class: 'btn sm ' + cls, onclick: async e => { await busy(e.currentTarget, () => PATCH('/api/admin/leads/' + l.id, { status })); toast(_('Saqlandi')); onChange(); } }, label);
  return h('div', { class: 'card lead-card' },
    h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px' } }, h('div', { class: 't' }, l.name), h('span', { class: 'pill ' + (l.status === 'new' ? 'warn' : l.status === 'done' ? 'pos' : l.status === 'rejected' ? 'neg' : 'blue') }, stLabel(l.status))),
    h('div', { class: 'muted', style: { fontSize: '13px', marginTop: '2px' } }, when(l.created_at)),
    h('div', { style: { marginTop: '10px' } }, [l.business_name, l.city].filter(Boolean).join(' · ') || '—'),
    l.message && h('p', { class: 'muted', style: { marginTop: '6px' } }, l.message),
    h('div', { class: 'btn-row', style: { marginTop: '12px' } },
      h('a', { class: 'btn', href: 'tel:' + l.phone }, icon('phone', 'sm'), l.phone),
      l.username && h('button', { class: 'btn', onclick: () => openLink('https://t.me/' + l.username) }, 'Telegram')),
    h('div', { style: { marginTop: '12px' } }, note),
    h('div', { class: 'btn-row', style: { marginTop: '12px', flexWrap: 'wrap' } },
      l.business_id ? h('button', { class: 'btn sm primary', onclick: () => { A.id = null; nav.go('/a/' + l.business_id); } }, ru() ? 'Открыть бизнес' : 'Biznesni ochish')
        : h('button', { class: 'btn sm primary', onclick: () => nav.go('/admin/new?lead=' + l.id) }, icon('plus', 'sm'), ru() ? 'Создать бизнес' : 'Biznes yaratish'),
      l.status === 'new' && set('contacted', ru() ? 'Связались' : "Bog'landim"),
      l.status !== 'done' && set('done', ru() ? 'Готово' : 'Bajarildi'),
      l.status !== 'rejected' && set('rejected', ru() ? 'Отклонить' : 'Rad etish')));
}

// ---------------------------------------------------------------- Platforma egasi: fikrlar
const KIND = { idea: ["G'oya", 'Идея'], bug: ['Xato', 'Ошибка'], praise: ['Rahmat', 'Спасибо'], other: ['Boshqa', 'Другое'] };
export async function feedbackScreen() {
  let filter = 'new';
  const box = h('div', {});
  const seg = h('div', { class: 'seg', style: { marginBottom: '12px' } });
  const draw = async () => {
    const r = await GET('/api/admin/feedback' + (filter ? '?status=' + filter : ''));
    const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
    seg.replaceChildren(h('button', { 'aria-pressed': String(filter === 'new'), onclick: () => { filter = 'new'; draw(); } }, (ru() ? 'Новые' : 'Yangi') + (r.counts.new ? ' · ' + r.counts.new : '')),
      h('button', { 'aria-pressed': String(filter === ''), onclick: () => { filter = ''; draw(); } }, (ru() ? 'Все' : 'Hammasi') + ' · ' + total));
    box.replaceChildren(...(r.feedback.length ? r.feedback.map(f => h('div', { class: 'card' },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' } },
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, h('span', { class: 'pill ' + (f.kind === 'bug' ? 'neg' : f.kind === 'praise' ? 'pos' : '') }, KIND[f.kind][ru() ? 1 : 0]), f.rating && h('span', { class: 'stars' }, icon('star', 'sm'), ' ' + f.rating)),
        h('span', { class: 'muted', style: { fontSize: '12px' } }, when(f.created_at))),
      h('p', { style: { margin: '10px 0 6px' } }, f.text),
      h('div', { class: 'muted', style: { fontSize: '13px' } }, [[f.first_name, f.last_name].filter(Boolean).join(' '), f.username && '@' + f.username, f.business].filter(Boolean).join(' · ')),
      h('div', { class: 'btn-row', style: { marginTop: '10px' } },
        f.username && h('button', { class: 'btn sm', onclick: () => openLink('https://t.me/' + f.username) }, ru() ? 'Ответить' : 'Javob yozish'),
        h('button', { class: 'btn sm', onclick: async e => { await busy(e.currentTarget, () => PATCH('/api/admin/feedback/' + f.id, { status: f.status === 'new' ? 'seen' : 'new' })); draw(); } }, f.status === 'new' ? (ru() ? 'Прочитано' : "Ko'rildi") : (ru() ? 'Вернуть в новые' : 'Yangi deb belgilash')))))
      : [h('div', { class: 'card' }, h('div', { class: 'empty' }, h('b', {}, ru() ? 'Отзывов нет' : "Fikrlar yo'q")))]));
  };
  await draw();
  return h('div', { class: 'screen' }, top(ru() ? 'Отзывы' : 'Fikrlar', '/admin'), seg, h('div', { class: 'stack' }, box));
}

// ---------------------------------------------------------------- Platforma egasi: biznes yaratish va topshirish
export async function newBiz(_p, q) {
  const [{ cities }, lead] = await Promise.all([GET('/api/cities'), q.get('lead') ? GET('/api/admin/leads').then(r => r.leads.find(x => x.id === Number(q.get('lead')))) : null]);
  const name = input({ value: lead?.business_name || '', maxlength: 80, placeholder: ru() ? 'Название бизнеса' : 'Biznes nomi' });
  const kind = h('select', { class: 'input' }, [['barber', ru() ? 'Барбершоп' : 'Sartaroshxona'], ['beauty', ru() ? 'Салон красоты' : "Go'zallik saloni"], ['nails', ru() ? 'Маникюр' : 'Manikyur'], ['clinic', ru() ? 'Клиника' : 'Klinika'], ['other', ru() ? 'Другое' : 'Boshqa']].map(([v, l]) => h('option', { value: v }, l)));
  const city = h('select', { class: 'input' }, cities.map(c => h('option', { value: c.id, selected: lead?.city_id === c.id }, ru() ? c.name_ru : c.name_uz)));
  const box = h('div', {});
  const form = h('div', { class: 'stack' },
    lead && h('div', { class: 'card' }, h('div', { class: 'muted', style: { fontSize: '13px' } }, ru() ? 'Заявка' : "So'rov"), h('div', { style: { fontWeight: 600 } }, lead.name), h('div', { class: 'muted' }, lead.phone + (lead.message ? ' · ' + lead.message : ''))),
    h('div', { class: 'card' }, field(ru() ? 'Название бизнеса' : 'Biznes nomi', name), field(ru() ? 'Тип' : 'Turi', kind), field(_('Shahar'), city),
      h('button', { class: 'btn primary block', style: { marginTop: '16px' }, onclick: async e => {
        if (name.value.trim().length < 2) return toast(errText({ code: 'invalid_name' }), true);
        const r = await busy(e.currentTarget, () => POST('/api/a/business', { name: name.value, kind: kind.value, city_id: Number(city.value), lead_id: lead?.id }));
        box.replaceChildren(await handoverCard(r.id, name.value, r.claim_code));
        form.remove();
      } }, ru() ? 'Создать' : 'Yaratish')));
  return h('div', { class: 'screen' }, top(ru() ? 'Новый бизнес' : 'Yangi biznes', '/admin'), form, box);
}

/** Yaratilgan biznes: keyingi qadamlar va egasiga beriladigan havola */
export async function handoverCard(bizId, bizName, code) {
  const me = await getMe();
  const link = me.platform_bot_username && code ? claimLink(me.platform_bot_username, code) : null;
  const step = (n, title, desc, action) => h('div', { class: 'line', style: { alignItems: 'flex-start' } }, h('span', { class: 'done-mark' }, n), h('div', { class: 'grow' }, h('div', { class: 't' }, title), h('div', { class: 'd' }, desc)), action);
  return h('div', { class: 'stack' },
    h('div', { class: 'card' }, h('div', { style: { fontWeight: 600, fontSize: '16px' } }, bizName), h('div', { class: 'muted' }, ru() ? 'Бизнес создан. Дальше:' : 'Biznes yaratildi. Keyingi qadamlar:')),
    h('div', { class: 'card check-list' },
      step('1', ru() ? 'Отправьте клиенту ссылку' : 'Mijozga havolani yuboring', ru() ? 'Откроет — станет владельцем бизнеса' : "Ochsa — biznes egasiga aylanadi",
        link ? h('div', { class: 'btn-row' }, h('button', { class: 'btn sm', onclick: () => copyText(link) }, icon('link', 'sm'), _('Nusxalash')), h('button', { class: 'btn sm', onclick: () => openLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(bizName)}`) }, icon('share', 'sm'))) : null),
      step('2', ru() ? 'Клиент сам создаёт бота' : "Mijoz o'z botini yaratadi", ru() ? 'В @BotFather: /newbot. Токен он вставляет сам, мы его не видим.' : "@BotFather da /newbot. Tokenni o'zi kiritadi, biz ko'rmaymiz."),
      step('3', ru() ? 'Клиент настраивает' : 'Mijoz sozlaydi', ru() ? 'Данные, услуги, график, внешний вид' : "Ma'lumotlar, xizmatlar, jadval, ko'rinish")),
    h('button', { class: 'textbtn', onclick: () => { A.id = null; nav.go(`/a/${bizId}/bot`); } }, ru() ? 'Подключить бота за клиента (если он прислал токен)' : "Mijoz token yuborgan bo'lsa, uning o'rniga ulash"),
    h('button', { class: 'btn block', onclick: () => { A.id = null; nav.go('/a/' + bizId); } }, ru() ? 'Открыть управление' : 'Boshqaruvni ochish'));
}
