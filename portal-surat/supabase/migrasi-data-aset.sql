-- =========================================================
-- DATA ASET: 1) Kendaraan  2) Peralatan  3) Tanah  4) Lain-lain
-- Terpisah dari menu Surat Tugas. Jalankan SEKALI di Supabase SQL Editor (setelah migrasi-surat-tugas.sql). Aman diulang.
-- Kendaraan memakai tabel "kendaraan" yang sudah ada (supaya pilihan kendaraan di Surat Tugas tetap jalan), hanya ditambah kolom.
-- =========================================================

alter table kendaraan add column if not exists jenis_kendaraan text;
alter table kendaraan add column if not exists tahun int;
alter table kendaraan add column if not exists kondisi text;
alter table kendaraan add column if not exists no_rangka text;
alter table kendaraan add column if not exists no_mesin text;
alter table kendaraan add column if not exists pajak_berlaku date;
alter table kendaraan add column if not exists stnk_berlaku date;
alter table kendaraan add column if not exists lokasi text;
alter table kendaraan add column if not exists nilai numeric;

create table if not exists aset (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('peralatan','tanah','lainnya')),
  kode text,                      -- nomor inventaris
  nama text not null,
  kategori text,
  merek_tipe text,
  jumlah int default 1,
  satuan text,
  tahun_perolehan int,
  nilai numeric,                  -- nilai perolehan (Rp)
  kondisi text,
  lokasi text,
  penanggung_jawab text,
  -- khusus tanah
  alamat text,
  luas_m2 numeric,
  no_sertifikat text,
  status_hak text,
  atas_nama text,
  penggunaan text,
  keterangan text,
  unit_id uuid default public.my_unit_id(),
  dibuat_oleh uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists aset_jenis_idx on aset (jenis);

alter table aset enable row level security;
drop policy if exists "Login lihat aset" on aset;
drop policy if exists "Unit tambah aset" on aset;
drop policy if exists "Unit ubah aset" on aset;
drop policy if exists "Biro Umum hapus aset" on aset;
create policy "Login lihat aset" on aset for select using (auth.role() = 'authenticated');
create policy "Unit tambah aset" on aset for insert with check (public.punya_unit());
create policy "Unit ubah aset" on aset for update using (public.punya_unit());
create policy "Biro Umum hapus aset" on aset for delete using (public.is_admin() or public.my_unit_tipe() = 'biro_umum');

-- kendaraan: izinkan ubah data (sebelumnya hanya tambah/hapus dari menu)
drop policy if exists "Unit ubah kendaraan" on kendaraan;
create policy "Unit ubah kendaraan" on kendaraan for update using (public.punya_unit());
