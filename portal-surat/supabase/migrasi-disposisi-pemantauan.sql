-- =========================================================
-- TAMBAHAN PORTAL SURAT:
--   1. Unit / Bidang tiap akun (Biro Umum, Sekretariat, Ketua, Kepala Markas, tiap Bidang)
--   2. Nomor agenda otomatis (surat masuk & keluar)
--   3. Disposisi (lembar disposisi digital + tujuan per bidang + status + scan lembar)
--   4. Pemantauan Biro Umum: "Panggilan" ke bidang yang belum input surat
--   5. Riwayat surat otomatis (waktu masuk/diteruskan/disposisi/dikirim) -> bisa dicetak
--   6. Ekspedisi (buku pengiriman surat keluar + tanda terima)
--   7. Kotak Saran
--
-- Jalankan SEKALI di Supabase Dashboard > SQL Editor > New query > Run.
-- Aman dijalankan ulang. Syarat: supabase-schema.sql, migrasi-arsip-dokumen.sql dan
-- migrasi-arsip-biro-umum.sql sudah pernah dijalankan.
-- =========================================================

-- ---------- 0. Kolom profil yang dipakai aplikasi ----------
alter table profiles add column if not exists email text;
alter table profiles add column if not exists last_seen timestamptz;
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('admin','petugas','viewer')) not valid;

-- ---------- 1. Unit / Bidang ----------
create table if not exists surat_unit (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  nama text not null unique,
  tipe text not null check (tipe in ('biro_umum','sekretariat','pimpinan','bidang')),
  urut integer not null default 100,
  aktif boolean not null default true,
  created_at timestamptz default now()
);

insert into surat_unit (kode, nama, tipe, urut) values
  ('BU',  'Biro Umum',                                   'biro_umum',   1),
  ('SEK', 'Sekretariat',                                 'sekretariat', 2),
  ('KT',  'Ketua',                                       'pimpinan',    3),
  ('KM',  'Kepala Markas',                               'pimpinan',    4),
  ('ORG', 'Bidang Organisasi',                           'bidang',     10),
  ('PB',  'Bidang Penanggulangan Bencana dan Logistik',  'bidang',     11),
  ('YKS', 'Bidang Pelayanan Kesehatan dan Sosial',       'bidang',     12),
  ('DD',  'Bidang Donor Darah',                          'bidang',     13),
  ('RD',  'Bidang Relawan dan Diklat',                   'bidang',     14),
  ('SDM', 'Bidang Sumber Daya Manusia',                  'bidang',     15),
  ('HAL', 'Bidang Hubungan Antar Lembaga',               'bidang',     16),
  ('HUM', 'Bidang Humas',                                'bidang',     17),
  ('PSD', 'Bidang Pengembangan Sumber Daya',             'bidang',     18),
  ('BEN', 'Bendahara',                                   'bidang',     19)
on conflict (kode) do nothing;

alter table profiles add column if not exists unit_id uuid references surat_unit(id) on delete set null;

-- ---------- Fungsi bantu hak akses ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.my_unit_id() returns uuid
language sql stable security definer set search_path = public as $$
  select unit_id from public.profiles where id = auth.uid();
$$;

create or replace function public.my_unit_tipe() returns text
language sql stable security definer set search_path = public as $$
  select u.tipe from public.profiles p join public.surat_unit u on u.id = p.unit_id where p.id = auth.uid();
$$;

-- Siapa boleh apa (ubah di sini bila aturan kantor berubah)
create or replace function public.boleh_catat_masuk() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() = 'sekretariat', false);
$$;
create or replace function public.boleh_disposisi() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('sekretariat','pimpinan'), false);
$$;
create or replace function public.boleh_catat_keluar() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('sekretariat','pimpinan','bidang'), false);
$$;
create or replace function public.boleh_alur() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() in ('sekretariat','pimpinan','biro_umum'), false);
$$;
create or replace function public.boleh_pantau() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() = 'biro_umum', false);
$$;
create or replace function public.boleh_arsip() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or coalesce(public.my_unit_tipe() = 'biro_umum', false);
$$;
create or replace function public.punya_unit() returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.my_unit_id() is not null;
$$;

