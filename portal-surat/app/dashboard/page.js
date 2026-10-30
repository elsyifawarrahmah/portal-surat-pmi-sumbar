'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { labelTahap } from '@/lib/tahap'
import NotifikasiButton from '@/components/NotifikasiButton'
import { usePeran } from '@/lib/peran'
import { fmtTgl, fmtWaktu, sudahLewat, STATUS_DISPOSISI, statusTampil } from '@/lib/format'
import Link from 'next/link'

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [suratMasuk, setSuratMasuk] = useState([])
  const [suratKeluar, setSuratKeluar] = useState([])
  const [tertahan, setTertahan] = useState([])
  const [loading, setLoading] = useState(true)
  const peran = usePeran()
  const [dispSaya, setDispSaya] = useState([])
  const [panggilanSaya, setPanggilanSaya] = useState([])
  const [belumDisposisi, setBelumDisposisi] = useState(0)

  useEffect(() => { load() }, [])
  useEffect(() => { if (!peran.loading) muatTugas() }, [peran.loading])

  // Tugas untuk unit saya: disposisi yang belum selesai & panggilan dari Biro Umum (kosong bila migrasi belum dijalankan)
  async function muatTugas() {
    if (peran.unitId && !peran.isBiroUmum) {
      const d = await supabase.from('surat_disposisi_tujuan').select('id, status, batas_waktu, instruksi, disposisi:surat_disposisi(tanggal_diteruskan, surat:surat_masuk(nomor_surat, perihal, asal_surat, sifat))').eq('unit_id', peran.unitId).neq('status', 'selesai').order('created_at', { ascending: false }).limit(8)
      if (!d.error) setDispSaya(d.data || [])
      const p = await supabase.from('surat_panggilan').select('id, jenis, pesan, created_at').eq('unit_id', peran.unitId).is('selesai_pada', null).order('created_at', { ascending: false })
      if (!p.error) setPanggilanSaya(p.data || [])
    }
    if (peran.bisaPantau) {
      const [m, d] = await Promise.all([supabase.from('surat_masuk').select('id, created_at'), supabase.from('surat_disposisi').select('surat_id')])
      if (!m.error && !d.error) { const ada = new Set((d.data || []).map(x => x.surat_id)); setBelumDisposisi((m.data || []).filter(x => !ada.has(x.id) && Date.now() - new Date(x.created_at).getTime() >= 86400000).length) }
    }
  }

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
      <div className="main">
        <div className="topbar">
          <div><h1>Ringkasan Surat</h1><p className="desc">Ringkasan surat masuk dan keluar PMI Sumatera Barat.</p></div>
        </div>

        <NotifikasiButton />

        <div className="grid4">
          <div className="stat row-click" style={{'--accent':'var(--stock)'}} onClick={()=>router.push('/surat-masuk')}><div className="lbl">Total Surat Masuk</div><div className="val">{suratMasuk.length}</div></div>
          <div className="stat row-click" style={{'--accent':'var(--gold)'}} onClick={()=>router.push('/surat-keluar')}><div className="lbl">Total Surat Keluar</div><div className="val">{suratKeluar.length}</div></div>
          <div className="stat row-click" style={{'--accent':'var(--pmi-red)'}} onClick={()=>router.push('/surat-masuk')}><div className="lbl">Sedang Berjalan</div><div className="val">{tertahan.length}</div></div>
          <div className="stat row-click" style={{'--accent':'#B3261E'}} onClick={()=>router.push('/surat-masuk')}><div className="lbl">Tertahan ≥2 Hari</div><div className="val">{bermasalah.length}</div></div>
        </div>

        {panggilanSaya.length > 0 && (
          <div className="panel" style={{borderColor:'#B3261E'}}>
            <div className="panel-head"><h3>📣 Panggilan dari Biro Umum untuk {peran.unit?.nama}</h3><Link href="/pemantauan" className="btn btn-primary" style={{textDecoration:'none',minHeight:36,padding:'6px 14px',fontSize:13}}>Tindak lanjuti →</Link></div>
            <div className="panel-body">{panggilanSaya.map(p => <div key={p.id} style={{padding:'6px 0',borderBottom:'1px solid var(--line)',fontSize:14}}>{p.pesan}<div style={{fontSize:12,color:'var(--ink-soft)'}}>{fmtWaktu(p.created_at)}</div></div>)}</div>
          </div>
        )}

        {peran.unitId && !peran.isBiroUmum && (
          <div className="panel">
            <div className="panel-head"><h3>Disposisi untuk {peran.unit?.nama}</h3><Link href="/disposisi" style={{color:'var(--pmi-red)',fontWeight:700,textDecoration:'none',fontSize:14}}>Lihat semua →</Link></div>
            <div style={{overflowX:'auto'}}><table>
              <thead><tr><th>Diteruskan</th><th>Surat</th><th>Disposisi</th><th>Batas</th><th>Status</th></tr></thead>
              <tbody>{dispSaya.length === 0 ? <tr><td colSpan={5} style={{textAlign:'center',padding:22,color:'var(--ink-soft)'}}>Tidak ada disposisi yang menunggu. 👍</td></tr> : dispSaya.map(d => {
                const s = d.disposisi?.surat, st = STATUS_DISPOSISI[statusTampil(d)], rahasia = s?.sifat === 'Rahasia'
                return <tr key={d.id} className="row-click" onClick={()=>router.push('/disposisi')}>
                  <td data-label="Diteruskan">{fmtTgl(d.disposisi?.tanggal_diteruskan)}</td>
                  <td data-label="Surat">{rahasia ? '🔒 Rahasia' : `${s?.nomor_surat} — ${s?.perihal}`}</td>
                  <td data-label="Disposisi">{rahasia ? '-' : d.instruksi}</td>
                  <td data-label="Batas" style={sudahLewat(d.batas_waktu) ? {color:'#B3261E',fontWeight:700} : null}>{d.batas_waktu ? fmtTgl(d.batas_waktu) : '-'}</td>
                  <td data-label="Status"><span className="tag" style={st.style}>{st.label}</span></td>
                </tr>})}</tbody>
            </table></div>
          </div>
        )}

        {peran.bisaPantau && (
          <div className="grid4" style={{gridTemplateColumns:'repeat(2,1fr)'}}>
            <div className="stat row-click" style={{'--accent':'#B3261E'}} onClick={()=>router.push('/pemantauan')}><div className="lbl">Surat masuk belum didisposisi (≥1 hari)</div><div className="val">{belumDisposisi}</div></div>
            <div className="stat row-click" style={{'--accent':'var(--pmi-red)'}} onClick={()=>router.push('/pemantauan')}><div className="lbl">Buka Pemantauan Bidang →</div><div className="val" style={{fontSize:18}}>Siapa yang belum input surat?</div></div>
          </div>
        )}

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
                    <td data-label="Tertahan di Tahap">{labelTahap(t.nama_tahap)}</td>
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
