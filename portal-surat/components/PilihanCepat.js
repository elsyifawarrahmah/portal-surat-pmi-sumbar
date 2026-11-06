'use client'
// Alat bantu supaya pimpinan tidak perlu mengetik: kalimat siap pakai yang tinggal disentuh, dan tombol bicara (suara jadi tulisan).
import { useState } from 'react'

// Kalimat cepat. onPilih(teks) dipanggil dengan kalimat yang disentuh.
export function KalimatCepat({ daftar, onPilih, judul = 'Sentuh untuk memasukkan:' }) {
  return (
    <div style={{ margin: '6px 0 8px' }}>
      <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 6 }}>{judul}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {daftar.map(k => <button key={k} type="button" className="btn btn-ghost" style={{ minHeight: 40, fontSize: 14.5, padding: '4px 14px', borderRadius: 999, textTransform: 'none', fontWeight: 600 }} onClick={() => onPilih(k)}>{k}</button>)}
      </div>
    </div>
  )
}

// Tombol bicara (hanya tampil bila tampil=true, dipakai untuk Ketua/Kepala Markas): memakai pengenalan suara peramban (Chrome Android). Tidak tampil kalau perangkat tidak mendukung.
export function TombolBicara({ onTeks, tampil = false }) {
  const [aktif, setAktif] = useState(false)
  const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null
  if (!tampil || !SR) return null
  function mulai() {
    const r = new SR()
    r.lang = 'id-ID'; r.interimResults = false; r.maxAlternatives = 1
    r.onresult = e => { const t = e.results?.[0]?.[0]?.transcript; if (t) onTeks(t) }
    r.onend = () => setAktif(false)
    r.onerror = () => setAktif(false)
    setAktif(true)
    try { r.start() } catch { setAktif(false) }
  }
  return <button type="button" className={'btn ' + (aktif ? 'btn-primary' : 'btn-ghost')} style={{ minHeight: 48, fontSize: 16, marginBottom: 8 }} onClick={mulai} disabled={aktif}>{aktif ? '🎤 Mendengarkan... silakan bicara' : '🎤 Bicara (suara jadi tulisan)'}</button>
}

export const tambahKalimat = (lama, baru) => { const a = String(lama || '').trim(); return a ? (/[.!?]$/.test(a) ? a + ' ' : a + '. ') + baru : baru }
