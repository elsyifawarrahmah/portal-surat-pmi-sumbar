'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/surat-masuk', label: 'Surat Masuk' },
  { href: '/surat-keluar', label: 'Surat Keluar' },
  { href: '/data-user', label: 'Data User' },
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
            <img src="/logo-pmi.png?v=3" alt="Logo PMI" style={{width:32,height:32,flexShrink:0}} />
            <div style={{lineHeight:1.25}}>
              <div style={{fontWeight:700,fontSize:13.5}}>Palang Merah Indonesia</div>
              <div style={{fontSize:11.5,opacity:.85}}>Provinsi Sumatera Barat</div>
            </div>
          </div>
          <div style={{fontSize:10.5,opacity:.65,marginTop:8,letterSpacing:'.03em',textTransform:'uppercase'}}>Portal Surat Digital</div>
        </div>
        <div className="nav">
          {LINKS.map(l => <a key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>{l.label}</a>)}
        </div>
        <div className="sidebar-foot">
          <button onClick={handleLogout} className="btn btn-ghost" style={{width:'100%'}}>Keluar</button>
        </div>
      </div>
    </>
  )
}
