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

# Email Configuration
MAIL_MAILER="smtp"
MAIL_HOST="smtp.gmail.com"
MAIL_PORT=587
MAIL_USERNAME="your-email@gmail.com"
MAIL_PASSWORD="your-app-password"
MAIL_FROM_ADDRESS="no-reply@karirkit.com"
MAIL_FROM_NAME="KarirKit"

# Redis
REDIS_HOST="127.0.0.1"
REDIS_PORT=6379
REDIS_PASSWORD=""
REDIS_DB=0

# OTP Configuration
OTP_ENABLED=true
OTP_EXPIRES_IN=300

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
npx prisma db push
npx prisma db seed
```

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

# Push schema changes to database
npx prisma db push

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

## Production Deployment dengan PM2

### 1. Install PM2 globally

```bash
npm install -g pm2
```

### 2. Build Application

```bash
npm run build
```

### 3. Create PM2 Ecosystem File

Buat file `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'karirkit-backend',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Log configuration
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Restart configuration
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // Monitoring
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // Other options
      merge_logs: true,
      kill_timeout: 5000
    }
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:username/karirkit-backend.git',
      path: '/var/www/karirkit-backend',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
```

### 4. Setup Production Environment

```bash
# Create logs directory
mkdir -p logs

# Set production environment variables
export NODE_ENV=production
export DATABASE_URL="mysql://user:pass@prod-host:3306/karirkit_prod"
export JWT_SECRET="your-production-jwt-secret"
# ... set other production variables
```

### 5. Start Application dengan PM2

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### 6. PM2 Commands

```bash
# List all processes
pm2 list

# View logs
pm2 logs karirkit-backend

# Monitor application
pm2 monit

# Restart application
pm2 restart karirkit-backend

# Reload application (zero downtime)
pm2 reload karirkit-backend

# Stop application
pm2 stop karirkit-backend

# Delete application
pm2 delete karirkit-backend

# View detailed information
pm2 show karirkit-backend
```
