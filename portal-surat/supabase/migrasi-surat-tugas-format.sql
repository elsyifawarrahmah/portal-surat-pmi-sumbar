-- Format Surat Tugas PMI: kolom Angkutan dan Anggaran. Jalankan SEKALI di Supabase SQL Editor. Aman diulang.
alter table surat_tugas add column if not exists angkutan text;
alter table surat_tugas add column if not exists anggaran text;
notify pgrst, 'reload schema';
