'use client'
// Riwayat & Buku Agenda: semua surat masuk + keluar dengan waktu masuk ke sistem, garis waktu per surat, dan cetak.
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import RiwayatModal from '@/components/RiwayatModal'
import { Info } from '@/components/Modal'
import { fmtTgl, fmtWaktu, tabelBelumAda, PESAN_MIGRASI, unduhCsv } from '@/lib/format'
import { cetakDaftar } from '@/lib/cetak'

export default function RiwayatPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [masuk, setMasuk] = useState([])
  const [keluar, setKeluar] = useState([])
  const [terakhir, setTerakhir] = useState({})
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [fJenis, setFJenis] = useState('semua')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [search, setSearch] = useState('')
  const [buka, setBuka] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [m, k, r] = await Promise.all([
      supabase.from('surat_masuk').select('*').order('created_at', { ascending: false }).limit(3000),
      supabase.from('surat_keluar').select('*').order('created_at', { ascending: false }).limit(3000),
      supabase.from('surat_riwayat').select('surat_jenis, surat_id, aksi, waktu').order('waktu', { ascending: false }).limit(6000),
    ])
    if (m.error || k.error) setPesan('Gagal memuat data: ' + (m.error || k.error).message)
    else setPesan('')
    setMasuk(m.data || []); setKeluar(k.data || [])
    if (r.error) { if (tabelBelumAda(r.error)) setPesan(PESAN_MIGRASI) }
    else { const peta = {}; (r.data || []).forEach(x => { const key = x.surat_jenis + ':' + x.surat_id; if (!peta[key]) peta[key] = x }); setTerakhir(peta) }
    setLoading(false)
  }

  const semua = useMemo(() => [
    ...masuk.map(s => ({ jenis: 'masuk', s, tgl: s.created_at, agenda: s.nomor_agenda, nomor: s.nomor_surat, pihak: s.asal_surat, perihal: s.perihal, unit: s.macam_surat || '' })),
    ...keluar.map(s => ({ jenis: 'keluar', s, tgl: s.created_at, agenda: s.nomor_agenda, nomor: s.nomor_surat, pihak: s.tujuan_surat, perihal: s.perihal, unit: s.divisi || '' })),
  ].sort((a, b) => (a.tgl < b.tgl ? 1 : -1)), [masuk, keluar])

  const rahasia = r => r.s.sifat === 'Rahasia' && !peran.isAdmin
  const tampil = semua.filter(r => {
    if (fJenis !== 'semua' && r.jenis !== fJenis) return false
    const tglLokal = String(r.tgl).slice(0, 10)
    if (dari && tglLokal < dari) return false
    if (sampai && tglLokal > sampai) return false
    if (search && !(rahasia(r) ? '' : `${r.agenda} ${r.nomor} ${r.pihak} ${r.perihal} ${r.unit}`).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const kolom = [
    { judul: 'Waktu Masuk Sistem', k: 'waktu' }, { judul: 'Jenis', k: 'jenis' }, { judul: 'No. Agenda', k: 'agenda' }, { judul: 'Tgl Surat', k: 'tglsurat' }, { judul: 'No. Surat', k: 'nomor' },
    { judul: 'Asal / Tujuan', k: 'pihak' }, { judul: 'Perihal', k: 'perihal' }, { judul: 'Sifat', k: 'sifat' }, { judul: 'Status Terakhir', k: 'status' },
  ]
  const baris = () => tampil.filter(r => !rahasia(r)).map(r => ({
    waktu: fmtWaktu(r.tgl), jenis: r.jenis === 'masuk' ? 'Masuk' : 'Keluar', agenda: r.agenda || '', tglsurat: fmtTgl(r.s.tanggal_surat), nomor: r.nomor, pihak: r.pihak, perihal: r.perihal, sifat: r.s.sifat || '',
    status: terakhir[r.jenis + ':' + r.s.id] ? terakhir[r.jenis + ':' + r.s.id].aksi : '',
  }))
  const subjudul = `${fJenis === 'semua' ? 'Surat masuk & keluar' : fJenis === 'masuk' ? 'Surat masuk' : 'Surat keluar'}${dari || sampai ? ` · ${dari ? fmtTgl(dari) : 'awal'} s/d ${sampai ? fmtTgl(sampai) : 'sekarang'}` : ''}`

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Riwayat Surat</h1><p className="desc">Buku agenda digital: semua surat masuk dan keluar beserta waktu masuknya ke sistem. Klik surat untuk melihat riwayat lengkapnya.</p></div></div>
      {pesan && (pesan === PESAN_MIGRASI ? <Info>{pesan}</Info> : <div className="error-box">{pesan}</div>)}

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <input placeholder="Cari agenda / nomor / asal / perihal..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
            <select value={fJenis} onChange={e => setFJenis(e.target.value)} style={{ maxWidth: 170 }}><option value="semua">Masuk & keluar</option><option value="masuk">Surat masuk</option><option value="keluar">Surat keluar</option></select>
            <input type="date" value={dari} onChange={e => setDari(e.target.value)} style={{ maxWidth: 160 }} aria-label="Dari tanggal" />
            <input type="date" value={sampai} onChange={e => setSampai(e.target.value)} style={{ maxWidth: 160 }} aria-label="Sampai tanggal" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => cetakDaftar({ judul: fJenis === 'masuk' ? 'Buku Agenda Surat Masuk' : fJenis === 'keluar' ? 'Buku Agenda Surat Keluar' : 'Buku Agenda Surat Masuk & Keluar', subjudul, kolom, baris: baris(), namaPencetak: peran.nama })}>🖨 Cetak Buku Agenda</button>
            <button className="btn btn-ghost" onClick={() => unduhCsv('riwayat-surat', kolom.map(k => k.judul), baris().map(b => kolom.map(k => b[k.k])))}>⬇ CSV</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Waktu Masuk Sistem</th><th>Jenis</th><th>Agenda</th><th>No. Surat</th><th>Asal / Tujuan</th><th>Perihal</th><th>Status Terakhir</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Memuat...</td></tr> :
                tampil.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Tidak ada surat yang cocok.</td></tr> :
                  tampil.slice(0, 500).map(r => {
                    const sem = rahasia(r), t = terakhir[r.jenis + ':' + r.s.id]
                    return (
                      <tr key={r.jenis + r.s.id} className="row-click" onClick={() => { if (!sem) setBuka(r) }}>
                        <td data-label="Waktu masuk" className="mono" style={{ fontSize: 12.5 }}>{fmtWaktu(r.tgl)}</td>
                        <td data-label="Jenis"><span className="tag" style={r.jenis === 'masuk' ? { background: 'var(--stock-bg)', color: 'var(--stock)' } : { background: 'var(--gold-bg)', color: 'var(--gold)' }}>{r.jenis === 'masuk' ? 'Masuk' : 'Keluar'}</span></td>
                        <td data-label="Agenda" className="mono">{r.agenda || '-'}</td>
                        <td data-label="No. Surat" className="mono">{sem ? '••••••' : r.nomor}</td>
                        <td data-label="Asal/Tujuan">{sem ? '🔒 Rahasia' : r.pihak}</td>
                        <td data-label="Perihal">{sem ? 'Hanya admin yang bisa lihat' : r.perihal}</td>
                        <td data-label="Status">{sem ? '-' : t ? <>{t.aksi}<div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{fmtWaktu(t.waktu)}</div></> : '-'}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
          {tampil.length > 500 && <div style={{ padding: '10px 20px', fontSize: 12.5, color: 'var(--ink-soft)' }}>Menampilkan 500 terbaru dari {tampil.length}. Persempit dengan filter tanggal; cetak/CSV memuat semua hasil filter.</div>}
        </div>
      </div>
      {buka && <RiwayatModal supabase={supabase} jenis={buka.jenis} surat={buka.s} peran={peran} onClose={() => setBuka(null)} />}
    </div></div>
  )
}
