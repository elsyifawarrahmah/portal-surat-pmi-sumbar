'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const Svg = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{children}</svg>
)

const ICONS = {
  dashboard: <Svg><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></Svg>,
  masuk: <Svg><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></Svg>,
  keluar: <Svg><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Svg>,
  user: <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  log: <Svg><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>,
  backup: <Svg><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></Svg>,
  logout: <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>,
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/surat-masuk', label: 'Surat Masuk', icon: 'masuk' },
  { href: '/surat-keluar', label: 'Surat Keluar', icon: 'keluar' },
  { href: '/data-user', label: 'Data User', icon: 'user' },
  { href: '/log-aktivitas', label: 'Log Aktivitas', icon: 'log' },
  { href: '/backup', label: 'Backup Data', icon: 'backup' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

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

  function toggleMenu() {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) setMobileOpen(o => !o)
    else setCollapsed(c => !c)
  }

  return (
    <>
      <button className="hamburger-btn" onClick={toggleMenu} aria-label="Buka atau tutup menu"><span></span></button>
      {mobileOpen && <div className="backdrop" onClick={()=>setMobileOpen(false)} />}
      <div className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
        <div className="brand">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:9,background:'#fff',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 2px 6px rgba(0,0,0,.15)',position:'relative'}}>
              <div style={{position:'absolute',width:18,height:6,background:'var(--pmi-red)',borderRadius:1.5}}></div>
              <div style={{position:'absolute',width:6,height:18,background:'var(--pmi-red)',borderRadius:1.5}}></div>
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
              {ICONS[l.icon]}{l.label}
            </a>
          ))}
        </div>
        <div className="sidebar-foot">
          <button onClick={handleLogout} className="btn btn-ghost" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>{ICONS.logout}Keluar</button>
        </div>
      </div>
    </>
  )
}
