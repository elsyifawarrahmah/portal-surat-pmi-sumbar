-- =========================================================
-- TAMBAHAN 4: ALUR BIRO -> SEKRETARIS -> TUJUAN, TTD DIGITAL, LAMPIRAN BANYAK, EDIT
--
--  * Biro Umum mencatat surat masuk & meneruskannya (mis. ke Sekretariat).
--  * Isi surat HANYA bisa dibaca unit yang menerima/meneruskan (+ Biro Umum pencatatnya + admin).
--    Sekretariat / pimpinan TIDAK lagi otomatis bisa membaca semua surat.
--  * Yang memegang surat (mis. Sekretariat) yang meneruskan ke tujuan lain.
--  * Unit tujuan menyatakan selesai -> kembali ke Biro Umum untuk diarsipkan (sudah ada).
--  * Viewer / unit lain: hanya lihat jejak lewat Lacak Surat (tanpa isi).
--  * Tanda tangan digital (profil + disposisi), banyak lampiran per surat, catatan bisa diedit.
--
-- Jalankan SEKALI di Supabase > SQL Editor (setelah migrasi sebelumnya). Aman diulang.
-- =========================================================

-- ---------- Kolom baru ----------
alter table profiles add column if not exists ttd_url text;
alter table surat_disposisi add column if not exists ttd_url text;
alter table surat_disposisi add column if not exists ttd_nama text;
alter table surat_disposisi add column if not exists ttd_pada timestamptz;
alter table surat_catatan add column if not exists diubah_pada timestamptz;

-- ---------- Lampiran banyak ----------
create table if not exists surat_lampiran (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('masuk','keluar')),
  surat_id uuid not null,
  url text not null,
  nama text,
  ukuran integer,
  dibuat_oleh uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists surat_lampiran_surat_idx on surat_lampiran (jenis, surat_id);
alter table surat_lampiran enable row level security;

-- ---------- Hak akses ----------
-- Isi surat: admin saja yang otomatis lihat semua
create or replace function public.punya_akses_penuh() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin();
$$;

-- Surat dicatat oleh unit saya (mis. Biro Umum yang mencatat)
create or replace function public.dicatat_unit_saya(p_petugas uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(exists (select 1 from public.profiles p where p.id = p_petugas and p.unit_id is not null and p.unit_id = public.my_unit_id()), false);
$$;

-- Biro Umum melihat surat yang kembali kepadanya untuk diarsipkan (surat lama yang dicatat unit lain)
create or replace function public.kembali_ke_biro(p_surat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_unit_tipe() = 'biro_umum' and exists (
    select 1 from public.surat_disposisi d join public.surat_disposisi_tujuan t on t.disposisi_id = d.id
    where d.surat_id = p_surat and t.status = 'selesai'), false);
$$;

create or replace function public.bisa_baca_surat(p_surat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.punya_akses_penuh()
    or exists (select 1 from public.surat_masuk m where m.id = p_surat and (m.petugas_id = auth.uid() or public.dicatat_unit_saya(m.petugas_id)))
    or public.terlibat_surat(p_surat)
    or public.kembali_ke_biro(p_surat)
  );
$$;

drop policy if exists "Baca surat masuk sesuai unit" on surat_masuk;
create policy "Baca surat masuk sesuai unit" on surat_masuk for select
  using (public.punya_akses_penuh() or petugas_id = auth.uid() or public.dicatat_unit_saya(petugas_id) or public.terlibat_surat(id) or public.kembali_ke_biro(id));

-- Biro Umum boleh mencatat & meneruskan surat masuk (Sekretariat tetap boleh agar data lama aman)
create or replace function public.boleh_catat_masuk() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('biro_umum','sekretariat'), false);
$$;
create or replace function public.boleh_disposisi() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('biro_umum','sekretariat','pimpinan'), false);
$$;

-- Meneruskan hanya pada surat yang boleh dibaca pemegangnya
drop policy if exists "Pemberi atau penerima tambah disposisi" on surat_disposisi;
create policy "Pemberi atau penerima tambah disposisi" on surat_disposisi for insert
  with check ((public.boleh_disposisi() or public.penerima_surat(surat_id)) and public.bisa_baca_surat(surat_id));

-- Catatan: boleh ubah/hapus catatan sendiri
drop policy if exists "Penulis ubah catatan" on surat_catatan;
drop policy if exists "Penulis hapus catatan" on surat_catatan;
create policy "Penulis ubah catatan" on surat_catatan for update using (dibuat_oleh = auth.uid() or public.is_admin());
create policy "Penulis hapus catatan" on surat_catatan for delete using (dibuat_oleh = auth.uid() or public.is_admin());

-- Surat masuk: pencatat (unit sama) boleh ubah datanya
drop policy if exists "Pencatat bisa ubah surat masuk" on surat_masuk;
create policy "Pencatat bisa ubah surat masuk" on surat_masuk for update
  using (public.boleh_catat_masuk() and (public.is_admin() or petugas_id = auth.uid() or public.dicatat_unit_saya(petugas_id)));

-- Lampiran: lihat mengikuti hak baca suratnya; tambah/hapus oleh yang terlibat
drop policy if exists "Lampiran lihat" on surat_lampiran;
drop policy if exists "Lampiran tambah" on surat_lampiran;
drop policy if exists "Lampiran hapus" on surat_lampiran;
create policy "Lampiran lihat" on surat_lampiran for select
  using (case jenis when 'masuk' then public.bisa_baca_surat(surat_id) else public.bisa_baca_keluar(surat_id) end);
create policy "Lampiran tambah" on surat_lampiran for insert
  with check (case jenis when 'masuk' then public.bisa_baca_surat(surat_id) else public.bisa_baca_keluar(surat_id) end);
create policy "Lampiran hapus" on surat_lampiran for delete
  using (dibuat_oleh = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
