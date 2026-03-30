# K6 Stress Test

Suite ini dipakai untuk mengukur kira-kira berapa RPS yang masih sanggup ditangani backend ini, terutama saat aplikasi dijalankan pada mesin kecil seperti `1 vCPU / 1 GB RAM`.

## Prinsip Pengujian

Jangan jalankan K6 di mesin yang sama dengan API yang diuji.

Alur yang disarankan:

1. Deploy backend ke target server `1 vCPU / 1 GB RAM`.
2. Jalankan K6 dari mesin terpisah.
3. Naikkan `TOTAL_MAX_RPS` bertahap sampai:
   - `http_req_failed` mulai naik
   - `p95` melonjak tajam
   - CPU target mendekati 100%
   - memory target mulai menipis atau proses restart

RPS yang layak dipakai sebagai kapasitas bukan angka puncak sesaat, tetapi angka tertinggi yang masih stabil terhadap threshold Anda.

## File

- `scripts/k6/representative-stress.js`

## Preset

Script mendukung preset berikut:

- `smoke`
- `stress`
- `breakpoint`
- `custom`

Preset dipakai lewat env `PRESET`, atau lebih praktis lewat script `npm`.

## Endpoint Representatif

Default mix mencakup:

- `GET /health`
- `GET /stats`
- `GET /templates?type=cv&language=id`
- `GET /jobs?page=1&per_page=12`
- `GET /dashboard`
- `GET /subscriptions/my`
- `GET /admin/dashboard`

Catatan:

- scenario user hanya aktif jika Anda memberi kredensial atau token user
- scenario admin hanya aktif jika Anda memberi kredensial atau token admin

## Instalasi K6

Gunakan K6 versi terbaru yang tersedia secara resmi dari Grafana.

Contoh cek versi:

```bash
k6 version
```

## Menjalankan Mixed Representative Test

Contoh:

```bash
k6 run ^
  -e BASE_URL=http://YOUR_SERVER:3000 ^
  -e USER_EMAIL=user@example.com ^
  -e USER_PASSWORD=your-password ^
  -e ADMIN_EMAIL=admin@example.com ^
  -e ADMIN_PASSWORD=your-password ^
  -e TOTAL_START_RPS=10 ^
  -e TOTAL_MAX_RPS=120 ^
  -e TOTAL_STEP_RPS=10 ^
  -e STEP_DURATION=1m ^
  -e HOLD_DURATION=2m ^
  -e RAMP_DOWN_DURATION=30s ^
  scripts/k6/representative-stress.js
```

Atau gunakan preset bawaan:

```bash
$env:BASE_URL="http://YOUR_SERVER:3000"
$env:USER_EMAIL="user@example.com"
$env:USER_PASSWORD="your-password"
$env:ADMIN_EMAIL="admin@example.com"
$env:ADMIN_PASSWORD="your-password"
npm run k6:stress
```

Arti preset:

- `npm run k6:smoke`: validasi cepat, aman untuk baseline awal
- `npm run k6:stress`: stress test representatif default
- `npm run k6:breakpoint`: dorong lebih agresif untuk mencari titik mulai rusak

## Menjalankan Single Endpoint Ceiling Test

Gunakan `SCENARIO` untuk fokus pada satu endpoint.

Contoh cari ceiling `GET /jobs`:

```bash
k6 run ^
  -e PRESET=breakpoint ^
  -e BASE_URL=http://YOUR_SERVER:3000 ^
  -e SCENARIO=jobs_public ^
  scripts/k6/representative-stress.js
```

Atau pakai script npm lalu override scenario:

```bash
$env:BASE_URL="http://YOUR_SERVER:3000"
$env:SCENARIO="jobs_public"
npm run k6:breakpoint
```

Scenario yang tersedia:

- `health_public`
- `stats_public`
- `templates_public`
- `jobs_public`
- `dashboard_user`
- `subscription_user`
- `admin_dashboard`

## Opsi Auth

### User

Pilih salah satu:

```bash
-e USER_EMAIL=user@example.com -e USER_PASSWORD=secret
```

atau:

```bash
-e USER_BEARER_TOKEN=...
```

atau:

```bash
-e USER_COOKIE="karirkit_session=..."
```

### Admin

Pilih salah satu:

```bash
-e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=secret
```

atau:

```bash
-e ADMIN_BEARER_TOKEN=...
```

atau:

```bash
-e ADMIN_COOKIE="karirkit_session=..."
```

## Environment Variables Penting

- `BASE_URL`: base URL API target
- `PRESET`: `smoke`, `stress`, `breakpoint`, atau `custom`
- `SCENARIO`: jalankan satu scenario tertentu
- `TOTAL_START_RPS`: RPS awal total
- `TOTAL_MAX_RPS`: target RPS total tertinggi
- `TOTAL_STEP_RPS`: kenaikan RPS total per stage
- `STEP_DURATION`: durasi tiap kenaikan
- `HOLD_DURATION`: durasi tahan di RPS tertinggi
- `RAMP_DOWN_DURATION`: durasi penurunan
- `P95_MS`: target latency global default untuk scenario yang tidak dioverride
- `MAX_ERROR_RATE`: batas error rate
- `SESSION_COOKIE_NAME`: default `karirkit_session`
- `SUMMARY_JSON`: path file JSON hasil summary

Catatan:

- jika `PRESET` dipilih, nilai default load akan diambil dari preset itu
- semua env seperti `TOTAL_MAX_RPS` tetap bisa dipakai untuk override preset

## Cara Membaca Hasil

Perhatikan empat hal:

1. `achieved_http_rps`
2. `http_req_failed`
3. `http_req_duration` khusus per scenario
4. metrik sistem server target: CPU, memory, restart, OOM, swap

Jika target `1 vCPU / 1 GB RAM` mulai menunjukkan:

- error rate naik
- p95/p99 memburuk tajam
- CPU mentok terlalu lama
- memory menipis

maka RPS sebelumnya adalah kandidat kapasitas aman.

## Catatan Implementasi

- login hanya dilakukan sekali di `setup()`, bukan di setiap iterasi
- ini sengaja agar hasil lebih fokus ke endpoint bisnis utama
- jika Anda ingin mengetes endpoint login secara terpisah, buat scenario khusus lain dan jangan campur dengan baseline ini
