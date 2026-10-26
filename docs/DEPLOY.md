# Tashrif: VPS ga joylash (qadamma-qadam)

Maqsad: bepul tunnelsiz, doimiy HTTPS manzilda, o'zi qayta yonadigan va zaxira nusxali server.

```
Telegram ──► https://tashrif.sizning-domen.uz ──► Caddy (HTTPS) ──► Node (pm2, 127.0.0.1:3000) ──► SQLite (data/)
```

## 0. Boshlashdan oldin hal qiling

| Savol | Tavsiya |
|---|---|
| **Server qayerda bo'lsin?** | O'zbekiston qonunchiligi fuqarolarning shaxsiy ma'lumotlarini mamlakat hududidagi serverlarda saqlashni talab qilishi mumkin. Telefon raqamlarini yig'ganingiz uchun, **yurist bilan tekshirib**, kerak bo'lsa O'zbekistondagi hosting/VPS (masalan mahalliy provayderlar) tanlang. |
| **Server hajmi** | Boshlash uchun 1–2 vCPU, 2 GB RAM, 20+ GB disk yetadi (Ubuntu 24.04 LTS). |
| **Domen** | Subdomen ham bo'ladi: `tashrif.sizning-domen.uz`. DNS da **A-yozuv** VPS IP ga qaratiladi. |
| **Platforma boti** | @BotFather da yaratilgan, tokeni tayyor. Nomini `/setname` bilan "Tashrif" qiling. |

## 1. Serverga kirish va asosiy himoya

```bash
ssh root@SERVER_IP
adduser tashrif                      # parol qo'ying
usermod -aG sudo tashrif
```

SSH kalit bilan kirishni sozlang (parolsiz), keyin `root` va parol bilan kirishni o'chiring:

```bash
# kompyuteringizda:  ssh-copy-id tashrif@SERVER_IP
sudo nano /etc/ssh/sshd_config       # PermitRootLogin no ; PasswordAuthentication no
sudo systemctl restart ssh
```

Xavfsizlik devori (faqat SSH, HTTP, HTTPS):

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
sudo apt update && sudo apt -y upgrade
```

## 2. Node.js 22+, pm2, Caddy

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

# Caddy (rasmiy repozitoriy):
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
node -v    # v22 yoki yuqori bo'lishi shart (node:sqlite uchun)
```

## 3. Loyihani serverga yuklash

Eng oddiy yo'l (Git bo'lmasa): kompyuteringizdan nusxalash. **`node_modules`, `data`, `.env` ni yubormang.**

```bash
# Windows PowerShell dan:
scp -r D:\AI\order\src D:\AI\order\public D:\AI\order\deploy D:\AI\order\docs D:\AI\order\scripts D:\AI\order\package.json D:\AI\order\package-lock.json D:\AI\order\ecosystem.config.cjs tashrif@SERVER_IP:/home/tashrif/app/
```

Yoki Git orqali (tavsiya, yangilash osonlashadi): loyihani **maxfiy** repozitoriyga (GitHub/GitLab) joylab, serverda `git clone`.

```bash
cd /home/tashrif/app
npm ci --omit=dev                    # faqat ishlab chiqarish paketlari
mkdir -p data backups
```

## 4. Sozlamalar (`.env`)

```bash
nano /home/tashrif/app/.env
```

```
PLATFORM_BOT_TOKEN=...                      # BotFather tokeni
PUBLIC_URL=https://tashrif.sizning-domen.uz
ADMIN_TG_IDS=5202212872                     # sizning Telegram ID
DEV_MODE=0                                  # production da DOIM 0
TRIAL_DAYS=14
```

```bash
chmod 600 .env
```

`data/.secret` (bot tokenlarini shifrlash kaliti) birinchi ishga tushishda **o'zi yaratiladi**. Uni nusxalab, parol menejeri yoki oflayn joyda **alohida** saqlang.

## 5. HTTPS (Caddy)

1. DNS da A-yozuv tayyor bo'lsin: `dig +short tashrif.sizning-domen.uz` serveringiz IP sini ko'rsatsin.
2. `deploy/Caddyfile` ni sozlang: domen va email ni almashtiring.

```bash
sudo cp /home/tashrif/app/deploy/Caddyfile /etc/caddy/Caddyfile
sudo mkdir -p /var/log/caddy && sudo chown caddy /var/log/caddy
sudo systemctl reload caddy
```

Sertifikat 1 daqiqa ichida o'zi olinadi.

