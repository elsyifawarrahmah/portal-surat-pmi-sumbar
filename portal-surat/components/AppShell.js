'use client'
// Kerangka tetap: sidebar dipasang SEKALI di sini, jadi tidak hilang-muncul atau kembali ke atas saat pindah halaman.
import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

export default function AppShell({ children }) {
  const pathname = usePathname() || ''
  const tanpaMenu = pathname === '/' || pathname.startsWith('/login')
  return (
    <>
      {!tanpaMenu && <Sidebar />}
      {children}
    </>
  )
}
