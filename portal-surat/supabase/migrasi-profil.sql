-- =========================================================
-- TAMBAHAN 4: PROFIL / BIODATA (foto profil + jabatan)
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run. Aman dijalankan ulang.
-- =========================================================
alter table profiles add column if not exists foto_url text;
alter table profiles add column if not exists jabatan text;
alter table profiles add column if not exists telepon text;

-- muat ulang daftar tabel agar kolom baru langsung terbaca
notify pgrst, 'reload schema';