-- RLS unit
alter table surat_unit enable row level security;
drop policy if exists "Login bisa lihat unit" on surat_unit;
drop policy if exists "Admin kelola unit" on surat_unit;
create policy "Login bisa lihat unit" on surat_unit for select using (auth.role() = 'authenticated');
create policy "Admin kelola unit" on surat_unit for all using (public.is_admin()) with check (public.is_admin());

-- Admin boleh mengatur role & unit akun lain. Akun biasa tidak boleh mengubah role/unit-nya sendiri.
drop policy if exists "Admin bisa update profil" on profiles;
create policy "Admin bisa update profil" on profiles for update using (public.is_admin());

create or replace function public.jaga_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.unit_id := old.unit_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_jaga_profil on profiles;
create trigger trg_jaga_profil before update on profiles for each row execute procedure public.jaga_profil();

-- ---------- 2. Nomor agenda otomatis ----------
create table if not exists surat_counter (
  jenis text not null,
  tahun integer not null,
  nilai integer not null default 0,
  primary key (jenis, tahun)
);
alter table surat_counter enable row level security;   -- tanpa policy: hanya diakses lewat fungsi di bawah

create or replace function public.nomor_agenda_berikut(p_jenis text, p_tahun integer) returns text
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into surat_counter (jenis, tahun, nilai) values (p_jenis, p_tahun, 1)
  on conflict (jenis, tahun) do update set nilai = surat_counter.nilai + 1
  returning nilai into n;
  return lpad(n::text, 3, '0') || '/' || p_tahun::text;
end $$;

alter table surat_masuk add column if not exists nomor_agenda text;
alter table surat_masuk add column if not exists macam_surat text;
alter table surat_masuk add column if not exists lampiran text;
alter table surat_masuk add column if not exists file_bukti_url text;
alter table surat_keluar add column if not exists nomor_agenda text;
alter table surat_keluar add column if not exists file_bukti_url text;
alter table surat_keluar add column if not exists divisi text;
alter table surat_keluar add column if not exists unit_id uuid references surat_unit(id) on delete set null;
alter table surat_keluar add column if not exists surat_masuk_id uuid references surat_masuk(id) on delete set null;  -- surat jawaban untuk surat masuk tertentu

-- Beri nomor agenda untuk surat lama (sekali, urut menurut waktu dicatat per tahun)
with n as (
  select id, extract(year from coalesce(tanggal_diterima_kantor, created_at::date))::int as y,
         row_number() over (partition by extract(year from coalesce(tanggal_diterima_kantor, created_at::date)) order by created_at, id) as rn
  from surat_masuk where nomor_agenda is null)
update surat_masuk s set nomor_agenda = lpad(n.rn::text, 3, '0') || '/' || n.y::text from n where s.id = n.id;

with n as (
  select id, extract(year from coalesce(tanggal_surat, created_at::date))::int as y,
         row_number() over (partition by extract(year from coalesce(tanggal_surat, created_at::date)) order by created_at, id) as rn
  from surat_keluar where nomor_agenda is null)
update surat_keluar s set nomor_agenda = lpad(n.rn::text, 3, '0') || '/' || n.y::text from n where s.id = n.id;

insert into surat_counter (jenis, tahun, nilai)
select 'masuk', split_part(nomor_agenda, '/', 2)::int, max(split_part(nomor_agenda, '/', 1)::int)
from surat_masuk where nomor_agenda ~ '^[0-9]+/[0-9]{4}$' group by 1, 2
on conflict (jenis, tahun) do update set nilai = greatest(surat_counter.nilai, excluded.nilai);

