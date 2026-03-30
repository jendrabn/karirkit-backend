# Perubahan Dashboard dan Subscription

Tanggal: 31 Maret 2026

## Ringkasan

Dokumen ini merangkum perubahan terbaru pada area berikut:

- dashboard user
- dashboard admin
- alur subscription Midtrans
- resume pembayaran untuk order `pending`

## 1. Dashboard User

Endpoint:

- `GET /dashboard`

Perubahan utama:

- menambahkan metrik pipeline aplikasi:
  - `interview_applications`
  - `offer_applications`
  - `accepted_applications`
  - `rejected_applications`
  - `needs_followup_applications`
  - `overdue_applications`
  - `no_followup_applications`
- menambahkan metrik aset user:
  - `total_documents`
  - `saved_jobs_count`
- menambahkan informasi plan dan usage:
  - `subscription_plan`
  - `subscription_expires_at`
  - `download_today_count`
  - `download_total_count`
  - `document_storage_limit`
  - `document_storage_used`
  - `document_storage_remaining`

Tujuan:

- dashboard user menjadi lebih actionable
- frontend bisa menampilkan status aplikasi, penggunaan storage, dan ringkasan plan tanpa request tambahan

## 2. Dashboard Admin

Endpoint:

- `GET /admin/dashboard`

Perubahan utama:

- menambahkan statistik akun:
  - `total_accounts`
  - `total_users`
  - `total_admins`
- melengkapi statistik blog:
  - `total_archived_blogs`
- menambahkan statistik job portal:
  - `total_jobs`
  - `total_published_jobs`
  - `total_draft_jobs`
  - `total_closed_jobs`
  - `total_archived_jobs`
  - `total_companies`
  - `total_job_roles`
- menambahkan statistik subscription:
  - `total_subscriptions`
  - `total_pending_subscriptions`
  - `total_paid_subscriptions`
  - `total_failed_subscriptions`
  - `total_cancelled_subscriptions`
  - `total_expired_subscriptions`
  - `total_subscription_revenue`
- menambahkan distribusi:
  - `user_status_distribution`
  - `job_status_distribution`
  - `subscription_status_distribution`

Tujuan:

- dashboard admin mencerminkan domain backend yang sebenarnya sudah dikelola
- admin bisa memantau content, job portal, user state, dan monetization dari satu endpoint

## 3. Perbaikan Midtrans `order_id`

Masalah sebelumnya:

- Midtrans menolak transaksi dengan error:
  - `transaction_details.order_id too long`

Penyebab:

- `order_id` dibentuk dari `userId` UUID penuh sehingga melebihi batas panjang yang diterima Midtrans

Perbaikan:

- generator `order_id` diganti ke format yang lebih pendek dan tetap unik
- format baru berbasis:
  - prefix subscription
  - plan id
  - timestamp base36
  - random hex

Hasil:

- request `createTransaction` tidak lagi gagal karena panjang `order_id`

## 4. Resume Pembayaran Subscription Pending

Endpoint terkait:

- `GET /subscriptions/my`
- `POST /subscriptions/order`

Perubahan utama:

- `GET /subscriptions/my` sekarang mengembalikan informasi resume pembayaran untuk order `pending`
- field baru:
  - `pending_plan`
  - `snap_token`
  - `snap_url`
  - `can_resume_payment`

Catatan penting:

- `plan` tetap merepresentasikan plan efektif user saat ini
- `pending_plan` merepresentasikan plan yang sedang menunggu pembayaran
- `snap_url` dapat bernilai `null` pada order lama yang di-resume
- frontend sebaiknya menggunakan `snap_token` untuk memanggil ulang `window.snap.pay(...)`

## 5. Reuse Pending Order

Perubahan perilaku pada `POST /subscriptions/order`:

- jika user membuat order untuk plan yang sama dan masih ada subscription `pending`, backend tidak membuat order baru
- backend akan mengembalikan kembali data order `pending` yang sudah ada

Tujuan:

- mencegah duplikasi transaksi
- user tetap bisa melanjutkan pembayaran yang sebelumnya tertunda
- backend tetap mempertahankan guard agar tidak ada banyak order `pending` identik untuk plan yang sama

## 6. Dampak ke Frontend

Hal yang perlu diperhatikan frontend:

- dashboard user dan admin memiliki field tambahan baru
- halaman subscription sebaiknya:
  - memanggil `GET /subscriptions/my`
  - jika `status = pending` dan `can_resume_payment = true`, tampilkan tombol `Lanjutkan pembayaran`
  - gunakan `snap_token` untuk membuka ulang Snap
- jangan mengandalkan `snap_url` selalu ada pada order yang di-resume

## 7. Update Dokumentasi API

File yang ikut diperbarui:

- `openapi.yaml`

Area dokumentasi yang diperbarui:

- schema `DashboardResponse`
- schema `AdminDashboardResponse`
- schema `CurrentSubscription`
- schema `CreateSubscriptionOrderResult`
- deskripsi endpoint dashboard dan subscription

## 8. Verifikasi

Verifikasi yang sudah dijalankan:

- `node_modules\\.bin\\tsc.cmd --noEmit`
- `node_modules\\.bin\\jest.cmd --runInBand --forceExit tests/api/subscriptions-my-get.test.ts tests/api/subscriptions-order-post.test.ts`

Hasil:

- compile TypeScript lulus
- test subscription terkait perubahan resume payment lulus

## 9. File yang Terdampak

- `src/services/dashboard.service.ts`
- `src/services/admin/dashboard.service.ts`
- `src/services/subscription.service.ts`
- `src/controllers/subscription.controller.ts`
- `tests/api/dashboard-get.test.ts`
- `tests/api/admin-dashboard-get.test.ts`
- `tests/api/subscriptions-my-get.test.ts`
- `tests/api/subscriptions-order-post.test.ts`
- `openapi.yaml`
