'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'

export default function LogAktivitasPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('viewer')
  const [search, setSearch] = useState('')

  const isAdmin = myRole === 'admin'

  useEffect(() => { load() }, [])

  async function load() {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
      if (profile) setMyRole(profile.role)
    }
    const { data } = await supabase.from('log_aktivitas').select('*, profiles:dilakukan_oleh(nama_lengkap)').order('waktu', { ascending: false }).limit(200)
    setLogs(data || [])
    setLoading(false)
  }

  if (!isAdmin && !loading) {
    return (
      <div className="app">
        <Sidebar />
        <div className="main">
          <div className="topbar"><div><h1>Log Aktivitas</h1><p className="desc">Halaman ini khusus admin.</p></div></div>
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'12px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>
            🔒 Kamu tidak punya akses ke halaman ini.
          </div>
        </div>
      </div>
    )
  }

  const filtered = logs.filter(l => JSON.stringify(l).toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div><h1>Log Aktivitas</h1><p className="desc">Jejak siapa menambah, mengubah, atau menghapus data — untuk akuntabilitas.</p></div>
        </div>
        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari nama / aksi..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:260}} />
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Waktu</th><th>Aksi</th><th>Data</th><th>Dilakukan Oleh</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={4} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length===0 ? <tr><td colSpan={4} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Belum ada aktivitas tercatat.</td></tr> :
                filtered.map(l => (
                  <tr key={l.id}>
                    <td className="mono" style={{fontSize:12.5}}>{new Date(l.waktu).toLocaleString('id-ID')}</td>
                    <td><span className="tag" style={aksiStyle(l.aksi)}>{aksiLabel(l.aksi)}</span></td>
                    <td>{l.ringkasan}</td>
                    <td>{l.profiles?.nama_lengkap || 'Sistem'}</td>
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

function aksiLabel(a) { return a === 'INSERT' ? 'Ditambah' : a === 'UPDATE' ? 'Diubah' : 'Dihapus' }
function aksiStyle(a) {
  if (a === 'INSERT') return { background: 'var(--stock-bg)', color: 'var(--stock)' }
  if (a === 'DELETE') return { background: '#FBE7E7', color: '#B3261E' }
  return { background: 'var(--gold-bg)', color: 'var(--gold)' }
}
