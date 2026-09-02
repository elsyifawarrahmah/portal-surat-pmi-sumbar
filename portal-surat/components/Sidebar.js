'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/surat-masuk', label: 'Surat Masuk' },
  { href: '/surat-keluar', label: 'Surat Keluar' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login'); router.refresh()
  }

  return (
    <div className="sidebar">
      <div className="brand">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/logo-pmi.svg?v=2" alt="Logo PMI" style={{width:32,height:32,flexShrink:0}} />
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
  )
}
