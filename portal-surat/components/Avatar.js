'use client'
// Foto profil bulat; bila belum ada foto, tampil inisial nama.
export default function Avatar({ url, nama = '', ukuran = 44 }) {
  const inisial = (nama.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('') || '?').toUpperCase()
  const gaya = { width: ukuran, height: ukuran, borderRadius: '50%', flexShrink: 0, objectFit: 'cover', border: '2px solid rgba(255,255,255,.55)' }
  return url
    ? <img src={url} alt={nama} style={gaya} />
    : <div style={{ ...gaya, background: 'var(--pmi-red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: ukuran * 0.38 }}>{inisial}</div>
}
