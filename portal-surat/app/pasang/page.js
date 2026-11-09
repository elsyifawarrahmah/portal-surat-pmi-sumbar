'use client'
// Halaman "Pasang di HP": cara menaruh ikon SATria PMI di layar HP supaya sekali sentuh langsung masuk. Terbuka tanpa login.
import { useEffect, useState } from 'react'
import Link from 'next/link'


function PanahBiru({ x, y, teks, arah = 'bawah' }) {
  const lebar = Math.max(70, teks.length * 8 + 22)
  return (<g>
    <rect x={x} y={y} width={lebar} height="26" rx="8" fill="#1F6FB2" stroke="#fff" strokeWidth="2" />
    <text x={x + lebar / 2} y={y + 18} textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff" fontFamily="Arial">{teks}</text>
  </g>)
}
function IlustrasiBagikan() {   // bilah bawah Safari, tombol Bagikan disorot
  const ikon = [[40, 'M34 38 l-8 -8 8 -8'], [100, 'M92 22 l8 8 -8 8']]
  return (
    <svg viewBox="0 0 320 130" style={{ width: '100%', maxWidth: 420, display: 'block', margin: '10px auto' }} role="img" aria-label="Tombol Bagikan di bagian bawah Safari">
      <rect x="2" y="44" width="316" height="80" rx="18" fill="#F2F2F7" stroke="#C7C7CC" />
      {ikon.map(([x, d], i) => <path key={i} d={d} fill="none" stroke="#8E8E93" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />)}
      <circle cx="160" cy="84" r="30" fill="#E3F0FB" stroke="#1F6FB2" strokeWidth="4" />
      <rect x="148" y="78" width="24" height="22" rx="4" fill="none" stroke="#1F6FB2" strokeWidth="3.5" />
      <path d="M160 88 V60 M151 69 l9 -9 9 9" fill="none" stroke="#1F6FB2" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="216" y="70" width="28" height="28" rx="5" fill="none" stroke="#8E8E93" strokeWidth="3.5" />
      <rect x="266" y="72" width="24" height="24" rx="5" fill="none" stroke="#8E8E93" strokeWidth="3.5" />
      <polygon points="150,2 170,2 170,22 182,22 160,42 138,22 150,22" fill="#1F6FB2" stroke="#fff" strokeWidth="2" />
      <PanahBiru x={186} y={4} teks="TEKAN INI" />
    </svg>)
}
function IlustrasiLayarUtama() {   // daftar menu Bagikan, baris "Tambah ke Layar Utama" disorot
  const baris = [['Salin', false], ['Tambah ke Markah', false], ['Tambah ke Layar Utama', true], ['Cetak', false]]
  return (
    <svg viewBox="0 0 320 190" style={{ width: '100%', maxWidth: 420, display: 'block', margin: '10px auto' }} role="img" aria-label="Menu Tambah ke Layar Utama">
      <rect x="2" y="2" width="316" height="186" rx="16" fill="#fff" stroke="#C7C7CC" />
      {baris.map(([t, on], i) => (<g key={t}>
        <rect x="10" y={10 + i * 44} width="300" height="38" rx="9" fill={on ? '#E3F0FB' : '#F7F7F9'} stroke={on ? '#1F6FB2' : 'none'} strokeWidth="3.5" />
        <text x="22" y={34 + i * 44} fontSize="15" fontWeight={on ? 800 : 500} fill="#1B1715" fontFamily="Arial">{t}</text>
        {on && <g><rect x="274" y={18 + i * 44} width="22" height="22" rx="5" fill="none" stroke="#1F6FB2" strokeWidth="3" /><path d={`M285 ${23 + i * 44} v12 M279 ${29 + i * 44} h12`} stroke="#1F6FB2" strokeWidth="3" strokeLinecap="round" /></g>}
      </g>))}
    </svg>)
}

