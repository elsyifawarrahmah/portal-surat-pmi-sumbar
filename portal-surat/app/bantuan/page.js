'use client'
// Bantuan: cara pakai dalam bahasa sehari-hari, per peran.
import { usePeran } from '@/lib/peran'

const KARTU = [
  ['Kalau saya di Bidang / Divisi', '🏢', [
    'Buka **Beranda**. Kotak merah **“Belum dibaca”** menunjukkan surat baru untuk bidangmu. Klik kotaknya.',
    'Klik surat yang mau dibuka. Surat otomatis berstatus **sudah dibaca** — kamu tidak perlu menekan apa-apa.',
    'Baca suratnya (tombol **“Buka / lihat surat”**). Lalu di kotak **Tindak Lanjut** pilih satu: **Selesai**, **Teruskan ke bidang lain**, atau **Balas dengan surat**.',
    'Kalau kamu mengirim surat sendiri, buka **Surat Keluar** lalu **Tambah Data**.',
  ]],
  ['Kalau saya Sekretaris', '✍️', [
    'Surat datang? Klik **Surat Masuk → + Catat Surat Masuk**. Nomor agenda terisi sendiri.',
    'Buka suratnya, klik **“Teruskan ke bidang lain (Disposisi)”**. Pilih bidang, pilih petunjuk, tulis pesan, lalu **Kirim**.',
    'Mau melihat surat mana yang tertahan? Klik **Lacak Surat**. Ada tombol telepon / WhatsApp untuk menghubungi orangnya.',
  ]],
  ['Kalau saya Ketua / Kepala Markas', '⭐', [
    'Buka surat, klik **“Teruskan ke bidang lain (Disposisi)”**. Pilih bidang dan tulis petunjukmu. Bidang langsung menerimanya.',
  ]],
  ['Kalau saya Biro Umum', '🗄️', [
    'Surat yang sudah selesai dikerjakan menunggu kamu. Buka suratnya lalu klik **Arsipkan**.',
    'Mau lihat bidang mana yang suratnya tertahan? Buka **Menu lain → Pemantauan**. Bidang yang belum input surat bisa diingatkan dengan tombol **Panggil**.',
  ]],
]

export default function BantuanPage() {
  const peran = usePeran()
  const bold = t => t.split('**').map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x))
  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Bantuan</h1><p className="desc">Cara memakai SATria PMI, langkah demi langkah.</p></div></div>

      <div className="panel"><div className="panel-body" style={{ fontSize: 15, lineHeight: 1.6 }}>
        <h3 style={{ marginTop: 0 }}>Siapa bisa melihat apa?</h3>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li><b>Isi surat</b> (perihal, asal, file) hanya bisa dibuka oleh <b>bidang yang dituju</b>, Sekretaris, Ketua / Kepala Markas, dan Biro Umum.</li>
          <li><b>Semua orang</b> bisa melihat <b>jejak</b> surat di menu <b>Lacak Surat</b>: ditujukan ke siapa, sudah sampai di mana, sudah dibaca atau belum, tertahan berapa hari.</li>
          <li>Mengubah data dilakukan oleh yang bertugas (admin / Sekretaris).</li>
        </ul>
        {peran.nama && <p style={{ margin: '12px 0 0', color: 'var(--ink-soft)' }}>Kamu masuk sebagai <b>{peran.nama}</b> — {peran.isAdmin ? 'Admin web' : peran.unit?.nama || 'belum ada unit (minta admin mengaturnya)'}.</p>}
      </div></div>

      {KARTU.map(([judul, ikon, langkah]) => (
        <div key={judul} className="panel">
          <div className="panel-head"><h3>{ikon} {judul}</h3></div>
          <div className="panel-body"><ol style={{ margin: '0 0 0 20px', padding: 0, fontSize: 15, lineHeight: 1.7 }}>{langkah.map((l, i) => <li key={i} style={{ marginBottom: 6 }}>{bold(l)}</li>)}</ol></div>
        </div>
      ))}

      <div className="panel"><div className="panel-body" style={{ fontSize: 15 }}>
        <b>Ada yang tidak bisa dibuka atau muncul pesan aneh?</b> Screenshot layarnya lalu kirim ke admin web (Elsyifa).
      </div></div>
    </div></div>
  )
}
