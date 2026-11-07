-- =========================================================
-- 1) "Sekretariat" -> "Sekretaris"
-- 2) Organisasi + SDM + Diklat dijadikan SATU bidang: "Bidang Organisasi, SDM dan Diklat" (kode ORG).
--    Anggota, surat keluar, dan disposisi bidang SDM / Relawan dan Diklat dipindah ke bidang gabungan.
--    Unit SDM dan RD dinonaktifkan (tidak dihapus, supaya riwayat lama tetap utuh).
-- Jalankan SEKALI di Supabase > SQL Editor. Aman diulang.
-- =========================================================
update surat_unit set nama = 'Sekretaris' where kode = 'SEK';

do $$
declare v_org uuid; v_lama uuid[]; r record;
begin
  select id into v_org from surat_unit where kode = 'ORG';
  if v_org is null then raise notice 'Unit ORG tidak ditemukan, dilewati.'; return; end if;
  select coalesce(array_agg(id), '{}') into v_lama from surat_unit where kode in ('SDM', 'RD');
  update surat_unit set nama = 'Bidang Organisasi, SDM dan Diklat' where id = v_org;
  if array_length(v_lama, 1) is null then return; end if;
  -- tujuan disposisi: pindahkan yang tidak bentrok (satu disposisi tidak boleh punya bidang yang sama dua kali)
  update surat_disposisi_tujuan t set unit_id = v_org
   where t.unit_id = any(v_lama)
     and not exists (select 1 from surat_disposisi_tujuan x where x.disposisi_id = t.disposisi_id and x.unit_id = v_org);
  -- pindahkan semua kolom yang menunjuk ke unit lama (kalau bentrok dengan data yang sudah ada, dilewati)
  for r in
    select c.conrelid::regclass as tabel, a.attname as kolom
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.surat_unit'::regclass and array_length(c.conkey, 1) = 1
  loop
    begin
      execute format('update %s set %I = $1 where %I = any($2)', r.tabel, r.kolom, r.kolom) using v_org, v_lama;
    exception when others then raise notice 'sebagian dilewati di % (%).', r.tabel, sqlerrm; end;
  end loop;
  update surat_unit set aktif = false where id = any(v_lama);
end $$;
notify pgrst, 'reload schema';
