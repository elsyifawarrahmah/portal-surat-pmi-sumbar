'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'

export default function Dashboard() {
  const supabase = createClient()
  const [suratMasuk, setSuratMasuk] = useState([])
  const [suratKeluar, setSuratKeluar] = useState([])
  const [tertahan, setTertahan] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const [sm, sk, th] = await Promise.all([
      supabase.from('surat_masuk').select('*'),
      supabase.from('surat_keluar').select('*'),
      supabase.from('surat_tahapan').select('*, surat_masuk(nomor_surat, perihal, asal_surat)').is('tanggal_diteruskan', null).not('tanggal_diterima', 'is', null),
    ])
    setSuratMasuk(sm.data || [])
    setSuratKeluar(sk.data || [])
    setTertahan((th.data || []).map(t => ({ ...t, hari: Math.floor((Date.now() - new Date(t.tanggal_diterima).getTime()) / (1000*60*60*24)) })).sort((a,b)=>b.hari-a.hari))
    setLoading(false)
  }

  const bermasalah = tertahan.filter(t => t.hari >= 2)

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div><h1>Ringkasan Surat</h1><p className="desc">Pantau surat mana yang lagi tertahan di siapa.</p></div>
        </div>

        <div className="grid4">
          <div className="stat" style={{'--accent':'var(--stock)'}}><div className="lbl">Total Surat Masuk</div><div className="val">{suratMasuk.length}</div></div>
          <div className="stat" style={{'--accent':'var(--gold)'}}><div className="lbl">Total Surat Keluar</div><div className="val">{suratKeluar.length}</div></div>
          <div className="stat" style={{'--accent':'var(--pmi-red)'}}><div className="lbl">Sedang Berjalan</div><div className="val">{tertahan.length}</div></div>
          <div className="stat" style={{'--accent':'#B3261E'}}><div className="lbl">Tertahan ≥2 Hari</div><div className="val">{bermasalah.length}</div></div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>⚠ Surat yang Perlu Perhatian (tertahan 2 hari atau lebih)</h3></div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>No. Surat</th><th>Perihal</th><th>Asal</th><th>Tertahan di Tahap</th><th>Dipegang Oleh</th><th>Sudah Berapa Hari</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{textAlign:'center',padding:24}}>Memuat...</td></tr> :
                bermasalah.length===0 ? <tr><td colSpan={6} style={{textAlign:'center',padding:24,color:'var(--ink-soft)'}}>Tidak ada surat yang tertahan lama. Semua lancar 👍</td></tr> :
                bermasalah.map(t => (
                  <tr key={t.id}>
                    <td className="mono">{t.surat_masuk?.nomor_surat}</td>
                    <td>{t.surat_masuk?.perihal}</td>
                    <td>{t.surat_masuk?.asal_surat}</td>
                    <td>{t.nama_tahap}</td>
                    <td>{t.penerima_nama || '-'}</td>
                    <td><span className="tag" style={{background:'#FBE7E7',color:'#B3261E'}}>{t.hari} hari</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
