-- =========================================================
-- TAMBAHAN 2 (alur seperti Srikandi): disposisi berjenjang, catatan tiap orang,
-- pengarsipan oleh Biro Umum, dan nomor telepon untuk menghubungi.
--
--   1. Penerima disposisi bisa MENERUSKAN lagi ke bidang lain dengan kata-katanya sendiri
--   2. Siapa pun yang punya unit bisa menulis CATATAN pada surat (terlihat semua orang)
--   3. Setelah bidang tujuan "Selesai", surat MENUNGGU diarsipkan: Biro Umum yang menekan "Arsipkan"
--   4. Nomor telepon akun (untuk tombol Telepon / WhatsApp saat surat menumpuk)
--
-- Jalankan SEKALI di Supabase > SQL Editor > New query > Run (setelah migrasi-disposisi-pemantauan.sql).
-- Aman dijalankan ulang.
-- =========================================================

-- ---------- 4. Telepon ----------
alter table profiles add column if not exists telepon text;

-- ---------- Disposisi berjenjang ----------
alter table surat_disposisi add column if not exists induk_tujuan_id uuid references surat_disposisi_tujuan(id) on delete set null;
alter table surat_disposisi_tujuan add column if not exists diarsipkan_oleh uuid references profiles(id);

-- Apakah unit saya penerima disposisi pada surat tertentu (boleh meneruskan)
create or replace function public.penerima_surat(p_surat uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(exists (
    select 1 from public.surat_disposisi_tujuan t
    join public.surat_disposisi d on d.id = t.disposisi_id
    where d.surat_id = p_surat and t.unit_id = public.my_unit_id()
  ), false);
$$;

create or replace function public.pembuat_disposisi(p_disposisi uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(exists (select 1 from public.surat_disposisi where id = p_disposisi and dibuat_oleh = auth.uid()), false);
$$;

drop policy if exists "Pemberi disposisi tambah" on surat_disposisi;
drop policy if exists "Pemberi disposisi ubah" on surat_disposisi;
drop policy if exists "Pemberi atau penerima tambah disposisi" on surat_disposisi;
drop policy if exists "Pembuat disposisi ubah" on surat_disposisi;
create policy "Pemberi atau penerima tambah disposisi" on surat_disposisi for insert
  with check (public.boleh_disposisi() or public.penerima_surat(surat_id));
create policy "Pembuat disposisi ubah" on surat_disposisi for update
  using (public.boleh_disposisi() or dibuat_oleh = auth.uid());

drop policy if exists "Pemberi disposisi tambah tujuan" on surat_disposisi_tujuan;
drop policy if exists "Tujuan dan pemberi ubah tujuan" on surat_disposisi_tujuan;
drop policy if exists "Pemberi disposisi hapus tujuan" on surat_disposisi_tujuan;
drop policy if exists "Pembuat tambah tujuan" on surat_disposisi_tujuan;
drop policy if exists "Pembuat, tujuan, pengarsip ubah tujuan" on surat_disposisi_tujuan;
drop policy if exists "Pembuat hapus tujuan" on surat_disposisi_tujuan;
create policy "Pembuat tambah tujuan" on surat_disposisi_tujuan for insert
  with check (public.boleh_disposisi() or public.pembuat_disposisi(disposisi_id));
create policy "Pembuat, tujuan, pengarsip ubah tujuan" on surat_disposisi_tujuan for update
  using (public.boleh_disposisi() or public.pembuat_disposisi(disposisi_id) or unit_id = public.my_unit_id() or public.boleh_arsip());
create policy "Pembuat hapus tujuan" on surat_disposisi_tujuan for delete
  using (public.boleh_disposisi() or public.pembuat_disposisi(disposisi_id));

-- Penjaga kolom + waktu otomatis. Selesai TIDAK lagi langsung diarsipkan: menunggu Biro Umum.
create or replace function public.jaga_tujuan() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pemberi boolean;
begin
  if auth.uid() is not null then
    v_pemberi := public.boleh_disposisi() or public.pembuat_disposisi(old.disposisi_id);
    if not v_pemberi then            -- penerima/pengarsip tidak boleh mengubah isi perintah
      new.disposisi_id := old.disposisi_id; new.unit_id := old.unit_id; new.instruksi := old.instruksi;
      new.perlu_jawaban := old.perlu_jawaban; new.batas_waktu := old.batas_waktu;
    end if;
    if not (old.unit_id = public.my_unit_id() or public.is_admin()) then   -- hanya unit tujuan (atau admin) yang mengubah status/tanggapan
      new.status := old.status; new.tanggapan := old.tanggapan; new.surat_jawaban_id := old.surat_jawaban_id;
    end if;
    if not public.boleh_arsip() then  -- hanya Biro Umum/admin yang mengarsipkan
      new.diarsipkan_pada := old.diarsipkan_pada; new.diarsipkan_oleh := old.diarsipkan_oleh;
    end if;
  end if;

  if new.status is distinct from old.status then
    if new.status in ('dibaca','diproses','selesai') and new.dibaca_pada is null then
      new.dibaca_pada := now(); new.dibaca_oleh := auth.uid();
    end if;
    if new.status = 'selesai' then
      new.selesai_pada := now();
    else
      new.selesai_pada := null;
    end if;
  end if;
  if new.status <> 'selesai' then new.diarsipkan_pada := null; new.diarsipkan_oleh := null; end if;
  if new.diarsipkan_pada is not null and old.diarsipkan_pada is null then
    new.diarsipkan_pada := now(); new.diarsipkan_oleh := coalesce(auth.uid(), new.diarsipkan_oleh);
  end if;
  return new;
end $$;

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
          case new.status when 'menunggu' then 'disposisi menunggu' when 'dibaca' then 'surat sudah dibaca' when 'diproses' then 'sedang diproses' else 'selesai, menunggu diarsipkan Biro Umum' end,
          nullif(new.tanggapan, ''));
      end if;
      if new.diarsipkan_pada is not null and old.diarsipkan_pada is null then
        perform public.catat_riwayat('masuk', v_surat, 'Diarsipkan oleh Biro Umum (' || v_unit || ')', null);
      end if;
      if new.surat_jawaban_id is distinct from old.surat_jawaban_id and new.surat_jawaban_id is not null then
        perform public.catat_riwayat('masuk', v_surat, 'Surat jawaban ditautkan (' || v_unit || ')',
          (select 'No. ' || nomor_surat from surat_keluar where id = new.surat_jawaban_id));
      end if;
    end if;
  exception when others then null; end;
  return new;
end $$;

-- Disposisi lanjutan: catat siapa meneruskan dari mana
create or replace function public.riwayat_disposisi() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dari text;
begin
  begin
    if new.induk_tujuan_id is not null then
      select u.nama into v_dari from surat_disposisi_tujuan t join surat_unit u on u.id = t.unit_id where t.id = new.induk_tujuan_id;
    end if;
    perform public.catat_riwayat('masuk', new.surat_id,
      case when new.induk_tujuan_id is not null then 'Diteruskan lagi oleh ' || coalesce(v_dari, '-') else 'Disposisi dibuat' end,
      'Dari ' || coalesce(nullif(new.dari_nama, ''), '-') || ' · tanggal diteruskan ' || to_char(new.tanggal_diteruskan, 'DD-MM-YYYY'));
  exception when others then null; end;
  return new;
end $$;

-- ---------- 2. Catatan pada surat ----------
create table if not exists surat_catatan (
  id uuid primary key default gen_random_uuid(),
  surat_id uuid not null references surat_masuk(id) on delete cascade,
  isi text not null check (length(btrim(isi)) > 0),
  dibuat_oleh uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists surat_catatan_surat_idx on surat_catatan (surat_id, created_at);

alter table surat_catatan enable row level security;
drop policy if exists "Login bisa lihat catatan" on surat_catatan;
drop policy if exists "Pengguna unit tulis catatan" on surat_catatan;
drop policy if exists "Admin hapus catatan" on surat_catatan;
create policy "Login bisa lihat catatan" on surat_catatan for select using (auth.role() = 'authenticated');
create policy "Pengguna unit tulis catatan" on surat_catatan for insert with check (public.punya_unit() and dibuat_oleh = auth.uid());
create policy "Admin hapus catatan" on surat_catatan for delete using (public.is_admin());

create or replace function public.riwayat_catatan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin perform public.catat_riwayat('masuk', new.surat_id, 'Catatan ditambahkan', left(new.isi, 300)); exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_riwayat_catatan on surat_catatan;
create trigger trg_riwayat_catatan after insert on surat_catatan for each row execute procedure public.riwayat_catatan();

do $$
begin
  begin alter publication supabase_realtime add table surat_catatan; exception when others then null; end;
end $$;
