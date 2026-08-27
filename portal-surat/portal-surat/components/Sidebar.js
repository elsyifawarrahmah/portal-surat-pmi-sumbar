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
        <div className="cross">
          <img src="/logo-pmi.svg" alt="Logo PMI" style={{width:24,height:24}} />
        </div>
        <div className="title">Portal Surat Digital</div>
        <div className="sub">PMI Provinsi Sumatera Barat</div>
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
