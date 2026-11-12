'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import { bunyiNotif } from '@/lib/bunyi'
import { NAMA_APLIKASI } from '@/lib/config'
import Avatar from '@/components/Avatar'

const Svg = ({ children }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>{children}</svg>
)

export const ICONS = {
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
  ekspedisi: <Svg><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22 6 12 13 2 6"/></Svg>,
  riwayat: <Svg><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/><polyline points="12 7 12 12 15 14"/></Svg>,
  pantau: <Svg><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Svg>,
  saran: <Svg><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Svg>,
  lacak: <Svg><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>,
  laporan: <Svg><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Svg>,
  batal: <Svg><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></Svg>,
  aset: <Svg><path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><rect x="9" y="12" width="6" height="9"/></Svg>,
  tugas: <Svg><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></Svg>,
  bantuan: <Svg><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></Svg>,
  buku: <Svg><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></Svg>,
  logout: <Svg><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Svg>,
}

// grup: 'utama' = selalu tampil; 'lain' = dilipat di "Menu lain"; 'admin' = khusus admin web
const LINKS = [
  { href: '/dashboard', label: 'Beranda', icon: 'dashboard', grup: 'utama', tone: 'emas' },
  { href: '/surat', label: 'Surat Masuk', icon: 'masuk', grup: 'utama', badge: 'disposisi', tone: 'biru' },
  { href: '/surat-keluar', label: 'Surat Keluar', icon: 'keluar', grup: 'utama', tone: 'hijau' },
  { href: '/surat-tugas', label: 'Surat Tugas', icon: 'tugas', grup: 'utama', tone: 'oranye' },
  { href: '/data-aset', label: 'Data Aset', icon: 'aset', grup: 'utama', tone: 'emas' },
  { href: '/lacak', label: 'Lacak Surat', icon: 'lacak', grup: 'utama', tone: 'ungu' },
  { href: '/bantuan', label: 'Bantuan', icon: 'bantuan', grup: 'lain' },
  { href: '/dasar-hukum', label: 'Dasar Hukum', icon: 'sk', grup: 'lain' },
  { href: '/pemantauan', label: 'Pemantauan', icon: 'pantau', badge: 'panggilan', grup: 'lain' },
  { href: '/pasang', label: 'Pasang di HP', icon: 'tugas', grup: 'lain' },
  { href: '/cek-kode', label: 'Cek Kode Paraf', icon: 'bantuan', grup: 'lain' },
  { href: '/kotak-saran', label: 'Kotak Saran', icon: 'saran', grup: 'lain' },
  { href: '/disposisi', label: 'Buku Disposisi', icon: 'disposisi', grup: 'lain', penuh: true },
  { href: '/surat-masuk', label: 'Buku Surat Masuk (lengkap)', icon: 'buku', grup: 'lain', penuh: true },
  { href: '/ekspedisi', label: 'Ekspedisi', icon: 'ekspedisi', grup: 'lain', penuh: true },
  { href: '/riwayat', label: 'Riwayat & Buku Agenda', icon: 'riwayat', grup: 'lain', penuh: true },
  { href: '/laporan-bulanan', label: 'Laporan Bulanan', icon: 'laporan', grup: 'lain', penuh: true },
  { href: '/surat-dibatalkan', label: 'Surat Dibatalkan', icon: 'batal', grup: 'lain', penuh: true },
  { href: '/arsip', label: 'Arsip Biro Umum', icon: 'arsip', grup: 'lain' },
  { href: '/perjanjian-kerja-sama', label: 'Perjanjian Kerja Sama', icon: 'pks', grup: 'lain' },
  { href: '/sertifikat-piagam', label: 'Sertifikat & Piagam', icon: 'sertifikat', grup: 'lain' },
  { href: '/surat-keputusan', label: 'Surat Keputusan', icon: 'sk', grup: 'lain' },
  { href: '/data-user', label: 'Data User & Unit', icon: 'user', grup: 'admin' },
  { href: '/log-aktivitas', label: 'Log Aktivitas', icon: 'log', grup: 'admin' },
  { href: '/backup', label: 'Backup Data', icon: 'backup', grup: 'admin' },
  { href: '/diagnosa', label: 'Cek Database', icon: 'log', grup: 'admin' },
]

