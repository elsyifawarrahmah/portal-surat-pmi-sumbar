'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'

export default function DataUserPage() {
  const supabase = createClient()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('viewer')
  const [search, setSearch] = useState('')

  const isAdmin = myRole === 'admin'

  useEffect(() => {
    load()
    const interval = setInterval(load, 20000) // refresh status online tiap 20 detik
    return () => clearInterval(interval)
  }, [])

  async function load() {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
      if (profile) setMyRole(profile.role)
    }
    const { data } = await supabase.from('profiles').select('*').order('nama_lengkap')
    setUsers(data || [])
    setLoading(false)
  }

  async function ubahRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  function isOnline(lastSeen) {
    if (!lastSeen) return false
    return (Date.now() - new Date(lastSeen).getTime()) < 90 * 1000 // online kalau ping < 90 detik lalu
  }

  const filtered = users.filter(u => (u.nama_lengkap || '').toLowerCase().includes(search.toLowerCase()) || (u.email || '').toLowerCase().includes(search.toLowerCase()))
  const onlineCount = users.filter(u => isOnline(u.last_seen)).length

  if (!isAdmin && !loading) {
    return (
      <div className="app">
        <Sidebar />
        <div className="main">
          <div className="topbar"><div><h1>Data User</h1><p className="desc">Halaman ini khusus admin.</p></div></div>
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'12px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>
            🔒 Kamu tidak punya akses ke halaman ini. Hubungi admin (Kabid) kalau butuh akses.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div><h1>Data User</h1><p className="desc">Semua akun yang terdaftar, dan siapa saja yang sedang online sekarang.</p></div>
        </div>

        <div className="grid4" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div className="stat" style={{'--accent':'var(--stock)'}}><div className="lbl">Total Akun</div><div className="val">{users.length}</div></div>
          <div className="stat" style={{'--accent':'var(--pmi-red)'}}><div className="lbl">Sedang Online</div><div className="val">{onlineCount}</div></div>
          <div className="stat" style={{'--accent':'var(--gold)'}}><div className="lbl">Admin</div><div className="val">{users.filter(u=>u.role==='admin').length}</div></div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari nama / email..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:260}} />
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Status</th><th>Nama</th><th>Email</th><th>Role</th><th>Terakhir Aktif</th><th>Ubah Role</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length===0 ? <tr><td colSpan={6} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Tidak ada user ditemukan.</td></tr> :
                filtered.map(u => {
                  const online = isOnline(u.last_seen)
                  return (
                    <tr key={u.id}>
                      <td>
                        <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color: online ? 'var(--stock)' : 'var(--ink-soft)'}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background: online ? '#2FA84F' : '#C9C1B8',display:'inline-block'}}></span>
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td><strong>{u.nama_lengkap}</strong></td>
                      <td>{u.email || '-'}</td>
                      <td><span className="tag" style={u.role==='admin' ? {background:'var(--stock-bg)',color:'var(--stock)'} : {background:'var(--cream)',color:'var(--ink-soft)'}}>{u.role}</span></td>
                      <td style={{fontSize:12.5,color:'var(--ink-soft)'}}>{u.last_seen ? new Date(u.last_seen).toLocaleString('id-ID') : 'Belum pernah'}</td>
                      <td>
                        <select value={u.role} onChange={e=>ubahRole(u.id, e.target.value)} style={{padding:'5px 8px',fontSize:12.5}}>
                          <option value="admin">admin</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
