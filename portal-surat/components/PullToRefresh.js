'use client'
// Tarik layar ke bawah (saat sudah di paling atas) untuk memuat ulang halaman, seperti aplikasi pada umumnya.
// Berjalan di aplikasi terpasang (PWA/APK), karena refresh bawaan peramban dimatikan di sana.
import { useEffect, useRef, useState } from 'react'

const AMBANG = 70      // jarak tarik (px) agar refresh jalan
const MAKS = 110       // jarak tarik maksimum yang terlihat

export default function PullToRefresh() {
  const [tarik, setTarik] = useState(0)
  const [muat, setMuat] = useState(false)
  const awal = useRef(null)
  const jarak = useRef(0)

  useEffect(() => {
    // jangan aktif bila sentuhan dimulai di menu, jendela (modal), atau area yang bisa digulir sendiri
    function bolehMulai(el) {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (n.classList?.contains('sidebar') || n.classList?.contains('bottomnav') || n.hasAttribute?.('data-tanpa-tarik')) return false
        const s = getComputedStyle(n)
        if (s.position === 'fixed' && !n.classList.contains('hamburger-btn')) return false
        if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return false
      }
      return true
    }
    function mulai(e) {
      if (muat || e.touches.length !== 1) return
      const atas = (window.scrollY || document.documentElement.scrollTop || 0) <= 0
      awal.current = atas && bolehMulai(e.target) ? e.touches[0].clientY : null
      jarak.current = 0
    }
    function gerak(e) {
      if (awal.current == null || muat) return
      const d = e.touches[0].clientY - awal.current
      if (d <= 0) { awal.current = d < -8 ? null : awal.current; jarak.current = 0; setTarik(0); return }
      jarak.current = Math.min(MAKS, d * 0.55)
      setTarik(jarak.current)
    }
    function lepas() {
      if (awal.current == null) return
      const cukup = jarak.current >= AMBANG * 0.55 + 12
      awal.current = null
      if (cukup) { setMuat(true); setTarik(56); setTimeout(() => window.location.reload(), 350) }
      else setTarik(0)
    }
    document.addEventListener('touchstart', mulai, { passive: true })
    document.addEventListener('touchmove', gerak, { passive: true })
    document.addEventListener('touchend', lepas, { passive: true })
    document.addEventListener('touchcancel', lepas, { passive: true })
    return () => {
      document.removeEventListener('touchstart', mulai); document.removeEventListener('touchmove', gerak)
      document.removeEventListener('touchend', lepas); document.removeEventListener('touchcancel', lepas)
    }
  }, [muat])

  if (tarik <= 0 && !muat) return null
  const siap = tarik >= AMBANG * 0.55 + 12
  return (
    <div className="ptr" style={{ transform: `translate(-50%, ${Math.min(tarik, 80) - 8}px)`, opacity: Math.min(1, tarik / 40) }} aria-live="polite">
      <span className={'ptr-lingkar' + (muat ? ' putar' : '')} style={!muat ? { transform: `rotate(${tarik * 4}deg)` } : undefined}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7" /><polyline points="21 3 21 9 15 9" />
        </svg>
      </span>
      <span className="ptr-teks">{muat ? 'Memuat ulang...' : siap ? 'Lepas untuk memuat ulang' : 'Tarik untuk memuat ulang'}</span>
    </div>
  )
}
