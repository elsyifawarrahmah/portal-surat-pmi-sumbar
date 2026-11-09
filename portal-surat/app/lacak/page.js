'use client'
// Lacak Surat: semua orang bisa melihat JEJAK surat (sampai di mana, sudah dibaca atau belum, tertahan di mana),
// tetapi isi surat hanya bisa dibuka oleh unit yang dituju. Dibuat seperti pelacakan naskah di Srikandi.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { kabarkan } from '@/lib/notif'
import { createClient } from '@/lib/supabase-browser'
import { usePeran, useUnits } from '@/lib/peran'
import KontakModal from '@/components/KontakModal'
import Modal from '@/components/Modal'
import { fmtTgl, fmtWaktu, pesanGalat } from '@/lib/format'

const WARNA = {
  'Baru masuk': ['#EEE9E2', '#6B5E4F'], 'Diterima': ['#EEE9E2', '#6B5E4F'], 'Belum dibuka': ['#FBE7E7', '#B3261E'], 'Sudah dibaca': ['var(--gold-bg)', 'var(--gold)'],
  'Sedang diproses': ['#E4EEF9', '#1F5E99'], 'Selesai': ['#E7F4EA', '#2E7D32'], 'Diarsipkan': ['var(--stock-bg)', 'var(--stock)'],
  'Belum dikirim': ['#FBE7E7', '#B3261E'], 'Dikirim': ['var(--gold-bg)', 'var(--gold)'], 'Kembali': ['#F3E8FB', '#7B2CBF'],
}
// Penanda keadaan per penerima: ikon + warna, supaya jelas sudah dibaca atau belum
const CHIP = {
  'belum dibuka': ['🔴', 'Belum dibuka', '#FBE7E7', '#B3261E'],
  'sudah dibaca': ['👁️', 'Sudah dibaca', 'var(--gold-bg)', 'var(--gold)'],
  'sedang diproses': ['⚙️', 'Sedang diproses', '#E4EEF9', '#1F5E99'],
}
function uraiPosisi(teks) {
  return String(teks || '').split(/,\s*/).map(x => { const m = x.match(/^(.*?)\s*\(([^)]+)\)\s*$/); return m ? { unit: m[1].trim(), status: m[2].trim().toLowerCase() } : { unit: x.trim(), status: '' } }).filter(x => x.unit)
}
const FILTER = [['semua', 'Semua'], ['saya', 'Untuk unit saya'], ['tertahan', 'Tertahan ≥ 3 hari'], ['selesai', 'Selesai / diarsipkan'], ['keluar', 'Surat keluar']]

