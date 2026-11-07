-- Kolom Tembusan pada surat keluar. Jalankan SEKALI di Supabase > SQL Editor. Aman diulang.
alter table surat_keluar add column if not exists tembusan text;
notify pgrst, 'reload schema';
