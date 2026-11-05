'use client'
// Kanvas tanda tangan digital: gambar dengan jari / mouse / pena. Hasil berupa PNG transparan, diunggah ke penyimpanan.
import { useEffect, useRef, useState } from 'react'

export default function TandaTangan({ onSimpan, onBatal, simpanLabel = 'Pakai tanda tangan ini' }) {
  const kanvas = useRef(null)
  const [adaGoresan, setAdaGoresan] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const gambar = useRef(false)

  useEffect(() => {
    const c = kanvas.current, rasio = window.devicePixelRatio || 1
    c.width = c.offsetWidth * rasio; c.height = 180 * rasio
    const ctx = c.getContext('2d'); ctx.scale(rasio, rasio)
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'
  }, [])

  const titik = e => { const r = kanvas.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  function mulai(e) { e.preventDefault(); kanvas.current.setPointerCapture?.(e.pointerId); gambar.current = true; const { x, y } = titik(e); const ctx = kanvas.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke() }
  function gerak(e) { if (!gambar.current) return; e.preventDefault(); const { x, y } = titik(e); const ctx = kanvas.current.getContext('2d'); ctx.lineTo(x, y); ctx.stroke(); setAdaGoresan(true) }
  function selesai() { gambar.current = false }
  function hapus() { const c = kanvas.current, ctx = c.getContext('2d'); ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore(); setAdaGoresan(false) }
  async function simpan() {
    setSibuk(true)
    const blob = await new Promise(r => kanvas.current.toBlob(r, 'image/png'))
    try { await onSimpan(new File([blob], 'ttd.png', { type: 'image/png' })) } finally { setSibuk(false) }
  }

  return (
    <div>
      <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 6 }}>Tanda tangan di dalam kotak ini (pakai jari atau mouse).</div>
      <canvas ref={kanvas} onPointerDown={mulai} onPointerMove={gerak} onPointerUp={selesai} onPointerLeave={selesai}
        style={{ width: '100%', height: 180, border: '2px dashed var(--line)', borderRadius: 12, background: '#fff', touchAction: 'none', cursor: 'crosshair' }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={!adaGoresan || sibuk} onClick={simpan}>{sibuk ? 'Menyimpan...' : simpanLabel}</button>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={hapus}>Ulangi</button>
        {onBatal && <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onBatal}>Batal</button>}
      </div>
    </div>
  )
}

// Unggah PNG tanda tangan ke penyimpanan dan kembalikan URL-nya
export async function unggahTtd(supabase, file, userId) {
  // Disimpan di akar bucket (sama seperti berkas surat lain) supaya lolos kebijakan penyimpanan
  const nama = `${Date.now()}-ttd-${userId}.png`
  const { error } = await supabase.storage.from('bukti-surat').upload(nama, file, { contentType: 'image/png' })
  if (error) throw new Error('Gagal menyimpan tanda tangan: ' + error.message)
  return supabase.storage.from('bukti-surat').getPublicUrl(nama).data.publicUrl
}
