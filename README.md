# KarirKit Backend

REST API untuk KarirKit yang mencakup autentikasi, aplikasi pekerjaan, surat lamaran, portfolio, dan CV builder.

## Fitur

- **Autentikasi dengan OTP**: Login dengan password dan verifikasi OTP opsional
- **Manajemen Aplikasi**: Track aplikasi pekerjaan dengan status dan follow-up
- **CV Builder**: Buat dan kelola CV dengan template
- **Portfolio**: Kelola portfolio proyek
- **Surat Lamaran**: Generate surat lamaran dengan template
- **Blog System**: Manajemen konten blog dengan kategori dan tags
- **Admin Dashboard**: Manajemen pengguna dan konten

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MariaDB dengan Prisma ORM
- **Authentication**: JWT dengan OTP opsional
- **Queue**: Redis + Bull untuk email processing
- **Validation**: Zod
- **Language**: TypeScript

## Prerequisites

- Node.js 18+
- MariaDB 10.6+
- Redis 6+
- npm atau yarn
- (Opsional untuk fitur PDF) Ghostscript dan LibreOffice

## Dependency untuk PDF (Ghostscript + LibreOffice)

Fitur konversi DOCX ke PDF membutuhkan Ghostscript dan LibreOffice terpasang di server.

### Windows

Opsi 1: Chocolatey
```bash
choco install ghostscript libreoffice-fresh -y
```

Opsi 2: Installer resmi
- Ghostscript: https://www.ghostscript.com/download/gsdnld.html
- LibreOffice: https://www.libreoffice.org/download/download/

Pastikan `gswin64c` (Ghostscript) dan `soffice` (LibreOffice) tersedia di PATH.

### Ubuntu Server

```bash
sudo apt update
sudo apt install -y ghostscript libreoffice
```

Verifikasi instalasi:
```bash
gs --version
soffice --version
```

## Installation

1. Clone repository
```bash
git clone <repository-url>
cd karirkit-backend
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env
```

Edit `.env` file dengan konfigurasi Anda:
```env
# Database
DATABASE_URL="mysql://username:password@localhost:3306/karirkit"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="1d"

# Server
PORT=3000
NODE_ENV="development"
MAINTENANCE_MODE=false

# Email Configuration
MAIL_MAILER="smtp"
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USERNAME="your-email@gmail.com"
MAIL_PASSWORD="your-app-password"
MAIL_ENCRYPTION="tls"
MAIL_FROM_ADDRESS="no-reply@karirkit.com"
MAIL_FROM_NAME="KarirKit"

# Redis
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""
REDIS_DB=0

# OTP Configuration
OTP_ENABLED=true
OTP_EXPIRES_IN=5m
OTP_RESEND_COOLDOWN=60s

# Google OAuth (Optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Frontend URL
FRONTEND_URL="http://localhost:3000"

# Password Reset
PASSWORD_RESET_URL="http://localhost:3000/reset-password"
```

4. Generate JWT key
```bash
npm run key:generate
```

5. Setup database
```bash
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
```

Gunakan `npx prisma db seed` hanya untuk inisialisasi awal atau environment development yang memang boleh diisi ulang. Jangan jalankan perintah ini untuk update/redeploy production yang sudah berisi data.

Catatan database:
- `DATABASE_URL` dipakai oleh runtime, Prisma CLI, migration, dan seed.

## Development

### Running in Development Mode

```bash
npm run dev
```

Server akan berjalan di `http://localhost:3000` dengan auto-reload saat file berubah.

### Database Management

```bash
# Generate Prisma client
npx prisma generate

# Apply schema migrations
npx prisma migrate deploy

# Reset database
npx prisma db push --force-reset

# Seed database
npx prisma db seed

# View database in browser
npx prisma studio
```

### Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Production Deployment dengan Bun dan Supervisor

### 1. Install Bun dan Supervisor

