-- =========================================================
-- TAMBAHAN: kolom Divisi/Biro
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor > New query > Run.
-- Aman dijalankan ulang.
-- =========================================================

-- Surat Keluar: divisi/biro yang mengeluarkan surat
alter table if exists surat_keluar add column if not exists divisi text;

-- Perjanjian Kerja Sama & Surat Keputusan: divisi/biro
alter table if exists arsip_dokumen add column if not exists divisi text;
