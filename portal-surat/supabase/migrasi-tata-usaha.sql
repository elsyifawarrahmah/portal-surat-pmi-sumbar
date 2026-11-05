-- =========================================================
-- TAMBAHAN 8: UNIT "TATA USAHA"
-- Tata Usaha boleh mencatat surat (masuk/keluar) tetapi surat HANYA bisa dikirim ke Biro Umum.
-- Selain itu Tata Usaha hanya memantau lewat menu Lacak Surat dan bisa menghubungi Biro Umum.
-- Jalankan SEKALI di Supabase SQL Editor. Aman diulang.
-- =========================================================

-- 1) Jenis unit baru: tata_usaha
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.surat_unit'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%tipe%' loop
    execute format('alter table public.surat_unit drop constraint %I', c.conname);
  end loop;
end $$;
alter table surat_unit add constraint surat_unit_tipe_check check (tipe in ('biro_umum','sekretariat','pimpinan','bidang','tata_usaha'));

insert into surat_unit (kode, nama, tipe, urut)
select 'TU', 'Tata Usaha', 'tata_usaha', 5 where not exists (select 1 from surat_unit where tipe = 'tata_usaha');

-- 2) Boleh mencatat surat (masuk & keluar). TIDAK boleh membuat disposisi bebas dan TIDAK membaca surat unit lain.
create or replace function public.boleh_catat_masuk() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('biro_umum','sekretariat','tata_usaha'), false);
$$;
create or replace function public.boleh_catat_keluar() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('sekretariat','pimpinan','bidang','tata_usaha'), false);
$$;

-- 3) Satu-satunya jalur Tata Usaha mengirim surat masuk: ke Biro Umum
create or replace function public.kirim_ke_biro_umum(p_surat uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record; v_biro uuid; v_unit uuid := public.my_unit_id(); v_nama text; v_disp uuid;
begin
  if not (public.is_admin() or public.my_unit_tipe() = 'tata_usaha') then raise exception 'Hanya Tata Usaha yang memakai pengiriman ini'; end if;
  perform set_config('app.rpc_batal', 'on', true);
  select * into m from surat_masuk where id = p_surat;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if not (public.is_admin() or m.petugas_id = auth.uid() or public.dicatat_unit_saya(m.petugas_id)) then raise exception 'Itu bukan surat yang kamu catat'; end if;
  select id into v_biro from surat_unit where tipe = 'biro_umum' and aktif order by urut limit 1;
  if v_biro is null then raise exception 'Unit Biro Umum belum ada'; end if;
  if exists (select 1 from surat_disposisi d where d.surat_id = p_surat) then raise exception 'Surat ini sudah dikirim ke Biro Umum'; end if;
  select nama into v_nama from surat_unit where id = v_unit;
  insert into surat_disposisi (surat_id, tanggal_diteruskan, dari_unit_id, dari_nama, dibuat_oleh)
    values (p_surat, current_date, v_unit, coalesce(v_nama, 'Tata Usaha'), auth.uid()) returning id into v_disp;
  insert into surat_disposisi_tujuan (disposisi_id, unit_id, instruksi) values (v_disp, v_biro, 'Mohon diproses lebih lanjut oleh Biro Umum.');
end $$;
grant execute on function public.kirim_ke_biro_umum(uuid) to authenticated;
notify pgrst, 'reload schema';
