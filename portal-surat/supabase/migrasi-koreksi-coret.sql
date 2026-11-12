-- =========================================================
-- KOREKSI DENGAN CORETAN (surat keluar)
-- Sekretaris / Kepala Markas / Ketua bisa mencoret langsung di gambar surat (pena, garis, teks rapi, keterangan).
-- Hasil coretan tersimpan sebagai gambar di riwayat koreksi dan ikut dikembalikan ke pembuat surat.
-- Berkas surat yang dikoreksi dicatat sebagai "versi" -> setelah pembuat mengganti berkas, versi lama otomatis
-- tampil sebagai "dibatalkan karena diganti revisi" (tidak dihapus, tetap jadi bukti), surat TIDAK dobel.
-- Syarat: migrasi-koreksi-tolak.sql sudah pernah dijalankan. Jalankan SEKALI di Supabase SQL Editor. Aman diulang.
-- =========================================================

alter table surat_koreksi add column if not exists gambar jsonb;       -- daftar alamat gambar halaman yang dicoret
alter table surat_koreksi add column if not exists berkas_url text;    -- berkas surat yang dikoreksi (versi sebelum diperbaiki)

-- Ganti fungsi lama (3 parameter) dengan yang baru (5 parameter, 2 terakhir boleh kosong).
-- Pemanggilan lama dengan 3 parameter tetap jalan.
drop function if exists public.koreksi_surat_keluar(uuid, text, text);

create or replace function public.koreksi_surat_keluar(p_id uuid, p_tipe text, p_catatan text, p_gambar jsonb default null, p_berkas text default null) returns void
language plpgsql security definer set search_path = public as $$
declare k record; v_nama text; v_unit text; v_status text; v_cat text; v_ada_gambar boolean := false;
begin
  if p_tipe not in ('koreksi', 'tolak', 'ke_sekretaris') then raise exception 'Jenis koreksi tidak dikenal'; end if;
  if p_gambar is not null then
    if jsonb_typeof(p_gambar) <> 'array' or jsonb_array_length(p_gambar) > 12 then raise exception 'Gambar koreksi tidak valid'; end if;
    if exists (select 1 from jsonb_array_elements(p_gambar) e where jsonb_typeof(e) <> 'string') then raise exception 'Gambar koreksi tidak valid'; end if;
    v_ada_gambar := jsonb_array_length(p_gambar) > 0;
  end if;
  if length(trim(coalesce(p_catatan, ''))) < 5 and not v_ada_gambar then raise exception 'Tulis catatan koreksi (minimal 5 huruf) atau coret langsung di surat'; end if;
  if not (public.is_admin() or public.my_unit_tipe() in ('sekretariat', 'pimpinan')) then raise exception 'Hanya Sekretaris, Kepala Markas, atau Ketua yang bisa mengoreksi'; end if;
  select * into k from surat_keluar where id = p_id;
  if not found then raise exception 'Surat tidak ditemukan'; end if;
  if k.status_persetujuan is null or k.status_persetujuan not in ('diajukan', 'diparaf') then raise exception 'Surat ini tidak sedang menunggu paraf atau persetujuan'; end if;
  if p_tipe = 'ke_sekretaris' and not (k.status_persetujuan = 'diparaf' and (public.is_admin() or public.my_unit_tipe() = 'pimpinan')) then
    raise exception 'Hanya Kepala Markas / Ketua yang bisa mengembalikan surat yang sudah diparaf ke Sekretaris';
  end if;
  v_status := case p_tipe when 'koreksi' then 'revisi' when 'tolak' then 'ditolak' else 'diajukan' end;
  v_cat := coalesce(nullif(trim(coalesce(p_catatan, '')), ''), 'Koreksi dengan coretan langsung pada surat (lihat gambar).');
  select p.nama_lengkap, coalesce(u.nama, 'Admin') into v_nama, v_unit from profiles p left join surat_unit u on u.id = p.unit_id where p.id = auth.uid();
  perform set_config('app.rpc_persetujuan', 'on', true);
  update surat_keluar set status_persetujuan = v_status, catatan_revisi = v_cat,
    paraf_oleh = null, paraf_nama = null, paraf_ttd_url = null, paraf_kode = null, paraf_pada = null where id = p_id;
  insert into surat_koreksi (jenis_surat, surat_id, tipe, catatan, oleh_id, oleh_nama, oleh_peran, gambar, berkas_url)
    values ('keluar', p_id, p_tipe, v_cat, auth.uid(), v_nama, v_unit, case when v_ada_gambar then p_gambar else null end, coalesce(p_berkas, k.file_bukti_url));
end $$;

grant execute on function public.koreksi_surat_keluar(uuid, text, text, jsonb, text) to authenticated;
notify pgrst, 'reload schema';
