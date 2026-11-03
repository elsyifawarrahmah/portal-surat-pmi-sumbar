'use client'
// Surat Masuk (kotak masuk) gaya Srikandi: daftar sederhana, status jelas, klik untuk membuka.
import { useEffect, useMemo, useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import PeringatanUnit from '@/components/PeringatanUnit'
import { fmtTgl, pesanGalat } from '@/lib/format'
import { STATUS_SURAT, TAB_ISI, statusUntukSaya } from '@/lib/surat'

export default function SuratPage() { return <Suspense fallback={null}><Isi /></Suspense> }

function Isi() {
  const supabase = createClient()
  const router = useRouter()
  const params = useSearchParams()
  const peran = usePeran()
  const [surat, setSurat] = useState([])
  const [tujuan, setTujuan] = useState([])
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')
  const [tab, setTab] = useState(params.get('tab') || '')
  const [cari, setCari] = useState('')

  useEffect(() => { if (!peran.loading) load() }, [peran.loading])
  useEffect(() => {
    const ch = supabase.channel('surat-daftar').on('postgres_changes', { event: '*', schema: 'public', table: 'surat_disposisi_tujuan' }, () => load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_masuk' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    setLoading(true)
    const [s, t] = await Promise.all([
      supabase.from('surat_masuk').select('id, nomor_surat, nomor_agenda, asal_surat, perihal, tanggal_surat, tanggal_diterima_kantor, sifat, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('surat_disposisi_tujuan').select('unit_id, status, diarsipkan_pada, disposisi:surat_disposisi!disposisi_id(surat_id)').limit(5000),
    ])
    const g = s.error || t.error
    if (g) { setGalat(pesanGalat(g)); setLoading(false); return }
    setGalat(''); setSurat(s.data || []); setTujuan(t.data || []); setLoading(false)
  }

  const daftar = useMemo(() => {
    const peta = {}
    tujuan.forEach(x => { const id = x.disposisi?.surat_id; if (id) (peta[id] = peta[id] || []).push(x) })
    return surat.map(s => ({ s, kunci: statusUntukSaya(peta[s.id] || [], peran.unitId) }))
  }, [surat, tujuan, peran.unitId])

  const jumlah = k => daftar.filter(d => TAB_ISI[k].includes(d.kunci)).length
  const tabAktif = tab || (jumlah('belum') > 0 ? 'belum' : 'semua')
  const tampil = daftar.filter(d => (tabAktif === 'semua' || TAB_ISI[tabAktif]?.includes(d.kunci)) &&
    (!cari || `${d.s.perihal} ${d.s.asal_surat} ${d.s.nomor_surat} ${d.s.nomor_agenda}`.toLowerCase().includes(cari.toLowerCase())))

  const penuh = peran.aksesPenuh || peran.loading
  const TAB = [['belum', penuh ? 'Belum diteruskan' : 'Belum dibaca'], ['proses', penuh ? 'Sedang berjalan' : 'Sedang dikerjakan'], ['selesai', 'Selesai'], ['semua', 'Semua']]

  return (
    <div className="app"><div className="main kolom" style={{ '--lebar': '900px' }}>
      <div className="topbar">
        <div><h1>{penuh ? 'Surat Masuk' : 'Surat untuk Saya'}</h1><p className="desc">{penuh ? 'Semua surat yang masuk ke PMI Sumatera Barat.' : `Surat yang ditujukan ke ${peran.unit?.nama || 'unit kamu'}.`}</p></div>
        {peran.bisaCatatMasuk && <Link href="/surat-masuk?tambah=1" className="btn btn-primary" style={{ textDecoration: 'none', minHeight: 50, fontSize: 16 }}>+ Catat Surat Masuk</Link>}
      </div>
      <PeringatanUnit peran={peran} />
      {galat && <div className="error-box">{galat}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {TAB.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={'btn ' + (tabAktif === k ? 'btn-primary' : 'btn-ghost')} style={{ minHeight: 48, fontSize: 15.5, padding: '0 18px' }}>
            {l}{k !== 'semua' && jumlah(k) > 0 ? ` (${jumlah(k)})` : ''}
          </button>
        ))}
      </div>
      <input placeholder="🔍 Cari surat (perihal, pengirim, nomor)..." value={cari} onChange={e => setCari(e.target.value)} style={{ fontSize: 16, minHeight: 50, marginBottom: 14 }} />

      {loading && <div style={{ padding: 30, color: 'var(--ink-soft)' }}>Memuat...</div>}
      {!loading && tampil.length === 0 && (
        <div style={{ background: '#fff', border: '1px dashed var(--line)', borderRadius: 16, padding: 30, textAlign: 'center', fontSize: 16, color: 'var(--ink-soft)' }}>
          {daftar.length === 0 ? (peran.unitId || peran.isAdmin ? 'Belum ada surat.' : 'Belum ada surat yang bisa kamu lihat.') : 'Tidak ada surat di bagian ini. 👍'}
        </div>
      )}
      {tampil.slice(0, 200).map(({ s, kunci }) => {
        const st = STATUS_SURAT[kunci], baru = kunci === 'belum'
        return (
          <div key={s.id} onClick={() => router.push(`/surat/${s.id}`)} className="row-click"
            style={{ background: '#fff', border: '1px solid ' + (baru ? 'var(--pmi-red)' : 'var(--line)'), borderLeft: '6px solid ' + (baru ? 'var(--pmi-red)' : st.fg), borderRadius: 14, padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 18, fontWeight: baru ? 800 : 600, lineHeight: 1.3, flex: 1, minWidth: 200 }}>{s.perihal}</div>
              <span className="tag" style={{ background: st.bg, color: st.fg, fontSize: 13.5 }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-soft)', marginTop: 4 }}>Dari <b style={{ color: 'var(--ink)' }}>{s.asal_surat}</b> · {fmtTgl(s.tanggal_diterima_kantor || s.tanggal_surat)}{s.sifat && s.sifat !== 'Biasa' ? ` · ${s.sifat}` : ''}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 2 }}>No. {s.nomor_surat}{s.nomor_agenda ? ` · Agenda ${s.nomor_agenda}` : ''}</div>
          </div>
        )
      })}
      {tampil.length > 200 && <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Menampilkan 200 terbaru. Gunakan pencarian untuk yang lain.</div>}
    </div></div>
  )
}
