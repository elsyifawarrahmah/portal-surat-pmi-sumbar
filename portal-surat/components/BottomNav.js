'use client'
// Tombol kontrol di bawah layar HP: Kembali, Beranda (tombol besar di tengah), dan Menu.
// Di aplikasi terpasang (layar penuh) tidak ada tombol kembali bawaan peramban, jadi tombol ini penting.
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const Ikon = ({ children }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>

export default function BottomNav() {
  const pathname = usePathname() || ''
  const router = useRouter()
  const diBeranda = pathname === '/dashboard'
  const kembali = () => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/dashboard') }
  const bukaMenu = () => window.dispatchEvent(new Event('satria:menu'))
  return (
    <nav className="bottomnav" aria-label="Kontrol cepat">
      <button type="button" className="bn-item" onClick={kembali}>
        <Ikon><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></Ikon>
        <span>Kembali</span>
      </button>
      <Link href="/dashboard" className={'bn-tengah' + (diBeranda ? ' aktif' : '')} aria-label="Beranda">
        <span className="bn-lingkar"><Ikon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /></Ikon></span>
        <span className="bn-label">Beranda</span>
      </Link>
      <button type="button" className="bn-item" onClick={bukaMenu}>
        <Ikon><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></Ikon>
        <span>Menu</span>
      </button>
    </nav>
  )
}
