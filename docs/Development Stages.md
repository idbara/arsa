# **🗺️ DEVELOPMENT STAGES (TAHAPAN PENGEMBANGAN)**

**Nama Produk:** Arsa (Family Wealth & Lifestyle Manager)

**Estimasi Waktu Pengembangan:** 6 \- 8 Minggu (Fase MVP)

**Pendekatan:** Agile / Iterative Development

**Design System:** Tailwind CSS \+ daisyUI

Dokumen ini membagi proses pengembangan ke dalam beberapa sprint/fase yang berurutan, memastikan fondasi aplikasi kuat sebelum menambahkan fitur-fitur kompleks (*AI*, *Scraper*, dll).

## **✅ FASE 0: Persiapan Infrastruktur & Environment (Minggu 1\)** — SELESAI

*Fokus: Mengamankan semua akun layanan gratis (Rp0), inisialisasi repositori, dan setup Design System.*

1. **Setup Repositori & Version Control:**  
   * Inisialisasi Git dan GitHub/GitLab repository.  
2. **Setup Cloudflare Ecosystem:**  
   * Buat akun/login ke Cloudflare.  
   * Buat *bucket* di Cloudflare R2 (misal: arsa-receipts).  
   * Aktifkan Cloudflare Workers & Workers AI.  
3. **Setup Supabase:**  
   * Buat *project* baru di Supabase.  
   * Dapatkan *API Keys* (Anon Key, Service Role Key) dan *Database URL*.  
   * Konfigurasi Auth Providers (Email/Password, atau Google OAuth).  
4. **Setup SvelteKit:**  
   * Inisialisasi *project* SvelteKit: npm create svelte@latest arsa-app.  
   * Install Tailwind CSS, supabase-js, dan @sveltejs/adapter-cloudflare.  
5. **Setup Design System (daisyUI):**  
   * Install plugin: npm i \-D daisyui@latest.  
   * Daftarkan daisyUI di dalam tailwind.config.js.  
   * Pilih dan tentukan tema estetik bawaan daisyUI (misal: cupcake, pastel, nord, atau dim untuk dark mode) agar UI konsisten dan indah tanpa perlu *styling* CSS dari nol.

## **✅ FASE 1: Skema Database & Autentikasi (Minggu 1-2)** — SELESAI

*Fokus: Membangun fondasi data dan sistem ruang kerja keluarga (Workspace).*

1. **Eksekusi DDL (Data Definition Language):**  
   * Tulis dan jalankan script SQL di Supabase untuk membuat tabel inti: families, users, accounts, categories, transactions.  
2. **Penerapan Row Level Security (RLS):**  
   * Buat *policy* RLS untuk memastikan data hanya bisa diakses oleh *user* dengan family\_id yang sama.  
3. **Integrasi Auth SvelteKit:**  
   * Buat halaman Login/Register menggunakan komponen Card & Input dari daisyUI.  
   * Buat alur "Buat Keluarga Baru" (Insert ke tabel families lalu update users).  
   * Buat fitur *Generate Invite Link* untuk mengundang pasangan ke dalam *workspace* keluarga.

## **✅ FASE 2: Core UI & Pencatatan Transaksi (Minggu 3\)** — SELESAI

*Fokus: Membangun fungsi paling sering dipakai dengan pendekatan Mobile-First menggunakan komponen daisyUI.*

1. **Layouting Mobile-First:**  
   * Bangun *Bottom Navigation Bar* menggunakan class btm-nav dari daisyUI (Home, History, \[ \+ \] Add, Plan, Settings).  
   * Implementasi class skeleton untuk *loading state* saat mengambil data dari Supabase.  
2. **Manajemen Master Data:**  
   * UI CRUD untuk Dompet/Akun (BCA, Tunai, dll) menggunakan card dan table.  
   * UI CRUD untuk Kategori Pengeluaran & Budget.  
3. **Form Transaksi Cepat:**  
   * Gunakan komponen modal (bergaya *bottom sheet*) dari daisyUI agar form input muncul dari bawah saat tombol Add ditekan.  
   * Bangun form input transaksi (Nominal, Kategori, Dompet, Tanggal) menggunakan class input dan select yang seragam.  
   * Tambahkan *checkbox* "Transaksi Privat" (class checkbox).  
   * **Split Bill Logic:** Buat UI dinamis untuk memecah 1 transaksi ke banyak kategori.  
4. **Dashboard Utama:**  
   * Tampilkan Sisa Saldo Total menggunakan komponen stat.  
   * Tampilkan *Progress Bar* Budget Bulanan menggunakan komponen progress.

## **✅ FASE 3: Rekonsiliasi Bank & R2 Storage (Minggu 4\)** — SELESAI

*Fokus: Akurasi data dan penyimpanan bukti transaksi.*

1. **Rekonsiliasi Bank (Client-Side):**  
   * Integrasi *library* PapaParse di SvelteKit.  
   * Buat UI *Upload File* CSV Mutasi BCA/Mandiri (class file-input).  
   * Bangun algoritma pencocokan tanggal dan nominal di memori browser.  
   * Buat fitur *Checklist Mode* (rekonsiliasi manual).  
2. **Penyimpanan Struk (Cloudflare R2):**  
   * Buat *endpoint* \+server.ts di SvelteKit untuk *generate* R2 Presigned URL.  
   * Buat komponen Kamera/Upload Foto di form transaksi SvelteKit.  
   * Implementasi kompresi gambar (*client-side* menggunakan Canvas API).

