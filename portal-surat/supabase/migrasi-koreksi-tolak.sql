-- =========================================================
-- KOREKSI & PENOLAKAN surat keluar / surat tugas (sebelum TTD)
-- Sekretaris, Kepala Markas, dan Ketua bisa: (1) minta diperbaiki, (2) menolak (tidak setuju), (3) Kepala Markas/Ketua
-- mengembalikan surat yang sudah diparaf ke Sekretaris untuk paraf ulang. Semua tercatat dengan tanda merah dan riwayat.
-- Jalankan SEKALI di Supabase SQL Editor. Aman diulang.
-- =========================================================

create table if not exists surat_koreksi (
  id uuid primary key default gen_random_uuid(),
  jenis_surat text not null check (jenis_surat in ('keluar', 'tugas')),
  surat_id uuid not null,
  tipe text not null check (tipe in ('koreksi', 'tolak', 'ke_sekretaris')),
  catatan text not null,
  oleh_id uuid default auth.uid(),
  oleh_nama text,
  oleh_peran text,
  created_at timestamptz default now()
);
create index if not exists surat_koreksi_idx on surat_koreksi (jenis_surat, surat_id, created_at desc);
alter table surat_koreksi enable row level security;

create or replace function public.bisa_baca_koreksi(p_jenis text, p_id uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare ok boolean := false;
begin
  if public.is_admin() then return true; end if;
  if p_jenis = 'keluar' then
    return public.bisa_baca_keluar(p_id) or exists (select 1 from public.surat_keluar k where k.id = p_id and (k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())));
  elsif p_jenis = 'tugas' and to_regclass('public.surat_tugas') is not null then
    execute 'select public.bisa_baca_tugas($1) or exists (select 1 from public.surat_tugas k where k.id = $1 and (k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())))' into ok using p_id;
    return coalesce(ok, false);
  end if;
  return false;
end $$;

drop policy if exists "Baca koreksi" on surat_koreksi;
create policy "Baca koreksi" on surat_koreksi for select using (public.bisa_baca_koreksi(jenis_surat, surat_id) or oleh_id = auth.uid());

-- ---------- Surat keluar ----------
create or replace function public.koreksi_surat_keluar(p_id uuid, p_tipe text, p_catatan text) returns void
language plpgsql security definer set search_path = public as $$
declare k record; v_nama text; v_unit text; v_status text;
begin
  if p_tipe not in ('koreksi', 'tolak', 'ke_sekretaris') then raise exception 'Jenis koreksi tidak dikenal'; end if;
  if length(trim(coalesce(p_catatan, ''))) < 5 then raise exception 'Tulis catatan koreksi (minimal 5 huruf)'; end if;
  if not (public.is_admin() or public.my_unit_tipe() in ('sekretariat', 'pimpinan')) then raise exception 'Hanya Sekretaris, Kepala Markas, atau Ketua yang bisa mengoreksi'; end if;
  select * into k from surat_keluar where id = p_id;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if k.status_persetujuan is null or k.status_persetujuan not in ('diajukan', 'diparaf') then raise exception 'Surat ini tidak sedang menunggu paraf atau persetujuan'; end if;
  if p_tipe = 'ke_sekretaris' and not (k.status_persetujuan = 'diparaf' and (public.is_admin() or public.my_unit_tipe() = 'pimpinan')) then
    raise exception 'Hanya Kepala Markas / Ketua yang bisa mengembalikan surat yang sudah diparaf ke Sekretaris';
  end if;
  v_status := case p_tipe when 'koreksi' then 'revisi' when 'tolak' then 'ditolak' else 'diajukan' end;
  select p.nama_lengkap, coalesce(u.nama, 'Admin') into v_nama, v_unit from profiles p left join surat_unit u on u.id = p.unit_id where p.id = auth.uid();
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_keluar set status_persetujuan = v_status, catatan_revisi = trim(p_catatan),
    paraf_oleh = null, paraf_nama = null, paraf_ttd_url = null, paraf_kode = null, paraf_pada = null where id = p_id;
  insert into surat_koreksi (jenis_surat, surat_id, tipe, catatan, oleh_id, oleh_nama, oleh_peran) values ('keluar', p_id, p_tipe, trim(p_catatan), auth.uid(), v_nama, v_unit);
end $$;

