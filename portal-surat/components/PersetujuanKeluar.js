'use client'
// Alur surat keluar: pembuat ajukan -> Sekretaris paraf -> Kepala Markas/Ketua setuju + TTD -> Biro Umum.
import { KalimatCepat, TombolBicara, tambahKalimat } from '@/components/PilihanCepat'
import { KALIMAT_TOLAK } from '@/lib/surat'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Modal from '@/components/Modal'
import KoreksiCoret from '@/components/KoreksiCoret'
import GambarKoreksi, { TautanBerkas } from '@/components/GambarKoreksi'
import TandaTangan, { unggahTtd } from '@/components/TandaTangan'
import { fmtWaktu } from '@/lib/format'
import { kabarkan } from '@/lib/notif'
import { cetakPengesahanKeluar, cetakLembarKoreksi } from '@/lib/cetak'
import { urlAman } from '@/lib/berkas'

export const LABEL_SETUJU = {
  null: ['Belum diajukan', '#6B6B6B'], revisi: ['PERLU DIPERBAIKI', '#B3261E'], ditolak: ['DITOLAK · tidak disetujui', '#B3261E'], diajukan: ['Menunggu paraf Sekretaris', '#B07A00'],
  diparaf: ['Menunggu persetujuan Kepala Markas/Ketua', '#1F5E99'], disetujui: ['Disetujui · di Biro Umum', '#2E7D32'],
}
// Posisi surat sekarang + langkah berikutnya, dalam bahasa sehari-hari
export const POSISI = {
  null: ['Di pembuat surat (belum diajukan)', 'Pembuat menekan "Ajukan" supaya Sekretaris bisa memeriksa.'],
  revisi: ['Dikembalikan ke pembuat untuk diperbaiki', 'Pembuat memperbaiki sesuai catatan, lalu mengajukan lagi.'],
  ditolak: ['Ditolak, kembali ke pembuat', 'Pembuat membaca alasan penolakan, lalu memperbaiki dan mengajukan lagi atau menghentikan surat.'],
  diajukan: ['Di meja Sekretaris', 'Sekretaris memeriksa lalu memaraf, atau mengembalikan ke pembuat.'],
  diparaf: ['Di meja Kepala Markas / Ketua', 'Kepala Markas atau Ketua menyetujui dan tanda tangan, atau mengembalikan (ke pembuat / ke Sekretaris).'],
  disetujui: ['Disetujui, ada di Biro Umum', 'Biro Umum mengirim surat, lalu mencatatnya di menu Ekspedisi.'],
}
// Tombol aksi yang cocok untuk peran yang sedang membuka (null bila tidak ada yang perlu dilakukan)
export function aksiSaya(st, peran, bisaUbah) {
  if (bisaUbah && (!st)) return 'Ajukan surat'
  if (bisaUbah && ['revisi', 'ditolak'].includes(st)) return 'Perbaiki & ajukan lagi'
  if ((peran.isAdmin || peran.tipe === 'sekretariat') && st === 'diajukan') return 'Periksa & paraf'
  if ((peran.isAdmin || peran.tipe === 'pimpinan') && st === 'diparaf') return 'Tinjau & setujui'
  return null
}
const langkah = [['diajukan', '1. Diajukan'], ['diparaf', '2. Paraf Sekretaris'], ['disetujui', '3. Disetujui + TTD']]
const urut = { diajukan: 1, diparaf: 2, disetujui: 3 }
const NAMA_TIPE = { koreksi: 'Perlu diperbaiki', tolak: 'Ditolak (tidak setuju)', ke_sekretaris: 'Dikembalikan ke Sekretaris' }
const JUDUL_TIPE = { koreksi: 'Apa yang perlu diperbaiki? (surat kembali ke pembuat)', tolak: 'Kenapa surat ini tidak disetujui?', ke_sekretaris: 'Catatan untuk Sekretaris (surat kembali untuk paraf ulang)' }

