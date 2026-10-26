// Birinchi kirishda o'rgatish: "Men yangiman" / "Hammasini bilaman" oynasi va elementlarni birma-bir
// yoritib tushuntiradigan qo'llanma ("Tushundim" tugmalari bilan). Har bir ekranning o'z qo'llanmasi bor.
import { h, _, ctx, icon, L, tg } from './lib.js';
import { showAll } from './fx.js';

const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  del: k => { try { localStorage.removeItem(k); } catch {} },
};

// ---------------------------------------------------------------- qo'llanmalar (sel yo'q = markazdagi kirish oynasi)
const TOURS = {
  'platform.about': () => [
    { icon: 'sparkle', title: L('Tashrif nima?', 'Что такое Tashrif?'), text: L("Sartaroshxona, salon va klinikalar uchun Telegram'dagi onlayn bron tizimi. Sahifani qisqacha ko'rsatib o'tamiz.", 'Онлайн-запись в Telegram для барбершопов, салонов и клиник. Коротко покажем страницу.') },
    { sel: '[data-tour=hero]', icon: 'phone2', title: L("Asosiy g'oya", 'Главная идея'), text: L("Mijozlaringiz sizning o'z botingizda ustani tanlab vaqtga yoziladi. Siz esa butun kunni ilovada ko'rasiz.", 'Клиенты выбирают мастера и время в вашем собственном боте, а вы видите весь день в приложении.') },
    { sel: '[data-tour=features]', icon: 'zap', title: L('Nimalar olasiz', 'Что вы получаете'), text: L("Har bir kartada bitta imkoniyat: bron, jadval, eslatma, statistika va o'z ko'rinishingiz.", 'В каждой карточке одна возможность: запись, график, напоминания, статистика и свой внешний вид.') },
    { sel: '[data-tour=roadmap]', icon: 'map', title: L("Yo'l xaritasi", 'Карта пути'), text: L("Boshlashdan mijoz yozilguncha yo'l shu tartibda. Nuqtaga bossangiz, batafsil ochiladi.", 'Путь от старта до первой записи. Нажмите на точку, чтобы раскрыть подробности.') },
    { sel: '[data-tour=guide]', icon: 'help', title: L('Kim uchun nima', 'Кто что делает'), text: L("Mijoz, usta va biznes egasi uchun alohida qisqa qo'llanma bor. Tablarni almashtirib ko'ring.", 'Для клиента, мастера и владельца есть отдельная короткая инструкция. Переключайте вкладки.') },
    { sel: '[data-tour=cta]', icon: 'send', title: L('Boshlash', 'Начать'), text: L("Tayyor bo'lsangiz, shu tugma bilan so'rov yuboring. Biz bog'lanib, hammasini sozlab beramiz.", 'Когда будете готовы, отправьте заявку этой кнопкой. Мы свяжемся и всё настроим.') },
  ],
  'platform.list': () => [
    { icon: 'home', title: L('Bizneslaringiz', 'Ваши бизнесы'), text: L("Bu yerda siz egasi yoki xodimi bo'lgan bizneslar turadi.", 'Здесь бизнесы, где вы владелец или сотрудник.') },
    { sel: '.screen > .card', icon: 'sliders', title: L('Boshqaruvga kirish', 'Вход в управление'), text: L("Biznes kartasiga bosing: bugungi bronlar, jadval, jamoa va sozlamalar ochiladi.", 'Нажмите на карточку бизнеса: откроются записи на сегодня, график, команда и настройки.') },
    { sel: '.seg', icon: 'globe', title: L('Til', 'Язык'), text: L("O'zbekcha va ruscha o'rtasida almashtiring.", 'Переключайтесь между узбекским и русским.') },
  ],
  'platform.admin': () => [
    { icon: 'award', title: L('Platforma paneli', 'Панель платформы'), text: L("Bu sizning markaziy paneringiz: barcha bizneslar, daromad, so'rovlar va fikrlar shu yerda.", 'Ваш центральный пульт: все бизнесы, доход, заявки и отзывы.') },
    { sel: '.btn-row .btn.primary', icon: 'plus', title: L('Biznes yaratish', 'Создать бизнес'), text: L("Yangi mijoz uchun biznes shu yerdan yaratiladi, keyin egalik havolasi beriladi.", 'Бизнес для нового клиента создаётся здесь, затем выдаётся ссылка владельца.') },
    { sel: '.screen > .card .list', icon: 'bell', title: L("So'rovlar va fikrlar", 'Заявки и отзывы'), text: L("Yangi ulanish so'rovlari va fikrlar soni shu yerda. Bosib ichiga kiring.", 'Здесь число новых заявок и отзывов. Нажмите, чтобы открыть.') },
    { sel: '.kpis', icon: 'trend', title: L("Ko'rsatkichlar", 'Показатели'), text: L("Daromad, bizneslar, bronlar, ustalar, mijozlar va botlar soni.", 'Доход, бизнесы, записи, мастера, клиенты и боты.') },
    { sel: '.bars', icon: 'chart', title: L('Dinamika', 'Динамика'), text: L("Oxirgi 30 kun: bronlar yoki yangi bizneslar. Ustunga bosib sonni ko'ring.", 'Последние 30 дней: записи или новые бизнесы.') },
    { sel: '.screen > .card:last-child', icon: 'users', title: L("Bizneslar ro'yxati", 'Список бизнесов'), text: L("Biznesga bosing: to'lovni yozish, egalik havolasi, bloklash yoki ichiga kirish.", 'Нажмите на бизнес: записать оплату, ссылка владельца, блокировка или вход внутрь.') },
  ],
  'admin.today': () => [
    { icon: 'home', title: L('Bugungi kun', 'Сегодняшний день'), text: L("Bu ekran bitta savolga javob beradi: bugun kim keladi va nima qilish kerak.", 'Этот экран отвечает на один вопрос: кто сегодня придёт и что делать.') },
    { sel: '.top .btn.primary', icon: 'plus', title: L('Yangi bron', 'Новая запись'), text: L("Telefon orqali yoki yurib kelgan mijozni shu yerdan yozasiz.", 'Здесь записываете клиента, который позвонил или пришёл сам.') },
    { sel: '.check-list', icon: 'flag', title: L('Sozlashni yakunlang', 'Завершите настройку'), text: L("Botni ulash, xizmat qo'shish, manzil va ustalar. Bosib to'g'ri joyga o'tasiz.", 'Подключить бота, добавить услуги, адрес и мастеров. Нажмите, чтобы перейти.') },
    { sel: '.kpis', icon: 'trend', title: L("Bugungi ko'rsatkichlar", 'Показатели дня'), text: L("Bronlar soni, kutilayotgan tushum va keyingi mijoz vaqti.", 'Число записей, ожидаемая выручка и время следующего клиента.') },
    { sel: '.lanes', icon: 'clock', title: L('Ustalar bandligi', 'Загрузка мастеров'), text: L("Har bir usta uchun kun chizig'i: rangli joy — band, oq chiziq — hozirgi vaqt.", 'Линия дня по каждому мастеру: цветное — занято, белая черта — сейчас.') },
    { sel: '.bk', icon: 'calendar', title: L('Bron qatori', 'Строка записи'), text: L("Bosib tafsilotni ochasiz. «Keldi» va «Kelmadi» tugmalari vaqt kelganda chiqadi.", 'Нажмите, чтобы открыть детали. Кнопки «Пришёл» и «Не пришёл» появляются, когда время пришло.') },
    { sel: '.tabbar', icon: 'grid', title: L('Pastki menyu', 'Нижнее меню'), text: L("Jadval — istalgan kun, Jamoa — ustalar va ish vaqti, Xizmatlar — narxlar, Boshqa — mijozlar, statistika, sozlamalar.", 'Расписание — любой день, Команда — мастера и график, Услуги — цены, Ещё — клиенты, статистика, настройки.') },
  ],
  'admin.day': () => [
    { sel: 'input[type=date]', icon: 'calendar', title: L('Kunni tanlang', 'Выберите день'), text: L("Strelkalar bilan kun almashtiring yoki sanani tanlang.", 'Листайте дни стрелками или выберите дату.') },
    { sel: '.chips', icon: 'users', title: L("Usta bo'yicha", 'По мастеру'), text: L("Faqat bitta ustaning bronlarini ko'rish uchun uning ismiga bosing.", 'Нажмите на имя мастера, чтобы видеть только его записи.') },
    { sel: '.bk', icon: 'clock', title: L('Bronlar', 'Записи'), text: L("Har bir qator: vaqt, mijoz, xizmat va narx. Bosib ko'chirish yoki bekor qilish mumkin.", 'Каждая строка: время, клиент, услуга и цена. Нажмите, чтобы перенести или отменить.') },
  ],
  'admin.team': () => [
    { sel: '.top .btn.primary', icon: 'plus', title: L("Usta qo'shish", 'Добавить мастера'), text: L("Ism va rolni kiriting. Keyin unga taklif havolasi yuborasiz.", 'Введите имя и роль, затем отправьте ему ссылку-приглашение.') },
    { sel: '.list .item', icon: 'user', title: L('Usta kartasi', 'Карточка мастера'), text: L("Bosing: rasm, ish vaqti, tanaffus, xizmat narxlari, ta'til va shaxsiy bot shu yerda.", 'Нажмите: фото, график, перерывы, цены услуг, отпуск и личный бот.') },
  ],
  'admin.staff': () => [
    { sel: '.avatar.lg', icon: 'camera', title: L("Rasm va ma'lumot", 'Фото и данные'), text: L("Mijozlar ustani shu rasm va ism bilan ko'radi.", 'Клиенты увидят мастера с этим фото и именем.') },
    { sel: '.dayrow', icon: 'clock', title: L('Ish vaqti', 'График работы'), text: L("Kunni yoqing yoki o'chiring, soatlarni belgilang. «+» bilan bir kunga ikkinchi oraliq qo'shiladi.", 'Включайте и выключайте день, задавайте часы. «+» добавляет второй интервал.') },
    { sel: '.btn.primary.block', icon: 'check', title: L('Saqlash', 'Сохранить'), text: L("Har bir bo'lim alohida saqlanadi. O'zgarish darrov mijozlarga ko'rinadi.", 'Каждый раздел сохраняется отдельно. Изменения сразу видны клиентам.') },
  ],
  'admin.services': () => [
    { sel: '.top .btn.primary', icon: 'plus', title: L("Xizmat qo'shish", 'Добавить услугу'), text: L("Nomi, narxi va davomiyligini yozing. Yangi xizmat hamma ustalarga qo'shiladi.", 'Укажите название, цену и длительность. Новая услуга добавится всем мастерам.') },
    { sel: '.list .item', icon: 'scissors', title: L('Xizmat qatori', 'Строка услуги'), text: L("Bosib tahrirlang yoki o'chiring. Bronlari bor xizmat o'chmaydi, arxivga tushadi.", 'Нажмите для правки или удаления. Услуга с записями не удаляется, а уходит в архив.') },
  ],
  'admin.more': () => [
    { sel: '.list .item', icon: 'grid', title: L("Bo'limlar", 'Разделы'), text: L("Mijozlar, statistika, ish rasmlari, ilova ko'rinishi, sozlamalar va botlar.", 'Клиенты, статистика, фото работ, вид приложения, настройки и боты.') },
    { sel: '.seg', icon: 'globe', title: L('Til', 'Язык'), text: L("Ilova tilini o'zbekcha va ruscha o'rtasida almashtiring.", 'Переключайте язык приложения между узбекским и русским.') },
    { sel: '.btn.block', icon: 'message', title: L('Fikr bildirish', 'Отзыв'), text: L("Xato topsangiz yoki g'oyangiz bo'lsa, platforma egasiga shu yerdan yozing.", 'Нашли ошибку или есть идея — напишите владельцу платформы отсюда.') },
  ],
  'admin.theme': () => [
    { sel: '.preview', icon: 'image', title: L("Jonli ko'rinish", 'Живой просмотр'), text: L("Mijozlar botingizni shunday ko'radi. Pastdagi sozlamalar darrov shu yerda ko'rinadi.", 'Так клиенты видят вашего бота. Настройки ниже сразу отражаются здесь.') },
    { sel: '.swatches', icon: 'sparkle', title: L('Rang', 'Цвет'), text: L("8 ta tayyor rang. Tanlanganida butun ilova shu rangga o'tadi.", '8 готовых цветов. Выбранный цвет применяется ко всему приложению.') },
    { sel: '.btn-row .btn.primary', icon: 'check', title: L('Saqlash', 'Сохранить'), text: L("Saqlamasangiz, mijozlar eski ko'rinishni ko'radi.", 'Пока не сохраните, клиенты видят прежний вид.') },
  ],
  'client.home': () => [
    { icon: 'sparkle', title: L('Xush kelibsiz!', 'Добро пожаловать!'), text: L("Bu yerda ustaga bir necha bosishda yozilasiz. Qisqacha ko'rsatamiz.", 'Здесь можно записаться к мастеру за пару нажатий. Коротко покажем.') },
    { sel: '.hero-name', icon: 'home', title: L("Do'kon sahifasi", 'Страница заведения'), text: L("Nomi, manzili va tavsifi. Rasm va ishlar ham shu yerda.", 'Название, адрес и описание. Здесь же фото и работы.') },
    { sel: '.btn-row', icon: 'phone', title: L("Aloqa va xarita", 'Связь и карта'), text: L("Qo'ng'iroq qiling yoki xaritada manzilni oching.", 'Позвоните или откройте адрес на карте.') },
    { sel: '.masters', icon: 'users', title: L('Ustalar', 'Мастера'), text: L("Ustaga bossangiz, to'g'ridan-to'g'ri shu ustaga yozilasiz.", 'Нажмите на мастера, и запись пойдёт именно к нему.') },
    { sel: '.dock .btn', icon: 'calendar', title: L('Bron qilish', 'Записаться'), text: L("Shu tugmadan boshlang: xizmat, usta, vaqt, tasdiqlash.", 'Начните с этой кнопки: услуга, мастер, время, подтверждение.') },
    { sel: '.tabbar', icon: 'clock', title: L('Bronlarim', 'Мои записи'), text: L("Yozilgan vaqtlaringiz, ko'chirish va bekor qilish shu yerda.", 'Ваши записи, перенос и отмена находятся здесь.') },
  ],
  'client.services': () => [
    { sel: '.pick', icon: 'scissors', title: L('Xizmatni belgilang', 'Отметьте услугу'), text: L("Bir nechta xizmatni tanlash mumkin: vaqt va narx qo'shiladi.", 'Можно выбрать несколько услуг: время и цена суммируются.') },
    { sel: '.dock', icon: 'check', title: L('Jami va davom etish', 'Итог и далее'), text: L("Pastda jami narx va vaqt. «Davom etish» bilan keyingi qadamga o'tasiz.", 'Внизу итоговая цена и время. «Продолжить» ведёт к следующему шагу.') },
  ],
  'client.staff': () => [
    { sel: '.pick', icon: 'users', title: L('Ustani tanlang', 'Выберите мастера'), text: L("«Istalgan usta» tanlansa, bo'sh ustaga avtomatik yoziladi. Yoki aniq ustani tanlang.", 'Если выбрать «Любой мастер», запись пойдёт к свободному. Или выберите конкретного.') },
  ],
  'client.time': () => [
    { sel: '.days', icon: 'calendar', title: L('Kunni tanlang', 'Выберите день'), text: L("Xira kunlar band yoki dam olish. Yon tomonga suring.", 'Блёклые дни заняты или выходные. Листайте вбок.') },
    { sel: '.slots', icon: 'clock', title: L("Bo'sh vaqt", 'Свободное время'), text: L("Faqat bo'sh vaqtlar ko'rinadi. Birini tanlang.", 'Показано только свободное время. Выберите одно.') },
    { sel: '.dock .btn', icon: 'check', title: L('Davom etish', 'Продолжить'), text: L("Vaqtni tanlagach tugma faollashadi.", 'После выбора времени кнопка станет активной.') },
  ],
  'client.confirm': () => [
    { sel: '.card', icon: 'check', title: L('Tekshirib oling', 'Проверьте'), text: L("Xizmat, usta, vaqt va jami narx. Xato bo'lsa orqaga qayting.", 'Услуга, мастер, время и итоговая цена. Если что-то не так, вернитесь назад.') },
    { sel: 'input[type=tel]', icon: 'phone', title: L('Telefon raqam', 'Номер телефона'), text: L("Usta zarur bo'lsa shu raqam orqali bog'lanadi.", 'Мастер свяжется по этому номеру, если понадобится.') },
    { sel: '.switch', icon: 'shield', title: L('Aloqaga rozilik', 'Согласие на связь'), text: L("Bronni tasdiqlash uchun rozilik kerak. Rozilik bermasangiz, usta telefonni ko'rmaydi.", 'Для подтверждения нужно согласие. Без него мастер не увидит ваш телефон.') },
    { sel: '.dock .btn', icon: 'send', title: L('Tasdiqlash', 'Подтвердить'), text: L("Bosganingizdan so'ng bron qabul qilinadi va eslatma keladi.", 'После нажатия запись принимается, а затем придёт напоминание.') },
  ],
  'client.my': () => [
    { sel: '.card, .empty', icon: 'calendar', title: L('Bronlaringiz', 'Ваши записи'), text: L("Har bir kartada vaqt va usta. «Ko'chirish» boshqa vaqtga o'tkazadi, «Bekor qilish» bronni olib tashlaydi.", 'В каждой карточке время и мастер. «Перенести» меняет время, «Отменить» снимает запись.') },
  ],
};