// Bagian menu yang bisa dibuka. Lima menu utama selalu terlihat; sisanya dikelompokkan supaya mudah dicari.
const SEKSI = [
  { id: 'laporan', judul: 'Pantau & Laporan', ikon: 'laporan', hrefs: ['/pemantauan', '/laporan-bulanan', '/riwayat', '/surat-dibatalkan'] },
  { id: 'buku', judul: 'Buku & Arsip', ikon: 'buku', hrefs: ['/surat-masuk', '/disposisi', '/ekspedisi', '/arsip', '/surat-keputusan', '/perjanjian-kerja-sama', '/sertifikat-piagam'] },
  { id: 'bantu', judul: 'Bantuan & Saran', ikon: 'bantuan', hrefs: ['/bantuan', '/pasang', '/cek-kode', '/kotak-saran'] },
  { id: 'admin', judul: 'Khusus admin web', ikon: 'user', hrefs: ['/data-user', '/log-aktivitas', '/backup', '/diagnosa'] },
]
const sapaan = () => { const j = new Date().getHours(); return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam' }

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  // tombol "Menu" di kontrol bawah (BottomNav) membuka / menutup menu samping
  useEffect(() => { const f = () => setMobileOpen(o => !o); window.addEventListener('satria:menu', f); return () => window.removeEventListener('satria:menu', f) }, [])
  const peran = usePeran()
  const [badge, setBadge] = useState({ disposisi: 0, panggilan: 0 })
  const [seksiBuka, setSeksiBuka] = useState({})

  const [nomorHp, setNomorHp] = useState('')
  async function isiNomorHp() {
    const baru = window.prompt('Nomor HP / WhatsApp kamu (supaya bisa dihubungi bila ada surat yang menunggu):', nomorHp || peran.telepon || '')
    if (baru === null) return
    const { error } = await supabase.from('profiles').update({ telepon: baru.trim() || null }).eq('id', peran.userId)
    if (error) { alert('Gagal menyimpan: ' + (/telepon/.test(error.message) ? 'database belum diperbarui (migrasi-alur-berjenjang.sql).' : error.message)); return }
    setNomorHp(baru.trim())
  }

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
          <div style={{fontSize:15,fontWeight:800,opacity:.95,marginTop:10,letterSpacing:'.02em'}}>{NAMA_APLIKASI}</div>
        </div>
        {peran.nama && <div className="sapa"><span>{sapaan()},</span><b>{peran.nama.split(' ')[0]}</b></div>}
        <div className="nav">
          {(() => {
            const bisaLihat = l => !(l.grup === 'admin' && !peran.isAdmin && !peran.loading) && !(l.penuh && !peran.aksesPenuh && !peran.loading)
            const item = l => (
              <Link key={l.href} href={l.href} data-tone={l.tone || 'netral'} className={pathname === l.href || (l.href === '/surat' && pathname.startsWith('/surat/')) ? 'active' : ''}>
                <span className="chip">{ICONS[l.icon]}</span><span style={{flex:1}}>{l.label === 'Pemantauan' && !peran.bisaPantau && !peran.loading ? 'Panggilan Biro Umum' : l.label}</span>
                {l.badge && badge[l.badge] > 0 && <span className="nav-badge">{badge[l.badge] > 99 ? '99+' : badge[l.badge]}</span>}
              </Link>
            )
            const dipakai = new Set()
            return <>
              {LINKS.filter(l => l.grup === 'utama').map(item)}
              {SEKSI.map(sk => {
                const daftar = sk.hrefs.map(h => LINKS.find(l => l.href === h)).filter(l => l && bisaLihat(l))
                daftar.forEach(l => dipakai.add(l.href))
                if (daftar.length === 0) return null
                const aktif = daftar.some(l => l.href === pathname)
                const terbuka = seksiBuka[sk.id] ?? aktif
                const lencana = daftar.reduce((n, l) => n + (l.badge ? badge[l.badge] || 0 : 0), 0)
                return (
                  <div key={sk.id} className="seksi">
                    <button type="button" className={'nav-seksi' + (terbuka ? ' buka' : '')} onClick={() => setSeksiBuka(o => ({ ...o, [sk.id]: !terbuka }))} aria-expanded={terbuka}>
                      <span className="seksi-ikon">{ICONS[sk.ikon]}</span><span style={{ flex: 1 }}>{sk.judul}</span>
                      {!terbuka && lencana > 0 && <span className="nav-badge">{lencana}</span>}
                      <span className="panah">▾</span>
                    </button>
                    {terbuka && <div className="seksi-isi">{daftar.map(item)}</div>}
                  </div>
                )
              })}
            </>
          })()}
        </div>
        <div className="sidebar-foot">
          {peran.nama && (
            <Link href="/profil" className="sidebar-user" style={{ display: 'flex', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'inherit', marginBottom: 10 }}>
              <Avatar url={peran.fotoUrl} nama={peran.nama} ukuran={42} />
              <span style={{ minWidth: 0 }}><b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peran.nama}</b><span style={{ opacity: .8, fontSize: 12 }}>{peran.isAdmin ? 'Admin web' : peran.unit?.nama || (peran.migrasiBelum ? '' : 'Belum ada unit')} · Profil saya</span></span>
            </Link>
          )}
          <button onClick={handleLogout} className="btn btn-ghost" style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>{ICONS.logout}Keluar</button>
        </div>
      </div>
    </>
  )
}
