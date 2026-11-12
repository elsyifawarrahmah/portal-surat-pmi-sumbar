'use client'
// Dasar hukum penggunaan SATRIA PMI: landasan surat elektronik, tanda tangan elektronik, dan pelindungan data pribadi.
// Ringkasan informasi, bukan nasihat hukum. Rujuk salinan resmi (JDIH) untuk bunyi pasal yang lengkap.

const ATURAN = [
  {
    nama: 'UU Informasi dan Transaksi Elektronik (UU ITE)',
    nomor: 'UU No. 11 Tahun 2008, diubah dengan UU No. 19 Tahun 2016, dan terakhir UU No. 1 Tahun 2024',
    inti: 'Payung hukum utama pemanfaatan teknologi informasi. Menegaskan bahwa informasi dan dokumen elektronik, serta hasil cetaknya, adalah alat bukti hukum yang sah (Pasal 5), dan mengakui tanda tangan elektronik (Pasal 11).',
    dipakai: [
      'Surat keluar, surat tugas, disposisi, dan koreksi yang dibuat di SATRIA adalah dokumen elektronik. Hasil cetaknya (misalnya surat tugas yang di-print) juga diakui.',
      'Paraf Sekretaris dan tanda tangan Kepala Markas/Ketua dicatat dengan nama, waktu, dan kode unik yang bisa dicek lewat menu Cek Kode Paraf.',
      'Riwayat koreksi, coretan, dan versi lama surat disimpan sebagai jejak (tidak dihapus), sehingga proses persetujuan bisa dibuktikan.',
    ],
    tautan: [['Teks UU 1/2024 (Wikisumber)', 'https://id.wikisource.org/wiki/Undang-Undang_Republik_Indonesia_Nomor_1_Tahun_2024']],
  },
  {
    nama: 'UU Pelindungan Data Pribadi (UU PDP)',
    nomor: 'UU No. 27 Tahun 2022, berlaku penuh sejak 17 Oktober 2024',
    inti: 'Mengatur siapa pun yang mengumpulkan atau memproses data pribadi: wajib menjaga kerahasiaan, memperoleh persetujuan pemilik data, dan mengamankan sistem dari kebocoran.',
    dipakai: [
      'Data nama, jabatan, kontak, dan berkas surat hanya bisa dibuka oleh akun yang sudah login dan punya unit; berkas disimpan privat dan dibuka lewat tautan sementara.',
      'Akses dibatasi menurut peran (pembuat, Sekretaris, Kepala Markas/Ketua, Biro Umum, admin). Aktivitas penting tercatat di Log Aktivitas.',
      'Kata sandi tidak pernah disimpan oleh aplikasi. Fitur "Ingat saya" hanya mengingat alamat email di HP itu.',
    ],
    tautan: [['UU 27/2022 (Pasal.id)', 'https://pasal.id/peraturan/uu/uu-no-27-tahun-2022']],
  },
  {
    nama: 'PP Penyelenggaraan Sistem dan Transaksi Elektronik (PP PSTE)',
    nomor: 'PP No. 71 Tahun 2019 (menggantikan PP No. 82 Tahun 2012)',
    inti: 'Mengatur tata kelola penyelenggara sistem elektronik (PSE): kewajiban keamanan dan keandalan sistem, pendaftaran PSE, serta fungsi tanda tangan elektronik sebagai alat autentikasi dan verifikasi.',
    dipakai: [
      'Tanda tangan elektronik di SATRIA berfungsi mengidentifikasi penandatangan dan menunjukkan persetujuan atas isi surat.',
      'Sistem dijaga keamanannya: login, pembatasan akses, berkas privat, dan cadangan data (menu Backup Data untuk admin).',
    ],
    tautan: [],
  },
]

export default function DasarHukumPage() {
  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Dasar Hukum</h1><p className="desc">Landasan hukum penggunaan surat elektronik, tanda tangan elektronik, dan pelindungan data di SATRIA PMI.</p></div></div>

      <div className="panel" style={{ padding: 16, marginBottom: 14, background: '#FFF8E6', borderColor: '#EBD38A' }}>
        <b>Perlu diketahui:</b> halaman ini ringkasan untuk memudahkan pengurus memahami landasan aplikasi. Ini bukan nasihat hukum. Untuk bunyi pasal yang lengkap dan terbaru, rujuk salinan resmi (JDIH) atau tanyakan kepada ahli hukum.
      </div>

      {ATURAN.map(a => (
        <div key={a.nama} className="panel" style={{ padding: 18, marginBottom: 14 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>{a.nama}</h2>
          <div style={{ color: '#C8102E', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{a.nomor}</div>
          <p style={{ margin: '0 0 12px', lineHeight: 1.6, fontSize: 15.5 }}>{a.inti}</p>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Penerapannya di SATRIA PMI</div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, fontSize: 15 }}>{a.dipakai.map((d, i) => <li key={i} style={{ marginBottom: 4 }}>{d}</li>)}</ul>
          {a.tautan.length > 0 && <div style={{ marginTop: 10, fontSize: 14 }}>Sumber: {a.tautan.map(([t, u]) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#C8102E', fontWeight: 600 }}>{t}</a>)}</div>}
        </div>
      ))}

      <div className="panel" style={{ padding: 18, marginBottom: 14, borderColor: '#E5B4B4' }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 19 }}>Catatan penting untuk pengurus</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, fontSize: 15 }}>
          <li style={{ marginBottom: 6 }}><b>Jenis tanda tangan.</b> Paraf dan TTD di SATRIA adalah tanda tangan elektronik internal (tidak memakai sertifikat elektronik dari penyelenggara tersertifikasi). Untuk dokumen berisiko tinggi, atau yang dikirim ke instansi yang mensyaratkan tanda tangan bersertifikat, konsultasikan dulu kepada pimpinan atau ahli hukum.</li>
          <li style={{ marginBottom: 6 }}><b>Pendaftaran PSE.</b> Apakah PMI Provinsi perlu mendaftarkan SATRIA sebagai penyelenggara sistem elektronik sebaiknya dipastikan kepada pengurus pusat atau ahli hukum.</li>
          <li><b>Surat tetap harus dijaga.</b> Surat dibatalkan atau diganti revisi tidak dihapus, hanya ditandai, supaya jejak dan buktinya utuh.</li>
        </ul>
      </div>
    </div></div>
  )
}