// ---------------------------------------------------------------- holat
let currentKey = null;
let fab = null;
const seenKey = k => 'tour.seen.' + k;
export const guided = () => ls.get('tour.guided') === '1';
export const hasTour = k => !!TOURS[k];

/** Hamma qo'llanmalarni qayta boshlash (Boshqa ekranidan) */
export function resetAll() {
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('tour.seen.')) { ls.del(k); i--; } }
  ls.set('tour.guided', '1'); ls.set('tour.welcomed', '1');
}

// ---------------------------------------------------------------- kirish oynasi
function welcome(onChoice) {
  const scrim = h('div', { class: 'scrim' });
  const close = v => { scrim.remove(); modal.remove(); onChoice(v); };
  const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'wave' }, icon('sparkle'), h('i', { class: 'ring r1' }), h('i', { class: 'ring r2' })),
    h('h2', {}, L('Xush kelibsiz!', 'Добро пожаловать!')),
    h('p', { class: 'muted' }, L("Bu ilovada hamma narsa tushunarli bo'lishi uchun qisqa qo'llanma tayyorladik: har bir tugma nima qilishini ko'rsatib o'tamiz.", 'Чтобы здесь всё было понятно, мы подготовили короткую инструкцию: покажем, что делает каждая кнопка.')),
    h('div', { class: 'stack', style: { marginTop: '18px' } },
      h('button', { class: 'btn primary block', onclick: () => close('new') }, icon('play', 'sm'), L("Men yangiman, o'rgating", 'Я новичок, покажите')),
      h('button', { class: 'btn block', onclick: () => close('known') }, L('Hammasini bilaman', 'Я всё знаю'))),
    h('p', { class: 'hint', style: { textAlign: 'center' } }, L("Qo'llanmani keyin ham «?» tugmasi bilan ochish mumkin.", 'Инструкцию можно открыть позже кнопкой «?».')));
  document.body.append(scrim, modal);
}

