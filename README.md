# RoemahCita CMS

RoemahCita CMS adalah platform manajemen konten berbasis Next.js App Router yang dirancang untuk kebutuhan editorial modern. Aplikasi ini menyediakan dashboard terintegrasi untuk mengatur artikel, halaman, media, navigasi, dan pengaturan situs dengan fitur keamanan tingkat lanjut seperti autentikasi dua faktor serta pemblokiran IP otomatis.

## Fitur Utama
- **Manajemen konten lengkap**: kelola artikel, halaman statis, kategori, dan tag dengan editor rich text.
- **Media library**: unggah dan gunakan aset gambar yang tersimpan di penyimpanan lokal atau S3 kompatibel.
- **Menu builder**: susun menu navigasi secara drag & drop, termasuk tautan internal maupun eksternal.
- **Dashboard berbasis peran**: akses dibatasi untuk Administrator, Editor, dan Author dengan kontrol granular.
- **Keamanan berlapis**: 2FA, rate limiting, blokir IP otomatis, audit log, dan kebijakan keamanan yang dapat dikonfigurasi.
- **Komentar publik terawasi**: formulir komentar aman dengan sanitasi XSS, pembatasan brute force, dan integrasi login.
- **Backup & restore**: ekspor dan impor data konten serta konfigurasi situs langsung dari dashboard.
- **Performa**: caching halaman publik, dukungan ISR, serta desain responsif menggunakan Tailwind CSS.

