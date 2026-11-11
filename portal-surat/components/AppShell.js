'use client'
// Kerangka tetap: sidebar dipasang SEKALI di sini, jadi tidak hilang-muncul atau kembali ke atas saat pindah halaman.
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import BottomNav from '@/components/BottomNav'
import PullToRefresh from '@/components/PullToRefresh'

export default function AppShell({ children }) {
  const pathname = usePathname() || ''
  const tanpaMenu = pathname === '/' || pathname.startsWith('/login') || pathname === '/pasang'
  return (
    <>
      <PullToRefresh />
      {!tanpaMenu && <Sidebar />}
      {children}
      {!tanpaMenu && <BottomNav />}
    </>
  )
}