// ---------------------------------------------------------------- qo'llanma
const COLORS = ['var(--accent)', 'var(--blue)', 'var(--positive)', '#f08a7a', '#f2994a', '#f08fb0'];

export function startTour(key, { force = false } = {}) {
  const defs = TOURS[key]?.() || [];
  const steps = defs.filter(s => !s.sel || document.querySelector(s.sel));
  if (!steps.length) return false;
  document.querySelector('.tour')?.remove();
  showAll();
  let i = 0;
  const spot = h('div', { class: 'tour-spot' }, h('i', { class: 'pulse' }));
  const card = h('div', { class: 'tour-card' });
  const root = h('div', { class: 'tour', role: 'dialog', 'aria-modal': 'true' }, spot, card);
  const finish = () => {
    ls.set(seenKey(key), '1');
    window.removeEventListener('resize', onResize); document.removeEventListener('keydown', onKey);
    root.classList.add('out'); setTimeout(() => root.remove(), 160);
    if (tg?.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  };
  const onResize = () => place();
  const onKey = e => { if (e.key === 'Escape') finish(); else if (e.key === 'Enter' || e.key === 'ArrowRight') next(); };
  const next = () => { if (i >= steps.length - 1) finish(); else { i++; render(); } };
  const prev = () => { if (i > 0) { i--; render(); } };

  function render() {
    const s = steps[i];
    card.replaceChildren(
      h('div', { class: 'tc-head' }, h('span', { class: 'tc-ic', style: { background: COLORS[i % COLORS.length] } }, icon(s.icon || 'info')), h('span', { class: 'tc-n' }, `${i + 1} / ${steps.length}`)),
      h('div', { class: 'tc-title' }, s.title), h('p', { class: 'tc-text' }, s.text),
      h('div', { class: 'tc-dots' }, steps.map((_x, j) => h('i', { class: j === i ? 'on' : j < i ? 'done' : '' }))),
      h('div', { class: 'tc-actions' },
        i > 0 ? h('button', { class: 'btn sm', onclick: prev }, L('Orqaga', 'Назад')) : h('button', { class: 'textbtn', onclick: finish }, L("O'tkazib yuborish", 'Пропустить')),
        h('button', { class: 'btn primary sm', onclick: next }, i === steps.length - 1 ? L('Tugatish', 'Готово') : L('Tushundim', 'Понятно'))));
    card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    const el = s.sel ? document.querySelector(s.sel) : null;
    if (el) { const fixed = getComputedStyle(el).position === 'fixed' || el.closest('.dock, .tabbar'); if (!fixed) el.scrollIntoView({ block: 'center' }); }
    setTimeout(place, 50);
  }
  function place() {
    const s = steps[i];
    const el = s.sel ? document.querySelector(s.sel) : null;
    const cw = Math.min(360, innerWidth - 32), ch = card.offsetHeight || 200;
    card.style.width = cw + 'px'; card.style.left = (innerWidth - cw) / 2 + 'px';
    if (!el) { spot.style.opacity = '0'; card.style.top = Math.max(24, (innerHeight - ch) / 2) + 'px'; return; }
    const r = el.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, { opacity: '1', left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const below = innerHeight - r.bottom, above = r.top;
    let top;
    if (below >= ch + 20) top = r.bottom + pad + 12;
    else if (above >= ch + 20) top = r.top - pad - ch - 12;
    else top = innerHeight - ch - 16;
    card.style.top = Math.max(12, top) + 'px';
  }
  document.body.append(root);
  window.addEventListener('resize', onResize); document.addEventListener('keydown', onKey);
  render();
  return true;
}

// ---------------------------------------------------------------- har bir ekran ochilganda
export function afterRender(key) {
  currentKey = key;
  fab?.remove(); fab = null;
  if (!key || !TOURS[key]) return;
  // doimiy yordam tugmasi: istalgan vaqtda joriy ekran qo'llanmasini qayta ochadi
  fab = h('button', { class: 'helpfab' + (document.querySelector('.dock') ? ' up' : ''), 'aria-label': L("Qo'llanma", 'Инструкция'), onclick: () => startTour(key, { force: true }) }, icon('help'));
  document.body.append(fab);
  const t = setTimeout(() => {
    if (currentKey !== key || document.querySelector('.modal, .tour')) return;
    if (!ls.get('tour.welcomed')) {
      welcome(choice => { ls.set('tour.welcomed', '1'); ls.set('tour.guided', choice === 'new' ? '1' : '0'); if (choice === 'new') startTour(key); });
    } else if (guided() && !ls.get(seenKey(key))) startTour(key);
  }, 900);
  return () => clearTimeout(t);
}
