'use client'
// Surat masuk yang dibatalkan (bukan dihapus permanen). Bisa dipulihkan oleh pencatat, Biro Umum, atau admin.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import { fmtTgl, fmtWaktu } from '@/lib/format'

export default function SuratDibatalkanPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')

  useEffect(() => { if (!peran.loading) muat() }, [peran.loading])
  async function muat() {
    setLoading(true)
    const { data, error } = await supabase.rpc('daftar_surat_batal')
    setPesan(error ? (/function|schema cache|does not exist/i.test(error.message) ? 'Fitur ini belum aktif di database. Jalankan supabase/migrasi-batal-surat.sql di Supabase (SQL Editor) satu kali.' : error.message) : '')
    setRows(data || []); setLoading(false)
  }
  async function pulihkan(r) {
    if (!confirm(`Pulihkan surat "${r.perihal}"? Surat akan muncul kembali di daftar.`)) return
    const { error } = await supabase.rpc('pulihkan_surat_masuk', { p_id: r.id })
    if (error) alert(error.message); else muat()
  }

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Surat Dibatalkan</h1><p className="desc">Surat yang salah input atau dobel. Tidak dihapus permanen, jadi bisa dipulihkan kapan saja.</p></div></div>
      {pesan && <div className="error-box">{pesan}</div>}
      <div className="panel">
        {loading ? <div style={{ padding: 24 }}>Memuat...</div> : rows.length === 0 ? <div style={{ padding: 24, color: 'var(--ink-soft)', fontSize: 16 }}>Tidak ada surat yang dibatalkan.</div> :
          rows.map(r => (
            <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', margin: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{r.perihal}</div>
              <div style={{ fontSize: 14, color: 'var(--ink-soft)', margin: '4px 0 8px' }}>{r.nomor_surat} · dari {r.asal_surat} · diterima {fmtTgl(r.tanggal_diterima_kantor)}</div>
              <div style={{ fontSize: 15 }}><b>Alasan:</b> {r.alasan_batal}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 10px' }}>Dibatalkan oleh {r.dibatalkan_nama || '-'} · {fmtWaktu(r.dibatalkan_pada)}</div>
              <button className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => pulihkan(r)}>↩ Pulihkan surat</button>
            </div>
          ))}
      </div>
    </div></div>
  )
}
