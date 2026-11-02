'use client'
// Beranda gaya Srikandi: kotak besar yang bisa diklik, lalu daftar surat terbaru.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import NotifikasiButton from '@/components/NotifikasiButton'
import PeringatanUnit from '@/components/PeringatanUnit'
import { fmtTgl, fmtWaktu } from '@/lib/format'
import { STATUS_SURAT, statusUntukSaya } from '@/lib/surat'

function Kotak({ angka, judul, ket, warna, href }) {
  return (
    <Link href={href} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid var(--line)', borderTop: `6px solid ${warna}`, borderRadius: 16, padding: '18px 20px', minHeight: 140 }}>
      <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: warna }}>{angka}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{judul}</div>
      <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 2 }}>{ket}</div>
    </Link>
  )
}

export default function Beranda() {
  const supabase = createClient()
  const router = useRouter()
  const peran = usePeran()
  const [surat, setSurat] = useState([])
  const [tujuan, setTujuan] = useState([])
  const [panggilan, setPanggilan] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!peran.loading) load() }, [peran.loading])
  useEffect(() => {
    const ch = supabase.channel('beranda').on('postgres_changes', { event: '*', schema: 'public', table: 'surat_disposisi_tujuan' }, () => load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_masuk' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const [s, t] = await Promise.all([
      supabase.from('surat_masuk').select('id, nomor_surat, asal_surat, perihal, tanggal_diterima_kantor, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('surat_disposisi_tujuan').select('unit_id, status, diarsipkan_pada, created_at, disposisi:surat_disposisi!disposisi_id(surat_id)').limit(5000),
    ])
    setSurat(s.data || []); setTujuan(t.data || [])
    if (peran.unitId) {
      const p = await supabase.from('surat_panggilan').select('id, pesan, created_at').eq('unit_id', peran.unitId).is('selesai_pada', null).order('created_at', { ascending: false })
      setPanggilan(p.error ? [] : p.data || [])
    }
    setLoading(false)
  }

  const peta = {}
  tujuan.forEach(x => { const id = x.disposisi?.surat_id; if (id) (peta[id] = peta[id] || []).push(x) })
  const daftar = surat.map(s => ({ s, kunci: statusUntukSaya(peta[s.id] || [], peran.unitId) }))
  const hit = (...k) => daftar.filter(d => k.includes(d.kunci)).length
  const penuh = peran.aksesPenuh
  const terbaru = daftar.filter(d => ['belum', 'belum_diteruskan'].includes(d.kunci)).slice(0, 5)

  return (
    <div className="app"><div className="main" style={{ maxWidth: 980 }}>
      <div className="topbar"><div><h1>Halo, {peran.nama || '...'} 👋</h1><p className="desc">{peran.isAdmin ? 'Admin web' : peran.unit?.nama || ''}</p></div></div>
      <PeringatanUnit peran={peran} />

      {panggilan.length > 0 && (
        <div style={{ background: '#FBE7E7', border: '1px solid #B3261E', borderRadius: 16, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#B3261E', marginBottom: 4 }}>📣 Ada panggilan dari Biro Umum</div>
          {panggilan.slice(0, 2).map(p => <div key={p.id} style={{ fontSize: 15.5, marginBottom: 4 }}>{p.pesan}</div>)}
          <Link href="/pemantauan" className="btn btn-primary" style={{ textDecoration: 'none', minHeight: 46, marginTop: 6 }}>Lihat dan tanggapi →</Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBottom: 22 }}>
        {penuh ? <>
          <Kotak href="/surat?tab=belum" angka={loading ? '…' : hit('belum_diteruskan')} judul="Belum diteruskan" ket="Surat baru yang belum didisposisikan" warna="#B3261E" />
          <Kotak href="/surat?tab=proses" angka={loading ? '…' : hit('berjalan')} judul="Sedang berjalan" ket="Sedang dikerjakan bidang tujuan" warna="#1F5E99" />
          <Kotak href="/surat?tab=selesai" angka={loading ? '…' : hit('selesai')} judul="Menunggu diarsipkan" ket="Sudah selesai, tinggal diarsipkan" warna="#2E7D32" />
        </> : <>
          <Kotak href="/surat?tab=belum" angka={loading ? '…' : hit('belum')} judul="Belum dibaca" ket="Surat baru untuk bidangmu" warna="#B3261E" />
          <Kotak href="/surat?tab=proses" angka={loading ? '…' : hit('proses')} judul="Sedang dikerjakan" ket="Sudah kamu baca, belum selesai" warna="#1F5E99" />
          <Kotak href="/surat?tab=selesai" angka={loading ? '…' : hit('selesai', 'arsip')} judul="Selesai" ket="Sudah kamu kerjakan" warna="#2E7D32" />
        </>}
      </div>

      <h3 style={{ fontSize: 19, margin: '0 0 10px' }}>{penuh ? 'Surat yang perlu diteruskan' : 'Surat baru untuk kamu'}</h3>
      {loading ? <div style={{ color: 'var(--ink-soft)' }}>Memuat...</div> : terbaru.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed var(--line)', borderRadius: 16, padding: 24, textAlign: 'center', fontSize: 16, color: 'var(--ink-soft)' }}>Tidak ada surat baru. 👍</div>
      ) : terbaru.map(({ s, kunci }) => (
        <div key={s.id} onClick={() => router.push(`/surat/${s.id}`)} className="row-click" style={{ background: '#fff', border: '1px solid var(--pmi-red)', borderLeft: '6px solid var(--pmi-red)', borderRadius: 14, padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{s.perihal}</div>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)' }}>Dari <b style={{ color: 'var(--ink)' }}>{s.asal_surat}</b> · {fmtTgl(s.tanggal_diterima_kantor)}</div>
        </div>
      ))}

      <div style={{ marginTop: 24 }}><NotifikasiButton /></div>
    </div></div>
  )
}