```bash
# Install Bun (untuk user yang menjalankan aplikasi)
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"

# Install Supervisor
sudo apt update
sudo apt install -y supervisor
sudo systemctl enable supervisor
sudo systemctl start supervisor
```

Verifikasi path Bun, karena Supervisor membutuhkan path absolut:

```bash
which bun
# contoh: /home/deploy/.bun/bin/bun atau /root/.bun/bin/bun
```

### 2. Siapkan Aplikasi

Aplikasi dijalankan langsung dari source TypeScript dengan Bun, jadi tidak ada langkah build terpisah.

```bash
cd /var/www/karirkit-backend
bun install --frozen-lockfile
bunx --bun prisma migrate deploy
mkdir -p logs
```

### 3. Membuat Config Supervisor

Buat file `/etc/supervisor/conf.d/karirkit-backend.conf`:

```ini
[program:karirkit-backend]
directory=/var/www/karirkit-backend
command=/home/deploy/.bun/bin/bun run src/server.ts
user=deploy
autostart=true
autorestart=true
startsecs=5
stopasgroup=true
killasgroup=true
environment=NODE_ENV="production",PORT="3000",HOME="/home/deploy"
stdout_logfile=/var/www/karirkit-backend/logs/supervisor.out.log
stderr_logfile=/var/www/karirkit-backend/logs/supervisor.err.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=5
stderr_logfile_maxbytes=10MB
stderr_logfile_backups=5
```

Sesuaikan:
- `command`: gunakan hasil `which bun` (mis. `/root/.bun/bin/bun` jika berjalan sebagai root).
- `user`: user pemilik direktori `/var/www/karirkit-backend`.
- `environment`: variabel selain di `.env` yang dibutuhkan proses. Variabel di `.env` tetap dimuat otomatis oleh `dotenv`.

Pastikan direktori log ada dan bisa ditulis oleh user tersebut:

```bash
sudo mkdir -p /var/www/karirkit-backend/logs
sudo chown -R deploy:deploy /var/www/karirkit-backend/logs
```

### 4. Load dan Jalankan Aplikasi

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status karirkit-backend
```

Jika proses sudah berjalan dan hanya perlu memuat config baru:

```bash
sudo supervisorctl restart karirkit-backend
```

### 5. Supervisor Commands

```bash
# Lihat semua proses
sudo supervisorctl status

# Lihat status aplikasi
sudo supervisorctl status karirkit-backend

# Restart aplikasi
sudo supervisorctl restart karirkit-backend

# Start / stop aplikasi
sudo supervisorctl start karirkit-backend
sudo supervisorctl stop karirkit-backend

# Lihat log realtime
sudo supervisorctl tail -f karirkit-backend
sudo supervisorctl tail -f karirkit-backend stderr
```

### 6. Update / Redeploy Production Tanpa Menghapus Database

Untuk update aplikasi di server production yang sudah memiliki data, gunakan alur berikut:

1. Backup database production terlebih dahulu.
2. Ambil kode terbaru di server.
3. Install dependency sesuai lockfile.
4. Jalankan migration yang belum diterapkan.
5. Restart Supervisor.

```bash
cd /var/www/karirkit-backend
git pull
bun install --frozen-lockfile
bunx --bun prisma migrate deploy
sudo supervisorctl restart karirkit-backend
```

Workflow GitHub Actions pada `.github/workflows/deploy.yaml` melakukan langkah yang sama dan me-restart program Supervisor `karirkit-backend`.

Catatan penting:
- `npx prisma migrate deploy` tidak akan menghapus data lama kecuali file migration yang Anda buat sendiri memang berisi perubahan destruktif seperti `DROP`, `DELETE`, atau perubahan kolom yang tidak kompatibel.
- Jangan jalankan `npx prisma db seed` saat redeploy production. File seed proyek ini menghapus data lama dengan `deleteMany()` sebelum mengisi ulang data.
