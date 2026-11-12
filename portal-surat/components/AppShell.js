'use client'
// Kerangka tetap: sidebar dipasang SEKALI di sini, jadi tidak hilang-muncul atau kembali ke atas saat pindah halaman.
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import PullToRefresh from '@/components/PullToRefresh'
import SplashScreen from '@/components/SplashScreen'
import KonfirmasiKeluar from '@/components/KonfirmasiKeluar'

export default function AppShell({ children }) {
  const pathname = usePathname() || ''
  const tanpaMenu = pathname === '/' || pathname.startsWith('/login') || pathname === '/pasang' || pathname === '/lupa-sandi' || pathname === '/atur-ulang-sandi'
  return (
    <>
      <SplashScreen />
      <KonfirmasiKeluar />
      <PullToRefresh />
      {!tanpaMenu && <Sidebar />}
      {children}
      {!tanpaMenu && <BottomNav />}
    </>
  )
}