## **✅ FASE 4: OCR Struk & Modul Anak (Minggu 5\)** — SELESAI

*Fokus: Menambahkan "Magic Moment" dan spesialisasi fitur keluarga.*

1. **Cloudflare Workers AI (OCR):**  
   * Buat *endpoint* SvelteKit untuk memanggil Cloudflare AI (Model Llama 3 Vision).  
   * Integrasikan ke alur *upload* foto struk: Foto ![][image1] Upload R2 ![][image1] Panggil AI ![][image1] Auto-fill Form Transaksi.  
2. **Modul Anak & Pendidikan:**  
   * Buat *Dashboard* khusus dengan filter kategori is\_child\_related.  
   * Bangun UI Kalkulator Proyeksi Biaya Pendidikan (input inflasi dan durasi tahun).

## **✅ FASE 5: Wealth Tracker & Market Scraper (Minggu 6\)** — SELESAI

*Fokus: Integrasi aset Emas, Saham, Reksadana.*

1. **Pembuatan Microservice Rust (Wasm):**  
   * Setup proyek worker-rs.  
   * Tulis logika *fetch* data ke Yahoo Finance (IHSG) dan web Logam Mulia (Emas).  
   * Tulis logika *insert/update* via PostgREST ke tabel market\_rates Supabase menggunakan SERVICE\_ROLE\_KEY.  
2. **Konfigurasi Cron Trigger:**  
   * Set *deploy* Worker ke Cloudflare dan atur Cron Triggers (misal: 09:00 & 13:00).  
3. **UI Portofolio Aset:**  
   * Buat form pencatatan beli/jual emas dan saham.  
   * Tampilkan valuasi aset *real-time* dan *Floating Profit/Loss* di SvelteKit (gunakan warna teks hijau/merah otomatis).

## **✅ FASE 6: Gamifikasi & Otomatisasi Laporan (Minggu 7\)** — SELESAI

*Fokus: Retensi pengguna (suami-istri) dan pelaporan rutin.*

1. **Sistem Gamifikasi:** ✅
   * 5 tabel baru: `point_rules`, `point_events`, `rewards`, `reward_redemptions`, `gamification` (per-user).
   * 4 tipe aturan poin: budget\_discipline, daily\_logging, savings\_milestone, custom\_challenge.
   * UI Dashboard gamifikasi (`/gamification`): poin, streak, leaderboard, aktivitas terbaru.
   * Katalog Reward (`/gamification/rewards`): proposal, approve/reject (admin), redeem.
   * Riwayat poin (`/gamification/history`): filter per member dan bulan.
   * Widget gamifikasi di halaman utama (poin + streak).
2. **Auto-Reporting (Resend API):** ✅
   * Cloudflare Worker terpisah (`arsa-monthly-worker`) berjalan setiap tanggal 1 pukul 01:00 UTC.
   * Evaluasi aturan gamifikasi untuk semua keluarga, hitung poin dan streak.
   * Template email HTML: ringkasan cashflow, kategori, investasi, leaderboard, highlights.
   * Pengiriman via Resend API ke semua anggota keluarga.

## **✅ FASE 7: PWA, Testing & Deployment (Minggu 8\)** — SELESAI

*Fokus: Rilis dan menjadikan aplikasi terasa seperti aplikasi Native.*

1. **Progressive Web App (PWA):** ✅
   * `manifest.json` dengan ikon aplikasi, nama, warna tema, dan `display: standalone`.
   * Service Worker menggunakan Workbox CDN caching: fonts, images, API responses, dan pages.
   * Push notification handling di Service Worker (event `push` dan `notificationclick`).
2. **Offline Support:** ✅
   * IndexedDB queue menggunakan library `idb` untuk menyimpan transaksi saat offline.
   * Sync engine dengan retry otomatis saat koneksi kembali online.
   * Online status banner yang menampilkan indikator offline/online kepada pengguna.
3. **Push Notifications:** ✅
   * Tabel `push_subscriptions` di Supabase (migrasi `009_push_subscriptions.sql`).
   * VAPID client subscription: pengguna subscribe via browser Push API.
   * Server-side sending menggunakan `web-push` library.
   * Trigger notifikasi: budget alert (pengeluaran > 80% limit), reward approved, monthly report ready.
4. **Testing:** ✅
   * Vitest unit tests: offline queue logic, worker helper functions.
   * Vitest integration tests: gamification scoring dan rule evaluation.
   * Playwright E2E tests: auth flow, PWA install prompt, responsive layout.
5. **CI/CD:** ✅
   * GitHub Actions workflow (`.github/workflows/ci.yml`) dengan 5 jobs: lint, unit test, integration test, E2E test, dan Cloudflare Pages deployment.
   * Deployment otomatis ke Cloudflare Pages saat push ke branch `main`.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAXCAYAAADpwXTaAAAAt0lEQVR4XmNgGAWjgDpAQUGBQ05OLk1UVJQHXY4cwCgvL98KNNAYXYIsADIIaGAvkMmCLkcOYAR6twBoaByIjSIDlBAA2iRJClZSUgKaJTcfyJ6soqLCBzZIXFycGyhQDcSzSMVAw3YA6a9A3Aw0kB3FhaQAWVlZE6Ahq6WlpWXQ5UgCQAOEgQYtVlRUlEeXIxkADcoChnMEujjJAJRogYZNlZGRkUaXIwcwqqur84JodIlRMMAAAJV7J+RoCL8jAAAAAElFTkSuQmCC>