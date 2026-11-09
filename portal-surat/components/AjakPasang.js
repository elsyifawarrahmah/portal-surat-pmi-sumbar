'use client'
// Kartu di Beranda: muncul hanya di HP yang belum memasang ikon. Bisa ditutup.
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AjakPasang() {
  const [tampil, setTampil] = useState(false)
  useEffect(() => {
    const hp = /Android|iPhone|iPad|iPod/.test(navigator.userAgent)
    const terpasang = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    let tutup = false; try { tutup = localStorage.getItem('pasang_tutup') === '1' } catch (e) {}
    setTampil(hp && !terpasang && !tutup)
  }, [])
  if (!tampil) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#EEF5FB', border: '1px solid #1F6FB2', borderRadius: 14, padding: '14px 16px', marginBottom: 18 }}>
      <span style={{ fontSize: 28 }}>📲</span>
      <div style={{ flex: 1, minWidth: 180, fontSize: 16, lineHeight: 1.4 }}><b>Pasang di layar HP</b><br />Sekali sentuh langsung masuk, seperti aplikasi.</div>
      <Link href="/pasang" className="btn btn-primary" style={{ minHeight: 48, padding: '0 18px', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontSize: 16 }}>Lihat caranya</Link>
      <button className="btn btn-ghost" style={{ minHeight: 44 }} onClick={() => { try { localStorage.setItem('pasang_tutup', '1') } catch (e) {} setTampil(false) }} aria-label="Tutup">✕</button>
    </div>
  )
}
