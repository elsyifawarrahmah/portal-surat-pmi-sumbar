'use client'
// Lacak Surat: semua orang bisa melihat JEJAK surat (sampai di mana, sudah dibaca atau belum, tertahan di mana),
// tetapi isi surat hanya bisa dibuka oleh unit yang dituju. Dibuat seperti pelacakan naskah di Srikandi.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import Modal from '@/components/Modal'
import { fmtTgl, fmtWaktu, pesanGalat } from '@/lib/format'

const WARNA = {
  'Baru masuk': ['#EEE9E2', '#6B5E4F'], 'Diterima': ['#EEE9E2', '#6B5E4F'], 'Belum dibuka': ['#FBE7E7', '#B3261E'], 'Sudah dibaca': ['var(--gold-bg)', 'var(--gold)'],
  'Sedang diproses': ['#E4EEF9', '#1F5E99'], 'Selesai': ['#E7F4EA', '#2E7D32'], 'Diarsipkan': ['var(--stock-bg)', 'var(--stock)'],
  'Belum dikirim': ['#FBE7E7', '#B3261E'], 'Dikirim': ['var(--gold-bg)', 'var(--gold)'], 'Kembali': ['#F3E8FB', '#7B2CBF'],
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

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
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
  const tampil = useMemo(() => rows.filter(r => {
    if (filter === 'saya' && !(namaUnit && (r.untuk || '').includes(namaUnit))) return false
    if (filter === 'tertahan' && !(['Belum dibuka', 'Sudah dibaca', 'Sedang diproses', 'Diterima', 'Belum dikirim'].includes(r.status) && r.hari >= 3)) return false
    if (filter === 'selesai' && !['Selesai', 'Diarsipkan', 'Diterima'].includes(r.status)) return false
    if (filter === 'selesai' && r.jenis === 'masuk' && !['Selesai', 'Diarsipkan'].includes(r.status)) return false
    if (filter === 'keluar' && r.jenis !== 'keluar') return false
    if (cari && !`${r.nomor_agenda} ${r.untuk} ${r.posisi} ${r.dari || ''}`.toLowerCase().includes(cari.toLowerCase())) return false
    return true
  }).sort((a, b) => (a.sejak < b.sejak ? 1 : -1)), [rows, filter, cari, namaUnit])

  const ditahan = rows.filter(r => r.jenis === 'masuk' && ['Belum dibuka', 'Sudah dibaca', 'Sedang diproses', 'Diterima'].includes(r.status) && r.hari >= 3).length

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Lacak Surat</h1><p className="desc">Lihat surat sudah sampai di mana, sudah dibaca atau belum, dan tertahan di mana. Isi surat hanya bisa dibuka oleh yang dituju.</p></div></div>
      {pesan && <div className="error-box">{pesan}</div>}

      <div className="grid4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        <div className="stat" style={{ '--accent': 'var(--pmi-red)' }}><div className="lbl">Surat tercatat</div><div className="val">{rows.length}</div></div>
        <div className="stat" style={{ '--accent': '#B3261E' }}><div className="lbl">Tertahan ≥ 3 hari</div><div className="val">{ditahan}</div></div>
        <div className="stat" style={{ '--accent': 'var(--stock)' }}><div className="lbl">Selesai / diarsipkan</div><div className="val">{rows.filter(r => ['Selesai', 'Diarsipkan'].includes(r.status)).length}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <input placeholder="Cari nomor agenda atau nama bidang..." value={cari} onChange={e => setCari(e.target.value)} style={{ maxWidth: 300 }} />
            {FILTER.map(([k, l]) => <button key={k} type="button" className={'btn ' + (filter === k ? 'btn-primary' : 'btn-ghost')} style={{ minHeight: 40, padding: '6px 14px', fontSize: 13.5 }} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
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
                        <td data-label="Ditujukan ke">{r.jenis === 'keluar' ? <>Dari <b>{r.dari}</b></> : r.untuk}</td>
                        <td data-label="Sekarang di">{r.posisi}</td>
                        <td data-label="Keadaan"><span className="tag" style={{ background: bg, color: fg }}>{r.status}</span></td>
                        <td data-label="Lama" style={telat ? { color: '#B3261E', fontWeight: 700 } : null}>{r.hari <= 0 ? 'hari ini' : r.hari + ' hari'}</td>
                        <td data-label="" style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 12px', minHeight: 36, fontSize: 13, marginRight: 6 }} onClick={() => bukaJejak(r)}>Jejak</button>
                          {r.boleh_baca
                            ? <Link href={r.jenis === 'masuk' ? `/surat-masuk?disposisi=${r.surat_id}` : '/surat-keluar'} className="btn btn-primary" style={{ padding: '6px 12px', minHeight: 36, fontSize: 13, textDecoration: 'none' }}>Buka surat</Link>
                            : <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>🔒 isi hanya untuk yang dituju</span>}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

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
