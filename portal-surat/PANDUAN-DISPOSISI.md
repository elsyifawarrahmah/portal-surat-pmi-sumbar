# Panduan: Disposisi, Pemantauan, Riwayat, Ekspedisi & Kotak Saran

## Langkah awal (sekali saja, urut)
1. Supabase → SQL Editor → New query → tempel isi `supabase/migrasi-disposisi-pemantauan.sql` → Run.
2. Query baru lagi → tempel isi `supabase/migrasi-alur-berjenjang.sql` → Run.
2b. Query baru lagi → tempel isi `supabase/migrasi-privasi-lacak.sql` → Run. (Ketiganya aman dijalankan ulang.)
3. Menu **Data User** → atur **Unit / Bidang** dan **Telepon / WA** tiap akun. Tiap orang juga bisa mengisi nomor HP-nya sendiri lewat tautan "📞 Isi nomor HP saya" di menu samping.
4. Selesai. Surat lama otomatis mendapat Nomor Agenda dan riwayat awal.

Nama aplikasi (tampil di menu, login, judul tab, cetakan) diubah di satu tempat: `lib/config.js`.

## Siapa boleh apa
| Unit | Boleh |
|---|---|
| **Admin** | Semua |
| **Sekretariat** | Catat surat masuk, buat disposisi, kelola alur surat, catat surat keluar & ekspedisi |
| **Pimpinan** (Ketua, Kepala Markas) | Buat disposisi, kelola alur, catat surat keluar |
| **Bidang** (PB, Yankessos, Donor Darah, dst.) | Menerima disposisi, **meneruskan lagi**, menulis kata-kata & catatan, menandai selesai, mencatat surat keluar bidangnya sendiri, ekspedisi |
| **Biro Umum** | **Memantau**: lihat semua, cetak, memanggil bidang, **mengarsipkan** surat yang sudah selesai, menanggapi Kotak Saran. Tidak punya kotak disposisi dan tidak mengubah status bidang lain. |

Semua akun bisa melihat data dan mengirim Kotak Saran.

## Alur kerja
1. **Sekretariat** mencatat surat masuk → Nomor Agenda terisi otomatis.
2. Surat difoto/dibawa ke pimpinan → **Disposisi** dibuat di portal (Surat Masuk → kolom Disposisi, atau menu Disposisi). Cetak **Lembar Disposisi** bila perlu ditandatangani; foto/scan lembar yang sudah ditandatangani diunggah ke disposisi tersebut (tersimpan di Ruang Disposisi).
3. **Bidang tujuan** melihat disposisi di menu Disposisi (lencana angka di menu). Begitu surat sampai ia menekan *Surat sudah sampai di saya*, lalu bisa:
   - **↪ Teruskan ke bidang lain** dengan kata-katanya sendiri (berjenjang, seperti Srikandi; tidak terbatas satu kali), atau
   - **✅ Selesai + tulis kata-kata**: tanggapan/hasil tindak lanjut.
   Siapa pun yang punya unit juga bisa menulis **Catatan** pada surat (terlihat semua orang) — untuk bertanya, membalas, atau memberi arahan.
   Setelah selesai, surat **menunggu diarsipkan**: **Biro Umum** menekan **🗄 Arsipkan** (di menu Disposisi atau Pemantauan, ada juga "Arsipkan semua").
4. Bila disposisi meminta **surat jawaban**: bidang membuat surat keluar lewat tombol "Buat surat jawaban" → tertaut ke surat masuk. Surat jawaban yang belum ada muncul di Pemantauan.
5. **Surat keluar**: tiap bidang mencatat suratnya sendiri, lalu mencatat pengiriman di **Ekspedisi** (via, penerima, tanda terima).
6. **Surat menumpuk?** Di **Pemantauan → Posisi surat** terlihat surat sedang tertahan di siapa dan sudah berapa hari. Tombol **📞 Hubungi** menampilkan **Telepon** dan **WhatsApp** orang di unit itu (misalnya Sekretaris yang belum masuk kantor).
7. **Biro Umum** memantau di menu **Pemantauan**: bidang yang tidak input surat dalam N hari berstatus "Perlu dipanggil". Klik **Panggil** (atau "Panggil Semua"). Bidang melihat panggilan di Dashboard/Pemantauan dan membalas "sudah ditindaklanjuti".

## Riwayat & cetak
- Setiap kejadian (surat masuk, diterima/diteruskan, disposisi, status disposisi, surat jawaban, pengiriman, panggilan) **dicatat otomatis oleh database** lengkap dengan waktu pasti dan nama pelaku; riwayat tidak bisa diubah/dihapus dari aplikasi.
- Menu **Riwayat Surat**: buku agenda digital masuk + keluar, filter tanggal, klik surat untuk garis waktu, tombol **Cetak Buku Agenda** / **CSV** / **Cetak Riwayat** per surat.
- Cetak tersedia juga di Disposisi (Buku Disposisi + Lembar Disposisi), Ekspedisi (Buku Ekspedisi), Kotak Saran.

## Mengubah aturan hak akses
Aturan ada di database pada fungsi `boleh_catat_masuk`, `boleh_disposisi`, `boleh_catat_keluar`, `boleh_alur`, `boleh_pantau`, `boleh_arsip` (bagian atas file migrasi). Contoh: agar Biro Umum juga boleh mencatat surat keluar, ubah daftar tipe pada `boleh_catat_keluar` menjadi `('sekretariat','pimpinan','bidang','biro_umum')` lalu ubah `bisaCatatKeluar` di `lib/peran.js` dengan cara yang sama.

## Privasi seperti Srikandi (migrasi 3)
- **Isi surat** (perihal, asal, file, catatan) hanya bisa dibuka oleh: bidang yang dituju / ikut menerima-meneruskan, unit pembuat (surat keluar), Sekretariat, Ketua & Kepala Markas, Biro Umum, dan admin web.
- **Semua orang** bisa melihat **jejak** surat di menu **Lacak Surat**: nomor agenda, ditujukan ke siapa, sekarang ada di mana, sudah dibaca atau belum, tertahan berapa hari. Perihal, asal, dan file tidak ditampilkan.
- Menu **Bantuan** menjelaskan langkah tiap peran dengan bahasa sehari-hari.
