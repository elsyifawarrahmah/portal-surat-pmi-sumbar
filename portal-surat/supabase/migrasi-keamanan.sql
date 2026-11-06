-- =========================================================
-- TAMBAHAN 9: KEAMANAN BERKAS SURAT
-- Bucket "bukti-surat" dijadikan PRIVAT: berkas tidak bisa lagi dibuka lewat alamat publik.
-- Hanya akun yang sudah login DAN punya unit (atau admin) yang bisa membaca berkas, lewat alamat sementara.
-- PENTING: jalankan SETELAH versi aplikasi terbaru selesai ter-deploy di Vercel. Aman diulang.
-- =========================================================
update storage.buckets set public = false where id = 'bukti-surat';

-- Hapus kebijakan baca/semua lama pada bucket ini (mis. "baca untuk semua orang")
do $$ declare p record; begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and cmd in ('SELECT', 'ALL')
             and (coalesce(qual, '') ilike '%bukti-surat%' or coalesce(with_check, '') ilike '%bukti-surat%') loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

drop policy if exists "Staf baca berkas" on storage.objects;
create policy "Staf baca berkas" on storage.objects for select to authenticated
  using (bucket_id = 'bukti-surat' and (public.is_admin() or public.punya_unit()));
drop policy if exists "Login unggah berkas" on storage.objects;
create policy "Login unggah berkas" on storage.objects for insert to authenticated with check (bucket_id = 'bukti-surat');
drop policy if exists "Login hapus berkas" on storage.objects;
create policy "Login hapus berkas" on storage.objects for delete to authenticated using (bucket_id = 'bukti-surat');
