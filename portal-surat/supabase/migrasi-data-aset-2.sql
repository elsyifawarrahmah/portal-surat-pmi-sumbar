-- =========================================================
-- DATA ASET tahap 2 — jalankan SEKALI di Supabase SQL Editor (setelah migrasi-data-aset.sql). Aman diulang.
-- Kendaraan: peruntukan, penempatan, pemegang, surat bukti penyerahan (Surat Aset). Peralatan: kolom detail opsional.
-- =========================================================
alter table kendaraan add column if not exists peruntukan text;     -- Operasional Pimpinan / Staff / Lokpus / Peminjaman
alter table kendaraan add column if not exists penempatan text;     -- Markas / Ketua / Staff / Perorangan
alter table kendaraan add column if not exists pemegang text;       -- nama pemegang bila tidak di Markas
alter table kendaraan add column if not exists surat_bukti_id uuid references surat_tugas(id) on delete set null;  -- Surat Aset (bukti penyerahan)

alter table aset add column if not exists no_seri text;
alter table aset add column if not exists spesifikasi text;
alter table aset add column if not exists garansi_sampai date;
alter table aset add column if not exists servis_terakhir date;
