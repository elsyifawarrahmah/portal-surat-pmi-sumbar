'use client'
// Bantuan: cara pakai dalam bahasa sehari-hari, per peran.
import { usePeran } from '@/lib/peran'

const KARTU = [
  ['Saya di Bidang / Divisi', '🏢', [
    'Buka menu **Surat Masuk**. Di situ hanya ada surat yang ditujukan ke bidang kamu.',
    'Klik surat, lalu tekan **“Surat sudah sampai di saya”**. Jadi semua orang tahu surat itu sudah kamu terima.',
    'Tulis kata-katamu, lalu tekan **Selesai**. Kalau perlu dikerjakan bidang lain, tekan **Teruskan ke bidang lain**.',
    'Kalau kamu mengirim surat, buka **Surat Keluar** lalu **Tambah Data**.',
  ]],
  ['Saya Sekretaris (Sekretariat)', '✍️', [
    'Surat datang? Buka **Surat Masuk → Catat Surat Masuk**. Nomor agenda terisi sendiri.',
    'Klik **+ Disposisi** pada surat itu, pilih bidang tujuan, tulis perintahnya. Bisa dicetak seperti lembar disposisi kertas.',
    'Kalau surat menumpuk, orang lain bisa menelepon kamu lewat tombol **Hubungi** di menu **Pemantauan**.',
  ]],
  ['Saya Ketua / Kepala Markas', '⭐', [
    'Kamu bisa membaca semua surat dan memberi **Disposisi** ke bidang mana pun.',
    'Tulis kata-katamu di disposisi. Bidang yang dituju langsung melihatnya di menu **Disposisi**.',
  ]],
  ['Saya Biro Umum', '🗄️', [
    'Buka **Pemantauan** untuk melihat bidang mana yang surat-suratnya tertahan.',
    'Surat yang sudah selesai dikerjakan bidang akan menunggu kamu. Tekan **Arsipkan**.',
    'Bidang yang belum input surat bisa diingatkan lewat tombol **Panggil**.',
  ]],
]

export default function BantuanPage() {
  const peran = usePeran()
  const bold = t => t.split('**').map((x, i) => (i % 2 ? <b key={i}>{x}</b> : x))
  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Bantuan</h1><p className="desc">Cara memakai portal ini, langkah demi langkah.</p></div></div>

      <div className="panel"><div className="panel-body" style={{ fontSize: 15, lineHeight: 1.6 }}>
        <h3 style={{ marginTop: 0 }}>Siapa bisa melihat apa?</h3>
        <ul style={{ margin: '0 0 0 18px', padding: 0 }}>
          <li><b>Isi surat</b> (perihal, asal, file) hanya bisa dibuka oleh <b>bidang yang dituju</b>, Sekretariat, Ketua / Kepala Markas, dan Biro Umum.</li>
          <li><b>Semua orang</b> bisa melihat <b>jejak</b> surat di menu <b>Lacak Surat</b>: ditujukan ke siapa, sudah sampai di mana, sudah dibaca atau belum, tertahan berapa hari.</li>
          <li>Mengubah data dilakukan oleh yang bertugas (admin / Sekretariat).</li>
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
