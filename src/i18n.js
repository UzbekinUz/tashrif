import { tsToLocal } from './time.js';

const MONTHS = {
  uz: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'],
  ru: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
};

const D = {
  uz: {
    'btn.connect': '🤖 Botni ulash',
    'btn.book': '📅 Bron qilish', 'btn.open': '📱 Ilovani ochish', 'btn.admin': '⚙️ Boshqaruv',
    'btn.cancel': '❌ Bekor qilish', 'btn.confirm': '✅ Tasdiqlash', 'btn.decline': '🚫 Rad etish',
    'btn.done': '✔️ Keldi', 'btn.noshow': '🙅 Kelmadi',
    'start.client': 'Assalomu alaykum! <b>{name}</b> ga xush kelibsiz.\n{desc}\n\nBron qilish uchun pastdagi tugmani bosing.',
    'start.staff': 'Assalomu alaykum! Men <b>{staff}</b> ({name}) ning shaxsiy botiman.\nUstaga yozilish uchun tugmani bosing.',
    'platform.start': 'Assalomu alaykum! 👋\nBu bot orqali o\'z ish joyingiz (sartaroshxona, salon va h.k.) uchun <b>onlayn bron tizimi</b> yaratasiz:\n\n1) Biznesingizni qo\'shing\n2) @BotFather dan o\'z botingizni oling va shu yerga ulang\n3) Mijozlar sizning botingizda ustani tanlab, vaqtga yoziladi.\n\nBoshlash uchun ilovani oching.',
    'sub.d3': "⏰ <b>{biz}</b>: obuna muddati 3 kundan kam qoldi (tugash: {date}).\nUzluksiz ishlash uchun to'lovni amalga oshiring. Aloqa: {contact}",
    'sub.d1': "⏰ <b>{biz}</b>: obuna ertaga tugaydi ({date}).\nTo'lov uchun: {contact}",
    'sub.expired': "⚠️ <b>{biz}</b>: obuna muddati tugadi. Yangi bronlar qabul qilinmaydi, mavjud ma'lumotlar saqlanadi.\nQayta yoqish uchun: {contact}",
    'platform.sales': "Assalomu alaykum! 👋\nBu — <b>Tashrif</b>: sartaroshxona, salon va klinikalar uchun Telegram'dagi onlayn bron tizimi.\n\n• Mijozlar sizning o'z botingizda ustani tanlab, vaqtga yoziladi\n• Eslatmalar, ish jadvali, mijozlar bazasi va statistika — hammasi ilovada\n• Sozlashni biz o'z zimmamizga olamiz: botingizni ulab, sizga topshirib beramiz\n\n14 kun bepul sinab ko'ring. Batafsil va ulanish uchun ilovani oching.",
    'claim.ok': "✅ Tabriklaymiz! <b>{biz}</b> endi sizniki.\n\nKeyingi qadam — o'z botingizni ulash:\n1) Telegram'da @BotFather ni oching va /newbot yuboring\n2) Bot nomi va username kiriting (oxiri <code>bot</code> bilan tugaydi)\n3) Olgan tokeningizni pastdagi tugma orqali ilovada kiriting\n\nToken faqat sizda qoladi, biz uni ko'rmaymiz va u shifrlangan holda saqlanadi.",
    'claim.bad': "Bu havola yaroqsiz yoki allaqachon ishlatilgan. Sizga havola bergan kishi bilan bog'laning.",
    'platform.help': 'Buyruqlar:\n/start — bosh menyu\n/lang — tilni almashtirish\n\nBiznes yaratish va botni ulash uchun «Ilovani ochish» tugmasidan foydalaning. Bot tokenini shu yerga yuborsangiz ham bo\'ladi.',
    'invite.ok': '✅ Siz <b>{biz}</b> jamoasiga qo\'shildingiz ({staff}). Endi ilovada ish jadvalingizni sozlang.',
    'invite.owner': '👤 {user} taklifni qabul qildi: {staff}.',
    'invite.bad': 'Taklif havolasi yaroqsiz yoki allaqachon ishlatilgan.',
    'token.ask': 'Bot tokenini yuboring (@BotFather bergan, ko\'rinishi 123456:ABC...). Qaysi biznesga ulansin: {biz}',
    'token.ok': '✅ @{bot} ulandi. Endi mijozlaringiz shu botga kirib bron qila oladi.',
    'token.bad': 'Token noto\'g\'ri yoki bot topilmadi. Qaytadan urinib ko\'ring.',
    'token.used': 'Bu bot allaqachon ulangan.',
    'lang.set': 'Til o\'zgartirildi: O\'zbekcha',
    'loc.saved': '📍 Joylashuv saqlandi.',
    'my.none': 'Sizda faol bronlar yo\'q.',
    'my.title': 'Sizning bronlaringiz:',
    'loc.none': 'Manzil kiritilmagan.',
    'bk.client.created': '✅ Bron qabul qilindi\n{biz}\n👤 {staff}\n🗓 {when}\n💈 {services}\n💵 {price}',
    'bk.client.pending': '⏳ So\'rov yuborildi, usta tasdiqlashini kuting\n{biz}\n👤 {staff}\n🗓 {when}\n💈 {services}\n💵 {price}',
    'bk.client.confirmed': '✅ Bron tasdiqlandi\n🗓 {when}\n👤 {staff}',
    'bk.client.cancelled_staff': '❌ Afsuski, bron bekor qilindi\n🗓 {when}\n👤 {staff}\nIltimos, boshqa vaqtni tanlang.',
    'bk.client.moved': '🔁 Bron ko\'chirildi\n🗓 {when}\n👤 {staff}',
    'bk.staff.new': '🆕 Yangi bron\n👤 {client} {phone}\n🗓 {when}\n💈 {services}\n💵 {price}\n{note}',
    'bk.staff.cancelled': '❌ Mijoz bronni bekor qildi\n👤 {client}\n🗓 {when}',
    'bk.staff.moved': '🔁 Mijoz bronni ko\'chirdi\n👤 {client}\n🗓 {when}',
    'bk.reminder': '⏰ Eslatma: <b>{when}</b> da {staff} ga yozilgansiz.\n📍 {addr}',
    'bk.review': 'Tashrifingiz qanday o\'tdi? Ustani baholang:',
    'bk.review.thanks': 'Rahmat! Bahoyingiz qabul qilindi ⭐',
    'bk.status.done': 'Belgilandi: {s}',
    'st.pending': 'Kutilmoqda', 'st.confirmed': 'Tasdiqlangan', 'st.completed': 'Bajarildi',
    'st.no_show': 'Kelmadi', 'st.cancelled_client': 'Mijoz bekor qildi', 'st.cancelled_staff': 'Usta bekor qildi',
    'err.generic': 'Xatolik yuz berdi, qayta urinib ko\'ring.',
    'blocked': 'Bu botdan foydalanish cheklangan.',
    'closed': 'Hozircha bron qabul qilinmaydi.',
  },
  ru: {
    'btn.connect': '🤖 Подключить бота',
    'btn.book': '📅 Записаться', 'btn.open': '📱 Открыть приложение', 'btn.admin': '⚙️ Управление',
    'btn.cancel': '❌ Отменить', 'btn.confirm': '✅ Подтвердить', 'btn.decline': '🚫 Отклонить',
    'btn.done': '✔️ Пришёл', 'btn.noshow': '🙅 Не пришёл',
    'start.client': 'Здравствуйте! Добро пожаловать в <b>{name}</b>.\n{desc}\n\nНажмите кнопку ниже, чтобы записаться.',
    'start.staff': 'Здравствуйте! Я личный бот мастера <b>{staff}</b> ({name}).\nНажмите кнопку, чтобы записаться.',
    'platform.start': 'Здравствуйте! 👋\nЗдесь вы создаёте <b>онлайн-запись</b> для своего заведения (барбершоп, салон и т.д.):\n\n1) Добавьте бизнес\n2) Получите своего бота в @BotFather и подключите сюда\n3) Клиенты выбирают мастера и записываются в вашем боте.\n\nОткройте приложение, чтобы начать.',
    'sub.d3': "⏰ <b>{biz}</b>: до конца подписки меньше 3 дней (до {date}).\nОплатите, чтобы работа не прерывалась. Связь: {contact}",
    'sub.d1': "⏰ <b>{biz}</b>: подписка заканчивается завтра ({date}).\nДля оплаты: {contact}",
    'sub.expired': "⚠️ <b>{biz}</b>: срок подписки истёк. Новые записи не принимаются, данные сохранены.\nЧтобы возобновить: {contact}",
    'platform.sales': "Здравствуйте! 👋\nЭто <b>Tashrif</b> — онлайн-запись в Telegram для барбершопов, салонов и клиник.\n\n• Клиенты записываются к мастеру в вашем собственном боте\n• Напоминания, график, база клиентов и статистика — всё в приложении\n• Настройку берём на себя: подключим вашего бота и передадим вам\n\n14 дней бесплатно. Откройте приложение, чтобы узнать подробнее и оставить заявку.",
    'claim.ok': "✅ Поздравляем! <b>{biz}</b> теперь ваш.\n\nСледующий шаг — подключить своего бота:\n1) Откройте @BotFather в Telegram и отправьте /newbot\n2) Придумайте название и username (оканчивается на <code>bot</code>)\n3) Вставьте полученный токен в приложении по кнопке ниже\n\nТокен остаётся только у вас: мы его не видим, он хранится в зашифрованном виде.",
    'claim.bad': "Ссылка недействительна или уже использована. Свяжитесь с тем, кто её отправил.",
    'platform.help': 'Команды:\n/start — главное меню\n/lang — сменить язык\n\nДля создания бизнеса и подключения бота откройте приложение. Токен бота можно также прислать сюда.',
    'invite.ok': '✅ Вы присоединились к команде <b>{biz}</b> ({staff}). Настройте график в приложении.',
    'invite.owner': '👤 {user} принял приглашение: {staff}.',
    'invite.bad': 'Ссылка-приглашение недействительна или уже использована.',
    'token.ask': 'Пришлите токен бота (от @BotFather, вида 123456:ABC...). Бизнес: {biz}',
    'token.ok': '✅ @{bot} подключён. Теперь клиенты могут записываться через этого бота.',
    'token.bad': 'Токен неверный или бот не найден. Попробуйте ещё раз.',
    'token.used': 'Этот бот уже подключён.',
    'lang.set': 'Язык изменён: Русский',
    'loc.saved': '📍 Локация сохранена.',
    'my.none': 'У вас нет активных записей.',
    'my.title': 'Ваши записи:',
    'loc.none': 'Адрес не указан.',
    'bk.client.created': '✅ Запись принята\n{biz}\n👤 {staff}\n🗓 {when}\n💈 {services}\n💵 {price}',
    'bk.client.pending': '⏳ Заявка отправлена, ждите подтверждения мастера\n{biz}\n👤 {staff}\n🗓 {when}\n💈 {services}\n💵 {price}',
    'bk.client.confirmed': '✅ Запись подтверждена\n🗓 {when}\n👤 {staff}',
    'bk.client.cancelled_staff': '❌ К сожалению, запись отменена\n🗓 {when}\n👤 {staff}\nПожалуйста, выберите другое время.',
    'bk.client.moved': '🔁 Запись перенесена\n🗓 {when}\n👤 {staff}',
    'bk.staff.new': '🆕 Новая запись\n👤 {client} {phone}\n🗓 {when}\n💈 {services}\n💵 {price}\n{note}',
    'bk.staff.cancelled': '❌ Клиент отменил запись\n👤 {client}\n🗓 {when}',
    'bk.staff.moved': '🔁 Клиент перенёс запись\n👤 {client}\n🗓 {when}',
    'bk.reminder': '⏰ Напоминание: вы записаны на <b>{when}</b> к {staff}.\n📍 {addr}',
    'bk.review': 'Как прошёл визит? Оцените мастера:',
    'bk.review.thanks': 'Спасибо! Оценка принята ⭐',
    'bk.status.done': 'Отмечено: {s}',
    'st.pending': 'Ожидает', 'st.confirmed': 'Подтверждена', 'st.completed': 'Выполнена',
    'st.no_show': 'Не пришёл', 'st.cancelled_client': 'Отменил клиент', 'st.cancelled_staff': 'Отменил мастер',
    'err.generic': 'Произошла ошибка, попробуйте ещё раз.',
    'blocked': 'Использование этого бота ограничено.',
    'closed': 'Запись временно не принимается.',
  },
};

export const LANGS = ['uz', 'ru'];
export const normLang = l => (l && l.toLowerCase().startsWith('ru') ? 'ru' : 'uz');

export function t(lang, key, vars = {}) {
  const s = (D[lang] && D[lang][key]) ?? D.uz[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function fmtWhen(ts, tz, lang) {
  const l = tsToLocal(ts, tz);
  const [, m, d] = l.date.split('-').map(Number);
  const hh = String(Math.floor(l.minutes / 60)).padStart(2, '0'), mm = String(l.minutes % 60).padStart(2, '0');
  return lang === 'ru' ? `${d} ${MONTHS.ru[m - 1]}, ${hh}:${mm}` : `${d}-${MONTHS.uz[m - 1]}, ${hh}:${mm}`;
}

export const fmtPrice = (n, cur = 'UZS') => `${Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ')} ${cur === 'UZS' ? "so'm" : cur}`;

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
