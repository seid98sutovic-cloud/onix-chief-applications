# ONIX Roleplay — Chief of Police Application System

Kompletan web sistem za prijave na poziciju Chief of Police.

## Šta uključuje

- **Javna forma** — jedan link za kandidate (`/`)
- **27 profesionalnih pitanja** u sekcijama
- **SQLite baza** — sve prijave se čuvaju lokalno
- **Admin panel** (`/admin`) — login, pregled, pretraga, statusi
- **Email obavijesti** — automatski mail na svaku novu prijavu
- **ONIX dizajn** — dark theme, responsive

## Brzi start (lokalno)

```bash
cd onix-chief-applications
cp .env.example .env
# Uredi .env — ADMIN_PASSWORD, JWT_SECRET, SMTP podatke
npm install
npm start
```

- **Forma:** http://localhost:3000
- **Admin:** http://localhost:3000/admin

Default admin (iz `.env`):
- Username: `admin`
- Password: vrijednost iz `ADMIN_PASSWORD`

## Konfiguracija (.env)

| Varijabla | Opis |
|-----------|------|
| `PORT` | Port servera (default 3000) |
| `BASE_URL` | Javni URL (za linkove u emailu) |
| `ADMIN_USERNAME` | Admin login |
| `ADMIN_PASSWORD` | Admin lozinka |
| `JWT_SECRET` | Duga random vrijednost |
| `SMTP_HOST` | npr. smtp.gmail.com |
| `SMTP_PORT` | 587 |
| `SMTP_USER` | Email nalog |
| `SMTP_PASS` | App password |
| `NOTIFY_EMAIL` | Email za obavijesti |
| `EMAIL_FROM` | From adresa |

### Gmail SMTP

1. Uključi 2FA na Google nalogu
2. Kreiraj App Password: Google Account → Security → App passwords
3. U `.env` stavi:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=tvoj@gmail.com
   SMTP_PASS=app-password-ovdje
   NOTIFY_EMAIL=tvoj@gmail.com
   ```

## Statusi prijava

- **Novo** — upravo poslano
- **U razmatranju** — pregled u toku
- **Prihvaćen** — kandidat prošao
- **Odbijen** — odbijena prijava

## Dodavanje admin korisnika

```bash
npm run setup-admin
# ili
node server/setup-admin.js username password
```

## Deploy (Docker)

```bash
docker build -t onix-chief-apps .
docker run -d -p 3000:3000 --env-file .env -v onix-data:/app/data onix-chief-apps
```

## Deploy (VPS / hosting)

1. Upload folder na server
2. Instaliraj Node.js 20+
3. `npm install --omit=dev`
4. Postavi `.env` sa produkcijskim vrijednostima
5. Pokreni sa PM2:
   ```bash
   pm2 start server/index.js --name onix-chief
   ```
6. Postavi reverse proxy (Nginx/Caddy) sa HTTPS
7. U `.env` postavi `BASE_URL=https://tvoj-domen.com`

## Sigurnost

- Admin panel je zaštićen JWT cookie sesijom
- Kandidati nemaju pristup admin API-ju
- Rate limit na slanje prijava (5 / 15 min)
- Lozinke su hashirane bcrypt-om

## Struktura

```
onix-chief-applications/
├── server/
│   ├── index.js          # Express server
│   ├── db.js             # SQLite
│   ├── auth.js           # JWT
│   ├── email.js          # Nodemailer
│   ├── questions.js      # 27 pitanja
│   └── routes/
├── public/
│   ├── index.html        # Javna forma
│   ├── admin/            # Admin panel
│   ├── css/
│   └── js/
└── data/                 # SQLite baza (auto-kreirana)
```

## Javni link za Discord

Nakon deploya, podijeli:
```
https://tvoj-domen.com/
```

Admin panel drži privatno — ne dijeli login podatke.
