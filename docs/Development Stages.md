# **🗺️ DEVELOPMENT STAGES (TAHAPAN PENGEMBANGAN)**

**Nama Produk:** Arsa (Family Wealth & Lifestyle Manager)

**Estimasi Waktu Pengembangan:** 6 \- 8 Minggu (Fase MVP)

**Pendekatan:** Agile / Iterative Development

**Design System:** Tailwind CSS \+ daisyUI

Dokumen ini membagi proses pengembangan ke dalam beberapa sprint/fase yang berurutan, memastikan fondasi aplikasi kuat sebelum menambahkan fitur-fitur kompleks (*AI*, *Scraper*, dll).

## **🚩 FASE 0: Persiapan Infrastruktur & Environment (Minggu 1\)**

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

## **🚩 FASE 1: Skema Database & Autentikasi (Minggu 1-2)**

*Fokus: Membangun fondasi data dan sistem ruang kerja keluarga (Workspace).*

1. **Eksekusi DDL (Data Definition Language):**  
   * Tulis dan jalankan script SQL di Supabase untuk membuat tabel inti: families, users, accounts, categories, transactions.  
2. **Penerapan Row Level Security (RLS):**  
   * Buat *policy* RLS untuk memastikan data hanya bisa diakses oleh *user* dengan family\_id yang sama.  
3. **Integrasi Auth SvelteKit:**  
   * Buat halaman Login/Register menggunakan komponen Card & Input dari daisyUI.  
   * Buat alur "Buat Keluarga Baru" (Insert ke tabel families lalu update users).  
   * Buat fitur *Generate Invite Link* untuk mengundang pasangan ke dalam *workspace* keluarga.

## **🚩 FASE 2: Core UI & Pencatatan Transaksi (Minggu 3\)**

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

## **🚩 FASE 3: Rekonsiliasi Bank & R2 Storage (Minggu 4\)**

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

## **🚩 FASE 4: OCR Struk & Modul Anak (Minggu 5\)**

*Fokus: Menambahkan "Magic Moment" dan spesialisasi fitur keluarga.*

1. **Cloudflare Workers AI (OCR):**  
   * Buat *endpoint* SvelteKit untuk memanggil Cloudflare AI (Model Llama 3 Vision).  
   * Integrasikan ke alur *upload* foto struk: Foto ![][image1] Upload R2 ![][image1] Panggil AI ![][image1] Auto-fill Form Transaksi.  
2. **Modul Anak & Pendidikan:**  
   * Buat *Dashboard* khusus dengan filter kategori is\_child\_related.  
   * Bangun UI Kalkulator Proyeksi Biaya Pendidikan (input inflasi dan durasi tahun).

## **🚩 FASE 5: Wealth Tracker & Market Scraper (Minggu 6\)**

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

## **🚩 FASE 6: Gamifikasi & Otomatisasi Laporan (Minggu 7\)**

*Fokus: Retensi pengguna (suami-istri) dan pelaporan rutin.*

1. **Sistem Gamifikasi:**  
   * Buat *job* atau fungsi evaluasi di akhir bulan: Jika *expense* \< *budget*, tambahkan poin ke tabel gamification.  
   * Buat UI "Katalog Reward Keluarga".  
2. **Auto-Reporting (Resend API):**  
   * Desain *template* email HTML elegan menggunakan Svelte.  
   * Buat Cloudflare Worker terpisah (atau satukan dengan *scraper*) yang berjalan setiap tanggal 1\.  
   * Tarik rekapitulasi data dari Supabase, lalu *trigger* pengiriman email via Resend API ke alamat email suami & istri.

## **🚩 FASE 7: PWA, Testing & Deployment (Minggu 8\)**

*Fokus: Rilis dan menjadikan aplikasi terasa seperti aplikasi Native.*

1. **Progressive Web App (PWA):**  
   * Tambahkan manifest.json (Ikon aplikasi, nama, warna tema).  
   * Daftarkan *Service Worker* untuk *caching* aset statis agar aplikasi cepat dibuka.  
2. **Quality Assurance (QA):**  
   * Uji coba aplikasi penuh (*End-to-End*) menggunakan HP Android dan iOS (Safari/Chrome).  
   * Pastikan *numpad* muncul saat mengisi nominal, kamera terbuka dengan benar, dan UI tidak pecah di layar kecil.  
3. **Production Deployment:**  
   * Konfigurasi *Environment Variables* (Supabase URL, R2 Keys, AI Keys) di *dashboard* Cloudflare Pages.  
   * *Push* kode ke *branch* utama (main/master) untuk memicu *build* otomatis di Cloudflare Pages.  
   * Akses aplikasi melalui URL produksi dan tambahkan ke *Home Screen* (Add to Home Screen).

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAXCAYAAADpwXTaAAAAt0lEQVR4XmNgGAWjgDpAQUGBQ05OLk1UVJQHXY4cwCgvL98KNNAYXYIsADIIaGAvkMmCLkcOYAR6twBoaByIjSIDlBAA2iRJClZSUgKaJTcfyJ6soqLCBzZIXFycGyhQDcSzSMVAw3YA6a9A3Aw0kB3FhaQAWVlZE6Ahq6WlpWXQ5UgCQAOEgQYtVlRUlEeXIxkADcoChnMEujjJAJRogYZNlZGRkUaXIwcwqqur84JodIlRMMAAAJV7J+RoCL8jAAAAAElFTkSuQmCC>