# Panduan: Login (Lupa sandi, Google, Facebook, link email) & Profil

## Yang perlu diatur SEKALI di Supabase (supaya link di email dan login Google/Facebook jalan)

### 1. Alamat situs (wajib, 2 menit)
Supabase → **Authentication → URL Configuration**
- **Site URL**: `https://portal-surat-pmi-sumbar.vercel.app`
- **Redirect URLs** → Add URL: `https://portal-surat-pmi-sumbar.vercel.app/**`
Tanpa ini, link "Lupa kata sandi" dan "Masuk lewat link email" tidak bisa kembali ke portal.

### 2. Email
Authentication → Providers → **Email** sudah aktif. Catatan: email bawaan Supabase dibatasi hanya beberapa email per jam. Kalau banyak pengguna, pasang SMTP sendiri di Authentication → **SMTP Settings** (mis. Gmail / Resend).

### 3. Login Google (disarankan)
1. https://console.cloud.google.com → buat project → **APIs & Services → Credentials → Create Credentials → OAuth client ID** → jenis **Web application**.
2. **Authorized redirect URIs**: `https://<kode-project>.supabase.co/auth/v1/callback` (alamat persisnya tertera di Supabase → Authentication → Providers → Google).
3. Salin **Client ID** dan **Client Secret** → Supabase → Authentication → Providers → **Google** → aktifkan → tempel → Save.
Tombol "Lanjut dengan Google" otomatis muncul di halaman login begitu Google diaktifkan.

### 4. Login Facebook (lebih repot, boleh belakangan)
1. https://developers.facebook.com → Create App → tambahkan produk **Facebook Login**.
2. **Valid OAuth Redirect URIs**: alamat callback Supabase yang sama dengan di atas.
3. Salin **App ID** dan **App Secret** → Supabase → Providers → **Facebook** → aktifkan → Save.
4. Aplikasi Facebook harus diubah ke mode **Live** (perlu URL kebijakan privasi).

## Catatan keamanan
- Siapa pun yang mendaftar atau login (Google/Facebook/email) otomatis menjadi akun biasa **tanpa unit**. Akun tanpa unit **tidak bisa melihat isi surat apa pun** sampai admin web menempatkannya di bidang (menu **Data User & Unit**).

## Aturan unggah berkas
- Hanya **1 file** per kolom unggah. Surat beberapa halaman: gabungkan jadi 1 PDF.
- Surat: PDF / JPG / PNG, **minimal 10 KB, maksimal 5 MB**. Foto besar dikecilkan otomatis (sisi terpanjang 1800 px).
- Foto profil: JPG / PNG, **minimal 5 KB, maksimal 2 MB** sebelum dikecilkan otomatis menjadi persegi 512 px.
- Berkas dibuka lewat pratinjau di dalam portal (pas layar HP, bisa diperbesar), bukan alamat mentah Supabase.

## Profil
Menu: klik nama/foto di bagian bawah menu samping → **Profil Saya**: ubah nama, jabatan, nomor HP, foto, dan ganti kata sandi. Email dan unit/bidang hanya bisa diubah admin web.
