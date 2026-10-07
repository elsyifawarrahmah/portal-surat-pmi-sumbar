'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/surat-masuk', label: 'Surat Masuk', icon: '📥' },
  { href: '/surat-keluar', label: 'Surat Keluar', icon: '📤' },
  { href: '/data-user', label: 'Data User', icon: '👥' },
  { href: '/log-aktivitas', label: 'Log Aktivitas', icon: '🕓' },
  { href: '/backup', label: 'Backup Data', icon: '🗄️' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    async function ping() {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user) {
        await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', userData.user.id)
      }
    }
    ping()
    const interval = setInterval(ping, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login'); router.refresh()
  }

  return (
    <>
      <button className="hamburger-btn" onClick={()=>setCollapsed(c=>!c)} aria-label="Buka/tutup menu"><span></span></button>
      <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
        <div className="brand">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{
              width:36, height:36, borderRadius:9, background:'#fff', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,.15)',
              position:'relative'
            }}>
              <div style={{position:'absolute', width:18, height:6, background:'var(--pmi-red)', borderRadius:1.5}}></div>
              <div style={{position:'absolute', width:6, height:18, background:'var(--pmi-red)', borderRadius:1.5}}></div>
            </div>
            <div style={{lineHeight:1.25}}>
              <div style={{fontWeight:700,fontSize:13.5}}>Palang Merah Indonesia</div>
              <div style={{fontSize:11.5,opacity:.85}}>Provinsi Sumatera Barat</div>
            </div>
          </div>
          <div style={{fontSize:10.5,opacity:.65,marginTop:8,letterSpacing:'.03em',textTransform:'uppercase'}}>Portal Surat Digital</div>
        </div>
        <div className="nav">
          {LINKS.map(l => (
            <a key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              <span style={{marginRight:8}}>{l.icon}</span>{l.label}
            </a>
          ))}
        </div>
        <div className="sidebar-foot">
          <button onClick={handleLogout} className="btn btn-ghost" style={{width:'100%'}}>🚪 Keluar</button>
        </div>
      </div>
    </>
  )
}
