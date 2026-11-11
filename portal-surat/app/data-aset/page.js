'use client'
// Data Aset PMI: Kendaraan, Peralatan, Tanah, dan Aset Lain-lain. Terpisah dari Surat Tugas.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import Modal from '@/components/Modal'
import { fmtTgl, hariIni, tabelBelumAda } from '@/lib/format'

const KONDISI = ['Baik', 'Rusak ringan', 'Rusak berat']
const rupiah = v => (v === null || v === undefined || v === '' ? '-' : 'Rp ' + Number(v).toLocaleString('id-ID'))
const angka = v => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('id-ID'))
const PESAN_MIGRASI = 'Data Aset belum aktif di database. Admin web perlu menjalankan file supabase/migrasi-data-aset.sql di Supabase (SQL Editor) satu kali.'

// Konfigurasi tiap kategori: tabel, isian formulir, dan kolom daftar
const TAB = {
  kendaraan: {
    judul: 'Kendaraan', tunggal: 'Kendaraan', tabel: 'kendaraan', urut: 'nama', cari: ['nama', 'nopol', 'sopir'],
    fields: [
      { k: 'nama', label: 'Nama kendaraan', req: true, ph: 'Toyota Innova' },
      { k: 'nopol', label: 'Nomor polisi', req: true, ph: 'BA 1234 XX', upper: true },
      { k: 'jenis_kendaraan', label: 'Jenis', type: 'select', opts: ['Mobil', 'Ambulans', 'Mobil Jenazah', 'Truk / Pick-up', 'Sepeda Motor', 'Perahu / Lainnya'] },
      { k: 'tahun', label: 'Tahun', type: 'number', ph: '2020' },
      { k: 'kondisi', label: 'Kondisi', type: 'select', opts: KONDISI },
      { k: 'sopir', label: 'Sopir / pemegang', ph: 'Nama sopir' },
      { k: 'no_rangka', label: 'Nomor rangka' }, { k: 'no_mesin', label: 'Nomor mesin' },
      { k: 'pajak_berlaku', label: 'Pajak berlaku sampai', type: 'date' }, { k: 'stnk_berlaku', label: 'STNK berlaku sampai', type: 'date' },
      { k: 'lokasi', label: 'Lokasi / garasi' }, { k: 'nilai', label: 'Nilai perolehan (Rp)', type: 'number' },
      { k: 'keterangan', label: 'Keterangan', type: 'area' },
    ],
    kolom: [
      { k: 'nopol', label: 'No. Polisi', mono: true }, { k: 'nama', label: 'Kendaraan' }, { k: 'jenis_kendaraan', label: 'Jenis' },
      { k: 'tahun', label: 'Tahun' }, { k: 'kondisi', label: 'Kondisi', tag: true }, { k: 'sopir', label: 'Sopir' },
      { k: 'pajak_berlaku', label: 'Pajak', fmt: r => r.pajak_berlaku ? fmtTgl(r.pajak_berlaku) : '-', warn: r => r.pajak_berlaku && r.pajak_berlaku < tambahHari(30) },
    ],
  },
  peralatan: {
    judul: 'Peralatan', tunggal: 'Peralatan', tabel: 'aset', jenis: 'peralatan', urut: 'nama', cari: ['kode', 'nama', 'merek_tipe', 'lokasi', 'penanggung_jawab'],
    fields: [
      { k: 'kode', label: 'Nomor inventaris', ph: 'PRL-001' }, { k: 'nama', label: 'Nama peralatan', req: true, ph: 'Tenda pleton, genset, tandu, dll' },
      { k: 'merek_tipe', label: 'Merek / tipe' }, { k: 'jumlah', label: 'Jumlah', type: 'number', ph: '1' }, { k: 'satuan', label: 'Satuan', ph: 'unit, buah, set' },
      { k: 'tahun_perolehan', label: 'Tahun perolehan', type: 'number' }, { k: 'nilai', label: 'Nilai perolehan (Rp)', type: 'number' },
      { k: 'kondisi', label: 'Kondisi', type: 'select', opts: KONDISI }, { k: 'lokasi', label: 'Lokasi simpan' }, { k: 'penanggung_jawab', label: 'Penanggung jawab' },
      { k: 'keterangan', label: 'Keterangan', type: 'area' },
    ],
    kolom: [
      { k: 'kode', label: 'No. Inventaris', mono: true }, { k: 'nama', label: 'Peralatan' }, { k: 'merek_tipe', label: 'Merek / Tipe' },
      { k: 'jumlah', label: 'Jumlah', fmt: r => r.jumlah ? `${angka(r.jumlah)} ${r.satuan || ''}`.trim() : '-' },
      { k: 'kondisi', label: 'Kondisi', tag: true }, { k: 'lokasi', label: 'Lokasi' }, { k: 'penanggung_jawab', label: 'Penanggung Jawab' },
    ],
  },
  tanah: {
    judul: 'Tanah', tunggal: 'Tanah', tabel: 'aset', jenis: 'tanah', urut: 'nama', cari: ['nama', 'alamat', 'no_sertifikat', 'atas_nama'],
    fields: [
      { k: 'nama', label: 'Nama / sebutan lahan', req: true, ph: 'Tanah Markas PMI Padang' }, { k: 'alamat', label: 'Alamat / lokasi', req: true, type: 'area' },
      { k: 'luas_m2', label: 'Luas (m²)', type: 'number', req: true }, { k: 'status_hak', label: 'Status hak', type: 'select', opts: ['SHM (Hak Milik)', 'HGB', 'Hak Pakai', 'Hibah / Wakaf', 'Pinjam Pakai', 'Belum bersertifikat', 'Lainnya'] },
      { k: 'no_sertifikat', label: 'Nomor sertifikat' }, { k: 'atas_nama', label: 'Atas nama', ph: 'PMI Provinsi Sumatera Barat' },
      { k: 'tahun_perolehan', label: 'Tahun perolehan', type: 'number' }, { k: 'nilai', label: 'Nilai perolehan (Rp)', type: 'number' },
      { k: 'penggunaan', label: 'Penggunaan', ph: 'Kantor, gudang logistik, dll' }, { k: 'penanggung_jawab', label: 'Penanggung jawab' },
      { k: 'keterangan', label: 'Keterangan', type: 'area' },
    ],
    kolom: [
      { k: 'nama', label: 'Nama Lahan' }, { k: 'alamat', label: 'Alamat' }, { k: 'luas_m2', label: 'Luas', fmt: r => r.luas_m2 ? angka(r.luas_m2) + ' m²' : '-' },
      { k: 'status_hak', label: 'Status Hak', tag: true }, { k: 'no_sertifikat', label: 'No. Sertifikat', mono: true }, { k: 'atas_nama', label: 'Atas Nama' },
    ],
  },
  lainnya: {
    judul: 'Lain-lain', tunggal: 'Aset Lain', tabel: 'aset', jenis: 'lainnya', urut: 'nama', cari: ['kode', 'nama', 'kategori', 'lokasi', 'penanggung_jawab'],
    fields: [
      { k: 'kode', label: 'Nomor inventaris', ph: 'LN-001' }, { k: 'nama', label: 'Nama aset', req: true, ph: 'Gedung, mebel, komputer, dll' },
      { k: 'kategori', label: 'Kategori', ph: 'Gedung / Mebel / Elektronik / dll' }, { k: 'merek_tipe', label: 'Merek / tipe' },
      { k: 'jumlah', label: 'Jumlah', type: 'number', ph: '1' }, { k: 'satuan', label: 'Satuan' },
      { k: 'tahun_perolehan', label: 'Tahun perolehan', type: 'number' }, { k: 'nilai', label: 'Nilai perolehan (Rp)', type: 'number' },
      { k: 'kondisi', label: 'Kondisi', type: 'select', opts: KONDISI }, { k: 'lokasi', label: 'Lokasi' }, { k: 'penanggung_jawab', label: 'Penanggung jawab' },
      { k: 'keterangan', label: 'Keterangan', type: 'area' },
    ],
    kolom: [
      { k: 'kode', label: 'No. Inventaris', mono: true }, { k: 'nama', label: 'Aset' }, { k: 'kategori', label: 'Kategori' },
      { k: 'jumlah', label: 'Jumlah', fmt: r => r.jumlah ? `${angka(r.jumlah)} ${r.satuan || ''}`.trim() : '-' },
      { k: 'kondisi', label: 'Kondisi', tag: true }, { k: 'lokasi', label: 'Lokasi' },
    ],
  },
}
function tambahHari(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const WARNA_KONDISI = { 'Baik': ['#E7F4EA', '#2E7D32'], 'Rusak ringan': ['#FBF1D6', '#8F6608'], 'Rusak berat': ['#FBE7E7', '#B3261E'] }

export default function DataAsetPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [tab, setTab] = useState('kendaraan')
  const [semua, setSemua] = useState({ kendaraan: [], peralatan: [], tanah: [], lainnya: [] })
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [cari, setCari] = useState('')
  const [form, setForm] = useState(null)   // null = tutup; objek = isian (id bila mengubah)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const bolehKelola = peran.isAdmin || peran.adaUnit
  const bolehHapus = peran.isAdmin || peran.tipe === 'biro_umum'
  const cfg = TAB[tab]

  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t && TAB[t]) setTab(t) }, [])
  useEffect(() => { muat() }, [])

  async function muat() {
    setLoading(true); setPesan('')
    const [k, a] = await Promise.all([
      supabase.from('kendaraan').select('*').order('nama'),
      supabase.from('aset').select('*').order('nama'),
    ])
    if (k.error && tabelBelumAda(k.error)) setPesan(PESAN_MIGRASI)
    else if (a.error && tabelBelumAda(a.error)) setPesan(PESAN_MIGRASI)
    const aa = a.data || []
    setSemua({ kendaraan: k.data || [], peralatan: aa.filter(x => x.jenis === 'peralatan'), tanah: aa.filter(x => x.jenis === 'tanah'), lainnya: aa.filter(x => x.jenis === 'lainnya') })
    setLoading(false)
  }

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const d = semua[tab] || []
    return q ? d.filter(r => cfg.cari.some(k => String(r[k] ?? '').toLowerCase().includes(q))) : d
  }, [semua, tab, cari])

  const totalNilai = daftar.reduce((n, r) => n + (Number(r.nilai) || 0), 0)
  const jumlahBaik = daftar.filter(r => r.kondisi === 'Baik').length

  function buka(r) { setGalat(''); setForm(r ? { ...r } : {}) }
  async function simpan() {
    for (const f of cfg.fields) if (f.req && !String(form[f.k] ?? '').trim()) { setGalat('Lengkapi: ' + f.label); return }
    const payload = {}
    cfg.fields.forEach(f => {
      let v = form[f.k]
      if (v === '' || v === undefined) v = null
      else if (f.type === 'number') v = Number(v)
      else if (typeof v === 'string') v = f.upper ? v.trim().toUpperCase() : v.trim()
      payload[f.k] = v
    })
    if (cfg.jenis) payload.jenis = cfg.jenis
    if (cfg.tabel === 'aset' && payload.jumlah == null) payload.jumlah = 1
    setSibuk(true); setGalat('')
    const r = form.id ? await supabase.from(cfg.tabel).update(payload).eq('id', form.id) : await supabase.from(cfg.tabel).insert(payload)
    setSibuk(false)
    if (r.error) { setGalat(/duplicate|unique/i.test(r.error.message) ? 'Nomor polisi itu sudah terdaftar.' : tabelBelumAda(r.error) ? PESAN_MIGRASI : r.error.message); return }
    setForm(null); muat()
  }
  async function hapus(r) {
    if (!confirm(`Hapus ${cfg.tunggal.toLowerCase()} "${r.nama}"?`)) return
    const { error } = await supabase.from(cfg.tabel).delete().eq('id', r.id)
    if (error) alert('Belum bisa dihapus: ' + error.message); else muat()
  }
  async function unduh() {
    const { unduhXlsx } = await import('@/lib/excel')
    await unduhXlsx(`data-aset-${tab}-${hariIni()}`, cfg.fields.map(f => f.label), daftar.map(r => cfg.fields.map(f => r[f.k])), 'Aset ' + cfg.judul)
  }

  const nilaiSel = (c, r) => {
    const v = c.fmt ? c.fmt(r) : (r[c.k] ?? '-')
    if (c.tag && r[c.k]) { const w = WARNA_KONDISI[r[c.k]] || ['#EFE9DD', '#554D47']; return <span className="tag" style={{ background: w[0], color: w[1] }}>{r[c.k]}</span> }
    if (c.warn && c.warn(r)) return <span style={{ color: '#B3261E', fontWeight: 700 }}>{v} · segera habis</span>
    return c.mono ? <span className="mono">{v}</span> : v
  }

  return (
    <div className="app"><div className="main kolom" style={{ '--lebar': '1100px' }}>
      <div className="topbar">
        <div><h1>Data Aset</h1><p className="desc">Kendaraan, peralatan, tanah, dan aset lain milik PMI Sumatera Barat. Terpisah dari Surat Tugas.</p></div>
        {bolehKelola && !pesan && <button className="btn btn-primary" onClick={() => buka(null)}>+ Tambah {cfg.tunggal}</button>}
      </div>

      {pesan && <div style={{ background: 'var(--gold-bg)', color: 'var(--gold)', padding: '10px 14px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>{pesan}</div>}
      {!bolehKelola && !peran.loading && <div style={{ background: 'var(--gold-bg)', color: 'var(--gold)', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Akunmu hanya bisa melihat data aset. Minta admin mengatur unit/bidang kamu bila perlu mengubah.</div>}

      <div className="aset-tab" role="tablist">
        {Object.entries(TAB).map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'aktif' : ''} onClick={() => { setTab(k); setCari('') }}>
            {t.judul}<span className="aset-jml">{(semua[k] || []).length}</span>
          </button>
        ))}
      </div>

      <div className="aset-stat">
        <div className="stat"><div className="lbl">Jumlah {cfg.judul}</div><div className="val">{daftar.length}</div></div>
        <div className="stat" style={{ '--accent': '#2E7D32' }}><div className="lbl">Kondisi baik</div><div className="val">{jumlahBaik}</div></div>
        <div className="stat" style={{ '--accent': '#B7791F' }}><div className="lbl">Total nilai perolehan</div><div className="val" style={{ fontSize: 20 }}>{totalNilai ? rupiah(totalNilai) : '-'}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <input placeholder={`Cari ${cfg.judul.toLowerCase()}...`} value={cari} onChange={e => setCari(e.target.value)} style={{ maxWidth: 280 }} />
          <button className="btn btn-ghost" onClick={unduh} disabled={daftar.length === 0}>Export Excel</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr>{cfg.kolom.map(c => <th key={c.k}>{c.label}</th>)}<th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={cfg.kolom.length + 1} style={{ textAlign: 'center', padding: 30 }}>Memuat...</td></tr>
                : daftar.length === 0 ? <tr><td colSpan={cfg.kolom.length + 1} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Belum ada data {cfg.judul.toLowerCase()}.</td></tr>
                : daftar.map(r => (
                  <tr key={r.id}>
                    {cfg.kolom.map(c => <td key={c.k} data-label={c.label}>{nilaiSel(c, r)}</td>)}
                    <td data-label="" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 12px', marginRight: 6 }} onClick={() => buka(r)}>{bolehKelola ? 'Detail / Edit' : 'Detail'}</button>
                      {bolehHapus && <button className="btn btn-ghost" style={{ padding: '4px 12px' }} onClick={() => hapus(r)}>Hapus</button>}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      {tab === 'kendaraan' && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Kendaraan di sini otomatis muncul sebagai pilihan saat membuat <Link href="/surat-tugas" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>Surat Tugas</Link>.</p>}

      {form && (
        <Modal judul={form.id ? `${cfg.tunggal}: ${form.nama || ''}` : `Tambah ${cfg.tunggal}`} onClose={() => setForm(null)} lebar={640}
          footer={<><button className="btn btn-ghost" onClick={() => setForm(null)}>{bolehKelola ? 'Batal' : 'Tutup'}</button>{bolehKelola && <button className="btn btn-primary" onClick={simpan} disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>}</>}>
          {galat && <div className="error-box">{galat}</div>}
          <div className="aset-form">
            {cfg.fields.map(f => (
              <div className={'field' + (f.type === 'area' ? ' lebar' : '')} key={f.k}>
                <label>{f.label}{f.req ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <select disabled={!bolehKelola} value={form[f.k] || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })}><option value="">— pilih —</option>{f.opts.map(o => <option key={o}>{o}</option>)}</select>
                ) : f.type === 'area' ? (
                  <textarea disabled={!bolehKelola} rows={3} value={form[f.k] || ''} placeholder={f.ph || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
                ) : (
                  <input disabled={!bolehKelola} type={f.type || 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} value={form[f.k] ?? ''} placeholder={f.ph || ''} onChange={e => setForm({ ...form, [f.k]: f.upper ? e.target.value.toUpperCase() : e.target.value })} />
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div></div>
  )
}
