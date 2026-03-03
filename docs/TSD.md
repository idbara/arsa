# **🛠️ TECHNICAL SPECIFICATION DOCUMENT (TSD)**

**Nama Produk:** Arsa (Family Wealth & Lifestyle Manager)

**Fase Target:** MVP / Phase 1

**Arsitektur:** Serverless & Edge Computing (Rp0 Stack)

## **1\. Stack Teknologi & Infrastruktur**

| Komponen | Teknologi | Keterangan Free Tier |
| :---- | :---- | :---- |
| **Frontend & PWA** | SvelteKit (adapter-cloudflare) | Cloudflare Pages (Bandwidth tak terbatas). |
| **Design System** | Tailwind CSS \+ daisyUI | Styling komponen cepat dengan *semantic class*. |
| **Database & Auth** | Supabase PostgreSQL | 500MB DB, 50k MAU. Sangat cukup untuk teks. |
| **Object Storage** | Cloudflare R2 | 10GB/bulan. *Direct upload* via Presigned URL. |
| **OCR (AI Vision)** | Cloudflare Workers AI | Llama 3 Vision (Gratis pemakaian wajar di Edge). |
| **Market Scraper** | Rust (Wasm) \+ CF Workers | Di-trigger via Cron. 100k requests/hari gratis. |
| **Email Notifikasi** | Resend API | 3.000 email/bulan (Cukup untuk *report* keluarga). |

## **2\. Alur Data Utama (*Data Flow*)**

### **A. Alur Upload Struk & Auto-Fill OCR**

1. User memotret struk melalui form SvelteKit (PWA).  
2. SvelteKit melakukan kompresi gambar (*client-side* menggunakan Canvas API) menjadi \~150KB.  
3. SvelteKit me-*request* *Presigned URL* ke *endpoint* API SvelteKit/Cloudflare.  
4. Browser mengunggah gambar **langsung** ke *bucket* Cloudflare R2 via URL tersebut (menghemat beban memori Worker).  
5. SvelteKit memanggil *endpoint* Cloudflare Workers AI, mengirimkan URL R2.  
6. Worker AI mengekstrak data dari gambar menjadi struktur JSON: { "nominal": 150000, "tanggal": "2026-03-03", "merchant": "Indomaret" }.  
7. Form input di layar pengguna otomatis terisi, user wajib melakukan *review* manual sebelum menyimpan (*Human-in-the-loop validation*).

### **B. Alur Market Scraper (Emas, Saham, Reksadana)**

1. Cloudflare Cron Trigger menjalankan Worker Wasm (berbasis Rust) setiap pukul 09:00 dan 13:00 WIB.  
2. Worker menarik data (menggunakan Fetch API) dari Yahoo Finance (untuk IHSG) dan melakukan *scraping* HTML ringan dari portal Logam Mulia/Reksadana.  
3. Worker memformat data menjadi JSON terstruktur.  
4. Worker menggunakan autentikasi SUPABASE\_SERVICE\_ROLE\_KEY untuk melakukan HTTP POST/PATCH ke PostgREST API Supabase, meng-*update* nilai pada tabel market\_rates.

## **3\. Skema Database Inti (Supabase PostgreSQL)**

Relasi entitas inti dibangun dengan pengamanan *Row Level Security* (RLS) ketat yang bergantung pada kolom family\_id.

* **families**  
  * id (UUID, PK) | name (String) | created\_at (Timestamp)  
* **users**  
  * id (UUID, PK, FK to auth.users) | family\_id (UUID, FK to families) | role (String: 'admin', 'member')  
* **accounts**  
  * id (UUID, PK) | family\_id (UUID, FK) | name (String) | type (String) | balance (Numeric)  
* **categories**  
  * id (UUID, PK) | family\_id (UUID, FK) | name (String) | monthly\_limit (Numeric) | is\_child\_related (Boolean)  
* **transactions**  
  * id (UUID, PK) | family\_id (UUID, FK) | account\_id (UUID, FK) | category\_id (UUID, FK) | user\_id (UUID, FK)  
  * amount (Numeric) | type (String: in/out/transfer) | receipt\_url (String/R2 Path)  
  * is\_reconciled (Boolean, Default: False) | is\_private (Boolean, Default: False)  
* **market\_rates** *(Tabel Global, Tanpa RLS family\_id)*  
  * asset\_code (String, PK \- misal: 'ANTAM', 'BBCA') | asset\_type (String: 'gold', 'stock', 'mutual\_fund')  
  * buy\_price (Numeric) | sell\_price (Numeric) | updated\_at (Timestamp)  
* **investments**  
  * id (UUID, PK) | family\_id (UUID, FK) | asset\_code (String, FK to market\_rates)  
  * qty (Numeric \- Lot/Gram/Unit) | avg\_buy\_price (Numeric)  
* **gamification**  
  * family\_id (UUID, PK) | current\_points (Integer) | rewards\_catalog (JSONB)

## **4\. Strategi Keamanan & Privasi**

### **4.1. Row Level Security (RLS)**

Wajib diaktifkan di Supabase untuk setiap tabel yang memiliki kaitan dengan keluarga.

Contoh *Policy* Standar (berlaku untuk accounts, categories, transactions, dll):

CREATE POLICY "Akses Khusus Keluarga" ON namatabel   
FOR ALL USING (  
  family\_id \= (SELECT family\_id FROM users WHERE id \= auth.uid())  
);

### **4.2. Privasi Mutasi Bank (Client-Side Parsing)**

File CSV mutasi perbankan untuk fitur rekonsiliasi **tidak akan pernah dikirim ke server backend atau Cloudflare R2**. Svelte akan menggunakan *library client-side* (misalnya PapaParse) untuk membaca dan mencocokkan mutasi tersebut sepenuhnya di dalam RAM perangkat HP pengguna, menjamin privasi absolut.