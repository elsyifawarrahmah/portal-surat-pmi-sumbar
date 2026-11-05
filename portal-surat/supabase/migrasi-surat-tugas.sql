-- =========================================================
-- TAMBAHAN 6: SURAT TUGAS, SURAT ASET, TUGAS KERJA SAMA + DATA KENDARAAN
-- Alur persetujuan sama dengan surat keluar: Ajukan -> Paraf Sekretaris -> Kepala Markas/Ketua setuju + TTD (kode penanda) -> Biro Umum.
-- Jalankan SEKALI di Supabase SQL Editor (setelah migrasi-persetujuan-paraf.sql). Aman diulang.
-- =========================================================

-- ---------- Data kendaraan ----------
create table if not exists kendaraan (
  id uuid primary key default gen_random_uuid(),
  nama text not null,                  -- mis. "Toyota Innova"
  nopol text not null unique,          -- mis. "BA 1234 XX"
  sopir text,
  keterangan text,
  created_at timestamptz default now()
);
alter table kendaraan enable row level security;
drop policy if exists "Login lihat kendaraan" on kendaraan;
drop policy if exists "Unit tambah kendaraan" on kendaraan;
drop policy if exists "Unit ubah kendaraan" on kendaraan;
drop policy if exists "Biro Umum hapus kendaraan" on kendaraan;
create policy "Login lihat kendaraan" on kendaraan for select using (auth.role() = 'authenticated');
create policy "Unit tambah kendaraan" on kendaraan for insert with check (public.punya_unit());
create policy "Unit ubah kendaraan" on kendaraan for update using (public.punya_unit());
create policy "Biro Umum hapus kendaraan" on kendaraan for delete using (public.is_admin() or public.my_unit_tipe() = 'biro_umum');

-- ---------- Surat tugas / aset / kerja sama ----------
create table if not exists surat_tugas (
  id uuid primary key default gen_random_uuid(),
  jenis text not null default 'tugas' check (jenis in ('tugas','aset','kerja_sama')),
  nomor_surat text not null,
  tanggal_surat date not null,
  perihal text not null,                -- tugas: maksud/tujuan penugasan | aset: perihal | kerja sama: perihal
  tujuan_surat text,                    -- tugas: lokasi tujuan | aset: kepada | kerja sama: mitra
  dasar text,                           -- dasar penugasan
  rincian text,                         -- aset: daftar/uraian aset | kerja sama: uraian pekerjaan
  mengetahui text,                      -- aset: pihak yang mengetahui
  anggota jsonb not null default '[]'::jsonb,   -- [{nama, jabatan}]
  tanggal_berangkat date,
  tanggal_kembali date,
  kendaraan_id uuid references kendaraan(id) on delete set null,
  kendaraan_nama text, kendaraan_nopol text, sopir text,   -- salinan supaya cetakan lama tidak berubah
  sk_id uuid references arsip_dokumen(id) on delete set null,
  pks_id uuid references arsip_dokumen(id) on delete set null,
  status_pekerjaan text check (status_pekerjaan in ('disiapkan','selesai')),   -- kerja sama
  unit_id uuid default public.my_unit_id(),
  petugas_id uuid references profiles(id) default auth.uid(),
  status_persetujuan text,
  diajukan_pada timestamptz,
  paraf_oleh uuid, paraf_nama text, paraf_ttd_url text, paraf_kode text, paraf_pada timestamptz,
  setuju_oleh uuid, setuju_nama text, setuju_jabatan text, setuju_ttd_url text, setuju_kode text, setuju_pada timestamptz,
  catatan_revisi text,
  created_at timestamptz default now()
);
create index if not exists surat_tugas_jenis_idx on surat_tugas (jenis, tanggal_surat desc);
create index if not exists surat_tugas_tgl_idx on surat_tugas (tanggal_berangkat, tanggal_kembali);
alter table surat_tugas enable row level security;

create or replace function public.bisa_baca_tugas(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_admin()
    or exists (select 1 from public.surat_tugas k where k.id = p_id and (
         k.petugas_id = auth.uid()
      or (k.unit_id is not null and k.unit_id = public.my_unit_id())
      or (public.my_unit_tipe() in ('sekretariat','pimpinan') and k.status_persetujuan in ('diajukan','diparaf','disetujui'))
      or (public.my_unit_tipe() = 'biro_umum' and k.status_persetujuan = 'disetujui')
    ))
  );
$$;
drop policy if exists "Baca surat tugas" on surat_tugas;
drop policy if exists "Buat surat tugas" on surat_tugas;
drop policy if exists "Ubah surat tugas" on surat_tugas;
drop policy if exists "Hapus surat tugas" on surat_tugas;
create policy "Baca surat tugas" on surat_tugas for select using (public.bisa_baca_tugas(id) or petugas_id = auth.uid());
create policy "Buat surat tugas" on surat_tugas for insert with check (public.punya_unit() and petugas_id = auth.uid());
create policy "Ubah surat tugas" on surat_tugas for update using (
  public.is_admin() or ((petugas_id = auth.uid() or (unit_id is not null and unit_id = public.my_unit_id())) and status_persetujuan is distinct from 'disetujui')
);
create policy "Hapus surat tugas" on surat_tugas for delete using (
  public.is_admin() or (petugas_id = auth.uid() and coalesce(status_persetujuan, 'revisi') = 'revisi')
);

