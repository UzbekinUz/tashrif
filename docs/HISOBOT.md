# Loyiha hisoboti: Telegram'da bron tizimi platformasi ("sotuvchi bot")

Sana: 2026-10-26 · Holat: ishlaydigan MVP (yadro, botlar, API, mini ilova) tayyor va sinalgan.

## 1. G'oya nima va u qanday ishlaydi

Bitta **platforma boti** ("sotuvchi") bor. Xizmat ko'rsatuvchi (sartarosh, salon, klinika) unga kiradi, biznesini yaratadi va **o'z botini** (@BotFather'dan olgan token bilan) ulaydi. Shundan so'ng o'sha bot unga **shaxsiy bron tizimi** bo'lib xizmat qiladi: mijozlar uning botiga kirib, mini ilova orqali usta va vaqtni tanlab yoziladi.

```
Platforma boti ──► Egasi biznes yaratadi ──► o'z botini ulaydi (token)
                                          └─► ustalarni taklif qiladi (havola)
Mijoz ──► biznesning boti ──► mini ilova (bron) + bot buyruqlari (/my, /location)
Usta/Egasi ──► o'sha mini ilovada "Boshqaruv" + botda tugmali bildirishnomalar
```

Bir mini ilova uch rolga xizmat qiladi, rol serverda aniqlanadi (mijoz Telegram ID'sini o'zgartirib egasiga aylana olmaydi):

| Rol | Nima qila oladi |
|---|---|
| Mijoz | do'konni ko'radi, bron qiladi, ko'chiradi, bekor qiladi, baho beradi |
| Usta (master) | faqat o'z bronlari, o'z ish vaqti, xizmatlari, ta'tili, qo'lda bron |
| Menejer | hamma bronlar, jamoa, xizmatlar, mijozlar; sozlamalar va botlar emas |
| Egasi | hammasi: sozlamalar, botlar, to'lov muddati |

## 2. Siz aytgan talablar va ular qanday hal qilindi

| Talab | Yechim |
|---|---|
| Bitta platforma boti, unga xizmat ko'rsatuvchilar kiradi | `src/telegram.js` — platforma boti + `/start` orqali mini ilova |
| O'z botini yaratadi (ulaydi) | Token → `getMe` bilan tekshiriladi → shifrlab saqlanadi → webhook/polling ishga tushadi, menyu tugmasi va buyruqlar avtomatik sozlanadi |
| Har bir sartarosh uchun alohida bot | Bot turi `staff` (shaxsiy): mijoz kirsa to'g'ridan-to'g'ri shu ustaga yoziladi |
| Bitta do'konda 4 usta, umumiy bot | Bot turi `shop` (umumiy): usta tanlanadi yoki **"istalgan usta"** (eng kam band ustaga avtomatik) |
| Ikkala tarafdan foydalanish: mini ilova **va** bot | Mini ilovada hamma narsa; botda `/my` (bekor qilish tugmasi bilan), `/location`, `/book`, ustaga **tugmali xabarlar** (Tasdiqlash / Keldi / Kelmadi) |
| Usta o'zi haqida ma'lumot kiritadi | Profil, rasm, haqida, lavozim, ish vaqti, tanaffus, xizmatlari (ustaga xos narx/davomiylik), galereya |
| Lokatsiya, shaharlar, rasmlar | 15 ta shahar ro'yxati, manzil + mo'ljal, koordinata (qurilma GPS'i yoki botga Telegram lokatsiyasini yuborish), "Xaritada ochish", logo/muqova/galereya (brauzerda kichraytirib yuklanadi) |
| To'q va qora ranglar, dizayn skill | `design-taste-frontend` skilli: **true-black-flat** uslubi (qora zamin, tus farqi bilan ko'tarilish, rang faqat ma'lumotda — mis-sariq; asosiy tugma oq pill). Skill inspektori: **0 FAIL** |

## 3. Bron tizimining barcha burchaklari (nimalarni inobatga oldim)

Hammasi `src/booking.js` da, Telegram/HTTP'dan mustaqil va **22 ta avtomatik test** bilan qoplangan.

**Slot hisoblash**
- Haftalik ish jadvali; bir kunda bir nechta oraliq (masalan 09–13 va 15–20).
- Tanaffuslar (har kuni yoki hafta kuniga); xizmat tanaffusga sig'masa slot berilmaydi.
- Alohida kun uchun maxsus soat yoki dam olish; ta'til (ustaga) va bayram/yopiq kun (butun biznesga).
- Bir nechta xizmat tanlansa davomiylik va narx **yig'iladi**; ustaga xos narx/davomiylik ustuvor.
- Bronlar orasida **bufer** (tozalash vaqti); slot qadami (15/30/60 daq).
- Minimal oldindan ogohlantirish ("1 soatdan kam qolgan vaqtga yozib bo'lmaydi"), maksimal muddat (30 kun), o'tgan vaqt yopiq.
- Vaqt mintaqasi: bazada UTC, hisob biznes mintaqasida (DST bor mintaqalar ham to'g'ri — sinalgan).

**Poyga holatlari va suiiste'mol**
- Ikki kishi bir vaqtda bitta slotni olsa: yozuv tranzaksiyasi (`BEGIN IMMEDIATE`) ichida qayta tekshiriladi — faqat biri o'tadi, ikkinchisiga "bu vaqt band bo'lib qoldi".
- Mijoz yuborgan vaqtga ishonilmaydi: server slot haqiqatan bo'shligini o'zi tekshiradi.
- Mijoz bir vaqtda ikki joyda bo'la olmaydi; faol bronlar chegarasi (3 ta); mijozning o'zi band vaqtlari ro'yxatda ko'rinmaydi.
- **Kelmaganlar**: usta "Kelmadi" belgilasa hisoblanadi; chegaradan (3) oshsa mijoz **avtomatik bloklanadi**.
- So'rov chastotasi cheklovi (daqiqada 240, bron uchun 12).

**Hayot sikli**
- Holatlar: kutilmoqda → tasdiqlangan → bajarildi / kelmadi; bekor (mijoz / usta). Noto'g'ri o'tishlar rad etiladi; "bajarildi/kelmadi" vaqt boshlanmaguncha belgilanmaydi.
- Tasdiqlash rejimi: avtomatik yoki usta qo'lda tasdiqlaydi (kutilayotgan bron ham slotni band qiladi).
- Mijoz bekor qilishi faqat chegaradan oldin (2 soat), faqat o'z broni. Ko'chirishda eski vaqt faqat yangisi bo'sh bo'lsa bo'shaydi (atomar).
- Usta/egasi bronni ko'chira oladi (boshqa ustaga ham), mijozga xabar ketadi.
- **Qo'lda bron** (yurib kelgan mijoz, telefon orqali) — Telegram'siz mijoz ham.
- Ustani o'chirishda kelgusi bronlar bo'lsa — egasidan so'raladi, tasdiqlansa bekor qilinib mijozlarga xabar yuboriladi. Ta'til qo'yganda to'qnashgan bronlar soni ko'rsatiladi.
- **Eslatmalar**: 24 soat va 2 soat oldin (sozlanadi), o'tib ketganlari qo'shilmaydi, ikki marta yuborilmaydi, bekor qilinsa o'chadi.
- Baholash: "Keldi" belgilangach mijozga 1–5 yulduz so'rovi; ustaning reytingi hisoblanadi.
- Obuna: sinov muddati (14 kun) → muddat tugasa yangi bron yopiladi (mavjudlari saqlanadi).

**Telegram'ning o'ziga xos cheklovlari**
- Bot faqat o'ziga yozgan foydalanuvchiga xabar yubora oladi: `user_bots` jadvali qaysi bot orqali yetkazish mumkinligini kuzatadi; 403 bo'lsa belgilanadi va boshqa botga o'tiladi.
- Bildirishnoma tugmalaridagi amallar (Tasdiqlash/Keldi) ham huquq tekshiruvidan o'tadi.
- Mini ilova `initData` HMAC bilan **har so'rovda** tekshiriladi (aynan shu botning tokeni bilan — boshqa bot nomidan soxtalashtirib bo'lmaydi; test bor).

## 4. Arxitektura

```
src/config.js     .env, maxfiy kalit        src/booking.js  BRON YADROSI (testlangan)
src/db.js         SQLite sxema (19 jadval)  src/api.js      REST API + ruxsatlar
src/crypto.js     AES-256-GCM, initData     src/telegram.js botlar, webhook/polling, xabarlar, eslatmalar
src/time.js       mintaqa hisobi            src/server.js   HTTP, statik, /tg/<bot> webhook
src/i18n.js       uz/ru bot matnlari        public/         mini ilova (vanilla JS, build kerak emas)
```

- **Texnologiya**: Node.js 22+ (ichki `node:sqlite`), grammY. Qo'shimcha og'ir kutubxona yo'q; mini ilova build talab qilmaydi.
- **Ko'p botli**: har bir ulangan bot — alohida grammY nusxasi; production'da webhook (`/tg/b<id>`, maxfiy sarlavha bilan), lokal'da polling.
- **Xavfsizlik**: tokenlar shifrlangan; rasm yuklash magic-bytes bilan tekshiriladi (5 MB); JSON 100 KB; har resurs biznes bo'yicha ruxsat tekshiruvidan o'tadi; ustalar faqat o'z qatoriga tegadi.
- **Til**: o'zbek (lotin) va rus — bot ham, mini ilova ham.

## 5. Tekshiruv natijalari (haqiqatan ishga tushirilgan)

- `npm test`: **27 ta test o'tdi** (22 bron yadrosi, 5 autentifikatsiya/shifrlash/vaqt mintaqasi).
- Brauzerda to'liq oqim: xizmat → usta → vaqt → tasdiq → "Bron qabul qilindi"; egasi ko'rinishidagi 12 ekran xatosiz ochildi.
- Ruxsat sinovlari: mijoz → boshqaruv 403; usta → boshqa usta jadvali 403; soxta `initData` 401; boshqa mijoz broni 404; yaroqsiz rasm 400.
- Dizayn: `lint --app` 0 FAIL; `inspect --app` 0 FAIL, 1 WARN (kompyuterda ustun markazda — mini ilova telefon uchun, ataylab).

**Tekshirilmagan (haqiqiy Telegram kerak):** haqiqiy bot tokeni bilan ulash, webhook, `web_app` tugmalari va xabar yuborish. Kod yozilgan, lekin bu muhitda token va HTTPS domen yo'q edi. Birinchi ishga tushirishda shularni sinab ko'rish kerak (7-bo'limga qarang).

## 6. Siz aytmagan, lekin qo'shgan g'oyalar

1. **Ustalar bandligi chizig'i** — bugungi kun uchun har bir usta bo'yicha vaqt chizig'i (band/kutilayotgan/o'tgan, hozirgi vaqt belgisi). Platformaning "o'ziga xos elementi".
2. **Sozlashni yakunlash ro'yxati** (bot ulang → xizmat → manzil → usta) — yangi egasini qo'llab-quvvatlaydi.
3. **Ustaga xos narx va davomiylik** (bosh barber qimmatroq, yosh barber arzonroq).
4. **"Istalgan usta"** rejimi va yuklamani tenglashtirish.
5. **Kelmaganlarni avtomatik bloklash**, mijoz eslatmalari va baholash.
6. **Platforma paneli** (admin): bizneslar, to'lov muddatini uzaytirish (bloklash API orqali).
7. Staff taklif havolasi (`t.me/<bot>?start=inv_…`) — usta o'zi kirib, jadvalini boshqaradi.

## 7. Keyingi qadamlar (tavsiya etilgan tartibda)

1. **Ishga tushirish va sinash** (1 kun): VPS/domen (HTTPS) → `.env` → platforma botini @BotFather'da yaratish (menyu tugmasi uchun) → real tokenlar bilan oqimni sinash.
2. **To'lov**: obuna uchun Click/Payme yoki Telegram Stars; hozir admin paneldan qo'lda uzaytiriladi (`paid_until`).
3. **Ommaviy katalog**: shahar bo'yicha sartaroshlarni topish (platforma botida) — mijozlar oqimi uchun eng kuchli o'sish vositasi. Ma'lumot tayyor (shahar, reyting, joylashuv).
4. **Navbat (waitlist)**: band kunga "bo'shasa xabar bering"; takroriy bron ("shu ustaga yana yozilish").
5. **Mijozga SMS/Telegram'siz** eslatma (telefon orqali) — Eskiz.uz integratsiyasi.
6. **Zaxira nusxa** (SQLite fayl + `uploads/`), monitoring; yuk oshsa PostgreSQL (so'rovlar ko'chirishga tayyor, `db.js` yagona kirish nuqtasi).
7. **Rasm saqlash**: hozir diskda; ko'p bo'lsa S3-mos omborga.
8. Mijoz tilini (uz/ru) biznes bo'yicha alohida; ish vaqti 24:00 dan o'tadigan tungi salonlar (hozir kun chegarasida).
9. Avtomatik testlarni HTTP darajasiga kengaytirish (hozir yadro + autentifikatsiya).

## 8. Ma'lum cheklovlar (halol ro'yxat)

- Ish vaqti bir kalendar kun ichida (soat 24:00 gacha).
- Bir bronda bir nechta usta yo'q (kombinatsiya bitta usta qiladi).
- Mijoz kunlar ro'yxatini hisoblashda o'z bronlarini hisobga olmaydi (faqat soat ro'yxatida olinadi).
- Telegram'siz mijozlar telefon bo'yicha birlashtirilmaydi (har qo'lda kiritishda yangi yozuv; qidirib tanlash mumkin).
- Chat holati (token/lokatsiya kutish) bazada, muddati yo'q — keyin tozalash kerak.
