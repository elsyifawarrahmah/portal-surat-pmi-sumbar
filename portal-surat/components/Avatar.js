'use client'
// Foto profil bulat; bila belum ada foto, tampil inisial nama. Foto ada di bucket privat, jadi dibuka lewat alamat sementara.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { urlAman } from '@/lib/berkas'

export default function Avatar({ url, nama = '', ukuran = 44 }) {
  const [src, setSrc] = useState(null)
  useEffect(() => {
    let ok = true
    if (!url) { setSrc(null); return }
    urlAman(createClient(), url).then(u => { if (ok) setSrc(u) }).catch(() => {})
    return () => { ok = false }
  }, [url])
  const inisial = (nama.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase()
  const gaya = { width: ukuran, height: ukuran, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', border: '2px solid rgba(255,255,255,.55)' }
  return src
    ? <img src={src} alt={nama} style={gaya} />
    : <div style={{ ...gaya, background: 'var(--pmi-red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: ukuran * 0.38 }}>{inisial}</div>
}