export default function PersetujuanKeluar({ supabase, surat, peran, bisaUbah, onClose, onChanged, rpc = 'surat_keluar', cetak = cetakPengesahanKeluar, migrasi = 'migrasi-persetujuan-paraf.sql' }) {
  const st = surat.status_persetujuan || null
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  const [ttdUrl, setTtdUrl] = useState(peran.ttdUrl || '')
  const [buat, setBuat] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [tipeKoreksi, setTipeKoreksi] = useState('')
  const [coret, setCoret] = useState(null)   // { sumber: [...] } saat editor coret terbuka
  const [bukaCoret, setBukaCoret] = useState(false)
  const [riwayat, setRiwayat] = useState([])
  const [kirim, setKirim] = useState([])
  const jenisSurat = rpc === 'surat_tugas' ? 'tugas' : 'keluar'
  async function muatRiwayat() {
    const { data, error } = await supabase.from('surat_koreksi').select('*').eq('jenis_surat', jenisSurat).eq('surat_id', surat.id).order('created_at', { ascending: false })
    if (!error) setRiwayat(data || [])
    if (jenisSurat === 'keluar') {
      const k = await supabase.from('surat_ekspedisi').select('*').eq('surat_keluar_id', surat.id).order('created_at')
      if (!k.error) setKirim(k.data || [])
    }
  }
  useEffect(() => { muatRiwayat() }, [surat.id, surat.status_persetujuan])

  const bisaParaf = (peran.isAdmin || peran.tipe === 'sekretariat') && st === 'diajukan'
  const bisaSetuju = (peran.isAdmin || peran.tipe === 'pimpinan') && st === 'diparaf'
  const bisaAjukan = bisaUbah && (!st || st === 'revisi' || st === 'ditolak')
  const bisaKembali = (peran.isAdmin || ['sekretariat', 'pimpinan'].includes(peran.tipe)) && ['diajukan', 'diparaf'].includes(st)

  async function panggil(fn, args) {
    setSibuk(true); setGalat('')
    const { error } = await supabase.rpc(fn, args)
    setSibuk(false)
    if (error) { setGalat(/function|schema cache|does not exist/i.test(error.message) ? 'Fitur ini belum aktif di database. Jalankan supabase/' + migrasi + ' dulu.' : error.message); return false }
    kabarkan(rpc, surat.id)
    onChanged && onChanged(); return true
  }
  async function bukaEditorCoret() {
    setBukaCoret(true); setGalat('')
    const sumber = surat.file_bukti_url ? [{ url: surat.file_bukti_url, nama: 'Surat' }] : []
    const l = await supabase.from('surat_lampiran').select('url,nama').eq('jenis', 'keluar').eq('surat_id', surat.id).order('created_at')
    ;(l.data || []).forEach(x => sumber.push({ url: x.url, nama: x.nama }))
    setBukaCoret(false)
    if (!sumber.length) { setGalat('Pembuat belum mengunggah berkas surat, jadi belum ada yang bisa dicoret. Gunakan catatan teks.'); return }
    setCoret({ sumber })
  }
  async function kirimCoretan({ gambar, catatan }) {
    const ok = await panggil('koreksi_' + rpc, { p_id: surat.id, p_tipe: tipeKoreksi, p_catatan: catatan || alasan || '', p_gambar: gambar, p_berkas: surat.file_bukti_url || null })
    if (ok) { setCoret(null); setTipeKoreksi(''); setAlasan(''); muatRiwayat() }
    return ok
  }
  async function simpanTtd(file) {
    try {
      const url = await unggahTtd(supabase, file, peran.userId)
      await supabase.from('profiles').update({ ttd_url: url }).eq('id', peran.userId)
      setTtdUrl(url); setBuat(false)
    } catch (e) { setGalat(e.message) }
  }
  const blokTtd = (
    <div style={{ margin: '12px 0' }}>
      {ttdUrl && !buat && <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><img src={ttdUrl} alt="TTD" style={{ height: 70, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 4 }} /><button className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => setBuat(true)}>Buat ulang tanda tangan</button></div>}
      {(!ttdUrl || buat) && <TandaTangan onSimpan={simpanTtd} onBatal={ttdUrl ? () => setBuat(false) : null} />}
    </div>
  )
  const [label, warna] = LABEL_SETUJU[st] || LABEL_SETUJU.null

  return (
    <Modal judul={`Persetujuan — ${surat.nomor_surat}`} onClose={onClose} lebar={600}>
      {galat && <div className="error-box">{galat}</div>}
      <div style={{ fontSize: 14, marginBottom: 12 }}><b>{surat.perihal}</b><br /><span style={{ color: 'var(--ink-soft)' }}>Kepada {surat.tujuan_surat}</span>{surat.tembusan && <><br /><span style={{ color: 'var(--ink-soft)' }}>Tembusan: {String(surat.tembusan).split('\n').filter(Boolean).join(', ')}</span></>}</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {langkah.map(([k, t]) => <span key={k} className="tag" style={{ background: (urut[st] || 0) >= urut[k] ? '#E7F4EA' : '#F1F1F1', color: (urut[st] || 0) >= urut[k] ? '#2E7D32' : '#777', fontSize: 13, padding: '6px 12px' }}>{(urut[st] || 0) >= urut[k] ? '✔ ' : ''}{t}</span>)}
      </div>
      <div style={{ fontWeight: 700, color: warna, marginBottom: 10 }}>Status: {label}</div>
      <div style={{ background: 'var(--cream)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '.03em' }}>Posisi surat sekarang</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: warna }}>{kirim.length ? (kirim[kirim.length - 1].status === 'diterima' ? 'Sudah diterima ' + (kirim[kirim.length - 1].penerima || 'tujuan') : 'Sudah dikirim ke ' + (kirim[kirim.length - 1].penerima || surat.tujuan_surat)) : (POSISI[st] || POSISI.null)[0]}</div>
        <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 2 }}>Berikutnya: {kirim.length ? 'selesai. Bukti kirim ada di menu Ekspedisi.' : (POSISI[st] || POSISI.null)[1]}</div>
      </div>
      <PerjalananSurat surat={surat} riwayat={riwayat} kirim={kirim} st={st} />
      {['revisi', 'ditolak'].includes(st) && (
        <div style={{ background: '#FDECEC', border: '2px solid #B3261E', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
          <div style={{ color: '#B3261E', fontWeight: 800, fontSize: 16 }}>{st === 'ditolak' ? 'DITOLAK — tidak disetujui' : 'PERLU DIPERBAIKI'}</div>
          {(surat.catatan_revisi || riwayat[0]?.catatan) && <div style={{ color: '#8C1010', marginTop: 4, fontSize: 15 }}>{surat.catatan_revisi || riwayat[0]?.catatan}</div>}
          {riwayat[0]?.gambar?.length > 0 && <GambarKoreksi supabase={supabase} daftar={riwayat[0].gambar} judul="Coretan dari pemeriksa" />}
          {riwayat[0]?.gambar?.length > 0 && st === 'revisi' && <div style={{ fontSize: 13, color: '#5A1010', marginTop: 6 }}>Perbaiki di surat yang sama (tombol Edit di daftar surat keluar), lalu ajukan lagi. Berkas lama otomatis tersimpan sebagai versi lama, jadi <b>tidak perlu membuat surat baru</b>.</div>}
          {riwayat[0] && <div style={{ fontSize: 12.5, color: '#8C1010', marginTop: 4 }}>Oleh {riwayat[0].oleh_nama} ({riwayat[0].oleh_peran}) · {fmtWaktu(riwayat[0].created_at)}</div>}
        </div>
      )}
      {riwayat.length > 0 && (
        <details style={{ marginBottom: 12 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, color: '#B3261E' }}>Riwayat koreksi dan penolakan ({riwayat.length})</summary>
          {riwayat.map(r => (
            <div key={r.id} style={{ borderLeft: '4px solid #B3261E', background: '#FFF6F6', padding: '8px 12px', margin: '8px 0', borderRadius: 8, fontSize: 14 }}>
              <b style={{ color: '#B3261E' }}>{NAMA_TIPE[r.tipe]}</b> · {r.oleh_nama} ({r.oleh_peran}) · {fmtWaktu(r.created_at)}
              <div style={{ color: '#5A1010' }}>{r.catatan}</div>
              {r.gambar?.length > 0 && <GambarKoreksi supabase={supabase} daftar={r.gambar} />}
              {r.berkas_url && surat.file_bukti_url && r.berkas_url !== surat.file_bukti_url && <div style={{ fontSize: 12.5, color: '#6A4A00', background: '#FFF4D6', borderRadius: 8, padding: '5px 9px', marginTop: 6 }}>Versi lama: sudah diganti revisi, dibatalkan otomatis oleh sistem (tetap disimpan sebagai bukti). <TautanBerkas supabase={supabase} url={r.berkas_url} teks="Lihat berkas lama" /></div>}
            </div>
          ))}
        </details>
      )}

      {surat.paraf_kode && <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <b>Paraf Sekretaris:</b> {surat.paraf_nama} · {fmtWaktu(surat.paraf_pada)}<br />
        {surat.paraf_ttd_url && <img src={surat.paraf_ttd_url} alt="Paraf" style={{ height: 56, margin: '6px 0', background: '#fff' }} />}<br />
        <span className="mono" style={{ fontSize: 13 }}>Kode: {surat.paraf_kode}</span></div>}
      {surat.setuju_kode && <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <b>Disetujui {surat.setuju_jabatan}:</b> {surat.setuju_nama}<br />Tanggal disetujui: <b>{fmtWaktu(surat.setuju_pada)}</b><br />
        {surat.setuju_ttd_url && <img src={surat.setuju_ttd_url} alt="TTD" style={{ height: 64, margin: '6px 0', background: '#fff' }} />}<br />
        <span className="mono" style={{ fontSize: 13 }}>Kode: {surat.setuju_kode}</span></div>}

      {bisaAjukan && <button className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, width: '100%' }} disabled={sibuk} onClick={() => panggil('ajukan_' + rpc, { p_id: surat.id })}>{st === 'revisi' || st === 'ditolak' ? 'Ajukan lagi setelah diperbaiki' : 'Ajukan untuk paraf & persetujuan'}</button>}
      {bisaParaf && <><div style={{ fontWeight: 700 }}>Paraf Sekretaris</div>{blokTtd}<button className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, width: '100%' }} disabled={sibuk || !ttdUrl} onClick={() => panggil('paraf_' + rpc, { p_id: surat.id, p_ttd: ttdUrl })}>Paraf & teruskan ke Kepala Markas/Ketua</button></>}
      {bisaSetuju && <><div style={{ fontWeight: 700 }}>Setujui & tanda tangan</div>{blokTtd}<button className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, width: '100%' }} disabled={sibuk || !ttdUrl} onClick={() => panggil('setujui_' + rpc, { p_id: surat.id, p_ttd: ttdUrl })}>Setujui & tanda tangani</button></>}
      {bisaKembali && !tipeKoreksi && (
        <div style={{ marginTop: 12, border: '1px solid #E5B4B4', borderRadius: 12, padding: 12, background: '#FFFAFA' }}>
          <div style={{ fontWeight: 700, color: '#B3261E', marginBottom: 8 }}>Ada yang tidak sesuai?</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <button className="btn btn-ghost" style={{ minHeight: 50, fontSize: 15, borderColor: '#B3261E', color: '#B3261E' }} onClick={() => { setTipeKoreksi('koreksi'); setAlasan('') }}>Perlu diperbaiki (kembali ke pembuat)</button>
            <button className="btn btn-ghost" style={{ minHeight: 50, fontSize: 15, borderColor: '#B3261E', color: '#B3261E' }} onClick={() => { setTipeKoreksi('tolak'); setAlasan('') }}>Tidak setuju (tolak surat)</button>
            {(peran.isAdmin || peran.tipe === 'pimpinan') && st === 'diparaf' && <button className="btn btn-ghost" style={{ minHeight: 50, fontSize: 15, borderColor: '#B3261E', color: '#B3261E' }} onClick={() => { setTipeKoreksi('ke_sekretaris'); setAlasan('') }}>↩ Kembalikan ke Sekretaris (paraf ulang)</button>}
          </div>
        </div>
      )}
      {tipeKoreksi && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, color: '#B3261E', marginBottom: 6 }}>{JUDUL_TIPE[tipeKoreksi]}</div>
          <KalimatCepat daftar={KALIMAT_TOLAK} onPilih={k => setAlasan(a => tambahKalimat(a, k))} judul="Sentuh alasan untuk memasukkan:" />
          <TombolBicara tampil={peran.tipe === 'pimpinan'} onTeks={t => setAlasan(a => tambahKalimat(a, t))} />
          {jenisSurat === 'keluar' && tipeKoreksi !== 'tolak' && (
            <button type="button" className="btn btn-primary" style={{ width: '100%', minHeight: 52, fontSize: 16, marginBottom: 10, background: 'linear-gradient(135deg,#E5333F,#B01028)' }} disabled={bukaCoret || sibuk} onClick={bukaEditorCoret}>
              {bukaCoret ? 'Membuka surat...' : '✎ Coret langsung di surat'}
            </button>
          )}
          <textarea rows={3} placeholder="Tulis catatan koreksi (minimal 5 huruf)" value={alasan} onChange={e => setAlasan(e.target.value)} style={{ fontSize: 16 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button className="btn btn-ghost" style={{ minHeight: 46 }} onClick={() => setTipeKoreksi('')}>Batal</button>
            <button className="btn btn-primary" style={{ minHeight: 46, flex: 1, background: '#B3261E', borderColor: '#B3261E' }} disabled={sibuk || alasan.trim().length < 5}
              onClick={async () => { const ok = await panggil('koreksi_' + rpc, { p_id: surat.id, p_tipe: tipeKoreksi, p_catatan: alasan }); if (ok) { setTipeKoreksi(''); setAlasan(''); muatRiwayat() } }}>
              {tipeKoreksi === 'tolak' ? 'Tolak surat' : tipeKoreksi === 'ke_sekretaris' ? 'Kembalikan ke Sekretaris' : 'Kembalikan untuk diperbaiki'}</button>
          </div>
        </div>
      )}
      {['revisi', 'ditolak'].includes(st) && <button className="btn btn-ghost" style={{ minHeight: 48, width: '100%', marginTop: 10, borderColor: '#B3261E', color: '#B3261E' }} onClick={async () => { const urlGambar = {}; for (const r of riwayat) for (const u of (r.gambar || [])) urlGambar[u] = await urlAman(supabase, u); cetakLembarKoreksi({ surat, riwayat, namaPencetak: peran.nama, jenis: rpc === 'surat_tugas' ? 'Surat Tugas' : 'Surat Keluar', urlGambar }) }}>Cetak lembar koreksi (tanda merah + coretan)</button>}
      {st === 'disetujui' && jenisSurat === 'keluar' && (
        <div style={{ marginTop: 12, border: '1px solid #BBD6C0', background: '#F3FAF4', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 800, color: '#2E7D32', marginBottom: 4 }}>{kirim.length ? 'Surat sudah dikirim' : 'Langkah berikutnya: kirim surat'}</div>
          <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 8 }}>{kirim.length ? kirim.map(k => `${k.dikirim_via}${k.penerima ? ' kepada ' + k.penerima : ''} (${k.status})`).join('; ') : `Tujuan: ${surat.tujuan_surat}.${surat.tembusan ? ' Tembusan: ' + String(surat.tembusan).split('\n').filter(Boolean).join(', ') + '.' : ''} Biro Umum mengirim, lalu mencatat pengirimannya di Ekspedisi.`}</div>
          <Link href="/ekspedisi" className="btn btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: 44 }}>{kirim.length ? 'Lihat di Ekspedisi' : 'Catat pengiriman di Ekspedisi'}</Link>
        </div>
      )}
      {st === 'disetujui' && <button className="btn btn-ghost" style={{ minHeight: 48, width: '100%', marginTop: 8 }} onClick={() => cetak({ surat, namaPencetak: peran.nama })}>Cetak lembar pengesahan (TTD + kode)</button>}
      {coret && <KoreksiCoret supabase={supabase} sumber={coret.sumber} suratId={surat.id} judul={`Koreksi — ${surat.nomor_surat || 'surat'}`} awalKeterangan={alasan} onSelesai={kirimCoretan} onClose={() => setCoret(null)} />}
    </Modal>
  )
}

