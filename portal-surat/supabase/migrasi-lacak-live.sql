-- =========================================================
-- LACAK SURAT LIVE: tahap persetujuan surat keluar ikut tercatat di Jejak
-- (diajukan, diparaf, disetujui, dikembalikan/ditolak). Jalankan SEKALI di Supabase SQL Editor. Aman diulang.
-- Syarat: migrasi-disposisi-pemantauan.sql (surat_riwayat + catat_riwayat) dan migrasi-koreksi-tolak.sql sudah dijalankan.
-- =========================================================
create or replace function public.trg_riwayat_persetujuan_keluar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status_persetujuan is distinct from old.status_persetujuan then
    begin
      if new.status_persetujuan = 'diajukan' and (old.status_persetujuan is null or old.status_persetujuan in ('revisi', 'ditolak')) then
        perform public.catat_riwayat('keluar', new.id, case when old.status_persetujuan is null then 'Diajukan untuk paraf Sekretaris' else 'Diajukan ulang setelah diperbaiki' end, null);
      elsif new.status_persetujuan = 'diparaf' then
        perform public.catat_riwayat('keluar', new.id, 'Diparaf Sekretaris, diteruskan ke Kepala Markas / Ketua', null);
      elsif new.status_persetujuan = 'disetujui' then
        perform public.catat_riwayat('keluar', new.id, 'Disetujui dan ditandatangani' || coalesce(' ' || nullif(new.setuju_jabatan, ''), ''), null);
      end if;
    exception when others then null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_riwayat_persetujuan_keluar on surat_keluar;
create trigger trg_riwayat_persetujuan_keluar after update of status_persetujuan on surat_keluar
  for each row execute function public.trg_riwayat_persetujuan_keluar();

create or replace function public.trg_riwayat_koreksi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.jenis_surat = 'keluar' then
    begin
      perform public.catat_riwayat('keluar', new.surat_id,
        case new.tipe when 'koreksi' then 'Dikembalikan untuk diperbaiki' when 'tolak' then 'Ditolak' else 'Dikembalikan ke Sekretaris' end,
        left(coalesce(new.catatan, ''), 300));
    exception when others then null;
    end;
  end if;
  return new;
end $$;
drop trigger if exists trg_riwayat_koreksi on surat_koreksi;
create trigger trg_riwayat_koreksi after insert on surat_koreksi
  for each row execute function public.trg_riwayat_koreksi();
