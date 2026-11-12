'use client'
// Menampilkan hasil coretan koreksi (gambar) untuk pembuat surat, plus tautan ke berkas versi lama.
import { useEffect, useState } from 'react'
import { urlAman } from '@/lib/berkas'

export default function GambarKoreksi({ supabase, daftar, judul = 'Coretan koreksi' }) {
  const [urls, setUrls] = useState([])
  const [buka, setBuka] = useState(false)
  const kunci = JSON.stringify(daftar || [])
  useEffect(() => {
    let batal = false
    Promise.all((daftar || []).map(u => urlAman(supabase, u))).then(r => { if (!batal) setUrls(r) })
    return () => { batal = true }
  }, [kunci])
  if (!daftar || !daftar.length) return null
  return (
    <div style={{ margin: '8px 0 4px' }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#8C1010', marginBottom: 4 }}>✎ {judul} ({daftar.length} halaman) · sentuh untuk memperbesar</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {urls.map((u, i) => <img key={i} src={u} alt={`Coretan koreksi halaman ${i + 1}`} onClick={() => setBuka(true)} style={{ height: 120, width: 'auto', borderRadius: 8, border: '2px solid #E5B4B4', background: '#fff', cursor: 'zoom-in', flexShrink: 0 }} />)}
      </div>
      {buka && (
        <div className="kc-lihat" data-guard-modal="1" role="dialog" aria-modal="true" aria-label={judul}>
          <div className="kc-lihat-atas"><b>{judul}</b><button onClick={() => setBuka(false)} aria-label="Tutup">✕</button></div>
          <div className="kc-lihat-isi">{urls.map((u, i) => <img key={i} src={u} alt={`Halaman ${i + 1}`} />)}</div>
        </div>
      )}
    </div>
  )
}

export function TautanBerkas({ supabase, url, teks }) {
  async function buka() { const u = await urlAman(supabase, url); window.open(u, '_blank', 'noopener') }
  return <button type="button" onClick={buka} style={{ border: 'none', background: 'none', padding: 0, color: '#1F5E99', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>{teks}</button>
}
