'use client'
// Pratinjau berkas di dalam aplikasi: foto muat di layar HP (bisa diperbesar), PDF bisa dibuka. Pengganti membuka alamat mentah Supabase.
import { useState } from 'react'

export function PratinjauBerkas({ url, judul = 'Surat', onClose }) {
  const [zoom, setZoom] = useState(1)
  const pdf = /\.pdf($|\?)/i.test(url || '')
  const tombol = { background: 'rgba(255,255,255,.16)', color: '#fff', border: 'none', borderRadius: 10, minHeight: 44, minWidth: 44, padding: '0 14px', fontSize: 16, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 130, background: '#161616', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', paddingTop: 'max(10px, env(safe-area-inset-top))', background: '#000', flexWrap: 'wrap' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, flex: 1, minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{judul}</div>
        {!pdf && <>
          <button type="button" style={tombol} onClick={() => setZoom(z => Math.max(1, +(z - 0.5).toFixed(1)))} aria-label="Perkecil">−</button>
          <button type="button" style={tombol} onClick={() => setZoom(1)}>Pas layar</button>
          <button type="button" style={tombol} onClick={() => setZoom(z => Math.min(4, +(z + 0.5).toFixed(1)))} aria-label="Perbesar">+</button>
        </>}
        <a href={url} target="_blank" rel="noreferrer" style={tombol}>↗ Tab baru</a>
        <button type="button" style={{ ...tombol, background: 'var(--pmi-red)' }} onClick={onClose}>✕ Tutup</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y pinch-zoom', display: 'flex', justifyContent: zoom === 1 ? 'center' : 'flex-start' }}>
        {pdf ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <iframe src={url} title={judul} style={{ flex: 1, border: 'none', background: '#fff', minHeight: '70vh' }} />
            <a href={url} target="_blank" rel="noreferrer" style={{ ...tombol, margin: 12, background: 'var(--pmi-red)', minHeight: 52 }}>Kalau PDF tidak tampil, buka di sini →</a>
          </div>
        ) : (
          <img src={url} alt={judul} style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? '100%' : 'none', height: 'auto', objectFit: 'contain', alignSelf: 'flex-start', display: 'block' }} />
        )}
      </div>
    </div>
  )
}

// Pengganti <a href=... target="_blank">: membuka pratinjau di dalam aplikasi
export function LihatBerkas({ url, judul, children, ...sisa }) {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <a href={url} onClick={e => { e.preventDefault(); e.stopPropagation(); setBuka(true) }} {...sisa}>{children}</a>
      {buka && <PratinjauBerkas url={url} judul={judul} onClose={() => setBuka(false)} />}
    </>
  )
}
export default LihatBerkas
