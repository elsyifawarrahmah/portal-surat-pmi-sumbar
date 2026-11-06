'use client'
// Halaman "Pasang di HP": cara menaruh ikon Portal Surat di layar HP supaya sekali sentuh langsung masuk. Terbuka tanpa login.
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PasangPage() {
  const [alamat, setAlamat] = useState('')
  const [qr, setQr] = useState('')
  const [tawaran, setTawaran] = useState(null)
  const [terpasang, setTerpasang] = useState(false)
  const [salin, setSalin] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    const a = window.location.origin + '/login'
    setAlamat(a)
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent))
    setTerpasang(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)
    import('qrcode').then(Q => Q.toDataURL(a, { width: 280, margin: 1 })).then(setQr).catch(() => {})
    const h = e => { e.preventDefault(); setTawaran(e) }
    window.addEventListener('beforeinstallprompt', h)
    window.addEventListener('appinstalled', () => setTerpasang(true))
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  async function pasang() { if (!tawaran) return; tawaran.prompt(); await tawaran.userChoice; setTawaran(null) }
  async function salinLink() { try { await navigator.clipboard.writeText(alamat); setSalin(true); setTimeout(() => setSalin(false), 2500) } catch { window.prompt('Salin link ini:', alamat) } }
  const kartu = { background: '#fff', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px', marginBottom: 16 }
  const langkah = { display: 'flex', gap: 12, alignItems: 'flex-start', margin: '12px 0', fontSize: 17, lineHeight: 1.45 }
  const no = { width: 32, height: 32, borderRadius: '50%', background: 'var(--pmi-red)', color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 18px 60px' }}>
      <Link href="/login" style={{ color: 'var(--pmi-red)', fontWeight: 700, fontSize: 16 }}>← Kembali</Link>
      <h1 style={{ fontSize: 28, margin: '14px 0 6px' }}>Pasang di layar HP</h1>
      <p style={{ fontSize: 17, color: 'var(--ink-soft)', margin: '0 0 18px' }}>Dengan ini, ikon merah PMI muncul di layar HP. Cukup <b>sentuh sekali</b>, portal langsung terbuka seperti aplikasi, tanpa mengetik alamat.</p>

      {terpasang && <div style={{ ...kartu, background: 'var(--stock-bg, #E8F5E9)', borderColor: '#2E7D32', fontSize: 18 }}>✅ <b>Sudah terpasang.</b> Portal ini sedang dibuka dari ikon di layar HP.</div>}

      {tawaran && !terpasang && <button className="btn btn-primary" style={{ width: '100%', minHeight: 64, fontSize: 20, marginBottom: 16 }} onClick={pasang}>📲 Pasang sekarang</button>}

      <div style={{ ...kartu, borderColor: !ios ? 'var(--pmi-red)' : 'var(--line)' }}>
        <h2 style={{ fontSize: 21, margin: 0 }}>🤖 HP Android (Chrome)</h2>
        <div style={langkah}><span style={no}>1</span><span>Buka portal ini di <b>Chrome</b>.</span></div>
        <div style={langkah}><span style={no}>2</span><span>Sentuh titik tiga <b>⋮</b> di pojok kanan atas.</span></div>
        <div style={langkah}><span style={no}>3</span><span>Pilih <b>“Pasang aplikasi”</b> atau <b>“Tambahkan ke layar utama”</b>, lalu <b>Pasang</b>.</span></div>
      </div>

      <div style={{ ...kartu, borderColor: ios ? 'var(--pmi-red)' : 'var(--line)' }}>
        <h2 style={{ fontSize: 21, margin: 0 }}>🍎 iPhone (Safari)</h2>
        <div style={langkah}><span style={no}>1</span><span>Buka portal ini di <b>Safari</b> (bukan Chrome).</span></div>
        <div style={langkah}><span style={no}>2</span><span>Sentuh tombol <b>Bagikan</b> (kotak dengan panah ke atas).</span></div>
        <div style={langkah}><span style={no}>3</span><span>Pilih <b>“Tambah ke Layar Utama”</b>, lalu <b>Tambah</b>.</span></div>
      </div>

      <div style={kartu}>
        <h2 style={{ fontSize: 21, margin: '0 0 10px' }}>🔗 Bagikan ke orang lain</h2>
        <div style={{ background: 'var(--cream, #FAF6EF)', borderRadius: 12, padding: '12px 14px', fontSize: 16, wordBreak: 'break-all', marginBottom: 10 }}>{alamat}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ minHeight: 52, fontSize: 16 }} onClick={salinLink}>{salin ? '✓ Tersalin' : '📋 Salin link'}</button>
          <a className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`https://wa.me/?text=${encodeURIComponent('Portal Surat Digital PMI Sumatera Barat: ' + alamat)}`} target="_blank" rel="noreferrer">💬 Kirim lewat WhatsApp</a>
        </div>
        {qr && <div style={{ textAlign: 'center', marginTop: 18 }}><img src={qr} alt="Kode QR portal" width={220} height={220} /><div style={{ fontSize: 15, color: 'var(--ink-soft)' }}>Arahkan kamera HP ke kode ini untuk membuka portal.</div></div>}
      </div>
    </div>
  )
}
