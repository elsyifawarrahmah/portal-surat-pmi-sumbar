# Panduan: Disposisi, Pemantauan, Riwayat, Ekspedisi & Kotak Saran

## Langkah awal (sekali saja)
1. Supabase → SQL Editor → New query → tempel isi `supabase/migrasi-disposisi-pemantauan.sql` → Run. (Aman dijalankan ulang.)
2. Buka menu **Data User** → atur **Unit / Bidang** tiap akun (kolom "Unit / Bidang").
3. Selesai. Surat lama otomatis mendapat Nomor Agenda dan riwayat awal.

## Siapa boleh apa
| Unit | Boleh |
|---|---|
| **Admin** | Semua |
| **Sekretariat** | Catat surat masuk, buat disposisi, kelola alur surat, catat surat keluar & ekspedisi |
| **Pimpinan** (Ketua, Kepala Markas) | Buat disposisi, kelola alur, catat surat keluar |
| **Bidang** (PB, Yankessos, Donor Darah, dst.) | Menerima disposisi (dibaca → proses → selesai), mencatat surat keluar bidangnya sendiri, ekspedisi |
| **Biro Umum** | **Hanya memantau**: lihat semua, cetak, memanggil bidang, mengarsipkan, menanggapi Kotak Saran. Tidak punya kotak disposisi. |

Semua akun bisa melihat data dan mengirim Kotak Saran.

## Alur kerja
1. **Sekretariat** mencatat surat masuk → Nomor Agenda terisi otomatis.
2. Surat difoto/dibawa ke pimpinan → **Disposisi** dibuat di portal (Surat Masuk → kolom Disposisi, atau menu Disposisi). Cetak **Lembar Disposisi** bila perlu ditandatangani; foto/scan lembar yang sudah ditandatangani diunggah ke disposisi tersebut (tersimpan di Ruang Disposisi).
3. **Bidang tujuan** melihat disposisi di menu Disposisi (lencana angka di menu), menandai *dibaca → diproses → selesai*. Saat **selesai**, disposisi **diarsipkan otomatis** dan waktunya tercatat.
4. Bila disposisi meminta **surat jawaban**: bidang membuat surat keluar lewat tombol "Buat surat jawaban" → tertaut ke surat masuk. Surat jawaban yang belum ada muncul di Pemantauan.
5. **Surat keluar**: tiap bidang mencatat suratnya sendiri, lalu mencatat pengiriman di **Ekspedisi** (via, penerima, tanda terima).
6. **Biro Umum** memantau di menu **Pemantauan**: bidang yang tidak input surat dalam N hari berstatus "Perlu dipanggil". Klik **Panggil** (atau "Panggil Semua"). Bidang melihat panggilan di Dashboard/Pemantauan dan membalas "sudah ditindaklanjuti".

## Riwayat & cetak
- Setiap kejadian (surat masuk, diterima/diteruskan, disposisi, status disposisi, surat jawaban, pengiriman, panggilan) **dicatat otomatis oleh database** lengkap dengan waktu pasti dan nama pelaku; riwayat tidak bisa diubah/dihapus dari aplikasi.
- Menu **Riwayat Surat**: buku agenda digital masuk + keluar, filter tanggal, klik surat untuk garis waktu, tombol **Cetak Buku Agenda** / **CSV** / **Cetak Riwayat** per surat.
- Cetak tersedia juga di Disposisi (Buku Disposisi + Lembar Disposisi), Ekspedisi (Buku Ekspedisi), Kotak Saran.

## Mengubah aturan hak akses
Aturan ada di database pada fungsi `boleh_catat_masuk`, `boleh_disposisi`, `boleh_catat_keluar`, `boleh_alur`, `boleh_pantau`, `boleh_arsip` (bagian atas file migrasi). Contoh: agar Biro Umum juga boleh mencatat surat keluar, ubah daftar tipe pada `boleh_catat_keluar` menjadi `('sekretariat','pimpinan','bidang','biro_umum')` lalu ubah `bisaCatatKeluar` di `lib/peran.js` dengan cara yang sama.
