# Tashrif: Telegram bron platformasi

Batafsil hisobot: [docs/HISOBOT.md](docs/HISOBOT.md)

## Ishga tushirish
```bash
npm install
cp .env.example .env      # PLATFORM_BOT_TOKEN va PUBLIC_URL ni to'ldiring
npm start                 # http://localhost:3000/app/
npm test                  # 27 ta test
```

## Lokal sinov (Telegram'siz)
```bash
# .env da DEV_MODE=1
node scripts/seed-dev.mjs  # demo biznes (Barber House)
npm start
```
- Mijoz: `http://localhost:3000/app/?b=1&dev=2001`
- Egasi: `http://localhost:3000/app/?b=1&dev=1001#/a/1`
- Usta: `?b=1&dev=1002#/a/1` · Platforma: `?b=platform&dev=1001`

## Production
HTTPS domen kerak (Telegram mini ilova va webhook talabi): `PUBLIC_URL=https://domen.uz`.
Bot ulanganda webhook va menyu tugmasi avtomatik o'rnatiladi.
