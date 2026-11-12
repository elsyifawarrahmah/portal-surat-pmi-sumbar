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
  },,
  {
    jenis: 'wajib', nama: 'Kitab Undang-Undang Hukum Pidana (KUHP)', nomor: 'UU No. 1 Tahun 2023 (KUHP nasional)',
    inti: 'KUHP nasional mengintegrasikan dan menggantikan sebagian ketentuan pidana yang sebelumnya ada di UU ITE, terutama soal pencemaran nama baik, berita bohong, dan tindak pidana kesusilaan, termasuk yang dilakukan lewat media elektronik.',
    dipakai: [
      'Catatan koreksi, komentar, dan isi surat harus sopan, benar, dan bisa dipertanggungjawabkan.',
      'Memalsukan surat, tanda tangan, paraf, atau kode verifikasi adalah perbuatan yang diancam pidana. Karena itu setiap paraf dan persetujuan tercatat nama, waktu, dan kodenya.',
    ],
    tautan: [],
  },
  {
    jenis: 'wajib', nama: 'Hak Cipta', nomor: 'UU No. 28 Tahun 2014',
    inti: 'Melindungi karya digital seperti perangkat lunak, musik, video, dan tulisan dari pembajakan atau penggandaan ilegal melalui internet.',
    dipakai: [
      'Logo, foto, dan dokumen yang diunggah ke SATRIA harus milik PMI atau sudah ada izin pemakaiannya.',
      'Perangkat lunak dan huruf (font) yang dipakai aplikasi ini memakai lisensi yang membolehkan.',
    ],
    tautan: [],
  },
  {
    jenis: 'tambahan', nama: 'Kearsipan', nomor: 'UU No. 43 Tahun 2009 (tambahan dari pengelola, tidak ada di gambar rujukan; periksa ke JDIH)',
    inti: 'Mengatur pengelolaan arsip, termasuk arsip dinamis yang dipakai dalam kegiatan organisasi sehari-hari. Surat masuk dan keluar adalah arsip.',
    dipakai: [
      'Surat yang salah tidak dihapus: dibatalkan dengan alasan, jejaknya tersimpan, dan bisa dipulihkan (menu Surat Dibatalkan).',
      'Naskah yang dikembalikan untuk diperbaiki disimpan sebagai versi lama; surat yang sama tetap satu dengan nomor yang sama.',
      'Arsip Biro Umum menyimpan surat yang sudah selesai.',
    ],
    tautan: [],
  },
  {
    jenis: 'tambahan', nama: 'Kepalangmerahan', nomor: 'UU No. 1 Tahun 2018 (tambahan dari pengelola; periksa ke JDIH)',
    inti: 'Dasar hukum Palang Merah Indonesia, termasuk ketentuan tentang nama dan lambang palang merah.',
    dipakai: ['Logo dan lambang PMI dipakai pada tempatnya (kop surat, ikon aplikasi) dan tidak diubah sembarangan.'],
    tautan: [],
  },
  {
    jenis: 'acuan', nama: 'Pelindungan Anak di Sistem Elektronik (PP TUNAS)', nomor: 'PP No. 17 Tahun 2025 dan Permenkomdigi No. 9 Tahun 2026 (6 Maret 2026)',
    inti: 'Mengatur tata kelola penyelenggaraan sistem elektronik untuk pelindungan anak, termasuk pembatasan atau penundaan akun anak di bawah 16 tahun pada platform digital berisiko tinggi seperti media sosial.',
    dipakai: [
      'SATRIA adalah alat kerja internal untuk pengurus, staf, dan relawan dewasa, bukan platform untuk anak. Aturan ini terkait tidak langsung.',
      'Bila relawan remaja (misalnya PMR) dilibatkan, data mereka perlu perlindungan ekstra: jangan unggah data anak tanpa izin orang tua atau wali.',
    ],
    tautan: [['Permenkomdigi 9/2026 (Peraturan BPK)', 'https://peraturan.bpk.go.id/Details/346040/permenkomdigi-no-9-tahun-2026']],
  },
  {
    jenis: 'acuan', nama: 'Keamanan Informasi (Peraturan BSSN)', nomor: 'Peraturan BSSN No. 4 Tahun 2021',
    inti: 'Regulasi teknis dari Badan Siber dan Sandi Negara tentang standar keamanan informasi pada sistem elektronik. Ditujukan untuk sistem pemerintahan (SPBE), jadi dipakai sebagai acuan praktik baik karena PMI bukan instansi pemerintah.',
    dipakai: [
      'Kata sandi kuat dan tidak dibagikan, keluar dari akun di perangkat bersama, dan aktifkan kunci layar di HP.',
      'Pencadangan data berkala (menu Backup Data) dan pemeriksaan sistem (menu Cek Database).',
    ],
    tautan: [],
  },
]

