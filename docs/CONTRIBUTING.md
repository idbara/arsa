# Panduan Kontribusi

## Sebelum Mulai

1. Baca [Development Guide](DEVELOPMENT.md) untuk setup lokal.
2. Baca [PRD.md](PRD.md) dan [TSD.md](TSD.md) untuk memahami konteks produk.
3. Pastikan `npm run check` dan `npm run lint` lolos sebelum submit perubahan.

## Branching

| Branch | Fungsi |
|--------|--------|
| `main` | Production-ready, auto-deploy ke Cloudflare Pages |
| `feat/<nama>` | Fitur baru |
| `fix/<nama>` | Perbaikan bug |
| `docs/<nama>` | Perubahan dokumentasi |

Selalu buat branch dari `main` terbaru:

```bash
git checkout main
git pull origin main
git checkout -b feat/nama-fitur
```

## Commit Messages

Format: `<tipe>: <deskripsi singkat>`

| Tipe | Penggunaan |
|------|-----------|
| `feat` | Fitur baru |
| `fix` | Perbaikan bug |
| `docs` | Dokumentasi |
| `refactor` | Refaktor tanpa perubahan fungsional |
| `style` | Formatting, semicolons, dll |
| `ci` | Perubahan CI/CD |
| `test` | Penambahan/perbaikan test |

Contoh:
```
feat: tambah form transaksi cepat
fix: perbaiki RLS policy untuk tabel invites
docs: update panduan deployment
```

## Code Style

- **TypeScript** — strict mode, hindari `any`
- **Svelte 5** — gunakan runes (`$state`, `$derived`, `$effect`, `$props`)
- **Styling** — gunakan class daisyUI (`card`, `btn`, `modal`, `input`). Hindari CSS kustom.
- **Penamaan** — variabel dan fungsi dalam bahasa Inggris, komentar boleh Bahasa Indonesia jika perlu
- **Komentar** — hanya untuk logika yang tidak jelas. Kode yang baik menjelaskan dirinya sendiri.

Jalankan sebelum commit:

```bash
cd arsa-app
npm run format
npm run lint
npm run check
```

## Database

- Semua tabel baru yang terkait keluarga **wajib** pakai RLS dengan `get_my_family_id()`.
- Migrasi baru dibuat di `supabase/migrations/` dengan nomor urut berikutnya.
- Tulis SQL yang idempotent (`IF NOT EXISTS`, `OR REPLACE`).
- Jangan pernah expose `SERVICE_ROLE_KEY` di client.

Detail lebih lanjut di bagian "Database Migrations" pada [Development Guide](DEVELOPMENT.md).

## Keamanan

- Jangan commit file `.env`, API key, atau kredensial apapun.
- Data CSV bank diproses **sepenuhnya di client** — tidak boleh dikirim ke server.
- Hasil OCR struk harus divalidasi user sebelum disimpan.
- Transaksi privat (`is_private`) hanya menyembunyikan detail merchant, bukan nominal.

## Pull Request

1. Pastikan branch sudah up-to-date dengan `main`.
2. Semua check lolos (`npm run check`, `npm run lint`).
3. Judul PR singkat dan deskriptif (< 70 karakter).
4. Deskripsi PR berisi:
   - Apa yang berubah dan kenapa
   - Cara testing manual (jika perlu)
   - Screenshot (untuk perubahan UI)

## Struktur Fase

Pengembangan mengikuti [Development Stages](Development%20Stages.md). Pastikan kontribusi sesuai dengan fase yang sedang aktif. Rencana detail tiap fase ada di `docs/plans/`.
