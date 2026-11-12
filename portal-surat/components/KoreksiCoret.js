'use client'
// Editor koreksi: mencoret langsung di gambar surat (seperti edit status WhatsApp).
// Alat: Geser, Pena, Garis lurus (anti "cakar ayam"), Stabilo, Teks (diketik, jadi rapi), Hapus, Urungkan, Zoom.
// Tebal pena otomatis menyesuaikan zoom: jari besar + zoom besar = coretan tetap halus di kertas.
import { useEffect, useRef, useState } from 'react'
import { urlAman } from '@/lib/berkas'

const WARNA = ['#E5171F', '#1565C0', '#111111', '#2E7D32', '#FFD400']
const MAKS_SISI = 1800
export const MAKS_HALAMAN = 8
const UKURAN_TEKS = [['S', 0.016], ['M', 0.024], ['L', 0.034]]

const adalahPdf = (blob, nama) => /pdf/i.test(blob.type || '') || /\.pdf($|\?)/i.test(nama || '')

async function ambilBlob(supabase, url) {
  const u = await urlAman(supabase, url)
  const r = await fetch(u)
  if (!r.ok) throw new Error('Berkas surat tidak bisa dibuka (' + r.status + ')')
  return r.blob()
}
function kanvasDariGambar(blob) {
  return new Promise((ok, gagal) => {
    const u = URL.createObjectURL(blob), im = new Image()
    im.onload = () => {
      const s = Math.min(1, MAKS_SISI / Math.max(im.naturalWidth, im.naturalHeight))
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s)
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height)
      URL.revokeObjectURL(u); ok(c)
    }
    im.onerror = () => { URL.revokeObjectURL(u); gagal(new Error('Gambar surat tidak bisa dibaca')) }
    im.src = u
  })
}
async function kanvasDariPdf(blob) {
  const pdfjs = await import('pdfjs-dist/build/pdf')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString()
  const pdf = await pdfjs.getDocument({ data: await blob.arrayBuffer() }).promise
  const hasil = []
  for (let i = 1; i <= Math.min(pdf.numPages, MAKS_HALAMAN); i++) {
    const pg = await pdf.getPage(i), v0 = pg.getViewport({ scale: 1 })
    const v = pg.getViewport({ scale: Math.min(2.4, MAKS_SISI / Math.max(v0.width, v0.height)) })
    const c = document.createElement('canvas'); c.width = Math.round(v.width); c.height = Math.round(v.height)
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
    await pg.render({ canvasContext: x, viewport: v }).promise
    hasil.push(c)
  }
  return hasil
}

