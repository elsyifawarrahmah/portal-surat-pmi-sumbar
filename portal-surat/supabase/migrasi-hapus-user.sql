-- =========================================================
-- ADMIN BISA MENGHAPUS PENGGUNA (tombol "Hapus" di Data User & Unit).
-- Surat yang pernah dicatat pengguna itu TETAP ADA; nama pencatatnya jadi kosong.
-- Jalankan SEKALI di Supabase > SQL Editor. Aman diulang.
-- =========================================================

-- 1. Semua kunci asing ke profiles / auth.users yang menghalangi penghapusan diubah menjadi "kosongkan saja"
do $$
declare r record; v_kol text;
begin
  for r in
    select c.conname, c.conrelid::regclass as tabel, c.confrelid::regclass as induk, c.conkey, c.conrelid
      from pg_constraint c
      join pg_namespace n on n.oid = c.connamespace
     where c.contype = 'f' and n.nspname = 'public'
       and c.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
       and c.confdeltype = 'a' and array_length(c.conkey, 1) = 1
  loop
    select a.attname into v_kol from pg_attribute a where a.attrelid = r.conrelid and a.attnum = r.conkey[1] and not a.attnotnull;
    if v_kol is not null then
      begin
        execute format('alter table %s drop constraint %I', r.tabel, r.conname);
        execute format('alter table %s add constraint %I foreign key (%I) references %s(id) on delete set null', r.tabel, r.conname, v_kol, r.induk);
      exception when others then raise notice 'dilewati: % (%).', r.conname, sqlerrm; end;
    end if;
    v_kol := null;
  end loop;
end $$;

-- 2. Fungsi hapus (hanya admin web, tidak bisa menghapus diri sendiri)
create or replace function public.hapus_user(p_id uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Hanya admin web yang bisa menghapus pengguna'; end if;
  if p_id = auth.uid() then raise exception 'Kamu tidak bisa menghapus akunmu sendiri'; end if;
  if not exists (select 1 from auth.users where id = p_id) then raise exception 'Pengguna tidak ditemukan'; end if;
  delete from public.profiles where id = p_id;
  delete from auth.users where id = p_id;
end $$;
revoke all on function public.hapus_user(uuid) from public;
grant execute on function public.hapus_user(uuid) to authenticated;
notify pgrst, 'reload schema';
