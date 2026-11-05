-- =========================================================
-- ARSIP OTOMATIS BULANAN: surat yang sudah SELESAI di tujuan langsung masuk arsip
-- (TIDAK perlu kembali ke Biro Umum). Jalankan SEKALI di Supabase SQL Editor. Aman diulang.
-- =========================================================

-- 1. Penjaga kolom: saat status jadi 'selesai' -> otomatis masuk arsip (diarsipkan_pada = sekarang)
create or replace function public.jaga_tujuan() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pemberi boolean; v_sistem boolean := coalesce(current_setting('app.sistem_arsip', true), '') = 'on';
begin
  if auth.uid() is not null and not v_sistem then
    v_pemberi := public.boleh_disposisi() or public.pembuat_disposisi(old.disposisi_id);
    if not v_pemberi then
      new.disposisi_id := old.disposisi_id; new.unit_id := old.unit_id; new.instruksi := old.instruksi;
      new.perlu_jawaban := old.perlu_jawaban; new.batas_waktu := old.batas_waktu;
    end if;
    if not (old.unit_id = public.my_unit_id() or public.is_admin()) then
      new.status := old.status; new.tanggapan := old.tanggapan; new.surat_jawaban_id := old.surat_jawaban_id;
    end if;
    if not public.boleh_arsip() then
      new.diarsipkan_pada := old.diarsipkan_pada; new.diarsipkan_oleh := old.diarsipkan_oleh;
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('dibaca','diproses','selesai') and new.dibaca_pada is null then
      new.dibaca_pada := now(); new.dibaca_oleh := auth.uid();
    end if;
    if new.status = 'selesai' then new.selesai_pada := now(); else new.selesai_pada := null; end if;
  end if;

  if new.status <> 'selesai' then
    new.diarsipkan_pada := null; new.diarsipkan_oleh := null;
  elsif old.status is distinct from 'selesai' then
    new.diarsipkan_pada := now(); new.diarsipkan_oleh := null;     -- otomatis masuk arsip bulan ini
  end if;
  return new;
end $$;

-- 2. Tulisan riwayat
create or replace function public.riwayat_tujuan() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_surat uuid; v_unit text;
begin
  begin
    select surat_id into v_surat from surat_disposisi where id = new.disposisi_id;
    select nama into v_unit from surat_unit where id = new.unit_id;
    if tg_op = 'INSERT' then
      perform public.catat_riwayat('masuk', v_surat, 'Disposisi ke ' || v_unit, nullif(new.instruksi, ''));
    else
      if new.status is distinct from old.status then
        perform public.catat_riwayat('masuk', v_surat, v_unit || ': ' ||
          case new.status when 'menunggu' then 'disposisi menunggu' when 'dibaca' then 'surat sudah dibaca' when 'diproses' then 'sedang diproses'
               else 'selesai, otomatis masuk arsip ' || to_char(now(), 'MM/YYYY') end,
          nullif(new.tanggapan, ''));
      end if;
      if new.surat_jawaban_id is distinct from old.surat_jawaban_id and new.surat_jawaban_id is not null then
        perform public.catat_riwayat('masuk', v_surat, 'Surat jawaban ditautkan (' || v_unit || ')',
          (select 'No. ' || nomor_surat from surat_keluar where id = new.surat_jawaban_id));
      end if;
    end if;
  exception when others then null; end;
  return new;
end $$;

-- 3. Setelah SEMUA tujuan akhir selesai, unit perantara (mis. Sekretariat yang hanya meneruskan) ikut selesai otomatis
create or replace function public.selesaikan_perantara() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_surat uuid;
begin
  if new.status <> 'selesai' or old.status = 'selesai' then return new; end if;
  if pg_trigger_depth() > 1 then return new; end if;
  select surat_id into v_surat from surat_disposisi where id = new.disposisi_id;
  if exists (
    select 1 from surat_disposisi_tujuan t join surat_disposisi d on d.id = t.disposisi_id
     where d.surat_id = v_surat and t.status <> 'selesai'
       and not exists (select 1 from surat_disposisi c where c.induk_tujuan_id = t.id)
  ) then return new; end if;
  perform set_config('app.sistem_arsip', 'on', true);
  update surat_disposisi_tujuan t set status = 'selesai'
    from surat_disposisi d where d.id = t.disposisi_id and d.surat_id = v_surat and t.status <> 'selesai';
  perform set_config('app.sistem_arsip', 'off', true);
  return new;
end $$;
drop trigger if exists trg_selesaikan_perantara on surat_disposisi_tujuan;
create trigger trg_selesaikan_perantara after update of status on surat_disposisi_tujuan
  for each row execute function public.selesaikan_perantara();

-- 4. Surat lama yang sudah selesai tapi menunggu Biro Umum -> masuk arsip sesuai tanggal selesainya
update surat_disposisi_tujuan set diarsipkan_pada = coalesce(selesai_pada, now())
 where status = 'selesai' and diarsipkan_pada is null;

notify pgrst, 'reload schema';