// ---------- menggambar ----------
function garisHalus(x, p) {
  if (p.length < 2) { x.lineTo(p[0][0] + 0.01, p[0][1]); return }
  x.moveTo(p[0][0], p[0][1])
  for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; x.quadraticCurveTo(p[i][0], p[i][1], mx, my) }
  const t = p[p.length - 1]; x.lineTo(t[0], t[1])
}
function gambarItem(x, it) {
  if (it.t === 'x') {
    x.save(); x.font = `700 ${it.s}px Arial, sans-serif`; x.textBaseline = 'top'; x.lineJoin = 'round'
    const baris = it.v.split('\n'); let lebar = 0
    baris.forEach(b => { lebar = Math.max(lebar, x.measureText(b).width) })
    it.box = { x: it.x - 4, y: it.y - 4, w: lebar + 8, h: baris.length * it.s * 1.18 + 8 }
    baris.forEach((b, i) => { const y = it.y + i * it.s * 1.18; x.strokeStyle = '#fff'; x.lineWidth = it.s * 0.2; x.strokeText(b, it.x, y); x.fillStyle = it.c; x.fillText(b, it.x, y) })
    x.restore(); return
  }
  x.save(); x.lineCap = it.m === 'stabilo' ? 'butt' : 'round'; x.lineJoin = 'round'; x.strokeStyle = it.c; x.lineWidth = it.w
  if (it.m === 'stabilo') { x.globalAlpha = 0.45; x.globalCompositeOperation = 'multiply' }
  x.beginPath()
  if (it.t === 'l') { x.moveTo(it.p[0][0], it.p[0][1]); x.lineTo(it.p[1][0], it.p[1][1]) } else garisHalus(x, it.p)
  x.stroke(); x.restore()
}
function gambarHalaman(c, pg) {
  const x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(pg.dasar, 0, 0)
  pg.items.forEach(it => gambarItem(x, it))
}
function jarakKeSegmen(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy
  let t = l2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy))
}
function kenaItem(it, x, y, r) {
  if (it.t === 'x') return it.box && x >= it.box.x - r && x <= it.box.x + it.box.w + r && y >= it.box.y - r && y <= it.box.y + it.box.h + r
  for (let i = 0; i < it.p.length - 1; i++) if (jarakKeSegmen(x, y, it.p[i], it.p[i + 1]) <= r + it.w / 2) return true
  return it.p.length === 1 && Math.hypot(x - it.p[0][0], y - it.p[0][1]) <= r + it.w / 2
}
function haluskan(p) {
  if (p.length < 4) return p
  return p.map((q, i) => { if (i === 0 || i === p.length - 1) return q; const a = p[i - 1], b = p[i + 1]; return [(a[0] + q[0] * 2 + b[0]) / 4, (a[1] + q[1] * 2 + b[1]) / 4] })
}