export default function LacakPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [filter, setFilter] = useState('semua')
  const [cari, setCari] = useState('')
  const [jejak, setJejak] = useState(null)
  const [garis, setGaris] = useState([])
  const [muatGaris, setMuatGaris] = useState(false)
  const { units } = useUnits()
  const [hubungi, setHubungi] = useState(null)   // { unit, pesan }
  const [milikSaya, setMilikSaya] = useState(null) // Tata Usaha: hanya surat yang ia catat

  useEffect(() => { if (!peran.loading) load() }, [peran.loading])
  async function load() {
    setLoading(true)
    if (peran.isTataUsaha) {
      const [a, b] = await Promise.all([supabase.from('surat_masuk').select('id'), supabase.from('surat_keluar').select('id')])
      setMilikSaya(new Set([...(a.data || []), ...(b.data || [])].map(x => x.id)))
    } else setMilikSaya(null)
    const { data, error } = await supabase.rpc('lacak_surat')
    if (error) { setPesan(pesanGalat(error)); setRows([]) } else { setPesan(''); setRows(data || []) }
    setLoading(false)
  }
  async function bukaJejak(r) {
    setJejak(r); setGaris([]); setMuatGaris(true)
    const { data } = await supabase.rpc('lacak_riwayat', { p_jenis: r.jenis, p_surat: r.surat_id })
    setGaris(data || []); setMuatGaris(false)
  }

  const namaUnit = peran.unit?.nama || ''
  // Tata Usaha: surat yang dicatat tetapi belum dilaporkan/dikirim ke Biro Umum
  const belumLapor = r => peran.isTataUsaha && r.jenis === 'masuk' && r.untuk === 'Belum didisposisikan'
  const [kirimSibuk, setKirimSibuk] = useState(false)
  async function kirimKeBiro(daftar) {
    setKirimSibuk(true); let gagal = 0, pesanGagal = ''
    for (const r of daftar) { const { error } = await supabase.rpc('kirim_ke_biro_umum', { p_surat: r.surat_id }); if (error) { gagal++; pesanGagal = error.message } else kabarkan('surat', r.surat_id) }
    setKirimSibuk(false)
    if (gagal) alert(`${gagal} surat belum terkirim: ` + (/function|schema cache|does not exist/i.test(pesanGagal) ? 'jalankan supabase/migrasi-tata-usaha.sql dulu.' : pesanGagal))
    load()
  }
  const unitBiro = units.find(u => u.tipe === 'biro_umum')
  function bukaHubungi(r) {
    const pesanWa = `Selamat pagi/siang, saya dari ${namaUnit || 'PMI Sumbar'}. Mohon dicek surat agenda ${r.nomor_agenda || '-'} (${r.jenis === 'masuk' ? 'surat masuk' : 'surat keluar'}), statusnya masih "${r.status}" sudah ${r.hari <= 0 ? 'hari ini' : r.hari + ' hari'}. Terima kasih.`
    // Tata Usaha selalu menghubungi Biro Umum; unit lain menghubungi unit yang belum membuka suratnya
    let unit = unitBiro
    if (!peran.isTataUsaha) {
      const p = uraiPosisi(r.posisi); const target = p.find(x => x.status === 'belum dibuka') || p[0]
      unit = units.find(u => target && u.nama === target.unit) || unitBiro
    }
    if (unit) setHubungi({ unit, pesan: pesanWa })
  }
  const tampil = useMemo(() => rows.filter(r => {
    if (milikSaya && !milikSaya.has(r.surat_id)) return false
    if (filter === 'saya' && !(namaUnit && (r.untuk || '').includes(namaUnit))) return false
    if (filter === 'tertahan' && !(['Belum dibuka', 'Sudah dibaca', 'Sedang diproses', 'Diterima', 'Belum dikirim'].includes(r.status) && r.hari >= 3)) return false
    if (filter === 'selesai' && !['Selesai', 'Diarsipkan', 'Diterima'].includes(r.status)) return false
    if (filter === 'selesai' && r.jenis === 'masuk' && !['Selesai', 'Diarsipkan'].includes(r.status)) return false
    if (filter === 'keluar' && r.jenis !== 'keluar') return false
    if (filter === 'belum_lapor' && !belumLapor(r)) return false
    if (cari && !`${r.nomor_agenda} ${r.untuk} ${r.posisi} ${r.dari || ''}`.toLowerCase().includes(cari.toLowerCase())) return false
    return true
  }).sort((a, b) => (a.sejak < b.sejak ? 1 : -1)), [rows, filter, cari, namaUnit, milikSaya])

  const dasar = milikSaya ? rows.filter(r => milikSaya.has(r.surat_id)) : rows
  const ditahan = dasar.filter(r => r.jenis === 'masuk' && ['Belum dibuka', 'Sudah dibaca', 'Sedang diproses', 'Diterima'].includes(r.status) && r.hari >= 3).length

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Lacak Surat</h1><p className="desc">Lihat surat sudah sampai di mana, sudah dibaca atau belum, dan tertahan di mana. Isi surat hanya bisa dibuka oleh yang dituju.</p></div></div>
      {pesan && <div className="error-box">{pesan}</div>}

      {peran.isTataUsaha && dasar.filter(belumLapor).length > 0 && (
        <div style={{ background: '#FBE7E7', border: '2px solid #B3261E', borderRadius: 14, padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 16 }}>⚠️ <b>{dasar.filter(belumLapor).length} surat belum dikirim ke Biro Umum.</b> Biro Umum belum tahu surat ini sudah masuk.</div>
          <button className="btn btn-primary" style={{ minHeight: 48 }} disabled={kirimSibuk} onClick={() => kirimKeBiro(dasar.filter(belumLapor))}>{kirimSibuk ? 'Mengirim...' : '📤 Kirim semua ke Biro Umum'}</button>
        </div>
      )}

      <div className="grid4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        <div className="stat" style={{ '--accent': 'var(--pmi-red)' }}><div className="lbl">Surat tercatat</div><div className="val">{dasar.length}</div></div>
        <div className="stat" style={{ '--accent': '#B3261E' }}><div className="lbl">Tertahan ≥ 3 hari</div><div className="val">{ditahan}</div></div>
        <div className="stat" style={{ '--accent': 'var(--stock)' }}><div className="lbl">Selesai / diarsipkan</div><div className="val">{dasar.filter(r => ['Selesai', 'Diarsipkan'].includes(r.status)).length}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <input placeholder="Cari nomor agenda atau nama bidang..." value={cari} onChange={e => setCari(e.target.value)} style={{ maxWidth: 300 }} />
            {(peran.isTataUsaha ? [...FILTER.filter(([k]) => k !== 'saya'), ['belum_lapor', '⚠️ Belum dikirim ke Biro']] : FILTER).map(([k, l]) => <button key={k} type="button" className={'btn ' + (filter === k ? 'btn-primary' : 'btn-ghost')} style={{ minHeight: 40, padding: '6px 14px', fontSize: 13.5 }} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
        </div>
        <div style={{ padding: '10px 20px', fontSize: 14, color: 'var(--ink-soft)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>🔴 <b>Belum dibuka</b></span><span>👁️ <b>Sudah dibaca</b></span><span>⚙️ <b>Sedang diproses</b></span><span>✅ <b>Selesai</b></span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>No. Agenda</th><th>Ditujukan ke</th><th>Sekarang ada di</th><th>Keadaan</th><th>Lama</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30 }}>Memuat...</td></tr> :
                tampil.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>{rows.length === 0 ? 'Belum ada surat.' : 'Tidak ada surat yang cocok.'}</td></tr> :
                  tampil.slice(0, 300).map(r => {
                    const [bg, fg] = WARNA[r.status] || ['#EEE9E2', '#6B5E4F']
                    const telat = r.hari >= 3 && !['Selesai', 'Diarsipkan', 'Diterima', 'Dikirim'].includes(r.status)
                    return (
                      <tr key={r.jenis + r.surat_id}>
                        <td data-label="No. Agenda"><b className="mono">{r.nomor_agenda || '-'}</b><div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{r.jenis === 'masuk' ? 'Surat masuk' : 'Surat keluar'} · {fmtTgl(r.tanggal)}</div></td>
                        <td data-label="Ditujukan ke">{r.jenis === 'keluar' ? <>Dari <b>{r.dari}</b></> : belumLapor(r) ? <b style={{ color: '#B3261E' }}>⚠️ Belum dikirim ke Biro Umum</b> : r.untuk}</td>
                        <td data-label="Sekarang di">{belumLapor(r) ? <b>Masih di Tata Usaha</b> : uraiPosisi(r.posisi).map((x, i) => { const c = CHIP[x.status]; return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}><b>{x.unit}</b>{c && <span className="tag" style={{ background: c[2], color: c[3] }}>{c[0]} {c[1]}</span>}</div> })}</td>
                        <td data-label="Keadaan"><span className="tag" style={{ background: bg, color: fg }}>{({ 'Belum dibuka': '🔴 ', 'Sudah dibaca': '👁️ ', 'Sedang diproses': '⚙️ ', 'Selesai': '✅ ', 'Diarsipkan': '🗄️ ' })[r.status] || ''}{r.status}</span></td>
                        <td data-label="Lama" style={telat ? { color: '#B3261E', fontWeight: 700 } : null}>{r.hari <= 0 ? 'hari ini' : r.hari + ' hari'}</td>
                        <td data-label="" style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 12px', minHeight: 36, fontSize: 13, marginRight: 6 }} onClick={() => bukaJejak(r)}>Jejak</button>
                          {belumLapor(r) && <button className="btn btn-primary" style={{ padding: '4px 12px', minHeight: 36, fontSize: 13, marginRight: 6 }} disabled={kirimSibuk} onClick={() => kirimKeBiro([r])}>📤 Kirim ke Biro Umum</button>}
                          {!belumLapor(r) && !['Selesai', 'Diarsipkan', 'Diterima', 'Dikirim'].includes(r.status) && <button className="btn btn-ghost" style={{ padding: '4px 12px', minHeight: 36, fontSize: 13, marginRight: 6, ...(telat || r.status === 'Belum dibuka' ? { borderColor: '#B3261E', color: '#B3261E' } : {}) }} onClick={() => bukaHubungi(r)}>📞 Hubungi</button>}
                          {r.boleh_baca
                            ? <Link href={r.jenis === 'masuk' ? `/surat/${r.surat_id}` : '/surat-keluar'} className="btn btn-primary" style={{ padding: '6px 12px', minHeight: 36, fontSize: 13, textDecoration: 'none' }}>Buka surat</Link>
                            : <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>🔒 isi hanya untuk yang dituju</span>}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {hubungi && <KontakModal supabase={supabase} unit={hubungi.unit} pesan={hubungi.pesan} onClose={() => setHubungi(null)} />}
      {jejak && (
        <Modal judul={`Jejak surat ${jejak.nomor_agenda || ''}`} onClose={() => setJejak(null)} lebar={560}>
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 14 }}>
            <b>{jejak.jenis === 'masuk' ? 'Surat masuk' : 'Surat keluar'}</b> · Sekarang di: <b>{jejak.posisi}</b><br />
            <span style={{ color: 'var(--ink-soft)' }}>{jejak.status} · {jejak.hari <= 0 ? 'hari ini' : jejak.hari + ' hari'}</span>
          </div>
          {muatGaris && <div style={{ color: 'var(--ink-soft)' }}>Memuat...</div>}
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {garis.map((g, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, paddingBottom: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ width: 12, height: 12, borderRadius: '50%', background: i === garis.length - 1 ? 'var(--pmi-red)' : 'var(--stock)', marginTop: 5 }} />
                  {i < garis.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--line)', marginTop: 2 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{g.aksi}</div>
                  {g.keterangan && <div style={{ fontSize: 13.5 }}>{g.keterangan}</div>}
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtWaktu(g.waktu)}{g.unit_nama ? ` · ${g.unit_nama}` : ''}</div>
                </div>
              </li>
            ))}
          </ol>
          {!muatGaris && garis.length === 0 && <div style={{ color: 'var(--ink-soft)' }}>Belum ada jejak tercatat.</div>}
          {!jejak.boleh_baca && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>🔒 Isi dan catatan surat hanya terlihat oleh unit yang dituju.</div>}
        </Modal>
      )}
    </div></div>
  )
}
