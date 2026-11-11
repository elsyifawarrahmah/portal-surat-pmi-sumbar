'use client'
// Menutup splash dalam aplikasi (dipasang di layout). Muncul sebentar saat dibuka dari ikon layar HP, lalu memudar.
import { useEffect } from 'react'

export default function SplashScreen() {
  useEffect(() => {
    const root = document.documentElement
    if (!root.classList.contains('tampil-splash')) return
    try { sessionStorage.setItem('satria-splash', '1') } catch (e) {}
    const a = setTimeout(() => root.classList.add('splash-pudar'), 1100)
    const b = setTimeout(() => root.classList.remove('tampil-splash', 'splash-pudar'), 1650)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  return null
}