## 6. Ishga tushirish (pm2)

```bash
cd /home/tashrif/app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup          # chiqargan buyruqni (sudo bilan) nusxalab ishga tushiring: server qayta yonsa ham ishlaydi
pm2 logs tashrif     # jurnal
```

Konsolda ko'rinishi kerak: `[tg] platforma boti tayyor`.

Tekshirish:

```bash
curl https://tashrif.sizning-domen.uz/health     # ok
```

Telegramda platforma botiga `/start` yuboring: "Ilovani ochish" tugmasi chiqadi.

## 7. Eski ma'lumotni ko'chirish (ixtiyoriy)

Hozirgi kompyuterdagi baza va kalitni ko'chirmoqchi bo'lsangiz, **ikkalasini birga**:

```powershell
scp D:\AI\order\data\app.db D:\AI\order\data\.secret tashrif@SERVER_IP:/home/tashrif/app/data/
```

Serverni to'xtatib (`pm2 stop tashrif`), fayllarni qo'yib, qayta yoqing. Ulangan botlarning webhook'lari yangi manzilga **o'zi o'rnatiladi** (server ishga tushganda va har 5 daqiqada tekshiriladi). Toza boshlamoqchi bo'lsangiz hech narsa ko'chirmang.

## 8. Zaxira nusxa

```bash
crontab -e
```

```
30 3 * * * cd /home/tashrif/app && /usr/bin/node --no-warnings scripts/backup.mjs >> data/backup.log 2>&1
45 3 * * * tar -czf /home/tashrif/backups/uploads-$(date +\%F).tar.gz -C /home/tashrif/app/data uploads
```

- Bazaning oxirgi 14 ta nusxasi saqlanadi (`backups/`).
- **Zaxirani boshqa joyga ham nusxalang** (boshqa server, bulut ombor): bir server buzilsa, hammasi yo'qolmasin.
- `data/.secret` zaxirasi alohida bo'lishi shart. Kalitsiz zaxiradagi bot tokenlari ochilmaydi.
- Qayta tiklash: `pm2 stop tashrif`, zaxirani `data/app.db` ga nusxalang, `pm2 start tashrif`.

## 9. Yangilash

```bash
cd /home/tashrif/app
git pull                  # yoki yangi fayllarni scp bilan yuklang
npm ci --omit=dev
pm2 restart tashrif
pm2 logs tashrif --lines 50
```

Muammo bo'lsa: oldingi versiyaga qaytib `pm2 restart tashrif`. Baza sxemasi yangilanishlari server ishga tushganda o'zi bajariladi (faqat ustun/jadval qo'shiladi).

## 10. Tekshiruv ro'yxati

- [ ] `https://domen/health` → `ok`
- [ ] `.env` da `DEV_MODE=0`, fayl ruxsati `600`
- [ ] 3000-port tashqaridan yopiq (`ufw status`, faqat 22/80/443)
- [ ] Platforma botiga `/start` javob beradi, mini ilova ochiladi
- [ ] Dashboard (siz admin sifatida) ochiladi, boshqa foydalanuvchida chiqmaydi
- [ ] Tariflar va to'lov ko'rsatmasi sozlangan (Dashboard → Tariflar va to'lov)
- [ ] `docs/` dagi shartlar va maxfiylik siyosatidagi [QUADRATLI QAVSLAR] to'ldirilgan, yurist ko'rgan
- [ ] Zaxira cron ishlayapti (`ls backups/`) va `.secret` nusxasi alohida joyda
- [ ] Kamida bitta sinov biznes bilan to'liq oqim: so'rov → biznes yaratish → egalik havolasi → bot ulash → bron

## Muammolar

| Belgi | Sabab va yechim |
|---|---|
| `Failed to resolve host` webhook xatosi | DNS hali tarqalmagan. Bot o'zi qayta urinadi (30 marta), kuting yoki `dig` bilan tekshiring. |
| Caddy sertifikat olmayapti | 80/443 ochiqmi, A-yozuv to'g'rimi, domen boshqa joyga qaramayaptimi. `sudo journalctl -u caddy -n 50`. |
| `node:sqlite` topilmadi | Node 22.13+ kerak: `node -v`. |
| Bot javob bermayapti | `pm2 logs tashrif`, bot tokeni to'g'rimi, `getWebhookInfo` da `last_error_message`. |
| Tokenlarni ochib bo'lmayapti | `data/.secret` boshqa kalit. Eski faylni qaytaring. |
