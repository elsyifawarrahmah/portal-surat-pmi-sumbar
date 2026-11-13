'use client'
// Beranda gaya Srikandi: kotak besar yang bisa diklik, lalu daftar surat terbaru.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import NotifikasiButton from '@/components/NotifikasiButton'
import AjakPasang from '@/components/AjakPasang'
import PeringatanUnit from '@/components/PeringatanUnit'
import { ICONS, LINKS } from '@/components/Sidebar'
import { fmtTgl, fmtWaktu } from '@/lib/format'
import { STATUS_SURAT, statusUntukSaya } from '@/lib/surat'

function Kotak({ angka, judul, ket, warna, href }) {
  return (
    <Link href={href} style={{ display: 'block', textDecoration: 'none', color: 'inherit', background: '#fff', border: '1px solid var(--line)', borderTop: `6px solid ${warna}`, borderRadius: 16, padding: '18px 20px', minHeight: 140 }}>
      <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: warna }}>{angka}</div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 8 }}>{judul}</div>
      <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 2 }}>{ket}</div>
    </Link>
  )
}

const sapaan = () => { const j = new Date().getHours(); return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam' }

export default function Beranda() {
  const supabase = createClient()
  const router = useRouter()
  const peran = usePeran()
  const [surat, setSurat] = useState([])
  const [tujuan, setTujuan] = useState([])
  const [panggilan, setPanggilan] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (!peran.loading) load() }, [peran.loading])
  useEffect(() => {
    const ch = supabase.channel('beranda').on('postgres_changes', { event: '*', schema: 'public', table: 'surat_disposisi_tujuan' }, () => load()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'surat_masuk' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    const [s, t] = await Promise.all([
      supabase.from('surat_masuk').select('id, nomor_surat, asal_surat, perihal, tanggal_diterima_kantor, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('surat_disposisi_tujuan').select('unit_id, status, diarsipkan_pada, created_at, disposisi:surat_disposisi!disposisi_id(surat_id)').limit(5000),
    ])
    setSurat(s.data || []); setTujuan(t.data || [])
    if (peran.unitId) {
      const p = await supabase.from('surat_panggilan').select('id, pesan, created_at').eq('unit_id', peran.unitId).is('selesai_pada', null).order('created_at', { ascending: false })
      setPanggilan(p.error ? [] : p.data || [])
    }
    setLoading(false)
  }

  const peta = {}
  tujuan.forEach(x => { const id = x.disposisi?.surat_id; if (id) (peta[id] = peta[id] || []).push(x) })
  const daftar = surat.map(s => ({ s, kunci: statusUntukSaya(peta[s.id] || [], peran.unitId) }))
  const hit = (...k) => daftar.filter(d => k.includes(d.kunci)).length
  const penuh = peran.aksesPenuh
  const terbaru = daftar.filter(d => ['belum', 'belum_diteruskan'].includes(d.kunci)).slice(0, 5)

  return (
    <div className="app"><div className="main kolom" style={{ '--lebar': '980px' }}>
      <div className="hero">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="hero-sapa">{sapaan()}</div>
          <h1>Halo, {(peran.nama || '...').split(' ')[0]} </h1>
          <p>{peran.isAdmin ? 'Admin web' : peran.unit?.nama || ''} · SATRIA PMI</p>
        </div>
        <img src="/logo-satria.png" alt="" className="hero-logo" />
      </div>
      {(() => {
        const inti = [
          { href: '/surat', label: 'Surat Masuk', ikon: 'masuk', tone: '#1F5E99', pale: '#E3EBF8', badge: penuh ? hit('belum_diteruskan') : hit('belum') },
          { href: '/surat-keluar', label: 'Surat Keluar', ikon: 'keluar', tone: '#2E7D32', pale: '#E5F1E7' },
          { href: '/surat-tugas', label: 'Surat Tugas', ikon: 'tugas', tone: '#C2570C', pale: '#FEE9D8' },
          { href: '/data-aset', label: 'Data Aset', ikon: 'aset', tone: '#B7791F', pale: '#FDEFD5' },
          { href: '/lacak', label: 'Lacak Surat', ikon: 'lacak', tone: '#6B3FB5', pale: '#EBE3FB' },
          peran.bisaCatatMasuk ? { href: '/surat-masuk?tambah=1', label: 'Catat Surat', ikon: 'buku', tone: '#B3261E', pale: '#FAE8E6' } : { href: '/pasang', label: 'Pasang di HP', ikon: 'bantuan', tone: '#B3261E', pale: '#FAE8E6' },
          { href: '/bantuan', label: 'Bantuan', ikon: 'bantuan', tone: '#B7791F', pale: '#FDEFD5' },
          { href: '/dasar-hukum', label: 'Dasar Hukum', ikon: 'sk', tone: '#1F5E99', pale: '#E3EBF8' },
        ]
        const dipakai = new Set(inti.map(t => t.href.split('?')[0]))
        const palet = [['#1F5E99', '#E3EBF8'], ['#2E7D32', '#E5F1E7'], ['#C2570C', '#FEE9D8'], ['#B7791F', '#FDEFD5'], ['#6B3FB5', '#EBE3FB'], ['#B3261E', '#FAE8E6']]
        const lain = LINKS.filter(l => l.href !== '/dashboard' && !dipakai.has(l.href) && !(l.grup === 'admin' && !peran.isAdmin) && !(l.penuh && !peran.aksesPenuh))
          .map((l, i) => ({ href: l.href, label: l.label === 'Pemantauan' && !peran.bisaPantau ? 'Panggilan Biro Umum' : l.label, ikon: l.icon, tone: palet[i % 6][0], pale: palet[i % 6][1], badge: l.badge === 'panggilan' ? panggilan.length : 0 }))
        const kartu = t => (
          <Link key={t.href + t.label} href={t.href} className="tile" style={{ '--tone': t.tone, '--pale': t.pale }}>
            <span className="tile-ikon">{ICONS[t.ikon]}</span>
            <span className="tile-label">{t.label}</span>
            {t.badge > 0 && <span className="tile-badge">{t.badge > 99 ? '99+' : t.badge}</span>}
          </Link>
        )
        return <>
          <div className="tiles">{inti.map(kartu)}</div>
          {lain.length > 0 && <><h2 className="tiles-judul">Menu Lainnya</h2><div className="tiles tiles-lain">{lain.map(kartu)}</div></>}
        </>
      })()}
      <PeringatanUnit peran={peran} />

      {panggilan.length > 0 && (
        <div style={{ background: '#FBE7E7', border: '1px solid #B3261E', borderRadius: 16, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: '#B3261E', marginBottom: 4 }}>Ada panggilan dari Biro Umum</div>
          {panggilan.slice(0, 2).map(p => <div key={p.id} style={{ fontSize: 15.5, marginBottom: 4 }}>{p.pesan}</div>)}
          <Link href="/pemantauan" className="btn btn-primary" style={{ textDecoration: 'none', minHeight: 46, marginTop: 6 }}>Lihat dan tanggapi →</Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16, marginBottom: 22 }}>
        {penuh ? <>
          <Kotak href="/surat?tab=belum" angka={loading ? '…' : hit('belum_diteruskan')} judul="Belum diteruskan" ket="Surat baru yang belum didisposisikan" warna="#B3261E" />
          <Kotak href="/surat?tab=proses" angka={loading ? '…' : hit('berjalan')} judul="Sedang berjalan" ket="Sedang dikerjakan bidang tujuan" warna="#1F5E99" />
          <Kotak href="/surat?tab=selesai" angka={loading ? '…' : hit('selesai')} judul="Selesai" ket="Sudah sampai tujuan, otomatis masuk arsip bulanan" warna="#2E7D32" />
        </> : <>
          <Kotak href="/surat?tab=belum" angka={loading ? '…' : hit('belum')} judul="Belum dibaca" ket="Surat baru untuk bidangmu" warna="#B3261E" />
          <Kotak href="/surat?tab=proses" angka={loading ? '…' : hit('proses')} judul="Sedang dikerjakan" ket="Sudah kamu baca, belum selesai" warna="#1F5E99" />
          <Kotak href="/surat?tab=selesai" angka={loading ? '…' : hit('selesai', 'arsip')} judul="Selesai" ket="Sudah kamu kerjakan" warna="#2E7D32" />
        </>}
      </div>

      <h3 style={{ fontSize: 19, margin: '0 0 10px' }}>{penuh ? 'Surat yang perlu diteruskan' : 'Surat baru untuk kamu'}</h3>
      {loading ? <div style={{ color: 'var(--ink-soft)' }}>Memuat...</div> : terbaru.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed var(--line)', borderRadius: 16, padding: 24, textAlign: 'center', fontSize: 16, color: 'var(--ink-soft)' }}>Tidak ada surat baru. </div>
      ) : terbaru.map(({ s, kunci }) => (
        <div key={s.id} onClick={() => router.push(`/surat/${s.id}`)} className="row-click" style={{ background: '#fff', border: '1px solid var(--pmi-red)', borderLeft: '6px solid var(--pmi-red)', borderRadius: 14, padding: '14px 18px', marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{s.perihal}</div>
          <div style={{ fontSize: 15, color: 'var(--ink-soft)' }}>Dari <b style={{ color: 'var(--ink)' }}>{s.asal_surat}</b> · {fmtTgl(s.tanggal_diterima_kantor)}</div>
        </div>
      ))}

      <div style={{ marginTop: 24 }}><AjakPasang /><NotifikasiButton /></div>
      <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12.5, color: 'var(--ink-soft)' }}>SATRIA PMI mengikuti UU ITE, UU PDP, dan PP 71/2019. <Link href="/dasar-hukum" style={{ color: 'var(--ink-soft)', textDecoration: 'underline' }}>Dasar Hukum</Link></div>
    </div></div>
  )
}
