'use client'
// Memeriksa apakah ada versi aplikasi yang lebih baru. Bila ada, halaman memuat ulang sendiri
// (kecuali pengguna sedang mengisi formulir atau membuka jendela), jadi tidak perlu hard refresh.
import { useEffect, useState } from 'react'

const SAYA = process.env.NEXT_PUBLIC_VERSI || 'dev'

function sedangMengisi() {
  const a = document.activeElement
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true
  if (document.querySelector('[role="dialog"], [data-tanpa-tarik]')) return true
  return Array.from(document.querySelectorAll('textarea, input[type="text"], input[type="email"], input[type="number"]')).some(e => e.value && e.value.length > 0 && e.offsetParent !== null && !e.closest('.login-card, .lg2'))
}

export default function CekVersi() {
  const [baru, setBaru] = useState(false)
  useEffect(() => {
    if (SAYA === 'dev') return
    let mati = false
    async function cek() {
      try {
        const r = await fetch('/api/versi', { cache: 'no-store' }); if (!r.ok) return
        const d = await r.json()
        if (!mati && d.versi && d.versi !== 'dev' && d.versi !== SAYA) setBaru(true)
      } catch (e) { /* offline: abaikan */ }
    }
    cek()
    const t = setInterval(cek, 90000)
    const v = () => { if (document.visibilityState === 'visible') cek() }
    document.addEventListener('visibilitychange', v)
    window.addEventListener('focus', cek)
    return () => { mati = true; clearInterval(t); document.removeEventListener('visibilitychange', v); window.removeEventListener('focus', cek) }
  }, [])
  useEffect(() => {
    if (!baru) return
    const t = setInterval(() => { if (!sedangMengisi()) window.location.reload() }, 5000)
    return () => clearInterval(t)
  }, [baru])
  if (!baru) return null
  return (
    <div role="status" style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))', zIndex: 2500, background: '#2A0A12', color: '#fff', padding: '10px 14px 10px 18px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 28px rgba(0,0,0,.35)', fontSize: 14, maxWidth: 'calc(100vw - 24px)' }}>
      <span>Ada pembaruan aplikasi.</span>
      <button type="button" onClick={() => window.location.reload()} style={{ background: '#C8102E', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 16px', fontWeight: 700, minHeight: 38, cursor: 'pointer' }}>Muat ulang</button>
    </div>
  )
}
