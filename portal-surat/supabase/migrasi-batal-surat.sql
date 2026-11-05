-- =========================================================
-- TAMBAHAN 7: BATALKAN SURAT MASUK (bukan hapus permanen) + PULIHKAN
-- Prinsip kearsipan (seperti Srikandi): surat salah tidak dihilangkan, tetapi dibatalkan dengan alasan, jejaknya tercatat, dan bisa dipulihkan.
-- Jalankan SEKALI di Supabase SQL Editor. Aman diulang.
-- =========================================================
alter table surat_masuk add column if not exists dibatalkan_pada timestamptz;
alter table surat_masuk add column if not exists dibatalkan_oleh uuid;
alter table surat_masuk add column if not exists dibatalkan_nama text;
alter table surat_masuk add column if not exists alasan_batal text;

-- Surat dibatalkan hilang dari semua daftar & halaman (kecuali lewat fungsi di bawah)
drop policy if exists "Sembunyikan surat dibatalkan" on surat_masuk;
create policy "Sembunyikan surat dibatalkan" on surat_masuk as restrictive for select
  using (dibatalkan_pada is null or coalesce(current_setting('app.rpc_batal', true), '') = 'on');

-- Kolom pembatalan hanya bisa diubah lewat fungsi (tidak bisa dipalsukan lewat update biasa)
create or replace function public.jaga_batal() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and coalesce(current_setting('app.rpc_batal', true), '') <> 'on' then
    new.dibatalkan_pada := old.dibatalkan_pada; new.dibatalkan_oleh := old.dibatalkan_oleh;
    new.dibatalkan_nama := old.dibatalkan_nama; new.alasan_batal := old.alasan_batal;
  end if;
  return new;
end $$;
drop trigger if exists trg_jaga_batal on surat_masuk;
create trigger trg_jaga_batal before update on surat_masuk for each row execute function public.jaga_batal();

-- Batalkan: pencatat surat / Biro Umum / admin. Selain admin, hanya selama belum ada unit yang mengerjakan.
create or replace function public.batalkan_surat_masuk(p_id uuid, p_alasan text) returns void
language plpgsql security definer set search_path = public as $$
declare m record; v_nama text; v_dikerjakan int;
begin
  if length(trim(coalesce(p_alasan, ''))) < 5 then raise exception 'Tulis alasan pembatalan (minimal 5 huruf)'; end if;
  perform set_config('app.rpc_batal', 'on', true);
  select * into m from surat_masuk where id = p_id;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if m.dibatalkan_pada is not null then raise exception 'Surat sudah dibatalkan'; end if;
  if not (public.is_admin() or m.petugas_id = auth.uid() or public.my_unit_tipe() = 'biro_umum') then raise exception 'Hanya pencatat surat, Biro Umum, atau admin yang bisa membatalkan'; end if;
  select count(*) into v_dikerjakan from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id
    where d.surat_id = p_id and t.status in ('diproses', 'selesai');
  if v_dikerjakan > 0 and not public.is_admin() then raise exception 'Surat ini sudah mulai dikerjakan unit lain. Hubungi admin untuk membatalkan.'; end if;
  select nama_lengkap into v_nama from profiles where id = auth.uid();
  update surat_masuk set dibatalkan_pada = now(), dibatalkan_oleh = auth.uid(), dibatalkan_nama = v_nama, alasan_batal = trim(p_alasan) where id = p_id;
  perform public.catat_riwayat('masuk', p_id, 'dibatalkan', trim(p_alasan));
end $$;

create or replace function public.pulihkan_surat_masuk(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record;
begin
  perform set_config('app.rpc_batal', 'on', true);
  select * into m from surat_masuk where id = p_id;
  if not found or m.dibatalkan_pada is null then raise exception 'Surat tidak ada di daftar dibatalkan'; end if;
  if not (public.is_admin() or m.petugas_id = auth.uid() or public.my_unit_tipe() = 'biro_umum') then raise exception 'Tidak berhak memulihkan'; end if;
  update surat_masuk set dibatalkan_pada = null, dibatalkan_oleh = null, dibatalkan_nama = null, alasan_batal = null where id = p_id;
  perform public.catat_riwayat('masuk', p_id, 'dipulihkan', 'Surat dipulihkan dari daftar dibatalkan');
end $$;

create or replace function public.daftar_surat_batal() returns table (
  id uuid, nomor_surat text, nomor_agenda text, asal_surat text, perihal text, tanggal_diterima_kantor date,
  dibatalkan_pada timestamptz, dibatalkan_nama text, alasan_batal text, petugas_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.rpc_batal', 'on', true);
  return query select m.id, m.nomor_surat, m.nomor_agenda::text, m.asal_surat, m.perihal, m.tanggal_diterima_kantor, m.dibatalkan_pada, m.dibatalkan_nama, m.alasan_batal, m.petugas_id
    from surat_masuk m
    where m.dibatalkan_pada is not null and (public.is_admin() or m.petugas_id = auth.uid() or public.my_unit_tipe() = 'biro_umum')
    order by m.dibatalkan_pada desc;
end $$;

grant execute on function public.batalkan_surat_masuk(uuid, text), public.pulihkan_surat_masuk(uuid), public.daftar_surat_batal() to authenticated;
notify pgrst, 'reload schema';
