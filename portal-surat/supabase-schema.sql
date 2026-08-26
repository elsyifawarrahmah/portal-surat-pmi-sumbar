-- =========================================================
-- PORTAL SURAT MASUK & KELUAR — PMI SUMATERA BARAT
-- Web TERPISAH dari portal logistik. Database sendiri, jangan digabung.
-- Jalankan di Supabase Dashboard project BARU > SQL Editor > New query > Run
-- =========================================================

create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nama_lengkap text not null,
  role text not null default 'petugas' check (role in ('admin','petugas')),
  created_at timestamptz default now()
);

create table if not exists surat_masuk (
  id uuid primary key default gen_random_uuid(),
  nomor_surat text not null,
  tanggal_surat date not null,
  tanggal_diterima_kantor date not null,
  asal_surat text not null,
  perihal text not null,
  sifat text default 'Biasa' check (sifat in ('Biasa','Penting','Segera','Rahasia')),
  petugas_id uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists surat_tahapan (
  id uuid primary key default gen_random_uuid(),
  surat_id uuid references surat_masuk(id) on delete cascade,
  nama_tahap text not null,
  urutan int not null,
  penerima_nama text,
  tanggal_diterima timestamptz,
  tanggal_diteruskan timestamptz,
  catatan text,
  created_at timestamptz default now()
);

create table if not exists surat_keluar (
  id uuid primary key default gen_random_uuid(),
  nomor_surat text not null,
  tanggal_surat date not null,
  tujuan_surat text not null,
  perihal text not null,
  sifat text default 'Biasa' check (sifat in ('Biasa','Penting','Segera','Rahasia')),
  petugas_id uuid references profiles(id),
  created_at timestamptz default now()
);

alter table profiles enable row level security;
alter table surat_masuk enable row level security;
alter table surat_tahapan enable row level security;
alter table surat_keluar enable row level security;

create policy "Login bisa lihat semua profil" on profiles for select using (auth.role() = 'authenticated');
create policy "User bisa update profil sendiri" on profiles for update using (auth.uid() = id);

create policy "Login bisa lihat surat masuk" on surat_masuk for select using (auth.role() = 'authenticated');
create policy "Login bisa tambah surat masuk" on surat_masuk for insert with check (auth.role() = 'authenticated');
create policy "Login bisa update surat masuk" on surat_masuk for update using (auth.role() = 'authenticated');
create policy "Hanya admin hapus surat masuk" on surat_masuk for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "Login bisa lihat tahapan" on surat_tahapan for select using (auth.role() = 'authenticated');
create policy "Login bisa tambah tahapan" on surat_tahapan for insert with check (auth.role() = 'authenticated');
create policy "Login bisa update tahapan" on surat_tahapan for update using (auth.role() = 'authenticated');
create policy "Hanya admin hapus tahapan" on surat_tahapan for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create policy "Login bisa lihat surat keluar" on surat_keluar for select using (auth.role() = 'authenticated');
create policy "Login bisa tambah surat keluar" on surat_keluar for insert with check (auth.role() = 'authenticated');
create policy "Login bisa update surat keluar" on surat_keluar for update using (auth.role() = 'authenticated');
create policy "Hanya admin hapus surat keluar" on surat_keluar for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nama_lengkap, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'nama_lengkap', new.email), 'petugas');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
