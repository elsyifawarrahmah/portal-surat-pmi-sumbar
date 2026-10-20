-- =========================================================
-- TAMBAHAN: Perjanjian Kerja Sama, Sertifikat & Piagam, Surat Keputusan
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor > New query > Run
-- Aman dijalankan ulang (memakai "if not exists" / "drop ... if exists").
-- =========================================================

create table if not exists arsip_dokumen (
  id uuid primary key default gen_random_uuid(),
  jenis text not null check (jenis in ('pks','sertifikat','sk')),
  nomor text not null,
  tanggal date not null,
  pihak text,                -- PKS: pihak kedua/mitra | Sertifikat & Piagam: nama penerima
  judul text not null,       -- PKS: tentang | Sertifikat & Piagam: dalam rangka | SK: tentang
  kategori text,             -- Sertifikat & Piagam: 'Sertifikat' / 'Piagam'
  penerbit text,             -- Sertifikat & Piagam: diterbitkan oleh | SK: ditetapkan oleh
  tanggal_mulai date,        -- masa berlaku (PKS, SK) - opsional
  tanggal_berakhir date,     -- masa berlaku (PKS, SK) - opsional
  keterangan text,
  file_bukti_url text,
  petugas_id uuid references profiles(id),
  created_at timestamptz default now()
);

create index if not exists arsip_dokumen_jenis_tanggal_idx on arsip_dokumen (jenis, tanggal desc);

alter table arsip_dokumen enable row level security;

drop policy if exists "Login bisa lihat arsip dokumen" on arsip_dokumen;
drop policy if exists "Admin bisa tambah arsip dokumen" on arsip_dokumen;
drop policy if exists "Admin bisa ubah arsip dokumen" on arsip_dokumen;
drop policy if exists "Admin bisa hapus arsip dokumen" on arsip_dokumen;

create policy "Login bisa lihat arsip dokumen" on arsip_dokumen
  for select using (auth.role() = 'authenticated');

create policy "Admin bisa tambah arsip dokumen" on arsip_dokumen
  for insert with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Admin bisa ubah arsip dokumen" on arsip_dokumen
  for update using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Admin bisa hapus arsip dokumen" on arsip_dokumen
  for delete using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Catat ke Log Aktivitas (best-effort: kalau kolom log berbeda, data tetap tersimpan normal)
create or replace function public.log_arsip_dokumen()
returns trigger as $$
declare
  r public.arsip_dokumen;
  label text;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  label := case r.jenis
    when 'pks' then 'Perjanjian Kerja Sama'
    when 'sertifikat' then 'Sertifikat/Piagam'
    else 'Surat Keputusan'
  end;
  begin
    insert into public.log_aktivitas (tabel, aksi, ringkasan, dilakukan_oleh)
    values ('arsip_dokumen', tg_op, label || ' ' || r.nomor || ' — ' || r.judul, auth.uid());
  exception when others then
    null;
  end;
  return r;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_log_arsip_dokumen on arsip_dokumen;
create trigger trg_log_arsip_dokumen
  after insert or update or delete on arsip_dokumen
  for each row execute procedure public.log_arsip_dokumen();