-- Kolom persetujuan hanya bisa diubah lewat fungsi di bawah (tidak bisa dipalsukan lewat update biasa)
create or replace function public.jaga_persetujuan_tugas() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.rpc_persetujuan', true), '') <> 'on' then
    new.status_persetujuan := old.status_persetujuan; new.diajukan_pada := old.diajukan_pada;
    new.paraf_oleh := old.paraf_oleh; new.paraf_nama := old.paraf_nama; new.paraf_ttd_url := old.paraf_ttd_url; new.paraf_kode := old.paraf_kode; new.paraf_pada := old.paraf_pada;
    new.setuju_oleh := old.setuju_oleh; new.setuju_nama := old.setuju_nama; new.setuju_jabatan := old.setuju_jabatan; new.setuju_ttd_url := old.setuju_ttd_url; new.setuju_kode := old.setuju_kode; new.setuju_pada := old.setuju_pada;
    new.catatan_revisi := old.catatan_revisi; new.status_pekerjaan := old.status_pekerjaan; new.petugas_id := old.petugas_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_jaga_persetujuan_tugas on surat_tugas;
create trigger trg_jaga_persetujuan_tugas before update on surat_tugas for each row execute function public.jaga_persetujuan_tugas();

create or replace function public.ajukan_surat_tugas(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k record;
begin
  select * into k from surat_tugas where id = p_id;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if not (public.is_admin() or k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())) then raise exception 'Bukan surat unit kamu'; end if;
  if coalesce(k.status_persetujuan, 'revisi') not in ('revisi') then raise exception 'Surat sudah diajukan'; end if;
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_tugas set status_persetujuan = 'diajukan', diajukan_pada = now(), catatan_revisi = null where id = p_id;
end $$;

create or replace function public.paraf_surat_tugas(p_id uuid, p_ttd text) returns text
language plpgsql security definer set search_path = public as $$
declare k record; v_kode text := public.kode_penanda(); v_nama text;
begin
  if not (public.is_admin() or public.my_unit_tipe() = 'sekretariat') then raise exception 'Hanya Sekretariat yang bisa memaraf'; end if;
  select * into k from surat_tugas where id = p_id;
  if not found or k.status_persetujuan is distinct from 'diajukan' then raise exception 'Surat belum diajukan / sudah diparaf'; end if;
  select nama_lengkap into v_nama from profiles where id = auth.uid();
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_tugas set status_persetujuan = 'diparaf', paraf_oleh = auth.uid(), paraf_nama = v_nama, paraf_ttd_url = p_ttd, paraf_kode = v_kode, paraf_pada = now() where id = p_id;
  return v_kode;
end $$;

create or replace function public.setujui_surat_tugas(p_id uuid, p_ttd text) returns text
language plpgsql security definer set search_path = public as $$
declare k record; v_kode text := public.kode_penanda(); v_nama text; v_jab text;
begin
  if not (public.is_admin() or public.my_unit_tipe() = 'pimpinan') then raise exception 'Hanya Ketua / Kepala Markas yang bisa menyetujui'; end if;
  select * into k from surat_tugas where id = p_id;
  if not found or k.status_persetujuan is distinct from 'diparaf' then raise exception 'Surat belum diparaf Sekretaris / sudah disetujui'; end if;
  select p.nama_lengkap, coalesce(u.nama, 'Pimpinan') into v_nama, v_jab from profiles p left join surat_unit u on u.id = p.unit_id where p.id = auth.uid();
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_tugas set status_persetujuan = 'disetujui', setuju_oleh = auth.uid(), setuju_nama = v_nama, setuju_jabatan = v_jab, setuju_ttd_url = p_ttd, setuju_kode = v_kode, setuju_pada = now() where id = p_id;
  return v_kode;
end $$;

create or replace function public.kembalikan_surat_tugas(p_id uuid, p_alasan text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.my_unit_tipe() in ('sekretariat','pimpinan')) then raise exception 'Tidak berhak'; end if;
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_tugas set status_persetujuan = 'revisi', catatan_revisi = nullif(trim(p_alasan), ''), paraf_oleh = null, paraf_nama = null, paraf_ttd_url = null, paraf_kode = null, paraf_pada = null
   where id = p_id and status_persetujuan in ('diajukan','diparaf');
end $$;

-- Kerja sama: tandai pekerjaan disiapkan / selesai (boleh setelah surat disetujui)
create or replace function public.status_pekerjaan_tugas(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare k record;
begin
  if p_status not in ('disiapkan','selesai') then raise exception 'Status tidak dikenal'; end if;
  select * into k from surat_tugas where id = p_id;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if not (public.is_admin() or public.my_unit_tipe() = 'biro_umum' or k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())) then raise exception 'Tidak berhak'; end if;
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_tugas set status_pekerjaan = p_status where id = p_id;
end $$;

grant execute on function public.ajukan_surat_tugas(uuid), public.paraf_surat_tugas(uuid, text), public.setujui_surat_tugas(uuid, text), public.kembalikan_surat_tugas(uuid, text), public.status_pekerjaan_tugas(uuid, text) to authenticated;
notify pgrst, 'reload schema';