-- Pembuat boleh mengajukan lagi surat yang diperbaiki ATAU yang ditolak
create or replace function public.ajukan_surat_keluar(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare k record;
begin
  select * into k from surat_keluar where id = p_id;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if not (public.is_admin() or k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())) then raise exception 'Bukan surat unit kamu'; end if;
  if coalesce(k.status_persetujuan, 'revisi') not in ('revisi', 'ditolak') then raise exception 'Surat sudah diajukan'; end if;
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_keluar set status_persetujuan = 'diajukan', diajukan_pada = now(), catatan_revisi = null where id = p_id;
end $$;

grant execute on function public.koreksi_surat_keluar(uuid, text, text), public.ajukan_surat_keluar(uuid), public.bisa_baca_koreksi(text, uuid) to authenticated;

-- ---------- Surat tugas (hanya bila migrasi-surat-tugas.sql sudah dijalankan) ----------
do $outer$
begin
  if to_regclass('public.surat_tugas') is not null then
    execute $f$
      create or replace function public.koreksi_surat_tugas(p_id uuid, p_tipe text, p_catatan text) returns void
      language plpgsql security definer set search_path = public as $b$
      declare k record; v_nama text; v_unit text; v_status text;
      begin
        if p_tipe not in ('koreksi', 'tolak', 'ke_sekretaris') then raise exception 'Jenis koreksi tidak dikenal'; end if;
        if length(trim(coalesce(p_catatan, ''))) < 5 then raise exception 'Tulis catatan koreksi (minimal 5 huruf)'; end if;
        if not (public.is_admin() or public.my_unit_tipe() in ('sekretariat', 'pimpinan')) then raise exception 'Hanya Sekretaris, Kepala Markas, atau Ketua yang bisa mengoreksi'; end if;
        select * into k from surat_tugas where id = p_id;
        if not found then raise exception 'Surat tidak ditemukan'; end if;
        if k.status_persetujuan is null or k.status_persetujuan not in ('diajukan', 'diparaf') then raise exception 'Surat ini tidak sedang menunggu paraf atau persetujuan'; end if;
        if p_tipe = 'ke_sekretaris' and not (k.status_persetujuan = 'diparaf' and (public.is_admin() or public.my_unit_tipe() = 'pimpinan')) then
          raise exception 'Hanya Kepala Markas / Ketua yang bisa mengembalikan surat yang sudah diparaf ke Sekretaris';
        end if;
        v_status := case p_tipe when 'koreksi' then 'revisi' when 'tolak' then 'ditolak' else 'diajukan' end;
        select p.nama_lengkap, coalesce(u.nama, 'Admin') into v_nama, v_unit from profiles p left join surat_unit u on u.id = p.unit_id where p.id = auth.uid();
        perform set_config('app.rpc_persetujuan', 'on', true);
        update surat_tugas set status_persetujuan = v_status, catatan_revisi = trim(p_catatan),
          paraf_oleh = null, paraf_nama = null, paraf_ttd_url = null, paraf_kode = null, paraf_pada = null where id = p_id;
        insert into surat_koreksi (jenis_surat, surat_id, tipe, catatan, oleh_id, oleh_nama, oleh_peran) values ('tugas', p_id, p_tipe, trim(p_catatan), auth.uid(), v_nama, v_unit);
      end $b$
    $f$;
    execute $f$
      create or replace function public.ajukan_surat_tugas(p_id uuid) returns void
      language plpgsql security definer set search_path = public as $b$
      declare k record;
      begin
        select * into k from surat_tugas where id = p_id;
        if not found then raise exception 'Surat tidak ditemukan'; end if;
        if not (public.is_admin() or k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())) then raise exception 'Bukan surat unit kamu'; end if;
        if coalesce(k.status_persetujuan, 'revisi') not in ('revisi', 'ditolak') then raise exception 'Surat sudah diajukan'; end if;
        perform set_config('app.rpc_persetujuan', 'on', true);
        update surat_tugas set status_persetujuan = 'diajukan', diajukan_pada = now(), catatan_revisi = null where id = p_id;
      end $b$
    $f$;
    execute 'grant execute on function public.koreksi_surat_tugas(uuid, text, text), public.ajukan_surat_tugas(uuid) to authenticated';
  end if;
end $outer$;

notify pgrst, 'reload schema';
