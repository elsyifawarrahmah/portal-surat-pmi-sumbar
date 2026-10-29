'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import { bunyiNotif } from '@/lib/bunyi'

const Svg = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{children}</svg>
)

const ICONS = {
  dashboard: <Svg><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></Svg>,
  masuk: <Svg><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></Svg>,
  keluar: <Svg><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Svg>,
  pks: <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></Svg>,
  sertifikat: <Svg><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></Svg>,
  sk: <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></Svg>,
  arsip: <Svg><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></Svg>,
  user: <Svg><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Svg>,
  log: <Svg><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></Svg>,
  backup: <Svg><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></Svg>,
  disposisi: <Svg><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></Svg>,
  ekspedisi: <Svg><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></Svg>,
  riwayat: <Svg><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/><polyline points="12 7 12 12 15 14"/></Svg>,
  pantau: <Svg><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Svg>,
  saran: <Svg><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Svg>,
  logout: <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>,
}

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/surat-masuk', label: 'Surat Masuk', icon: 'masuk' },
  { href: '/disposisi', label: 'Disposisi', icon: 'disposisi', badge: 'disposisi' },
  { href: '/surat-keluar', label: 'Surat Keluar', icon: 'keluar' },
  { href: '/ekspedisi', label: 'Ekspedisi', icon: 'ekspedisi' },
  { href: '/riwayat', label: 'Riwayat Surat', icon: 'riwayat' },
  { href: '/pemantauan', label: 'Pemantauan', icon: 'pantau', badge: 'panggilan' },
  { href: '/perjanjian-kerja-sama', label: 'Perjanjian Kerja Sama', icon: 'pks' },
  { href: '/sertifikat-piagam', label: 'Sertifikat & Piagam', icon: 'sertifikat' },
  { href: '/surat-keputusan', label: 'Surat Keputusan', icon: 'sk' },
  { href: '/arsip', label: 'Arsip Biro Umum', icon: 'arsip' },
  { href: '/kotak-saran', label: 'Kotak Saran', icon: 'saran' },
  { href: '/data-user', label: 'Data User', icon: 'user', admin: true },
  { href: '/log-aktivitas', label: 'Log Aktivitas', icon: 'log', admin: true },
  { href: '/backup', label: 'Backup Data', icon: 'backup', admin: true },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const peran = usePeran()
  const [badge, setBadge] = useState({ disposisi: 0, panggilan: 0 })

  // Lencana angka: disposisi yang menunggu untuk unit saya & panggilan yang belum ditindaklanjuti
  async function hitungBadge() {
    if (!peran.userId) return
    let disposisi = 0, panggilan = 0
    if (peran.unitId && !peran.isBiroUmum) {
      const r = await supabase.from('surat_disposisi_tujuan').select('id', { count: 'exact', head: true }).eq('unit_id', peran.unitId).eq('status', 'menunggu')
      if (!r.error) disposisi = r.count || 0
    }
    const p = await supabase.from('surat_panggilan').select('id', { count: 'exact', head: true }).is('selesai_pada', null)
    if (!p.error) panggilan = p.count || 0
    setBadge({ disposisi, panggilan })
  }
  useEffect(() => {
    if (peran.loading || !peran.userId) return
    hitungBadge()
    const t = setInterval(hitungBadge, 60000)
    const ch = supabase.channel('badge-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_disposisi_tujuan' }, pl => { if (pl.eventType === 'INSERT' && peran.unitId && pl.new?.unit_id === peran.unitId) bunyiNotif(); hitungBadge() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surat_panggilan' }, pl => { if (pl.eventType === 'INSERT' && peran.unitId && pl.new?.unit_id === peran.unitId) bunyiNotif(); hitungBadge() })
      .subscribe()
    return () => { clearInterval(t); supabase.removeChannel(ch) }
  }, [peran.loading, peran.userId, peran.unitId])

  // Ingat menu tertutup/terbuka, dan tandai di <body> supaya isi halaman ikut menyesuaikan
  useEffect(() => { try { if (sessionStorage.getItem('menuTutup') === '1') setCollapsed(true) } catch (e) {} }, [])
  useEffect(() => {
    document.body.classList.toggle('menu-tutup', collapsed)
    try { sessionStorage.setItem('menuTutup', collapsed ? '1' : '0') } catch (e) {}
    return () => document.body.classList.remove('menu-tutup')
  }, [collapsed])
  // Laci menu di HP menutup sendiri setelah pindah halaman
  useEffect(() => { setMobileOpen(false) }, [pathname])

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
          <div className="brand-logo">
            <img src="/logo-pmi.png" alt="Lambang Palang Merah Indonesia" width={42} height={42} />
            <div className="brand-name">Palang<br />Merah<br />Indonesia</div>
            <div className="brand-vline" />
            <div className="brand-prov">Provinsi<br />Sumatera Barat</div>
          </div>
          <div style={{fontSize:10.5,opacity:.65,marginTop:10,letterSpacing:'.03em',textTransform:'uppercase'}}>Portal Surat Digital</div>
        </div>
        <div className="nav">
          {LINKS.filter(l => !(l.admin && !peran.isAdmin && !peran.loading)).map(l => (
            <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
              {ICONS[l.icon]}<span style={{flex:1}}>{l.label}</span>
              {l.badge && badge[l.badge] > 0 && <span className="nav-badge">{badge[l.badge] > 99 ? '99+' : badge[l.badge]}</span>}
            </Link>
          ))}
        </div>
        <div className="sidebar-foot">
          {peran.nama && <div className="sidebar-user"><b>{peran.nama}</b><span>{peran.isAdmin ? 'Admin' : peran.unit?.nama || (peran.migrasiBelum ? '' : 'Belum ada unit')}</span></div>}
          <button onClick={handleLogout} className="btn btn-ghost" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>{ICONS.logout}Keluar</button>
        </div>
      </div>
    </>
  )
}
