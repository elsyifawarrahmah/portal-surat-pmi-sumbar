'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'
import NotifikasiButton from '@/components/NotifikasiButton'

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [suratMasuk, setSuratMasuk] = useState([])
  const [suratKeluar, setSuratKeluar] = useState([])
  const [tertahan, setTertahan] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  useEffect(() => {
    const channel = supabase
      .channel('surat-masuk-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_masuk' }, () => {
        playChime()
        load()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const beep = (freq, start, dur) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + start)
        gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur)
      }
      beep(880, 0, 0.15)
      beep(1175, 0.15, 0.2)
    } catch (e) { /* browser tidak izinkan audio otomatis, abaikan */ }
  }

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
          <div><h1>Ringkasan Surat</h1><p className="desc">Ringkasan surat masuk dan keluar PMI Sumatera Barat.</p></div>
        </div>

        <NotifikasiButton />

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
              <thead><tr><th>No. Surat</th><th>Perihal</th><th>Asal</th><th>Tertahan di Tahap</th><th>Dipegang Oleh</th><th>Sudah Berapa Hari</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} style={{textAlign:'center',padding:24}}>Memuat...</td></tr> :
                bermasalah.length===0 ? <tr><td colSpan={7} style={{textAlign:'center',padding:24,color:'var(--ink-soft)'}}>Tidak ada surat yang tertahan lama. Semua lancar 👍</td></tr> :
                bermasalah.map(t => (
                  <tr key={t.id} className="row-click" onClick={()=>router.push(`/surat-masuk?open=${t.surat_id}`)}>
                    <td data-label="No. Surat" className="mono">{t.surat_masuk?.nomor_surat}</td>
                    <td data-label="Perihal">{t.surat_masuk?.perihal}</td>
                    <td data-label="Asal">{t.surat_masuk?.asal_surat}</td>
                    <td data-label="Tertahan di Tahap">{t.nama_tahap}</td>
                    <td data-label="Dipegang Oleh">{t.penerima_nama || '-'}</td>
                    <td data-label="Sudah Berapa Hari"><span className="tag" style={{background:'#FBE7E7',color:'#B3261E'}}>{t.hari} hari</span></td>
                    <td style={{color:'var(--ink-soft)',textAlign:'right'}}>→</td>
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
