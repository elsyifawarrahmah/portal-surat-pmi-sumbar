-- =========================================================
-- TAMBAHAN 3 (seperti Srikandi): PRIVASI PER UNIT + PELACAKAN SURAT
--
--   * Isi surat hanya bisa dibaca oleh: unit yang dituju / yang ikut menerima-meneruskan,
--     unit pembuat (surat keluar), serta Sekretariat, pimpinan (Ketua, Kepala Markas),
--     Biro Umum, dan admin web.
--   * Bidang lain TIDAK bisa membuka isi surat orang lain, tetapi bisa melihat JEJAKNYA
--     lewat menu "Lacak Surat": nomor agenda, ditujukan ke siapa, sudah sampai di mana,
--     sudah dibaca atau belum, dan tertahan berapa hari (tanpa perihal, asal, atau file).
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run
-- (setelah migrasi-disposisi-pemantauan.sql dan migrasi-alur-berjenjang.sql). Aman dijalankan ulang.
-- =========================================================

-- ---------- Siapa boleh membaca isi surat ----------
create or replace function public.punya_akses_penuh() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('sekretariat','pimpinan','biro_umum'), false);
$$;

-- Unit saya terlibat pada surat masuk ini (dituju, atau pemberi/peneruskan disposisi)
create or replace function public.terlibat_surat(p_surat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(exists (
    select 1 from public.surat_disposisi d
    left join public.surat_disposisi_tujuan t on t.disposisi_id = d.id
    where d.surat_id = p_surat
      and (t.unit_id = public.my_unit_id() or d.dari_unit_id = public.my_unit_id() or d.dibuat_oleh = auth.uid())
  ), false);
$$;

create or replace function public.bisa_baca_surat(p_surat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.punya_akses_penuh()
    or exists (select 1 from public.surat_masuk m where m.id = p_surat and m.petugas_id = auth.uid())
    or public.terlibat_surat(p_surat)
  );
$$;

create or replace function public.bisa_baca_keluar(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.punya_akses_penuh()
    or exists (select 1 from public.surat_keluar k where k.id = p_id and (k.petugas_id = auth.uid() or (k.unit_id is not null and k.unit_id = public.my_unit_id())))
  );
$$;

create or replace function public.surat_dari_disposisi(p_disposisi uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select surat_id from public.surat_disposisi where id = p_disposisi;
$$;

-- ---------- Ganti aturan LIHAT pada tabel surat ----------
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' and cmd = 'SELECT'
             and tablename in ('surat_masuk','surat_tahapan','surat_keluar','surat_disposisi','surat_disposisi_tujuan','surat_catatan','surat_riwayat','surat_ekspedisi')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- (dicek langsung pada kolom baris, bukan dicari ulang di tabel, supaya baris yang baru disimpan langsung terbaca pembuatnya)
create policy "Baca surat masuk sesuai unit" on surat_masuk for select
  using (public.punya_akses_penuh() or petugas_id = auth.uid() or public.terlibat_surat(id));
create policy "Baca tahapan sesuai unit" on surat_tahapan for select using (public.bisa_baca_surat(surat_id));
create policy "Baca surat keluar sesuai unit" on surat_keluar for select
  using (public.punya_akses_penuh() or petugas_id = auth.uid() or (unit_id is not null and unit_id = public.my_unit_id()));
create policy "Baca disposisi sesuai unit" on surat_disposisi for select using (public.bisa_baca_surat(surat_id));
create policy "Baca tujuan disposisi sesuai unit" on surat_disposisi_tujuan for select
  using (public.bisa_baca_surat(public.surat_dari_disposisi(disposisi_id)));
create policy "Baca catatan sesuai unit" on surat_catatan for select using (public.bisa_baca_surat(surat_id));
create policy "Baca riwayat sesuai unit" on surat_riwayat for select
  using (case surat_jenis when 'masuk' then public.bisa_baca_surat(surat_id) else public.bisa_baca_keluar(surat_id) end);
create policy "Baca ekspedisi sesuai unit" on surat_ekspedisi for select using (public.bisa_baca_keluar(surat_keluar_id));

-- ---------- Pelacakan: terlihat semua orang, TANPA isi surat ----------
create or replace function public.lacak_surat()
returns table (
  jenis text, surat_id uuid, nomor_agenda text, tanggal date, dari text, untuk text,
  posisi text, status text, sejak timestamptz, hari integer, boleh_baca boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  return query
  with masuk as (
    select m.id, m.nomor_agenda, m.tanggal_diterima_kantor as tgl, m.created_at,
      (select string_agg(distinct u.nama, ', ' order by u.nama) from surat_disposisi d
         join surat_disposisi_tujuan t on t.disposisi_id = d.id join surat_unit u on u.id = t.unit_id where d.surat_id = m.id) as untuk,
      (select count(*) from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id where d.surat_id = m.id) as n_tujuan,
      (select count(*) from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id where d.surat_id = m.id and t.status <> 'selesai') as n_aktif,
      (select count(*) from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id where d.surat_id = m.id and t.status = 'selesai' and t.diarsipkan_pada is null) as n_tunggu_arsip,
      (select string_agg(distinct u.nama || ' (' || case t.status when 'menunggu' then 'belum dibuka' when 'dibaca' then 'sudah dibaca' else 'sedang diproses' end || ')', ', ')
         from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id join surat_unit u on u.id = t.unit_id
         where d.surat_id = m.id and t.status <> 'selesai') as posisi_aktif,
      (select min(t.created_at) from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id where d.surat_id = m.id and t.status <> 'selesai') as sejak_aktif,
      (select count(*) from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id where d.surat_id = m.id and t.status = 'menunggu') as n_menunggu,
      (select count(*) from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id where d.surat_id = m.id and t.status = 'dibaca') as n_dibaca,
      (select max(t.selesai_pada) from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id where d.surat_id = m.id) as sejak_selesai,
      (select x.nama_tahap || '|' || x.tanggal_diterima::text from surat_tahapan x
         where x.surat_id = m.id and x.tanggal_diterima is not null and x.tanggal_diteruskan is null order by x.urutan limit 1) as tahap
    from surat_masuk m
  ), hitung as (
    select 'masuk'::text as jenis, ms.id as surat_id, ms.nomor_agenda, ms.tgl as tanggal, null::text as dari,
      coalesce(ms.untuk, 'Belum didisposisikan') as untuk,
      case
        when ms.n_tujuan = 0 and ms.tahap is not null then split_part(ms.tahap, '|', 1)
        when ms.n_tujuan = 0 then 'Baru dicatat oleh Sekretariat'
        when ms.n_aktif > 0 then ms.posisi_aktif
        when ms.n_tunggu_arsip > 0 then 'Biro Umum (menunggu diarsipkan)'
        else 'Arsip Biro Umum'
      end as posisi,
      case
        when ms.n_tujuan = 0 then case when ms.tahap is not null then 'Diterima' else 'Baru masuk' end
        when ms.n_aktif > 0 then case when ms.n_menunggu > 0 then 'Belum dibuka' when ms.n_dibaca > 0 then 'Sudah dibaca' else 'Sedang diproses' end
        when ms.n_tunggu_arsip > 0 then 'Selesai' else 'Diarsipkan'
      end as status,
      case
        when ms.n_tujuan = 0 and ms.tahap is not null then split_part(ms.tahap, '|', 2)::timestamptz
        when ms.n_tujuan = 0 then ms.created_at
        when ms.n_aktif > 0 then ms.sejak_aktif
        else coalesce(ms.sejak_selesai, ms.created_at)
      end as sejak,
      (ms.n_tujuan > 0 and ms.n_aktif = 0) as selesai
    from masuk ms
  )
  select h.jenis, h.surat_id, h.nomor_agenda, h.tanggal, h.dari, h.untuk, h.posisi, h.status, h.sejak,
         floor(extract(epoch from (now() - h.sejak)) / 86400)::int,
         public.bisa_baca_surat(h.surat_id)
  from hitung h
  union all
  select 'keluar'::text, k.id, k.nomor_agenda, k.tanggal_surat,
         coalesce(u.nama, nullif(k.divisi, ''), 'Unit'),
         'Surat keluar',
         case when e.id is null then 'Di ' || coalesce(u.nama, nullif(k.divisi, ''), 'unit pembuat') || ' (belum dikirim)'
              when e.status = 'diterima' then 'Sudah diterima tujuan' when e.status = 'kembali' then 'Kembali / tidak sampai' else 'Dalam pengiriman' end,
         case when e.id is null then 'Belum dikirim' when e.status = 'diterima' then 'Diterima' when e.status = 'kembali' then 'Kembali' else 'Dikirim' end,
         coalesce(e.created_at, k.created_at),
         floor(extract(epoch from (now() - coalesce(e.created_at, k.created_at))) / 86400)::int,
         public.bisa_baca_keluar(k.id)
  from surat_keluar k
  left join surat_unit u on u.id = k.unit_id
  left join lateral (select x.* from surat_ekspedisi x where x.surat_keluar_id = k.id order by x.created_at desc limit 1) e on true;
end $$;

-- Garis waktu pelacakan: kejadian terlihat semua orang, keterangan (yang bisa memuat isi surat) hanya untuk yang berhak
create or replace function public.lacak_riwayat(p_jenis text, p_surat uuid)
returns table (waktu timestamptz, aksi text, unit_nama text, oleh_nama text, keterangan text)
language plpgsql stable security definer set search_path = public as $$
declare v_boleh boolean;
begin
  if auth.uid() is null then return; end if;
  v_boleh := case p_jenis when 'masuk' then public.bisa_baca_surat(p_surat) else public.bisa_baca_keluar(p_surat) end;
  return query
    select r.waktu, r.aksi, r.unit_nama, r.oleh_nama, case when v_boleh then r.keterangan else null end
    from surat_riwayat r
    where r.surat_jenis = p_jenis and r.surat_id = p_surat
      and (v_boleh or r.aksi not like 'Catatan%')
    order by r.waktu, r.id;
end $$;

grant execute on function public.lacak_surat() to authenticated;
grant execute on function public.lacak_riwayat(text, uuid) to authenticated;

-- Muat ulang daftar tabel Supabase otomatis (supaya tidak ada pesan "belum dibuat" yang basi)
notify pgrst, 'reload schema';