## Teknologi yang Digunakan
- [Next.js 15 (App Router)](https://nextjs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Prisma ORM](https://www.prisma.io/) + PostgreSQL
- [NextAuth v5](https://authjs.dev/) dengan autentikasi kredensial & 2FA
- [Tailwind CSS](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/) untuk pengujian

## Struktur Direktori
```
cms/
├── app/                    # App Router routes untuk publik & dashboard
├── components/             # UI components & form utilities
├── config/                 # Konfigurasi navigasi & konstanta
├── lib/                    # Helper (auth, security, validators, dsb.)
├── prisma/                 # Skema Prisma & seed
├── public/                 # Assets statis
├── tests/                  # E2E & unit tests
└── README.md               # Dokumentasi proyek (file ini)
```

## Prasyarat
- Node.js 20.x (disarankan menggunakan [nvm](https://github.com/nvm-sh/nvm))
- PostgreSQL 14+ (lokal atau managed service)
- Git
- Opsional: penyimpanan S3 kompatibel (AWS S3, MinIO, Cloudflare R2, dsb.) untuk media

## Konfigurasi Environment
Salin `.env.example` menjadi `.env.local` (untuk pengembangan) atau `.env.production` (untuk server) lalu isi nilainya. File `.env.example` bersifat referensi dan boleh dikomit, sedangkan file berisi rahasia jangan pernah dibagikan publik.

| Nama Variabel | Deskripsi |
| ------------- | --------- |
| `DATABASE_URL` | URL koneksi PostgreSQL (format Prisma). |
| `DATABASE_CONNECTION_LIMIT` | Batas koneksi maksimal per instance Prisma (default 5, sesuaikan dengan kapasitas database/pgBouncer). |
| `NEXTAUTH_SECRET` | String acak >= 32 karakter untuk enkripsi session. |
| `NEXTAUTH_URL` | URL publik aplikasi (contoh: `https://cms.domain.com`). |
| `NEXT_PUBLIC_APP_URL` | URL publik yang digunakan di sisi klien (misal untuk berbagi tautan). |
| `APP_URL` | URL publik aplikasi untuk pembuatan tautan aktivasi email. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | (Opsional) Site key Cloudflare Turnstile untuk formulir publik (reset password). |
| `TURNSTILE_SECRET_KEY` | (Opsional) Secret key Turnstile untuk memverifikasi token di server. Wajib saat site key diaktifkan. |
| `AWS_S3_BUCKET` | (Opsional) Nama bucket untuk media. Kosongkan untuk penyimpanan lokal. |
| `AWS_S3_REGION` | (Opsional) Region bucket. |
| `AWS_S3_ACCESS_KEY_ID` & `AWS_S3_SECRET_ACCESS_KEY` | (Opsional) Kredensial akses S3. |
| `SMTP_HOST` | Host SMTP untuk pengiriman email aktivasi. |
| `SMTP_PORT` | Port SMTP (umumnya 465 atau 587). |
| `SMTP_USER` & `SMTP_PASSWORD` | Kredensial autentikasi SMTP. |
| `SMTP_SECURE` | Gunakan `true` jika menggunakan TLS implicit (465), `false` jika STARTTLS (587). |
| `SMTP_FROM` | Alamat email pengirim (contoh: `Roemah Cita <no-reply@domain.com>`). |
| `SEED_ADMIN_PASSWORD` | (Opsional) Password admin saat seeding. Jika tidak diisi, script akan membuat password acak dan menampilkannya di log. |

> Gunakan `openssl rand -hex 32` atau `npx auth secret` untuk membuat nilai `NEXTAUTH_SECRET`.

## Menjalankan Secara Lokal
```bash
# Clone repository
git clone <repo-url> roemahcita-cms
cd roemahcita_cms/cms
cp .env.example .env.local
# Edit .env.local sesuai konfigurasi Anda

# Instal dependencies
npm install

# Jalankan migrasi & seed data awal (opsional)
npx prisma migrate dev
npm run prisma:seed

# Mulai server pengembangan
npm run dev
```

Aplikasi akan tersedia di [http://localhost:3000](http://localhost:3000). Login awal dapat dibuat lewat seed atau langsung dari database.

## Skrip Penting
- `npm run dev` – menjalankan Next.js mode pengembangan.
- `npm run build` – build produksi.
- `npm run start` – menjalankan hasil build (pastikan `npm run build` sukses).
- `npm run lint` – menjalankan ESLint.
- `npm run test` – menjalankan unit test (Vitest).
- `npm run e2e` – menjalankan Playwright E2E tests.
- `npm run prisma:generate` – generate client Prisma.
- `npm run prisma:migrate` – migrasi dev; gunakan `npx prisma migrate deploy` di server produksi.
- `npm run prisma:seed` – mengisi data awal.

## Checklist Kesiapan Produksi
- Pastikan `.env.production` terisi lengkap (database, `NEXTAUTH_SECRET`, URL publik, SMTP, opsi S3 bila diperlukan).
- Sesuaikan `DATABASE_CONNECTION_LIMIT` dengan kapasitas pool database atau layanan pgBouncer yang digunakan.
- Jalankan `npm run lint`, `npm run test`, dan `npm run build` hingga semuanya lulus tanpa error.
- Jalankan `npx prisma migrate deploy` pada database produksi sebelum boot pertama.
- Konfigurasi layanan email (SMTP) dan storage sesuai kebutuhan lalu uji kirim email aktivasi.
- Siapkan reverse proxy (mis. Nginx) serta sertifikat TLS (Let’s Encrypt/sertifikat resmi) sebelum membuka akses publik.

## Panduan Deploy ke Server Online (Contoh Ubuntu 22.04)

### 1. Siapkan Server
```bash
# Update paket
sudo apt update && sudo apt upgrade -y

# Instal dependensi dasar
sudo apt install -y build-essential curl git

# Instal Node.js 20 via nvm
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.nvm/nvm.sh
nvm install 20

# (Opsional) Instal PostgreSQL lokal
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres createuser cms_user -P
sudo -u postgres createdb roemahcita_cms -O cms_user
```

Atur firewall dan hostname sesuai kebijakan Anda (contoh menggunakan UFW dan menutup port yang tidak perlu).

### 2. Clone Proyek & Instal Dependensi
```bash
cd /var/www
sudo mkdir roemahcita-cms && sudo chown $USER:$USER roemahcita-cms
git clone <repo-url> roemahcita-cms
cd roemahcita-cms/cms
npm ci
```

### 3. Konfigurasi Environment
Salin file contoh environment dan isi dengan kredensial produksi:
```bash
cp .env.example .env.production
```
Perbarui nilainya:
```env
DATABASE_URL="postgresql://cms_user:password@localhost:5432/roemahcita_cms?schema=public"
DATABASE_CONNECTION_LIMIT=10           # Sesuaikan dengan kapasitas pool DB/pgBouncer
NEXTAUTH_URL="https://cms.domain.com"
NEXT_PUBLIC_APP_URL="https://cms.domain.com"
APP_URL="https://cms.domain.com"
NEXTAUTH_SECRET="ganti_dengan_random_hex_64"
# Jika memakai S3:
# AWS_S3_BUCKET="nama-bucket"
# AWS_S3_REGION="ap-southeast-1"
# AWS_S3_ACCESS_KEY_ID="AKIA..."
# AWS_S3_SECRET_ACCESS_KEY="..."
```

Gunakan `chmod 600 .env.production` agar file tidak mudah dibaca pihak lain. Saat menjalankan aplikasi, muat variabel env tersebut (contoh dengan shell bawaan):
```bash
set -a
source .env.production
set +a
```

### 4. Migrasi & Seed Database
```bash
npx prisma migrate deploy   # menjalankan migrasi di produksi
npm run prisma:seed         # opsional, jika butuh data awal
npm run prisma:generate
```

### 5. Validasi Build & Jalankan Produksi
```bash
npm run lint
npm run test
npm run build
NODE_ENV=production npm run start
```

Agar service tetap hidup setelah logout, gunakan process manager. Contoh dengan `pm2`:
```bash
sudo npm install -g pm2
pm2 start npm --name "roemahcita-cms" -- start
pm2 save
pm2 startup systemd
```

Contoh konfigurasi `systemd` (jika tidak memakai pm2):
```
[Unit]
Description=RoemahCita CMS
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/roemahcita-cms/cms
EnvironmentFile=/var/www/roemahcita-cms/cms/.env.production
ExecStart=/usr/bin/env NODE_ENV=production /home/<user>/.nvm/versions/node/v20.11.0/bin/npm run start
Restart=always

[Install]
WantedBy=multi-user.target
```
Simpan sebagai `/etc/systemd/system/roemahcita.service`, lalu:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now roemahcita.service
```

### 6. Konfigurasi Reverse Proxy & HTTPS
Pasang Nginx dan arahkan ke port 3000:
```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/roemahcita
```
Contoh server block:
```
server {
    listen 80;
    server_name cms.domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Aktifkan dan restart:
```bash
sudo ln -s /etc/nginx/sites-available/roemahcita /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Tambah HTTPS menggunakan [Certbot](https://certbot.eff.org/):
```bash
sudo apt install python3-certbot-nginx
sudo certbot --nginx -d cms.domain.com
```

### 7. Pemeliharaan
- Jalankan `pm2 restart roemahcita-cms` atau `systemctl restart roemahcita.service` setelah update.
- Catat backup database secara berkala (`pg_dump` atau managed backup).
- Gunakan halaman dashboard > Keamanan untuk memantau blokir IP dan mengubah kebijakan rate limit.

## Pengujian & QA
- **Unit test**: `npm run test`
- **E2E test** (Playwright): `npm run e2e`
- **Linting**: `npm run lint`

Jalankan lint dan test sebelum deploy untuk memastikan tidak ada regresi.

## Kontribusi
Pull request dan diskusi issue sangat diterima. Silakan gunakan format commit yang jelas dan sertakan langkah reproduksi jika melaporkan bug.

---
© RoemahCita CMS – dibangun dengan penuh perhatian pada keamanan dan pengalaman editorial.