function PerjalananSurat({ surat, riwayat, kirim, st }) {
  const ev = []
  if (surat.created_at) ev.push({ t: surat.created_at, judul: 'Surat dibuat & dicatat', oleh: surat.profiles?.nama_lengkap, warna: '#2E7D32' })
  if (surat.diajukan_pada && ['diajukan', 'diparaf', 'disetujui'].includes(st)) ev.push({ t: surat.diajukan_pada, judul: 'Diajukan ke Sekretaris', oleh: surat.profiles?.nama_lengkap, warna: '#2E7D32' })
  if (surat.paraf_pada) ev.push({ t: surat.paraf_pada, judul: 'Diparaf Sekretaris, diteruskan ke Kepala Markas/Ketua', oleh: surat.paraf_nama, warna: '#2E7D32' })
  if (surat.setuju_pada) ev.push({ t: surat.setuju_pada, judul: 'Disetujui dan ditandatangani ' + (surat.setuju_jabatan || ''), oleh: surat.setuju_nama, warna: '#2E7D32' })
  riwayat.forEach(r => ev.push({ t: r.created_at, judul: NAMA_TIPE[r.tipe] || 'Dikembalikan', oleh: r.oleh_nama ? `${r.oleh_nama} (${r.oleh_peran})` : '', catatan: r.catatan, warna: '#B3261E' }))
  kirim.forEach(k => {
    ev.push({ t: k.created_at, judul: `Dikirim via ${k.dikirim_via}${k.penerima ? ' kepada ' + k.penerima : ''}`, oleh: k.pengantar, warna: '#1F5E99' })
    if (k.status === 'diterima') ev.push({ t: k.tanggal_diterima || k.created_at, judul: 'Diterima oleh tujuan', oleh: k.penerima, warna: '#1F5E99' })
  })
  ev.sort((a, b) => new Date(a.t) - new Date(b.t))
  if (ev.length === 0) return null
  return (
    <details open style={{ marginBottom: 14 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 800, marginBottom: 8 }}>Perjalanan surat ({ev.length} kejadian)</summary>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {ev.map((e, i) => (
          <li key={i} style={{ display: 'flex', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: e.warna, marginTop: 5, flexShrink: 0 }} />
              {i < ev.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--line)', marginTop: 2 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 12 }}>
              <div style={{ fontWeight: 700, color: e.warna === '#B3261E' ? '#B3261E' : 'var(--ink)' }}>{e.judul}</div>
              {e.catatan && <div style={{ fontSize: 14, color: '#5A1010', background: '#FFF6F6', borderLeft: '3px solid #B3261E', padding: '4px 10px', margin: '3px 0', borderRadius: 6 }}>{e.catatan}</div>}
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtWaktu(e.t)}{e.oleh ? ' · ' + e.oleh : ''}</div>
            </div>
          </li>
        ))}
      </ol>
    </details>
  )
}
