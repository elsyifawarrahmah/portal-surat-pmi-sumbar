# Portal Surat Digital — PMI Sumatera Barat
Ini **WEB TERPISAH**, tidak ada hubungannya dengan portal logistik kemarin. Ikuti dari awal seperti baru pertama kali.

---

## BAGIAN 1 — Bikin Database BARU di Supabase

1. Buka **https://supabase.com** → login pakai akun yang sama juga boleh
2. Klik **New project**
3. Isi:
   - Name: `pmi-sumbar-surat` (BEDA nama dari project logistik kemarin)
   - Password: buat baru, simpan baik-baik
   - Region: **Southeast Asia (Singapore)**
4. Tunggu ±2 menit
5. **SQL Editor** → **New query** → buka file **`supabase-schema.sql`** yang saya kirim, copy semua, paste, **Run**
6. **Settings** → **API Keys** → klik tab **"Legacy anon, service_role API keys"** → copy key **`anon` `public`** (yang diawali `eyJ...`)
7. **Settings** → **Data API** → copy **Project URL** (`https://xxxxx.supabase.co`)

---

## BAGIAN 2 — Upload ke GitHub (repo BARU, terpisah)

1. **github.com** → **New repository** → nama: `portal-surat-pmi-sumbar`
2. Ekstrak zip yang saya kirim → dapat folder `portal-surat`
3. Di halaman repo kosong, klik **uploading an existing file**
4. **Drag folder `portal-surat` itu sendiri** (bukan isinya satu-satu) ke kotak upload
5. **Commit changes**
6. Cek hasilnya: pastikan kelihatan folder `app`, `components`, `lib` di dalam folder `portal-surat` di GitHub

---

## BAGIAN 3 — Deploy ke Vercel (project BARU)

1. **vercel.com** → **Add New** → **Project** → pilih repo `portal-surat-pmi-sumbar`
2. **PENTING**: sebelum Deploy, di bagian **Root Directory**, klik **Edit**, isi: `portal-surat`
3. Isi **Environment Variables**:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari Bagian 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Legacy anon key dari Bagian 1 (yang `eyJ...`) |
4. Klik **Deploy**, tunggu ±2 menit
5. Dapat alamat baru, contoh: `portal-surat-pmi-sumbar.vercel.app` — ini alamat khusus surat, beda dari alamat logistik

---

## BAGIAN 4 — Jadikan Admin

1. Buka situs surat yang baru → **Daftar di sini** pakai email kamu
2. Balik ke **Supabase** (project surat, bukan project logistik) → **SQL Editor**:
   ```sql
   update profiles set role = 'admin' where id = (select id from auth.users where email = 'email_kamu@contoh.com');
   ```
3. **Run**

Selesai — sekarang punya 2 web terpisah: satu untuk logistik, satu khusus surat.
