# Cashflow Feature Design

**Date:** 2026-03-04
**Status:** Approved

## Overview

Halaman `/cashflow` baru untuk visualisasi arus kas keluarga. Menampilkan ringkasan pemasukan vs pengeluaran, tren 6 bulan, breakdown per kategori, dan detail transaksi per kategori (drill-down).

Semua member bisa akses. Transaksi privat tetap dihitung nominalnya tapi merchant tersembunyi.

## Navigasi

- Route: `/cashflow`
- Akses dari bottom nav (ganti "Plan" yang belum diimplementasi)
- Header navigasi bulan: `< Maret 2026 >` untuk pindah bulan. Default: bulan berjalan.

## Komponen

### 1. Stat Cards

Tiga stat card horizontal (daisyUI `stats`):

| Card | Nilai | Warna |
|------|-------|-------|
| Pemasukan | Total `type: 'in'` bulan terpilih | `text-success` |
| Pengeluaran | Total `type: 'out'` bulan terpilih | `text-error` |
| Selisih | Pemasukan - Pengeluaran | Hijau jika positif, merah jika negatif |

Format: `Rp 1.234.567` (locale `id-ID`).

### 2. Bar Chart — Tren 6 Bulan

- Dua bar per bulan: hijau (pemasukan), merah (pengeluaran)
- Sumbu X: label bulan (Jan, Feb, Mar, ...)
- Sumbu Y: nominal Rupiah
- Responsive untuk mobile
- Library: Chart.js + svelte-chartjs

### 3. Donut Chart — Breakdown Kategori

- Setiap slice = satu kategori pengeluaran bulan terpilih
- Center text: total pengeluaran
- Legend di bawah: nama kategori + nominal + persentase
- Maksimal 8 kategori terbesar, sisanya "Lainnya"
- Kategori tanpa pengeluaran tidak ditampilkan

### 4. Tabel Detail per Kategori

- Baris per kategori, urut dari pengeluaran terbesar
- Kolom: Kategori | Jumlah Transaksi | Total | % dari Total
- Tap baris → expand (daisyUI `collapse`) menampilkan transaksi: tanggal, merchant, nominal
- Transaksi privat: merchant = "Private" untuk member lain
- Data transaksi di-fetch on-demand saat expand (bukan upfront)

## Data Flow

### Server-side (page load) — 2 query:

**Query 1 — Stat cards + donut chart:**
```sql
SELECT type, category_id, SUM(amount) as total, COUNT(*) as count
FROM transactions
WHERE family_id = ? AND date BETWEEN month_start AND month_end
GROUP BY type, category_id
```

**Query 2 — Bar chart tren 6 bulan:**
```sql
SELECT DATE_TRUNC('month', date) as month, type, SUM(amount) as total
FROM transactions
WHERE family_id = ? AND date >= 6_months_ago
GROUP BY month, type
ORDER BY month
```

**Tambahan:** Fetch kategori names dari `categories` table.

### Client-side (on-demand) — 1 query per expand:

**API route** `/api/transactions?category_id=X&month=YYYY-MM` untuk detail transaksi saat user tap baris kategori.

## Dependencies

- `chart.js` — chart library
- `svelte-chartjs` — Svelte wrapper untuk Chart.js

## Constraints

- Transaksi privat: nominal dihitung, merchant disembunyikan untuk member lain
- RLS otomatis filter by `family_id`
- Chart.js canvas-based, performa bagus di mobile
- On-demand loading untuk detail transaksi (hemat bandwidth)
