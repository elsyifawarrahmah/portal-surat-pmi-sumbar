-- =========================================================
-- TAMBAHAN 5: PARAF + PERSETUJUAN SURAT KELUAR (Sekretaris paraf -> Kepala Markas/Ketua setuju & TTD -> Biro Umum)
--             + KODE PENANDA pada TTD disposisi
-- Jalankan SEKALI di Supabase SQL Editor (setelah migrasi-alur-biro-ttd-lampiran.sql). Aman diulang.
-- =========================================================
alter table surat_disposisi add column if not exists ttd_kode text;

alter table surat_keluar add column if not exists status_persetujuan text;   -- null/'revisi' = draf, 'diajukan','diparaf','disetujui'
alter table surat_keluar add column if not exists diajukan_pada timestamptz;
alter table surat_keluar add column if not exists paraf_oleh uuid;
alter table surat_keluar add column if not exists paraf_nama text;
alter table surat_keluar add column if not exists paraf_ttd_url text;
alter table surat_keluar add column if not exists paraf_kode text;
alter table surat_keluar add column if not exists paraf_pada timestamptz;
alter table surat_keluar add column if not exists setuju_oleh uuid;
alter table surat_keluar add column if not exists setuju_nama text;
alter table surat_keluar add column if not exists setuju_jabatan text;
alter table surat_keluar add column if not exists setuju_ttd_url text;
alter table surat_keluar add column if not exists setuju_kode text;
alter table surat_keluar add column if not exists setuju_pada timestamptz;
alter table surat_keluar add column if not exists catatan_revisi text;

-- Siapa boleh membaca surat keluar:
--  pembuat/unit pembuat, admin; Sekretariat & pimpinan setelah surat DIAJUKAN; Biro Umum setelah DISETUJUI (dan surat lama tanpa status)
create or replace function public.bisa_baca_keluar(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.punya_akses_penuh()
    or exists (select 1 from public.surat_keluar k where k.id = p_id and (
         k.petugas_id = auth.uid()
      or (k.unit_id is not null and k.unit_id = public.my_unit_id())
      or (public.my_unit_tipe() in ('sekretariat','pimpinan') and k.status_persetujuan in ('diajukan','diparaf','disetujui'))
      or (public.my_unit_tipe() = 'biro_umum' and (k.status_persetujuan is null or k.status_persetujuan = 'disetujui'))
    ))
  );
$$;
drop policy if exists "Baca surat keluar sesuai unit" on surat_keluar;
create policy "Baca surat keluar sesuai unit" on surat_keluar for select
  using (public.bisa_baca_keluar(id) or petugas_id = auth.uid());

-- Kolom persetujuan hanya bisa diubah lewat fungsi di bawah (tidak bisa dipalsukan lewat update biasa)
create or replace function public.jaga_persetujuan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.rpc_persetujuan', true), '') <> 'on' then
    new.status_persetujuan := old.status_persetujuan; new.diajukan_pada := old.diajukan_pada;
    new.paraf_oleh := old.paraf_oleh; new.paraf_nama := old.paraf_nama; new.paraf_ttd_url := old.paraf_ttd_url; new.paraf_kode := old.paraf_kode; new.paraf_pada := old.paraf_pada;
    new.setuju_oleh := old.setuju_oleh; new.setuju_nama := old.setuju_nama; new.setuju_jabatan := old.setuju_jabatan; new.setuju_ttd_url := old.setuju_ttd_url; new.setuju_kode := old.setuju_kode; new.setuju_pada := old.setuju_pada;
    new.catatan_revisi := old.catatan_revisi;
    -- surat yang sudah disetujui isinya terkunci (kecuali admin)
    if old.status_persetujuan = 'disetujui' and not public.is_admin() then
      new.nomor_surat := old.nomor_surat; new.tujuan_surat := old.tujuan_surat; new.perihal := old.perihal; new.tanggal_surat := old.tanggal_surat;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_jaga_persetujuan on surat_keluar;