const Ik = ({ children, u = 22 }) => <svg width={u} height={u} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
const ALAT = [
  ['geser', 'Geser', <Ik key="g"><path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.4L3 16a2 2 0 0 1 3-2.6L8 15" /></Ik>],
  ['pena', 'Pena', <Ik key="p"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></Ik>],
  ['garis', 'Garis', <Ik key="l"><line x1="5" y1="19" x2="19" y2="5" /></Ik>],
  ['stabilo', 'Stabilo', <Ik key="s"><path d="M9 11l-6 6v3h9l3-3" /><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" /></Ik>],
  ['teks', 'Teks', <span key="t" style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-.02em' }}>Aa</span>],
  ['hapus', 'Hapus', <Ik key="h"><path d="M20 20H9l-6-6 10-10 7 7-7 7" /><path d="M7 11l6 6" /></Ik>],
]

export default function KoreksiCoret({ supabase, sumber, suratId, judul = 'Koreksi surat', awalKeterangan = '', onSelesai, onClose }) {
  const [halaman, setHalaman] = useState([])
  const [muat, setMuat] = useState('Membuka surat...')
  const [galat, setGalat] = useState('')
  const [alat, setAlat] = useState('pena')
  const [warna, setWarna] = useState(WARNA[0])
  const [tebal, setTebal] = useState(3)
  const [zoom, setZoom] = useState(1)
  const [jumlah, setJumlah] = useState(0)
  const [teksBaru, setTeksBaru] = useState(null)   // { i, x, y, nilai, ukuran, item? }
  const [ket, setKet] = useState(awalKeterangan)
  const [sibuk, setSibuk] = useState(false)
  const halRef = useRef([]); const kanvas = useRef([]); const ops = useRef([]); const aksi = useRef(null); const jaga = useRef(null)
  const adaCoret = jumlah > 0

  useEffect(() => {
    let batal = false
    ;(async () => {
      try {
        const hasil = []
        for (const s of sumber) {
          if (hasil.length >= MAKS_HALAMAN) break
          const blob = await ambilBlob(supabase, s.url)
          const daftar = adalahPdf(blob, s.nama || s.url) ? await kanvasDariPdf(blob) : [await kanvasDariGambar(blob)]
          daftar.forEach(c => hasil.push({ dasar: c, w: c.width, h: c.height, items: [], no: hasil.length + 1, asal: s.nama || '' }))
        }
        if (batal) return
        if (!hasil.length) throw new Error('Tidak ada berkas surat yang bisa dicoret.')
        halRef.current = hasil.slice(0, MAKS_HALAMAN); setHalaman(halRef.current); setMuat('')
      } catch (e) { if (!batal) { setGalat(e.message || 'Gagal membuka surat'); setMuat('') } }
    })()
    return () => { batal = true }
  }, [])
  useEffect(() => { halaman.forEach((pg, i) => { const c = kanvas.current[i]; if (c) gambarHalaman(c, pg) }) }, [halaman])

  const ulang = i => { const c = kanvas.current[i]; if (c) gambarHalaman(c, halRef.current[i]) }
  const hitung = () => setJumlah(halRef.current.reduce((n, p) => n + p.items.length, 0))
  const tandaiUbah = () => { try { jaga.current && jaga.current.dispatchEvent(new Event('input', { bubbles: true })) } catch (e) {} }
  function titik(e, i) {
    const r = kanvas.current[i].getBoundingClientRect(), pg = halRef.current[i]
    return [(e.clientX - r.left) * pg.w / r.width, (e.clientY - r.top) * pg.h / r.height]
  }
  const lebarPena = pg => Math.max(1.2, tebal * (pg.w / 900) / zoom)

  function turun(e, i) {
    if (alat === 'geser' || !e.isPrimary) return
    const pg = halRef.current[i], [x, y] = titik(e, i)
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (alat === 'pena' || alat === 'stabilo') {
      const it = { t: 's', m: alat, c: alat === 'stabilo' ? '#FFE600' : warna, w: alat === 'stabilo' ? lebarPena(pg) * 5 : lebarPena(pg), p: [[x, y]] }
      pg.items.push(it); aksi.current = { jenis: 'gambar', i, it }
    } else if (alat === 'garis') {
      const it = { t: 'l', m: 'garis', c: warna, w: lebarPena(pg), p: [[x, y], [x, y]] }
      pg.items.push(it); aksi.current = { jenis: 'gambar', i, it }
    } else if (alat === 'teks') {
      const r = Math.max(6, pg.w * 0.01)
      const ada = [...pg.items].reverse().find(it => it.t === 'x' && kenaItem(it, x, y, r))
      if (ada) { aksi.current = { jenis: 'pindah', i, it: ada, dx: x - ada.x, dy: y - ada.y, mulai: [x, y], gerak: false } }
      else setTeksBaru({ i, x, y, nilai: '', ukuran: 1 })
    } else if (alat === 'hapus') {
      const r = Math.max(8, pg.w * 0.012)
      const idx = [...pg.items.keys()].reverse().find(k => kenaItem(pg.items[k], x, y, r))
      if (idx !== undefined) { const [it] = pg.items.splice(idx, 1); ops.current.push({ k: 'hapus', i, it, idx }); ulang(i); hitung(); tandaiUbah() }
    }
  }
  function gerak(e, i) {
    const a = aksi.current; if (!a || a.i !== i || !e.isPrimary) return
    const [x, y] = titik(e, i)
    if (a.jenis === 'gambar') {
      if (a.it.t === 'l') a.it.p[1] = [x, y]
      else { const t = a.it.p[a.it.p.length - 1]; if (Math.hypot(x - t[0], y - t[1]) > 1.2) a.it.p.push([x, y]) }
      ulang(i)
    } else if (a.jenis === 'pindah') {
      if (Math.hypot(x - a.mulai[0], y - a.mulai[1]) > 4) a.gerak = true
      a.it.x = x - a.dx; a.it.y = y - a.dy; ulang(i)
    }
  }
  function naik(e, i) {
    const a = aksi.current; aksi.current = null; if (!a || a.i !== i) return
    if (a.jenis === 'gambar') {
      if (a.it.t === 's') a.it.p = haluskan(haluskan(a.it.p))
      ops.current.push({ k: 'tambah', i, it: a.it }); ulang(i); hitung(); tandaiUbah()
    } else if (a.jenis === 'pindah') {
      if (!a.gerak) setTeksBaru({ i, x: a.it.x, y: a.it.y, nilai: a.it.v, ukuran: Math.max(0, UKURAN_TEKS.findIndex(u => Math.abs(u[1] * halRef.current[i].w - a.it.s) < 1)), item: a.it })
      else { ops.current.push({ k: 'tambah', i, it: a.it, geser: true }); tandaiUbah() }
    }
  }
  function simpanTeks() {
    const t = teksBaru; if (!t) return
    const pg = halRef.current[t.i], s = UKURAN_TEKS[t.ukuran][1] * pg.w
    if (t.item) { if (t.nilai.trim()) { t.item.v = t.nilai.trim(); t.item.s = s; t.item.c = warna } else { pg.items = pg.items.filter(z => z !== t.item) } }
    else if (t.nilai.trim()) { const it = { t: 'x', c: warna, s, x: t.x, y: t.y, v: t.nilai.trim() }; pg.items.push(it); ops.current.push({ k: 'tambah', i: t.i, it }) }
    setTeksBaru(null); ulang(t.i); hitung(); tandaiUbah()
  }
  function urungkan() {
    const o = ops.current.pop(); if (!o) return
    const pg = halRef.current[o.i]
    if (o.k === 'tambah' && !o.geser) pg.items = pg.items.filter(z => z !== o.it)
    else if (o.k === 'hapus') pg.items.splice(o.idx, 0, o.it)
    ulang(o.i); hitung()
  }
  function tutup() {
    if (adaCoret && !confirm('Coretan belum dikirim. Tutup dan buang coretan?')) return
    onClose()
  }
  async function kirim() {
    const kena = halRef.current.filter(p => p.items.length)
    if (!kena.length && ket.trim().length < 5) { setGalat('Coret suratnya dulu, atau tulis keterangan (minimal 5 huruf).'); return }
    setSibuk(true); setGalat('')
    try {
      const urls = []
      for (const pg of kena) {
        const c = document.createElement('canvas'); c.width = pg.w; c.height = pg.h; gambarHalaman(c, pg)
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.86))
        if (!blob) throw new Error('Gambar coretan gagal dibuat.')
        const nama = `koreksi/${suratId}/${Date.now()}-h${pg.no}.jpg`
        const { error } = await supabase.storage.from('bukti-surat').upload(nama, blob, { contentType: 'image/jpeg' })
        if (error) throw new Error('Gagal mengunggah coretan: ' + error.message)
        urls.push(supabase.storage.from('bukti-surat').getPublicUrl(nama).data.publicUrl)
      }
      const ok = await onSelesai({ gambar: urls, catatan: ket.trim() })
      if (ok === false) setSibuk(false)
    } catch (e) { setGalat(e.message || 'Gagal mengirim koreksi'); setSibuk(false) }
  }

  return (
    <div className="kc" data-guard-modal="1" role="dialog" aria-modal="true" aria-label={judul}>
      <input ref={jaga} type="text" tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }} readOnly />
      <div className="kc-atas">
        <button className="kc-ib" onClick={tutup} aria-label="Tutup"><Ik u={24}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Ik></button>
        <button className="kc-ib" onClick={urungkan} disabled={!ops.current.length && !adaCoret} aria-label="Urungkan"><Ik u={24}><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></Ik></button>
        <div className="kc-judul">{judul}</div>
        <div className="kc-alat" role="toolbar" aria-label="Alat coret">
          {ALAT.map(([k, nama, ikon]) => <button key={k} className={'kc-ib kc-a' + (alat === k ? ' on' : '')} onClick={() => setAlat(k)} aria-pressed={alat === k} title={nama}><span>{ikon}</span><small>{nama}</small></button>)}
        </div>
      </div>
      <div className="kc-opsi">
        <div className="kc-warna">{WARNA.map(w => <button key={w} aria-label={'Warna ' + w} className={warna === w ? 'on' : ''} style={{ background: w }} onClick={() => setWarna(w)} />)}</div>
        <label className="kc-tebal"><span>Tebal</span><input type="range" min="1" max="10" value={tebal} onChange={e => setTebal(+e.target.value)} aria-label="Tebal pena" /></label>
        <div className="kc-zoom">{[1, 2, 3].map(z => <button key={z} className={zoom === z ? 'on' : ''} onClick={() => setZoom(z)}>{z}×</button>)}</div>
      </div>
      <div className="kc-tip">{alat === 'geser' ? 'Geser dengan jari untuk menggulir surat.' : alat === 'garis' ? 'Seret untuk membuat garis lurus (coret kata / garis bawah).' : alat === 'teks' ? 'Sentuh surat untuk menulis teks. Sentuh teks lalu seret untuk memindah, sentuh sekali untuk mengubah.' : alat === 'hapus' ? 'Sentuh coretan yang mau dihapus.' : 'Coret dengan jari. Perbesar (2×/3×) supaya coretan lebih halus dan rapi.'}</div>
      <div className="kc-kertas">
        {muat && <div className="kc-pesan">{muat}</div>}
        {galat && !halaman.length && <div className="kc-pesan err">{galat}</div>}
        <div className="kc-isi" style={{ width: `${zoom * 100}%` }}>
          {halaman.map((pg, i) => (
            <div key={i} className="kc-hal">
              {halaman.length > 1 && <div className="kc-no">Halaman {pg.no}{pg.asal ? ' · ' + pg.asal : ''}</div>}
              <canvas ref={el => { kanvas.current[i] = el }} width={pg.w} height={pg.h}
                style={{ width: '100%', height: 'auto', touchAction: alat === 'geser' ? 'auto' : 'none', cursor: alat === 'geser' ? 'grab' : alat === 'teks' ? 'text' : 'crosshair' }}
                onPointerDown={e => turun(e, i)} onPointerMove={e => gerak(e, i)} onPointerUp={e => naik(e, i)} onPointerCancel={e => naik(e, i)} />
            </div>
          ))}
        </div>
      </div>
      {teksBaru && (
        <div className="kc-teks">
          <textarea autoFocus rows={2} value={teksBaru.nilai} onChange={e => setTeksBaru({ ...teksBaru, nilai: e.target.value })} placeholder="Ketik koreksi (contoh: Ganti menjadi 'PT. Sukses Makmur')" style={{ color: warna === '#FFD400' ? '#111' : warna }} />
          <div className="kc-teks-baris">
            <div className="kc-ukuran">{UKURAN_TEKS.map(([n], k) => <button key={n} className={teksBaru.ukuran === k ? 'on' : ''} onClick={() => setTeksBaru({ ...teksBaru, ukuran: k })}>{n}</button>)}</div>
            <button className="kc-btn" onClick={() => setTeksBaru(null)}>Batal</button>
            <button className="kc-btn utama" onClick={simpanTeks}>{teksBaru.item && !teksBaru.nilai.trim() ? 'Hapus teks' : 'Pasang teks'}</button>
          </div>
        </div>
      )}
      {galat && halaman.length > 0 && <div className="kc-galat">{galat}</div>}
      <div className="kc-bawah">
        <input className="kc-ket" value={ket} onChange={e => setKet(e.target.value)} placeholder="Tambah keterangan..." aria-label="Keterangan koreksi" maxLength={500} />
        <button className="kc-kirim" onClick={kirim} disabled={sibuk || !halaman.length} aria-label="Kirim koreksi ke pembuat surat">
          {sibuk ? <span style={{ fontSize: 12, fontWeight: 700 }}>...</span> : <Ik u={26}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></Ik>}
        </button>
      </div>
    </div>
  )
}