insert into surat_counter (jenis, tahun, nilai)
select 'keluar', split_part(nomor_agenda, '/', 2)::int, max(split_part(nomor_agenda, '/', 1)::int)
from surat_keluar where nomor_agenda ~ '^[0-9]+/[0-9]{4}$' group by 1, 2
on conflict (jenis, tahun) do update set nilai = greatest(surat_counter.nilai, excluded.nilai);

create or replace function public.isi_nomor_agenda() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nomor_agenda is null or btrim(new.nomor_agenda) = '' then
    if tg_table_name = 'surat_masuk' then
      new.nomor_agenda := public.nomor_agenda_berikut('masuk', extract(year from coalesce(new.tanggal_diterima_kantor, current_date))::int);
    else
      new.nomor_agenda := public.nomor_agenda_berikut('keluar', extract(year from coalesce(new.tanggal_surat, current_date))::int);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_agenda_masuk on surat_masuk;
create trigger trg_agenda_masuk before insert on surat_masuk for each row execute procedure public.isi_nomor_agenda();
drop trigger if exists trg_agenda_keluar on surat_keluar;
create trigger trg_agenda_keluar before insert on surat_keluar for each row execute procedure public.isi_nomor_agenda();

-- ---------- 3. Disposisi ----------
create table if not exists surat_disposisi (
  id uuid primary key default gen_random_uuid(),
  surat_id uuid not null references surat_masuk(id) on delete cascade,
  tanggal_diteruskan date not null default current_date,
  dari_unit_id uuid references surat_unit(id) on delete set null,
  dari_nama text,                       -- mis. "Ketua" / "Kepala Markas" (kolom "Dari" di lembar disposisi)
  catatan text,
  file_scan_url text,                   -- foto/scan lembar disposisi yang sudah ditandatangani
  file_scan_nama text,
  dibuat_oleh uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists surat_disposisi_surat_idx on surat_disposisi (surat_id);

create table if not exists surat_disposisi_tujuan (
  id uuid primary key default gen_random_uuid(),
  disposisi_id uuid not null references surat_disposisi(id) on delete cascade,
  unit_id uuid not null references surat_unit(id) on delete restrict,
  instruksi text,                       -- kolom "Disposisi" (isi perintah)
  perlu_jawaban boolean not null default false,
  batas_waktu date,
  status text not null default 'menunggu' check (status in ('menunggu','dibaca','diproses','selesai')),
  dibaca_pada timestamptz,
  dibaca_oleh uuid references profiles(id),
  selesai_pada timestamptz,
  tanggapan text,
  surat_jawaban_id uuid references surat_keluar(id) on delete set null,
  diarsipkan_pada timestamptz,          -- terisi otomatis saat selesai: semua tujuan disposisi diarsipkan
  created_at timestamptz default now(),
  unique (disposisi_id, unit_id)
);
create index if not exists surat_disposisi_tujuan_unit_idx on surat_disposisi_tujuan (unit_id, status);

alter table surat_disposisi enable row level security;
alter table surat_disposisi_tujuan enable row level security;
drop policy if exists "Login bisa lihat disposisi" on surat_disposisi;
drop policy if exists "Pemberi disposisi tambah" on surat_disposisi;
drop policy if exists "Pemberi disposisi ubah" on surat_disposisi;
drop policy if exists "Admin hapus disposisi" on surat_disposisi;
create policy "Login bisa lihat disposisi" on surat_disposisi for select using (auth.role() = 'authenticated');
create policy "Pemberi disposisi tambah" on surat_disposisi for insert with check (public.boleh_disposisi());
create policy "Pemberi disposisi ubah" on surat_disposisi for update using (public.boleh_disposisi());
create policy "Admin hapus disposisi" on surat_disposisi for delete using (public.is_admin());

drop policy if exists "Login bisa lihat tujuan disposisi" on surat_disposisi_tujuan;
drop policy if exists "Pemberi disposisi tambah tujuan" on surat_disposisi_tujuan;
drop policy if exists "Tujuan dan pemberi ubah tujuan" on surat_disposisi_tujuan;
drop policy if exists "Pemberi disposisi hapus tujuan" on surat_disposisi_tujuan;
create policy "Login bisa lihat tujuan disposisi" on surat_disposisi_tujuan for select using (auth.role() = 'authenticated');
create policy "Pemberi disposisi tambah tujuan" on surat_disposisi_tujuan for insert with check (public.boleh_disposisi());
create policy "Tujuan dan pemberi ubah tujuan" on surat_disposisi_tujuan for update
  using (public.boleh_disposisi() or unit_id = public.my_unit_id());
create policy "Pemberi disposisi hapus tujuan" on surat_disposisi_tujuan for delete using (public.boleh_disposisi());

-- Bidang tujuan hanya boleh mengubah status/tanggapan/surat jawaban; waktu dibaca & selesai terisi otomatis
create or replace function public.jaga_tujuan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.boleh_disposisi() then
    new.disposisi_id := old.disposisi_id;
    new.unit_id := old.unit_id;
    new.instruksi := old.instruksi;
    new.perlu_jawaban := old.perlu_jawaban;
    new.batas_waktu := old.batas_waktu;
  end if;
  if new.status is distinct from old.status then
    if new.status in ('dibaca','diproses','selesai') and new.dibaca_pada is null then
      new.dibaca_pada := now(); new.dibaca_oleh := auth.uid();
    end if;
    if new.status = 'selesai' then
      new.selesai_pada := now(); new.diarsipkan_pada := now();
    else
      new.selesai_pada := null; new.diarsipkan_pada := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_jaga_tujuan on surat_disposisi_tujuan;
create trigger trg_jaga_tujuan before update on surat_disposisi_tujuan for each row execute procedure public.jaga_tujuan();

-- ---------- 4. Pemantauan Biro Umum: Panggilan ----------
create table if not exists surat_panggilan (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references surat_unit(id) on delete cascade,
  jenis text not null default 'belum_input' check (jenis in ('belum_input','belum_dikirim','tindak_lanjut','lainnya')),
  pesan text,
  surat_masuk_id uuid references surat_masuk(id) on delete set null,
  dibuat_oleh uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now(),
  dibaca_pada timestamptz,
  selesai_pada timestamptz,
  selesai_oleh uuid references profiles(id),
  balasan text
);
create index if not exists surat_panggilan_unit_idx on surat_panggilan (unit_id, selesai_pada);

alter table surat_panggilan enable row level security;
drop policy if exists "Panggilan: lihat" on surat_panggilan;
drop policy if exists "Panggilan: buat" on surat_panggilan;
drop policy if exists "Panggilan: ubah" on surat_panggilan;
drop policy if exists "Panggilan: hapus" on surat_panggilan;
create policy "Panggilan: lihat" on surat_panggilan for select using (public.boleh_pantau() or unit_id = public.my_unit_id());
create policy "Panggilan: buat" on surat_panggilan for insert with check (public.boleh_pantau());
create policy "Panggilan: ubah" on surat_panggilan for update using (public.boleh_pantau() or unit_id = public.my_unit_id());
create policy "Panggilan: hapus" on surat_panggilan for delete using (public.boleh_pantau());

create or replace function public.jaga_panggilan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.boleh_pantau() then
    new.unit_id := old.unit_id; new.jenis := old.jenis; new.pesan := old.pesan;
    new.surat_masuk_id := old.surat_masuk_id; new.dibuat_oleh := old.dibuat_oleh; new.created_at := old.created_at;
  end if;
  if new.dibaca_pada is null and old.dibaca_pada is null and (new.selesai_pada is not null or new.balasan is distinct from old.balasan) then
    new.dibaca_pada := now();
  end if;
  if new.selesai_pada is not null and old.selesai_pada is null then new.selesai_oleh := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists trg_jaga_panggilan on surat_panggilan;
create trigger trg_jaga_panggilan before update on surat_panggilan for each row execute procedure public.jaga_panggilan();

-- ---------- 5. Riwayat surat otomatis ----------
create table if not exists surat_riwayat (
  id uuid primary key default gen_random_uuid(),
  surat_jenis text not null check (surat_jenis in ('masuk','keluar')),
  surat_id uuid not null,
  aksi text not null,
  keterangan text,
  oleh uuid,
  oleh_nama text,
  unit_nama text,
  waktu timestamptz not null default now()
);
create index if not exists surat_riwayat_surat_idx on surat_riwayat (surat_jenis, surat_id, waktu);

alter table surat_riwayat enable row level security;
drop policy if exists "Login bisa lihat riwayat" on surat_riwayat;
create policy "Login bisa lihat riwayat" on surat_riwayat for select using (auth.role() = 'authenticated');
-- (sengaja tanpa policy tambah/ubah/hapus: riwayat hanya ditulis otomatis oleh sistem dan tidak bisa diubah)

create or replace function public.catat_riwayat(p_jenis text, p_surat uuid, p_aksi text, p_ket text) returns void
language plpgsql security definer set search_path = public as $$
declare v_nama text; v_unit text;
begin
  select p.nama_lengkap, u.nama into v_nama, v_unit
  from public.profiles p left join public.surat_unit u on u.id = p.unit_id where p.id = auth.uid();
  insert into public.surat_riwayat (surat_jenis, surat_id, aksi, keterangan, oleh, oleh_nama, unit_nama)
  values (p_jenis, p_surat, p_aksi, p_ket, auth.uid(), v_nama, v_unit);
end $$;

-- Isi riwayat untuk surat yang sudah ada (sekali saja, memakai waktu yang tercatat di data lama)
do $$
begin
  if (select count(*) from surat_riwayat) = 0 then
    insert into surat_riwayat (surat_jenis, surat_id, aksi, keterangan, oleh, oleh_nama, waktu)
    select 'masuk', m.id, 'Surat dicatat masuk',
           'No. ' || m.nomor_surat || ' · dari ' || m.asal_surat || ' · perihal: ' || m.perihal, m.petugas_id, p.nama_lengkap, m.created_at
    from surat_masuk m left join profiles p on p.id = m.petugas_id;

    insert into surat_riwayat (surat_jenis, surat_id, aksi, keterangan, waktu)
    select 'masuk', t.surat_id, 'Diterima: ' || t.nama_tahap, nullif(t.penerima_nama, ''), t.tanggal_diterima
    from surat_tahapan t where t.tanggal_diterima is not null;

    insert into surat_riwayat (surat_jenis, surat_id, aksi, keterangan, waktu)
    select 'masuk', t.surat_id, 'Diteruskan dari: ' || t.nama_tahap, nullif(t.catatan, ''), t.tanggal_diteruskan
    from surat_tahapan t where t.tanggal_diteruskan is not null;

    insert into surat_riwayat (surat_jenis, surat_id, aksi, keterangan, oleh, oleh_nama, waktu)
    select 'keluar', k.id, 'Surat keluar dicatat',
           'No. ' || k.nomor_surat || ' · tujuan ' || k.tujuan_surat || ' · perihal: ' || k.perihal, k.petugas_id, p.nama_lengkap, k.created_at
    from surat_keluar k left join profiles p on p.id = k.petugas_id;
  end if;
end $$;

-- Pemicu riwayat (dibungkus penangkap kesalahan: pencatatan riwayat tidak pernah menggagalkan simpan data)
create or replace function public.riwayat_surat_masuk() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.catat_riwayat('masuk', new.id, 'Surat dicatat masuk',
      'No. ' || new.nomor_surat || ' · dari ' || new.asal_surat || ' · perihal: ' || new.perihal || coalesce(' · agenda ' || new.nomor_agenda, ''));
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_riwayat_surat_masuk on surat_masuk;
create trigger trg_riwayat_surat_masuk after insert on surat_masuk for each row execute procedure public.riwayat_surat_masuk();

create or replace function public.riwayat_tahapan() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' then
      if new.tanggal_diterima is not null then
        perform public.catat_riwayat('masuk', new.surat_id, 'Diterima: ' || new.nama_tahap, nullif(new.penerima_nama, ''));
      end if;
    else
      if new.tanggal_diterima is not null and new.tanggal_diterima is distinct from old.tanggal_diterima then
        perform public.catat_riwayat('masuk', new.surat_id, 'Diterima: ' || new.nama_tahap, nullif(new.penerima_nama, ''));
      end if;
      if new.tanggal_diteruskan is not null and new.tanggal_diteruskan is distinct from old.tanggal_diteruskan then
        perform public.catat_riwayat('masuk', new.surat_id, 'Diteruskan dari: ' || new.nama_tahap, nullif(new.catatan, ''));
      end if;
    end if;
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_riwayat_tahapan on surat_tahapan;
create trigger trg_riwayat_tahapan after insert or update on surat_tahapan for each row execute procedure public.riwayat_tahapan();

create or replace function public.riwayat_disposisi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.catat_riwayat('masuk', new.surat_id, 'Disposisi dibuat',
      'Dari ' || coalesce(nullif(new.dari_nama, ''), '-') || ' · tanggal diteruskan ' || to_char(new.tanggal_diteruskan, 'DD-MM-YYYY'));
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_riwayat_disposisi on surat_disposisi;
create trigger trg_riwayat_disposisi after insert on surat_disposisi for each row execute procedure public.riwayat_disposisi();

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
        perform public.catat_riwayat('masuk', v_surat, 'Disposisi ' || v_unit || ': ' ||
          case new.status when 'menunggu' then 'menunggu' when 'dibaca' then 'sudah dibaca' when 'diproses' then 'sedang diproses' else 'selesai & diarsipkan' end,
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
drop trigger if exists trg_riwayat_tujuan on surat_disposisi_tujuan;
create trigger trg_riwayat_tujuan after insert or update on surat_disposisi_tujuan for each row execute procedure public.riwayat_tujuan();

create or replace function public.riwayat_surat_keluar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.catat_riwayat('keluar', new.id, 'Surat keluar dicatat',
      'No. ' || new.nomor_surat || ' · tujuan ' || new.tujuan_surat || ' · perihal: ' || new.perihal || coalesce(' · ' || new.divisi, '') || coalesce(' · agenda ' || new.nomor_agenda, ''));
    if new.surat_masuk_id is not null then
      perform public.catat_riwayat('masuk', new.surat_masuk_id, 'Surat jawaban dibuat', 'No. ' || new.nomor_surat || ' · ' || new.perihal);
    end if;
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_riwayat_surat_keluar on surat_keluar;
create trigger trg_riwayat_surat_keluar after insert on surat_keluar for each row execute procedure public.riwayat_surat_keluar();

create or replace function public.riwayat_panggilan() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_unit text;
begin
  begin
    if new.surat_masuk_id is not null then
      select nama into v_unit from surat_unit where id = new.unit_id;
      perform public.catat_riwayat('masuk', new.surat_masuk_id, 'Biro Umum memanggil ' || v_unit, nullif(new.pesan, ''));
    end if;
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_riwayat_panggilan on surat_panggilan;
create trigger trg_riwayat_panggilan after insert on surat_panggilan for each row execute procedure public.riwayat_panggilan();

-- ---------- 6. Ekspedisi (pengiriman surat keluar) ----------
create table if not exists surat_ekspedisi (
  id uuid primary key default gen_random_uuid(),
  surat_keluar_id uuid not null references surat_keluar(id) on delete cascade,
  tanggal_kirim date not null default current_date,
  dikirim_via text not null default 'Diantar langsung'
    check (dikirim_via in ('Diantar langsung','Kurir','Pos','Email','WhatsApp','Lainnya')),
  penerima text,                  -- nama penerima / instansi penerima
  pengantar text,                 -- petugas yang mengantar
  status text not null default 'dikirim' check (status in ('dikirim','diterima','kembali')),
  tanggal_diterima date,
  tanda_terima_url text,
  catatan text,
  dibuat_oleh uuid references profiles(id) default auth.uid(),
  created_at timestamptz default now()
);
create index if not exists surat_ekspedisi_surat_idx on surat_ekspedisi (surat_keluar_id);

alter table surat_ekspedisi enable row level security;
drop policy if exists "Login bisa lihat ekspedisi" on surat_ekspedisi;
drop policy if exists "Pengguna unit tambah ekspedisi" on surat_ekspedisi;
drop policy if exists "Pengguna unit ubah ekspedisi" on surat_ekspedisi;
drop policy if exists "Admin hapus ekspedisi" on surat_ekspedisi;
create policy "Login bisa lihat ekspedisi" on surat_ekspedisi for select using (auth.role() = 'authenticated');
create policy "Pengguna unit tambah ekspedisi" on surat_ekspedisi for insert with check (public.punya_unit());
create policy "Pengguna unit ubah ekspedisi" on surat_ekspedisi for update using (public.punya_unit());
create policy "Admin hapus ekspedisi" on surat_ekspedisi for delete using (public.is_admin());

create or replace function public.riwayat_ekspedisi() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.catat_riwayat('keluar', new.surat_keluar_id, 'Surat dikirim (' || new.dikirim_via || ')',
        'Penerima: ' || coalesce(nullif(new.penerima, ''), '-') || coalesce(' · pengantar ' || nullif(new.pengantar, ''), ''));
    elsif new.status is distinct from old.status then
      perform public.catat_riwayat('keluar', new.surat_keluar_id,
        case new.status when 'diterima' then 'Tanda terima: surat sudah diterima' when 'kembali' then 'Surat kembali / tidak sampai' else 'Status pengiriman: dikirim' end,
        nullif(new.catatan, ''));
    end if;
  exception when others then null; end;
  return new;
end $$;
drop trigger if exists trg_riwayat_ekspedisi on surat_ekspedisi;
create trigger trg_riwayat_ekspedisi after insert or update on surat_ekspedisi for each row execute procedure public.riwayat_ekspedisi();

-- ---------- 7. Kotak Saran ----------
create table if not exists surat_saran (
  id uuid primary key default gen_random_uuid(),
  kategori text not null default 'Saran' check (kategori in ('Saran','Pengaduan','Apresiasi','Lainnya')),
  isi text not null,
  anonim boolean not null default false,
  nama_pengirim text,
  unit_pengirim text,
  sumber text not null default 'Aplikasi' check (sumber in ('Aplikasi','Kotak fisik')),
  status text not null default 'baru' check (status in ('baru','dibaca','ditanggapi','selesai')),
  tanggapan text,
  ditanggapi_oleh uuid references profiles(id),
  ditanggapi_pada timestamptz,
  dibuat_oleh uuid references profiles(id),
  created_at timestamptz default now()
);

alter table surat_saran enable row level security;
drop policy if exists "Saran: lihat" on surat_saran;
drop policy if exists "Saran: kirim" on surat_saran;
drop policy if exists "Saran: tanggapi" on surat_saran;
drop policy if exists "Saran: hapus" on surat_saran;
create policy "Saran: lihat" on surat_saran for select using (public.boleh_pantau() or dibuat_oleh = auth.uid());
create policy "Saran: kirim" on surat_saran for insert with check (auth.role() = 'authenticated');
create policy "Saran: tanggapi" on surat_saran for update using (public.boleh_pantau());
create policy "Saran: hapus" on surat_saran for delete using (public.is_admin());

create or replace function public.siapkan_saran() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.sumber = 'Kotak fisik' and not public.boleh_pantau() then new.sumber := 'Aplikasi'; end if;
    if new.anonim then
      new.dibuat_oleh := null; new.nama_pengirim := null; new.unit_pengirim := null;
    elsif new.sumber = 'Aplikasi' then
      new.dibuat_oleh := auth.uid();
      select p.nama_lengkap, u.nama into new.nama_pengirim, new.unit_pengirim
      from profiles p left join surat_unit u on u.id = p.unit_id where p.id = auth.uid();
    end if;
  else
    if new.tanggapan is distinct from old.tanggapan and new.tanggapan is not null then
      new.ditanggapi_oleh := auth.uid(); new.ditanggapi_pada := now();
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_siapkan_saran on surat_saran;
create trigger trg_siapkan_saran before insert or update on surat_saran for each row execute procedure public.siapkan_saran();

-- ---------- 8. Hak akses tabel yang sudah ada (diperketat sesuai unit) ----------
-- Surat masuk: dicatat Sekretariat/admin
drop policy if exists "Login bisa tambah surat masuk" on surat_masuk;
drop policy if exists "Login bisa update surat masuk" on surat_masuk;
drop policy if exists "Pencatat bisa tambah surat masuk" on surat_masuk;
drop policy if exists "Pencatat bisa ubah surat masuk" on surat_masuk;
create policy "Pencatat bisa tambah surat masuk" on surat_masuk for insert with check (public.boleh_catat_masuk());
create policy "Pencatat bisa ubah surat masuk" on surat_masuk for update using (public.boleh_catat_masuk());

-- Alur / tahapan: Sekretariat, pimpinan, Biro Umum (tahap pengarsipan), admin
drop policy if exists "Login bisa tambah tahapan" on surat_tahapan;
drop policy if exists "Login bisa update tahapan" on surat_tahapan;
drop policy if exists "Pengelola alur bisa tambah tahapan" on surat_tahapan;
drop policy if exists "Pengelola alur bisa ubah tahapan" on surat_tahapan;
create policy "Pengelola alur bisa tambah tahapan" on surat_tahapan for insert with check (public.boleh_alur());
create policy "Pengelola alur bisa ubah tahapan" on surat_tahapan for update using (public.boleh_alur());

-- Surat keluar: dicatat tiap bidang/unit (bukan Biro Umum yang hanya memantau), admin untuk semua
drop policy if exists "Login bisa tambah surat keluar" on surat_keluar;
drop policy if exists "Login bisa update surat keluar" on surat_keluar;
drop policy if exists "Unit bisa tambah surat keluar" on surat_keluar;
drop policy if exists "Unit bisa ubah surat keluar" on surat_keluar;
create policy "Unit bisa tambah surat keluar" on surat_keluar for insert with check (public.boleh_catat_keluar());
create policy "Unit bisa ubah surat keluar" on surat_keluar for update
  using (public.is_admin() or (public.boleh_catat_keluar() and (petugas_id = auth.uid() or unit_id = public.my_unit_id())));

-- Arsip: Biro Umum juga boleh mengarsipkan
drop policy if exists "Admin bisa tambah arsip catatan" on arsip_catatan;
drop policy if exists "Admin bisa ubah arsip catatan" on arsip_catatan;
drop policy if exists "Admin bisa hapus arsip catatan" on arsip_catatan;
drop policy if exists "Pengarsip bisa tambah arsip catatan" on arsip_catatan;
drop policy if exists "Pengarsip bisa ubah arsip catatan" on arsip_catatan;
drop policy if exists "Pengarsip bisa hapus arsip catatan" on arsip_catatan;
create policy "Pengarsip bisa tambah arsip catatan" on arsip_catatan for insert with check (public.boleh_arsip());
create policy "Pengarsip bisa ubah arsip catatan" on arsip_catatan for update using (public.boleh_arsip());
create policy "Pengarsip bisa hapus arsip catatan" on arsip_catatan for delete using (public.boleh_arsip());

-- ---------- 9. Pemberitahuan langsung (realtime) ----------
do $$
begin
  begin alter publication supabase_realtime add table surat_disposisi_tujuan; exception when others then null; end;
  begin alter publication supabase_realtime add table surat_panggilan; exception when others then null; end;
end $$;