export default function PasangPage() {
  const [alamat, setAlamat] = useState('')
  const [qr, setQr] = useState('')
  const [tawaran, setTawaran] = useState(null)
  const [terpasang, setTerpasang] = useState(false)
  const [salin, setSalin] = useState(false)
  const [ios, setIos] = useState(false)
  const [jenis, setJenis] = useState('')   // ios | samsung | chrome | android | lain

  useEffect(() => {
    const a = window.location.origin + '/login'
    setAlamat(a)
    const ua = navigator.userAgent
    setIos(/iPad|iPhone|iPod/.test(ua))
    setJenis(/iPad|iPhone|iPod/.test(ua) ? 'ios' : /SamsungBrowser/.test(ua) ? 'samsung' : /Android/.test(ua) ? (/Chrome\//.test(ua) && !/OPR|EdgA|Firefox|UCBrowser/.test(ua) ? 'chrome' : 'android') : 'lain')
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
      <p style={{ fontSize: 17, color: 'var(--ink-soft)', margin: '0 0 18px' }}>Dengan ini, ikon merah PMI muncul di layar HP. Cukup <b>sentuh sekali</b>, SATria PMI langsung terbuka seperti aplikasi, tanpa mengetik alamat.</p>

      {terpasang && <div style={{ ...kartu, background: 'var(--stock-bg, #E8F5E9)', borderColor: '#2E7D32', fontSize: 18 }}>✅ <b>Sudah terpasang.</b> SATria PMI sedang dibuka dari ikon di layar HP.</div>}

      {tawaran && !terpasang && <button className="btn btn-primary" style={{ width: '100%', minHeight: 64, fontSize: 20, marginBottom: 16 }} onClick={pasang}>📲 Pasang sekarang</button>}

      {jenis && <div style={{ ...kartu, background: '#EEF5FB', borderColor: '#1F6FB2', fontSize: 17 }}>📱 Kamu sedang memakai: <b>{{ ios: 'iPhone', samsung: 'Samsung Internet', chrome: 'Chrome (Android)', android: 'Android, browser lain', lain: 'Komputer / laptop' }[jenis]}</b>. Ikuti kotak yang <b>berbingkai merah</b> di bawah.</div>}

      {jenis === 'samsung' && <div style={{ ...kartu, borderColor: 'var(--pmi-red)', borderWidth: 2 }}>
        <h2 style={{ fontSize: 21, margin: 0 }}>🟣 Samsung Internet</h2>
        <div style={{ background: '#FBF1D6', borderRadius: 12, padding: '10px 14px', margin: '10px 0', fontSize: 16, lineHeight: 1.45 }}>Kalau muncul tulisan <b>“Aplikasi yang tidak aman diblokir”</b> dari Google Play Protect: <b>SATria PMI aman</b>. Itu aturan HP untuk pemasangan lewat Samsung Internet. Pilih salah satu cara di bawah.</div>
        <div style={{ fontWeight: 800, fontSize: 18, margin: '12px 0 4px' }}>Cara A (paling mudah): pakai Chrome</div>
        <a className="btn btn-primary" style={{ minHeight: 60, fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', margin: '8px 0' }} href={`intent://${typeof window !== 'undefined' ? window.location.host : ''}/pasang#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(alamat)};end`}>🌐 Buka di Chrome</a>
        <div style={langkah}><span style={no}>1</span><span>Setelah terbuka di Chrome, sentuh <b>⋮</b> di pojok kanan atas.</span></div>
        <div style={langkah}><span style={no}>2</span><span>Pilih <b>“Pasang aplikasi”</b>, lalu <b>Pasang</b>.</span></div>
        <div style={{ fontWeight: 800, fontSize: 18, margin: '16px 0 4px' }}>Cara B: tetap di Samsung Internet</div>
        <div style={langkah}><span style={no}>1</span><span>Sentuh <b>⋮</b> di pojok kanan bawah.</span></div>
        <div style={langkah}><span style={no}>2</span><span>Pilih <b>“Tambahkan halaman ke”</b>, lalu <b>“Layar utama”</b>.</span></div>
        <div style={langkah}><span style={no}>3</span><span>Ikon merah PMI muncul di layar HP. Tidak ada yang diblokir.</span></div>
        <div style={{ fontWeight: 800, fontSize: 18, margin: '16px 0 4px' }}>Kalau sudah terlanjur muncul peringatan merah</div>
        <div style={langkah}><span style={no}>!</span><span>Sentuh tulisan kecil <b>“Tetap instal”</b> (di atas tombol Oke), bukan tombol <b>Oke</b>.</span></div>
      </div>}

      {jenis === 'ios' && <div style={{ ...kartu, borderColor: 'var(--pmi-red)', borderWidth: 2 }}>
        <h2 style={{ fontSize: 21, margin: 0 }}>🍎 iPhone (Safari)</h2>
        <div style={langkah}><span style={no}>1</span><span>Buka SATria PMI di <b>Safari</b> (ikon kompas biru), bukan Chrome atau aplikasi lain.</span></div>
        <div style={langkah}><span style={no}>2</span><span>Sentuh tombol <b>Bagikan</b> di bagian bawah layar.</span></div>
        <IlustrasiBagikan />
        <div style={langkah}><span style={no}>3</span><span>Geser menunya ke atas, pilih <b>“Tambah ke Layar Utama”</b>.</span></div>
        <IlustrasiLayarUtama />
        <div style={langkah}><span style={no}>4</span><span>Sentuh <b>Tambah</b> di pojok kanan atas. Ikon merah PMI muncul di layar HP.</span></div>
        <div style={{ background: '#FBF1D6', borderRadius: 12, padding: '12px 14px', marginTop: 12, fontSize: 16, lineHeight: 1.5 }}>🔔 <b>Notifikasi di iPhone</b> baru bisa dinyalakan <b>setelah</b> ikon terpasang. Caranya: buka SATria PMI <b>dari ikon merah itu</b>, masuk, lalu di <b>Beranda</b> sentuh <b>“Aktifkan Sekarang”</b>. Butuh iPhone dengan iOS 16.4 atau lebih baru.</div>
      </div>}

      {(jenis === 'chrome' || jenis === 'android' || jenis === 'lain' || !jenis) && <div style={{ ...kartu, borderColor: jenis === 'chrome' ? 'var(--pmi-red)' : 'var(--line)', borderWidth: jenis === 'chrome' ? 2 : 1 }}>
        <h2 style={{ fontSize: 21, margin: 0 }}>🤖 HP Android (Chrome)</h2>
        <div style={langkah}><span style={no}>1</span><span>Buka SATria PMI di <b>Chrome</b>.</span></div>
        <div style={langkah}><span style={no}>2</span><span>Sentuh titik tiga <b>⋮</b> di pojok kanan atas.</span></div>
        <div style={langkah}><span style={no}>3</span><span>Pilih <b>“Pasang aplikasi”</b> atau <b>“Tambahkan ke layar utama”</b>, lalu <b>Pasang</b>.</span></div>
      </div>}

      {jenis !== 'ios' && jenis !== 'samsung' && <details style={{ ...kartu, padding: '14px 22px' }}>
        <summary style={{ fontSize: 18, fontWeight: 700, cursor: 'pointer' }}>🍎 Punya iPhone? Lihat caranya</summary>
        <div style={langkah}><span style={no}>1</span><span>Buka SATria PMI di <b>Safari</b>.</span></div>
        <div style={langkah}><span style={no}>2</span><span>Sentuh <b>Bagikan</b> di bagian bawah layar.</span></div>
        <IlustrasiBagikan />
        <div style={langkah}><span style={no}>3</span><span>Pilih <b>“Tambah ke Layar Utama”</b>, lalu <b>Tambah</b>.</span></div>
        <IlustrasiLayarUtama />
      </details>}

      <div style={kartu}>
        <h2 style={{ fontSize: 21, margin: '0 0 10px' }}>🔗 Bagikan ke orang lain</h2>
        <div style={{ background: 'var(--cream, #FAF6EF)', borderRadius: 12, padding: '12px 14px', fontSize: 16, wordBreak: 'break-all', marginBottom: 10 }}>{alamat}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ minHeight: 52, fontSize: 16 }} onClick={salinLink}>{salin ? '✓ Tersalin' : '📋 Salin link'}</button>
          <a className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} href={`https://wa.me/?text=${encodeURIComponent('SATria PMI, surat digital PMI Sumatera Barat: ' + alamat)}`} target="_blank" rel="noreferrer">💬 Kirim lewat WhatsApp</a>
        </div>
        {qr && <div style={{ textAlign: 'center', marginTop: 18 }}><img src={qr} alt="Kode QR SATria PMI" width={220} height={220} /><div style={{ fontSize: 15, color: 'var(--ink-soft)' }}>Arahkan kamera HP ke kode ini untuk membuka SATria PMI.</div></div>}
      </div>
    </div>
  )
}
