# **📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)**

**Nama Produk:** Arsa (Family Wealth & Lifestyle Manager)

**Platform:** Mobile-First Web App (PWA)

**Fase Target:** MVP / Phase 1

**Design System:** Tailwind CSS \+ daisyUI

**Prinsip Utama:** 100% Free Tier (Rp0 Infrastructure)

## **1\. Visi & Tujuan Produk**

Membangun aplikasi pencatatan keuangan keluarga yang intuitif, minim friksi, dan cerdas bernama **Arsa** (berasal dari bahasa Sanskerta yang berarti kebahagiaan). Arsa dirancang untuk mentransformasi rutinitas mencatat pengeluaran menjadi sebuah sistem manajemen kekayaan, investasi, dan gaya hidup keluarga, tanpa membebani biaya operasional server bulanan (Rp0).

## **2\. Pengguna Sasaran (*Target Audience*)**

Pasangan suami istri (atau keluarga) dalam satu ruang kerja (*workspace*) bersama yang membutuhkan transparansi arus kas, pelacakan aset terintegrasi, dan kolaborasi dalam merencanakan anggaran masa depan.

## **3\. Ruang Lingkup Fitur Utama (Fase 1\)**

### **A. Modul Core Family Finance**

* **Family Workspace:**  
  * Pembuatan sistem *invite* antar anggota keluarga.  
  * Pembagian peran: *Admin* (suami/istri yang bisa mengubah budget/kategori) dan *Member* (hanya input).  
  * *Transaksi Privat:* Opsi saat input pengeluaran untuk memotong saldo tanpa menampilkan detail *merchant* kepada pasangan.  
* **Multi-Wallet & Rekonsiliasi Bank:**  
  * Dukungan berbagai dompet (BCA, Mandiri, e-Wallet, Uang Tunai).  
  * *Rekonsiliasi Ganda:* Mode *Checklist* (manual) dan Import CSV (otomatis *parsing* mutasi di dalam perangkat pengguna).  
* **Smart Entry & OCR Struk (Magic Moment):**  
  * Input transaksi secepat kilat menggunakan *numpad* bawaan layar HP.  
  * *Scan Struk:* Memotret struk via kamera HP, otomatis diisi (Nominal, Tanggal, Nama Toko) menggunakan model AI (Vision).  
* **Budgeting & Split Bill:**  
  * Alokasi batas pengeluaran per kategori dengan indikator visual.  
  * Kemampuan memecah satu total struk belanja besar ke berbagai kategori yang berbeda (misal: 1 struk untuk belanja dapur dan popok bayi).

### **B. Modul Wealth & Investment Tracker**

* **Live Market Integration:**  
  * *Dashboard* terpisah untuk memantau nilai aset (tidak bercampur dengan uang tunai harian).  
* **Tabungan Emas Antam:**  
  * Pencatatan gramasi emas dengan valuasi nilai tukar Rupiah yang di-*update* secara otomatis setiap hari.  
* **Portofolio Pasar Modal:**  
  * Pelacakan lot saham (IHSG) dan unit Reksadana dengan kalkulasi *Floating Profit/Loss* secara *real-time*.

### **C. Modul Family Lifestyle & Automation**

* **Modul Anak & Pendidikan:**  
  * *Dashboard* khusus terisolasi untuk melacak pengeluaran esensial anak (popok, susu, vaksin/dokter).  
  * Kalkulator cerdas untuk memproyeksikan biaya pendidikan (TK hingga Kuliah) dengan asumsi laju inflasi.  
* **Gamifikasi & Reward:**  
  * Sistem "Poin Disiplin" yang didapat jika keluarga berhasil menjaga pengeluaran bulanan tetap di bawah *budget* yang ditentukan.  
  * *Katalog Reward:* Poin dapat ditukar dengan *reward* kustom (misal: "Bebas tugas cuci piring 3 hari").  
* **Auto-Reporting (Monthly):**  
  * Laporan otomatis *cashflow* bulanan dan pertumbuhan aset (format HTML/PDF).  
  * Dikirim otomatis ke email suami dan istri setiap tanggal 1\.

## **4\. Panduan UI/UX (Estetika & Tampilan)**

* **Mobile-First Experience:** Aplikasi harus terasa seperti aplikasi *native* saat diinstal via PWA. Gunakan *Bottom Navigation Bar* dan *Bottom Sheets* untuk form input.  
* **Tema Visual (daisyUI):** Menggunakan tema estetik bawaan daisyUI (seperti cupcake, pastel, atau nord) untuk memberikan kesan antarmuka yang bersih, lembut, modern, dan tidak kaku layaknya aplikasi akuntansi tradisional.