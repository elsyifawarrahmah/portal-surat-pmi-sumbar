-- =========================================================
-- NOTIFIKASI HP yang tepat sasaran + CEK KODE PARAF + TEMBUSAN SURAT TUGAS
-- Jalankan SEKALI di Supabase > SQL Editor. Aman diulang.
-- =========================================================

-- 1. Tabel langganan notifikasi (satu baris per HP/browser yang menyalakan notifikasi)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  petugas_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists "Langganan milik sendiri lihat" on push_subscriptions;
drop policy if exists "Langganan milik sendiri tambah" on push_subscriptions;
drop policy if exists "Langganan milik sendiri ubah" on push_subscriptions;
drop policy if exists "Langganan milik sendiri hapus" on push_subscriptions;
create policy "Langganan milik sendiri lihat" on push_subscriptions for select using (petugas_id = auth.uid());
create policy "Langganan milik sendiri tambah" on push_subscriptions for insert with check (petugas_id = auth.uid());
create policy "Langganan milik sendiri ubah" on push_subscriptions for update using (petugas_id = auth.uid());
create policy "Langganan milik sendiri hapus" on push_subscriptions for delete using (petugas_id = auth.uid());

-- 2. Tembusan pada Surat Tugas
alter table surat_tugas add column if not exists tembusan text;

-- 3. Cek keaslian kode penanda (hanya untuk pengguna yang sudah masuk; tidak menampilkan isi surat)
create or replace function public.cek_kode_penanda(p_kode text)
returns table (peran text, jenis text, nomor text, nama text, jabatan text, waktu timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare k text := upper(trim(coalesce(p_kode, '')));
begin
  if auth.uid() is null then raise exception 'Harus masuk dulu'; end if;
  return query
    select 'Paraf Sekretaris'::text, 'Surat Keluar'::text, s.nomor_surat::text, s.paraf_nama::text, 'Sekretaris'::text, s.paraf_pada from surat_keluar s where s.paraf_kode = k
    union all select 'Persetujuan', 'Surat Keluar', s.nomor_surat::text, s.setuju_nama::text, s.setuju_jabatan::text, s.setuju_pada from surat_keluar s where s.setuju_kode = k
    union all select 'Paraf Sekretaris', 'Surat Tugas / Aset / Kerja Sama', s.nomor_surat::text, s.paraf_nama::text, 'Sekretaris', s.paraf_pada from surat_tugas s where s.paraf_kode = k
    union all select 'Persetujuan', 'Surat Tugas / Aset / Kerja Sama', s.nomor_surat::text, s.setuju_nama::text, s.setuju_jabatan::text, s.setuju_pada from surat_tugas s where s.setuju_kode = k
    union all select 'Tanda tangan disposisi', 'Surat Masuk', m.nomor_surat::text, d.ttd_nama::text, ''::text, d.ttd_pada from surat_disposisi d join surat_masuk m on m.id = d.surat_id where d.ttd_kode = k;
end $$;
revoke all on function public.cek_kode_penanda(text) from public;
grant execute on function public.cek_kode_penanda(text) to authenticated;

notify pgrst, 'reload schema';