create trigger trg_jaga_persetujuan before update on surat_keluar for each row execute function public.jaga_persetujuan();

create or replace function public.kode_penanda() returns text language sql volatile as $$
  select 'PMI-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-' || upper(substr(md5(clock_timestamp()::text || random()::text), 1, 4));
$$;

-- 1. Pembuat mengajukan
create or replace function public.ajukan_surat_keluar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k record;
begin
  select * into k from surat_keluar where id = p_id;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if not (public.is_admin() or k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())) then raise exception 'Bukan surat unit kamu'; end if;
  if coalesce(k.status_persetujuan, 'revisi') not in ('revisi') then raise exception 'Surat sudah diajukan'; end if;
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_keluar set status_persetujuan = 'diajukan', diajukan_pada = now(), catatan_revisi = null where id = p_id;
end $$;

-- 2. Sekretaris paraf
create or replace function public.paraf_surat_keluar(p_id uuid, p_ttd text) returns text
language plpgsql security definer set search_path = public as $$
declare k record; v_kode text := public.kode_penanda(); v_nama text;
begin
  if not (public.is_admin() or public.my_unit_tipe() = 'sekretariat') then raise exception 'Hanya Sekretariat yang bisa memaraf'; end if;
  select * into k from surat_keluar where id = p_id;
  if not found or k.status_persetujuan is distinct from 'diajukan' then raise exception 'Surat belum diajukan / sudah diparaf'; end if;
  select nama_lengkap into v_nama from profiles where id = auth.uid();
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_keluar set status_persetujuan = 'diparaf', paraf_oleh = auth.uid(), paraf_nama = v_nama, paraf_ttd_url = p_ttd, paraf_kode = v_kode, paraf_pada = now() where id = p_id;
  return v_kode;
end $$;

-- 3. Kepala Markas / Ketua menyetujui + TTD -> otomatis terlihat Biro Umum
create or replace function public.setujui_surat_keluar(p_id uuid, p_ttd text) returns text
language plpgsql security definer set search_path = public as $$
declare k record; v_kode text := public.kode_penanda(); v_nama text; v_jab text;
begin
  if not (public.is_admin() or public.my_unit_tipe() = 'pimpinan') then raise exception 'Hanya Ketua / Kepala Markas yang bisa menyetujui'; end if;
  select * into k from surat_keluar where id = p_id;
  if not found or k.status_persetujuan is distinct from 'diparaf' then raise exception 'Surat belum diparaf Sekretaris / sudah disetujui'; end if;
  select p.nama_lengkap, coalesce(u.nama, 'Pimpinan') into v_nama, v_jab from profiles p left join surat_unit u on u.id = p.unit_id where p.id = auth.uid();
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_keluar set status_persetujuan = 'disetujui', setuju_oleh = auth.uid(), setuju_nama = v_nama, setuju_jabatan = v_jab, setuju_ttd_url = p_ttd, setuju_kode = v_kode, setuju_pada = now() where id = p_id;
  return v_kode;
end $$;

-- 4. Dikembalikan untuk diperbaiki
create or replace function public.kembalikan_surat_keluar(p_id uuid, p_alasan text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.my_unit_tipe() in ('sekretariat','pimpinan')) then raise exception 'Tidak berhak'; end if;
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_keluar set status_persetujuan = 'revisi', catatan_revisi = nullif(trim(p_alasan), ''), paraf_oleh = null, paraf_nama = null, paraf_ttd_url = null, paraf_kode = null, paraf_pada = null
   where id = p_id and status_persetujuan in ('diajukan','diparaf');
end $$;

grant execute on function public.ajukan_surat_keluar(uuid), public.paraf_surat_keluar(uuid, text), public.setujui_surat_keluar(uuid, text), public.kembalikan_surat_keluar(uuid, text) to authenticated;
notify pgrst, 'reload schema';
