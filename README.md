# Backend Service

Express.js API written in TypeScript with a modular architecture optimised for future growth.

## Scripts

- `npm run dev` - start the server with hot-reload for local development.
- `npm run build` - compile TypeScript sources into `dist`.
- `npm start` - run the compiled JavaScript from the `dist` folder.

## Project Structure

```
src/
|-- config/         # Environment configuration
|-- controllers/    # Route handlers
|-- interfaces/     # Shared interfaces and types
|-- middleware/     # Express middleware
|-- models/         # Data access layer or ORM models
|-- routes/         # Route definitions
|-- services/       # Business logic
|-- utils/          # Helper utilities
|-- validators/     # Validation helpers
|-- index.ts        # Express application bootstrap
`-- server.ts       # HTTP server entry point
```

Tests live under `tests/unit` and `tests/integration`.

## Environment

The `.env` file supports:

- `PORT` - HTTP port for the server (default `3000`)
- `NODE_ENV` - runtime environment label
- `LOG_LEVEL` - Winston logging level (default `info`)
- `LOG_FILE` - Path to the Winston log file (default `logs/app.log`)

## API Documentation

The OpenAPI specification lives at `backend/openapi.yaml`. Run `npm run dev` and visit `/docs` to view the Swagger UI powered by that spec.

## Deployment on Ubuntu Server

1. **Install dependensi sistem**
   ```bash
   sudo apt update
   sudo apt install -y curl build-essential mysql-client redis-server nginx
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo npm install -g pm2
   sudo systemctl enable --now redis-server
   ```
   Pastikan MySQL database dapat diakses dari server ini dan Redis diamankan dengan password yang sama seperti `REDIS_PASSWORD`.

2. **Clone repo & siapkan environment**
   ```bash
   sudo mkdir -p /var/www/karirkit
   sudo chown -R $USER:$USER /var/www/karirkit
   git clone <repo-url> /var/www/karirkit/backend
   cd /var/www/karirkit/backend
   cp .env.example .env
   ```
   Lengkapi `.env` dengan nilai produksi (`DATABASE_URL`, `DATABASE_*`, `REDIS_*`, secret JWT, konfigurasi mail, dsb). Variabel ini digunakan oleh Prisma saat migrasi dan oleh server saat boot.

3. **Install dependencies Node.js**
   ```bash
   npm ci
   ```

4. **Generate Prisma & deploy migrasi**
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
   `prisma generate` membuat Prisma Client terbaru, sedangkan `prisma migrate deploy` mengeksekusi seluruh migrasi pada database produksi. Pastikan `DATABASE_URL` sudah menunjuk ke database yang benar sebelum menjalankan perintah ini.

5. **Build dan jalankan aplikasi dengan PM2**
   ```bash
   npm run build  # output siap pakai berada di /var/www/karirkit/backend/dist
   cat <<'EOF' > ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'karirkit-backend',
       script: 'dist/server.js',
       cwd: '/var/www/karirkit/backend',
       env: { NODE_ENV: 'production', PORT: 3000 }
     }]
   };
   EOF
   pm2 start ecosystem.config.js
   pm2 status
   sudo pm2 startup systemd -u $USER --hp $HOME
   pm2 save
   ```
   PM2 menjalankan `dist/server.js` langsung dari folder `/var/www/karirkit/backend/dist`. Gunakan `pm2 logs karirkit-backend` bila perlu melihat log, dan `pm2 restart karirkit-backend` setelah deploy berikutnya.

6. **Konfigurasi Nginx untuk api.karirkit.id**
   ```bash
   sudo tee /etc/nginx/sites-available/api.karirkit.id <<'EOF'
   server {
     listen 80;
     server_name api.karirkit.id;

     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   EOF
   sudo ln -s /etc/nginx/sites-available/api.karirkit.id /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```
   Sesuaikan port jika aplikasi berjalan di nilai `PORT` yang berbeda, dan jalankan `sudo certbot --nginx -d api.karirkit.id` untuk HTTPS.

7. **Service pendukung**
   - Redis harus tetap aktif (`sudo systemctl status redis-server`). Sesuaikan `/etc/redis/redis.conf` bila perlu agar password cocok dengan `.env`.
   - Setiap ada perubahan schema Prisma, ulangi langkah 4-5 untuk generate client dan deploy migrasi terbaru sebelum restart PM2 (`pm2 restart karirkit-backend`).

Dengan alur di atas backend siap berjalan di Ubuntu dengan domain `api.karirkit.id`, PM2 menjaga proses Node.js di `/var/www/karirkit/backend/dist`, dan Nginx mem-proxy traffic ke aplikasi.
