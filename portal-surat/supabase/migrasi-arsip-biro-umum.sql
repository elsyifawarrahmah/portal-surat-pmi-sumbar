-- =========================================================
-- TAMBAHAN: Arsip Biro Umum (register arsip: lokasi simpan, tanggal arsip, catatan)
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor > New query > Run.
-- Aman dijalankan ulang.
-- =========================================================

create table if not exists arsip_catatan (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('surat_masuk','surat_keluar','pks','sertifikat','sk')),
  ref_id uuid not null,                 -- id surat / dokumen yang diarsipkan
  lokasi_arsip text,                    -- mis. "Lemari A / Rak 2 / Map Biru"
  tanggal_arsip date not null default current_date,
  catatan text,
  diarsip_oleh uuid references profiles(id),
  created_at timestamptz default now(),
  unique (jenis, ref_id)
);

alter table arsip_catatan enable row level security;

drop policy if exists "Login bisa lihat arsip catatan" on arsip_catatan;
drop policy if exists "Admin bisa tambah arsip catatan" on arsip_catatan;
drop policy if exists "Admin bisa ubah arsip catatan" on arsip_catatan;
drop policy if exists "Admin bisa hapus arsip catatan" on arsip_catatan;

create policy "Login bisa lihat arsip catatan" on arsip_catatan
  for select using (auth.role() = 'authenticated');
create policy "Admin bisa tambah arsip catatan" on arsip_catatan
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Admin bisa ubah arsip catatan" on arsip_catatan
  for update using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Admin bisa hapus arsip catatan" on arsip_catatan
  for delete using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Catat ke Log Aktivitas (best-effort: kalau kolom log berbeda, data tetap tersimpan normal)
create or replace function public.log_arsip_catatan()
returns trigger as $$
declare
  r public.arsip_catatan;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  begin
    insert into public.log_aktivitas (tabel, aksi, ringkasan, dilakukan_oleh)
    values ('arsip_catatan', tg_op, 'Arsip ' || r.jenis || ' — lokasi: ' || coalesce(r.lokasi_arsip, '-'), auth.uid());
  exception when others then
    null;
  end;
  return r;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_log_arsip_catatan on arsip_catatan;
create trigger trg_log_arsip_catatan
  after insert or update or delete on arsip_catatan
  for each row execute procedure public.log_arsip_catatan();