const JENIS = { wajib: ['Wajib diikuti', '#E7F4EA', '#2E7D32'], acuan: ['Acuan / terkait tidak langsung', '#FBF1D6', '#8F6608'], tambahan: ['Tambahan dari pengelola', '#E8F0FA', '#1F5E99'] }
const chip = j => ({ display: 'inline-block', fontSize: 12, fontWeight: 800, padding: '3px 10px', borderRadius: 999, background: JENIS[j][1], color: JENIS[j][2] })

export default function DasarHukumPage() {
  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Dasar Hukum</h1><p className="desc">Landasan hukum penggunaan surat elektronik, tanda tangan elektronik, dan pelindungan data di SATRIA PMI.</p></div></div>

      <div className="panel" style={{ padding: 16, marginBottom: 14, background: '#FFF8E6', borderColor: '#EBD38A' }}>
        <b>Perlu diketahui:</b> halaman ini ringkasan untuk memudahkan pengurus memahami landasan aplikasi. Ini bukan nasihat hukum. Untuk bunyi pasal yang lengkap dan terbaru, rujuk salinan resmi (JDIH) atau tanyakan kepada ahli hukum.
      </div>

      <p style={{ margin: '0 2px 12px', fontSize: 15, lineHeight: 1.55 }}>Inilah aturan yang kita ikuti dalam membuat dan memakai SATRIA PMI. <span style={chip('wajib')}>Wajib diikuti</span> berlaku langsung; <span style={chip('acuan')}>Acuan</span> dibaca sebagai pedoman karena terkait tidak langsung; <span style={chip('tambahan')}>Tambahan</span> ditambahkan pengelola di luar daftar rujukan.</p>

      {ATURAN.map(a => (
        <div key={a.nama} className="panel" style={{ padding: 18, marginBottom: 14 }}>
          <div style={{ marginBottom: 6 }}><span style={chip(a.jenis || 'wajib')}>{JENIS[a.jenis || 'wajib'][0]}</span></div>
          <h2 style={{ margin: '0 0 4px', fontSize: 19 }}>{a.nama}</h2>
          <div style={{ color: '#C8102E', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{a.nomor}</div>
          <p style={{ margin: '0 0 12px', lineHeight: 1.6, fontSize: 15.5 }}>{a.inti}</p>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>Penerapannya di SATRIA PMI</div>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, fontSize: 15 }}>{a.dipakai.map((d, i) => <li key={i} style={{ marginBottom: 4 }}>{d}</li>)}</ul>
          {a.tautan.length > 0 && <div style={{ marginTop: 10, fontSize: 14 }}>Sumber: {a.tautan.map(([t, u]) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" style={{ color: '#C8102E', fontWeight: 600 }}>{t}</a>)}</div>}
        </div>
      ))}

      <div className="panel" style={{ padding: 18, marginBottom: 14 }}>
        <h2 style={{ margin: '0 0 8px', fontSize: 19 }}>Periksa naskah resminya</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 15 }}>
          <li><a href="https://peraturan.bpk.go.id" target="_blank" rel="noopener noreferrer" style={{ color: '#C8102E', fontWeight: 600 }}>Peraturan BPK (JDIH)</a></li>
          <li><a href="https://jdih.komdigi.go.id" target="_blank" rel="noopener noreferrer" style={{ color: '#C8102E', fontWeight: 600 }}>JDIH Kementerian Komunikasi dan Digital</a></li>
        </ul>
      </div>

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
