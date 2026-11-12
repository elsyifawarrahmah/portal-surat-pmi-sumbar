'use client'
// Data Aset PMI: Kendaraan, Peralatan, Tanah, dan Aset Lain-lain. Terpisah dari Surat Tugas.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import Modal from '@/components/Modal'
import { cetakRekapAset } from '@/lib/cetak'
import { fmtTgl, hariIni, tabelBelumAda } from '@/lib/format'

const KONDISI = ['Baik', 'Rusak ringan', 'Rusak berat']
const rupiah = v => (v === null || v === undefined || v === '' ? '-' : 'Rp ' + Number(v).toLocaleString('id-ID'))
const angka = v => (v === null || v === undefined || v === '' ? '-' : Number(v).toLocaleString('id-ID'))
const PESAN_MIGRASI = 'Data Aset belum aktif di database. Admin web perlu menjalankan supabase/migrasi-data-aset.sql lalu supabase/migrasi-data-aset-2.sql di Supabase (SQL Editor), masing-masing satu kali.'
const normPlat = s => String(s || '').replace(/\s+/g, '').toUpperCase()
const tambahHari = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const diMarkas = r => !r.penempatan || r.penempatan === 'Markas'

// Peralatan: kategori menentukan seberapa lengkap isiannya (true = perlu detail lengkap, false = cukup ringkas)
const KATEGORI_PERALATAN = { 'Tenda & Shelter': false, 'Logistik & Bantuan': false, 'Evakuasi & Tandu': false, 'Air & Sanitasi': false, 'Medis & Kesehatan': true, 'Komunikasi & Elektronik': true, 'Mesin & Genset': true, 'Lainnya': false }

const TAB = {
  kendaraan: {
    judul: 'Kendaraan', tunggal: 'Kendaraan', tabel: 'kendaraan', cari: ['nama', 'nopol', 'pemegang', 'peruntukan', 'penempatan'],
    fields: [
      { k: 'nama', label: 'Nama kendaraan', req: true, ph: 'Toyota Innova' },
      { k: 'nopol', label: 'Nomor polisi', req: true, ph: 'BA 1234 XX', upper: true },
      { k: 'jenis_kendaraan', label: 'Jenis', type: 'select', opts: ['Mobil', 'Ambulans', 'Mobil Jenazah', 'Truk / Pick-up', 'Sepeda Motor', 'Perahu / Lainnya'] },
      { k: 'tahun', label: 'Tahun produksi', type: 'number', ph: '2020', req: true },
      { k: 'peruntukan', label: 'Dipergunakan sebagai', type: 'select', req: true, opts: ['Operasional Pimpinan', 'Operasional Staff', 'Operasional Lokpus', 'Peminjaman', 'Ambulans / Layanan'] },
      { k: 'kondisi', label: 'Kondisi', type: 'select', opts: KONDISI },
      { k: 'penempatan', label: 'Penempatan', type: 'select', req: true, opts: ['Markas', 'Ketua', 'Staff', 'Perorangan'], bantu: 'Di Markas tidak perlu surat. Ketua, Staff, atau perorangan wajib ada surat bukti penyerahan.' },
      { k: 'pemegang', label: 'Nama pemegang', ph: 'Nama pejabat / staff', tampil: f => !diMarkas(f), wajib: f => !diMarkas(f) },
      { k: 'surat_bukti_id', label: 'Surat bukti penyerahan (Surat Aset)', type: 'surat', tampil: f => !diMarkas(f), wajib: f => !diMarkas(f), lebar: true },
      { k: 'no_rangka', label: 'Nomor rangka' }, { k: 'no_mesin', label: 'Nomor mesin' },
      { k: 'pajak_berlaku', label: 'Pajak berlaku sampai', type: 'date' }, { k: 'stnk_berlaku', label: 'STNK berlaku sampai', type: 'date' },
      { k: 'nilai', label: 'Nilai perolehan (Rp)', type: 'number' },
      { k: 'keterangan', label: 'Keterangan', type: 'area' },
    ],
    kolom: [
      { k: 'nopol', label: 'No. Polisi', mono: true },
      { k: 'nama', label: 'Kendaraan', fmt: r => r.tahun ? `${r.nama} (${r.tahun})` : r.nama },
      { k: 'peruntukan', label: 'Dipergunakan' },
      { k: 'penempatan', label: 'Penempatan', fmt: r => diMarkas(r) ? 'Markas' : `${r.penempatan}${r.pemegang ? ': ' + r.pemegang : ''}` },
      { k: 'surat', label: 'Surat Bukti', surat: true },
      { k: 'kondisi', label: 'Kondisi', tag: true },
      { k: 'pajak_berlaku', label: 'Pajak', fmt: r => r.pajak_berlaku ? fmtTgl(r.pajak_berlaku) : '-', warn: r => r.pajak_berlaku && r.pajak_berlaku < tambahHari(30) },
      { k: 'dipakai', label: 'Dipakai', pakai: true },
    ],
  },
  peralatan: {
    judul: 'Peralatan', tunggal: 'Peralatan', tabel: 'aset', jenis: 'peralatan', cari: ['kode', 'nama', 'kategori', 'merek_tipe', 'lokasi', 'penanggung_jawab'], mode: true, kategoriMode: KATEGORI_PERALATAN,
    fields: [
      { k: 'nama', label: 'Nama peralatan', req: true, ph: 'Tenda pleton, genset, tandu, radio HT...' },
      { k: 'kategori', label: 'Kategori', type: 'select', opts: Object.keys(KATEGORI_PERALATAN) },
      { k: 'jumlah', label: 'Jumlah', type: 'number', ph: '1' }, { k: 'satuan', label: 'Satuan', ph: 'unit, buah, set' },
      { k: 'kondisi', label: 'Kondisi', type: 'select', opts: KONDISI },
      { k: 'kode', label: 'Nomor inventaris', ph: 'PRL-001', lengkap: true }, { k: 'merek_tipe', label: 'Merek / tipe', lengkap: true },
      { k: 'no_seri', label: 'Nomor seri', lengkap: true }, { k: 'spesifikasi', label: 'Spesifikasi', type: 'area', lengkap: true },
      { k: 'tahun_perolehan', label: 'Tahun perolehan', type: 'number', lengkap: true }, { k: 'nilai', label: 'Nilai perolehan (Rp)', type: 'number', lengkap: true },
      { k: 'garansi_sampai', label: 'Garansi sampai', type: 'date', lengkap: true }, { k: 'servis_terakhir', label: 'Servis terakhir', type: 'date', lengkap: true },
      { k: 'lokasi', label: 'Lokasi simpan', lengkap: true }, { k: 'penanggung_jawab', label: 'Penanggung jawab', lengkap: true },
      { k: 'keterangan', label: 'Keterangan', type: 'area', lengkap: true },
    ],
    kolom: [
      { k: 'kode', label: 'No. Inventaris', mono: true }, { k: 'nama', label: 'Peralatan' }, { k: 'kategori', label: 'Kategori' },
      { k: 'jumlah', label: 'Jumlah', fmt: r => r.jumlah ? `${angka(r.jumlah)} ${r.satuan || ''}`.trim() : '-' },
      { k: 'kondisi', label: 'Kondisi', tag: true }, { k: 'lokasi', label: 'Lokasi' }, { k: 'penanggung_jawab', label: 'Penanggung Jawab' },
    ],
  },
  tanah: {
    judul: 'Tanah', tunggal: 'Tanah', tabel: 'aset', jenis: 'tanah', cari: ['nama', 'alamat', 'no_sertifikat', 'atas_nama'],
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
    judul: 'Lain-lain', tunggal: 'Aset Lain', tabel: 'aset', jenis: 'lainnya', cari: ['kode', 'nama', 'kategori', 'lokasi', 'penanggung_jawab'], mode: true,
    fields: [
      { k: 'nama', label: 'Nama aset', req: true, ph: 'Gedung, mebel, komputer, dll' },
      { k: 'kategori', label: 'Kategori', ph: 'Gedung / Mebel / Elektronik / dll' },
      { k: 'jumlah', label: 'Jumlah', type: 'number', ph: '1' }, { k: 'satuan', label: 'Satuan' },
      { k: 'kondisi', label: 'Kondisi', type: 'select', opts: KONDISI },
      { k: 'kode', label: 'Nomor inventaris', ph: 'LN-001', lengkap: true }, { k: 'merek_tipe', label: 'Merek / tipe', lengkap: true },
      { k: 'tahun_perolehan', label: 'Tahun perolehan', type: 'number', lengkap: true }, { k: 'nilai', label: 'Nilai perolehan (Rp)', type: 'number', lengkap: true },
      { k: 'lokasi', label: 'Lokasi', lengkap: true }, { k: 'penanggung_jawab', label: 'Penanggung jawab', lengkap: true },
      { k: 'keterangan', label: 'Keterangan', type: 'area', lengkap: true },
    ],
    kolom: [
      { k: 'kode', label: 'No. Inventaris', mono: true }, { k: 'nama', label: 'Aset' }, { k: 'kategori', label: 'Kategori' },
      { k: 'jumlah', label: 'Jumlah', fmt: r => r.jumlah ? `${angka(r.jumlah)} ${r.satuan || ''}`.trim() : '-' },
      { k: 'kondisi', label: 'Kondisi', tag: true }, { k: 'lokasi', label: 'Lokasi' },
    ],
  },
}
const WARNA_KONDISI = { 'Baik': ['#E7F4EA', '#2E7D32'], 'Rusak ringan': ['#FBF1D6', '#8F6608'], 'Rusak berat': ['#FBE7E7', '#B3261E'] }

export default function DataAsetPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [tab, setTab] = useState('kendaraan')
  const [semua, setSemua] = useState({ kendaraan: [], peralatan: [], tanah: [], lainnya: [] })
  const [suratTugas, setSuratTugas] = useState([])   // surat tugas (pemakaian kendaraan) + surat aset (bukti penyerahan)
  const [nama, setNama] = useState({ sekretaris: '', biro: '' })
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [cari, setCari] = useState('')
  const [form, setForm] = useState(null)
  const [lengkap, setLengkap] = useState(false)
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const bolehKelola = peran.isAdmin || peran.adaUnit
  const bolehHapus = peran.isAdmin || peran.tipe === 'biro_umum'
  const cfg = TAB[tab]

  useEffect(() => { const t = new URLSearchParams(window.location.search).get('tab'); if (t && TAB[t]) setTab(t) }, [])
  useEffect(() => { muat() }, [])

  async function muat() {
    setLoading(true); setPesan('')
    const [k, a, st, pr] = await Promise.all([
      supabase.from('kendaraan').select('*').order('nama'),
      supabase.from('aset').select('*').order('nama'),
      supabase.from('surat_tugas').select('id, jenis, nomor_surat, tanggal_surat, perihal, tujuan_surat, tanggal_berangkat, tanggal_kembali, kendaraan_id, kendaraan_nopol').in('jenis', ['tugas', 'aset']).order('tanggal_surat', { ascending: false }),
      supabase.from('profiles').select('nama_lengkap, unit:surat_unit(tipe)'),
    ])
    if (k.error && tabelBelumAda(k.error)) setPesan(PESAN_MIGRASI)
    else if (a.error && tabelBelumAda(a.error)) setPesan(PESAN_MIGRASI)
    const aa = a.data || []
    setSemua({ kendaraan: k.data || [], peralatan: aa.filter(x => x.jenis === 'peralatan'), tanah: aa.filter(x => x.jenis === 'tanah'), lainnya: aa.filter(x => x.jenis === 'lainnya') })
    setSuratTugas(st.error ? [] : st.data || [])
    if (!pr.error) { const p = pr.data || []; setNama({ sekretaris: p.find(x => x.unit?.tipe === 'sekretariat')?.nama_lengkap || '', biro: p.find(x => x.unit?.tipe === 'biro_umum')?.nama_lengkap || '' }) }
    setLoading(false)
  }

  const suratAset = useMemo(() => suratTugas.filter(s => s.jenis === 'aset'), [suratTugas])
  const suratById = useMemo(() => Object.fromEntries(suratTugas.map(s => [s.id, s])), [suratTugas])
  // pemakaian kendaraan = jumlah Surat Tugas yang memakai kendaraan itu (otomatis dari surat, termasuk tujuannya)
  const pakaiDari = useMemo(() => {
    const m = {}
    suratTugas.filter(s => s.jenis === 'tugas' && (s.kendaraan_id || s.kendaraan_nopol)).forEach(s => {
      const kunci = s.kendaraan_id || 'p:' + normPlat(s.kendaraan_nopol); (m[kunci] ||= []).push(s)
    })
    return m
  }, [suratTugas])
  const riwayatPakai = r => {
    const a = pakaiDari[r.id] || [], b = pakaiDari['p:' + normPlat(r.nopol)] || []
    const gab = [...a, ...b.filter(x => !a.some(y => y.id === x.id))]
    return gab.sort((x, y) => String(y.tanggal_berangkat || y.tanggal_surat).localeCompare(String(x.tanggal_berangkat || x.tanggal_surat)))
  }

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase()
    const d = semua[tab] || []
    return q ? d.filter(r => cfg.cari.some(k => String(r[k] ?? '').toLowerCase().includes(q))) : d
  }, [semua, tab, cari])

  const totalNilai = daftar.reduce((n, r) => n + (Number(r.nilai) || 0), 0)
  const jumlahBaik = daftar.filter(r => r.kondisi === 'Baik').length
  const totalPakai = tab === 'kendaraan' ? daftar.reduce((n, r) => n + riwayatPakai(r).length, 0) : 0
  const tanpaSurat = tab === 'kendaraan' ? daftar.filter(r => !diMarkas(r) && !r.surat_bukti_id).length : 0

  const adaIsiLengkap = r => TAB[tab].fields.some(f => f.lengkap && r[f.k] !== null && r[f.k] !== undefined && r[f.k] !== '')
  function buka(r) { setGalat(''); setForm(r ? { ...r } : {}); setLengkap(r ? adaIsiLengkap(r) : false) }
  const tampilField = f => (!f.lengkap || lengkap) && (!f.tampil || f.tampil(form || {}))
  function ubah(f, v) {
    const baru = { ...form, [f.k]: f.upper ? String(v).toUpperCase() : v }
    if (f.k === 'penempatan' && v === 'Markas') { baru.pemegang = ''; baru.surat_bukti_id = '' }
    setForm(baru)
    if (cfg.kategoriMode && f.k === 'kategori' && cfg.kategoriMode[v] !== undefined) setLengkap(cfg.kategoriMode[v])
  }

  async function simpan() {
    const tampil = cfg.fields.filter(tampilField)
    for (const f of tampil) {
      const wajib = f.req || (f.wajib && f.wajib(form))
      if (wajib && !String(form[f.k] ?? '').trim()) { setGalat(f.k === 'surat_bukti_id' ? 'Kendaraan yang ditempatkan pada Ketua, Staff, atau perorangan wajib punya surat bukti penyerahan (pilih Surat Aset, atau buat dulu di menu Surat Tugas → Surat Aset).' : 'Lengkapi: ' + f.label); return }
    }
    const payload = {}
    tampil.forEach(f => {
      let v = form[f.k]
      if (v === '' || v === undefined) v = null
      else if (f.type === 'number') v = Number(v)
      else if (typeof v === 'string' && f.type !== 'surat') v = f.upper ? v.trim().toUpperCase() : v.trim()
      payload[f.k] = v
    })
    if (tab === 'kendaraan' && diMarkas(form)) { payload.pemegang = null; payload.surat_bukti_id = null }
    if (cfg.jenis) payload.jenis = cfg.jenis
    if (cfg.tabel === 'aset' && payload.jumlah == null && !form.id) payload.jumlah = 1
    setSibuk(true); setGalat('')
    const r = form.id ? await supabase.from(cfg.tabel).update(payload).eq('id', form.id) : await supabase.from(cfg.tabel).insert(payload)
    setSibuk(false)
    if (r.error) { setGalat(/duplicate|unique/i.test(r.error.message) ? 'Nomor polisi itu sudah terdaftar.' : tabelBelumAda(r.error) || /column/i.test(r.error.message) ? PESAN_MIGRASI : r.error.message); return }
    setForm(null); muat()
  }
  async function hapus(r) {
    if (!confirm(`Hapus ${cfg.tunggal.toLowerCase()} "${r.nama}"?`)) return
    const { error } = await supabase.from(cfg.tabel).delete().eq('id', r.id)
    if (error) alert('Belum bisa dihapus: ' + error.message); else muat()
  }

  // teks polos sebuah kolom (untuk Excel & cetak rekap)
  const teksSel = (c, r) => {
    if (c.surat) return diMarkas(r) ? 'Tidak perlu (Markas)' : (suratById[r.surat_bukti_id]?.nomor_surat || 'BELUM ADA')
    if (c.pakai) return `${riwayatPakai(r).length} kali`
    const v = c.fmt ? c.fmt(r) : r[c.k]
    return v === null || v === undefined || v === '' ? '-' : String(v)
  }
  async function unduh() {
    const { unduhXlsx } = await import('@/lib/excel')
    const judul = cfg.fields.filter(f => f.type !== 'surat').map(f => f.label)
    if (tab === 'kendaraan') judul.push('Surat bukti', 'Dipakai (kali)')
    const baris = daftar.map(r => { const x = cfg.fields.filter(f => f.type !== 'surat').map(f => r[f.k]); if (tab === 'kendaraan') x.push(diMarkas(r) ? 'Tidak perlu (Markas)' : suratById[r.surat_bukti_id]?.nomor_surat || 'BELUM ADA', riwayatPakai(r).length); return x })
    await unduhXlsx(`data-aset-${tab}-${hariIni()}`, judul, baris, 'Aset ' + cfg.judul)
  }
  function rekap() {
    cetakRekapAset({
      jenis: cfg.judul, kolom: cfg.kolom.map(c => c.label), baris: daftar.map(r => cfg.kolom.map(c => teksSel(c, r))),
      ringkasan: `Jumlah: ${daftar.length} ${tab === 'kendaraan' ? 'unit' : 'data'}${totalNilai ? ' · Total nilai perolehan: ' + rupiah(totalNilai) : ''}${tab === 'kendaraan' ? ` · Total pemakaian: ${totalPakai} kali` : ''}`,
      namaBiro: nama.biro, namaSekretaris: nama.sekretaris, namaPencetak: peran.nama,
    })
  }

  const nilaiSel = (c, r) => {
    if (c.surat) return diMarkas(r) ? <span style={{ color: 'var(--ink-soft)' }}>Tidak perlu</span> : r.surat_bukti_id ? <span className="mono" style={{ color: '#2E7D32', fontWeight: 700 }}>{suratById[r.surat_bukti_id]?.nomor_surat || 'Ada'}</span> : <span style={{ color: '#B3261E', fontWeight: 800 }}>Belum ada</span>
    if (c.pakai) { const n = riwayatPakai(r).length; return <span style={{ fontWeight: 700 }}>{n} kali</span> }
    const v = c.fmt ? c.fmt(r) : (r[c.k] ?? '-')
    if (c.tag && r[c.k]) { const w = WARNA_KONDISI[r[c.k]] || ['#EFE9DD', '#554D47']; return <span className="tag" style={{ background: w[0], color: w[1] }}>{r[c.k]}</span> }
    if (c.warn && c.warn(r)) return <span style={{ color: '#B3261E', fontWeight: 700 }}>{v} · segera habis</span>
    return c.mono ? <span className="mono">{v}</span> : v
  }
  const riwayatForm = tab === 'kendaraan' && form?.id ? riwayatPakai(form) : []

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
        {tab === 'kendaraan' && <div className="stat" style={{ '--accent': '#1F5E99' }}><div className="lbl">Total pemakaian (dari Surat Tugas)</div><div className="val">{totalPakai} kali</div></div>}
        {tab === 'kendaraan' && tanpaSurat > 0 && <div className="stat" style={{ '--accent': '#B3261E' }}><div className="lbl">Belum ada surat bukti</div><div className="val" style={{ color: '#B3261E' }}>{tanpaSurat}</div></div>}
        <div className="stat" style={{ '--accent': '#B7791F' }}><div className="lbl">Total nilai perolehan</div><div className="val" style={{ fontSize: 20 }}>{totalNilai ? rupiah(totalNilai) : '-'}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: 8 }}>
          <input placeholder={`Cari ${cfg.judul.toLowerCase()}...`} value={cari} onChange={e => setCari(e.target.value)} style={{ maxWidth: 280 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={rekap} disabled={daftar.length === 0}>Cetak Rekap</button>
            <button className="btn btn-ghost" onClick={unduh} disabled={daftar.length === 0}>Export Excel</button>
          </div>
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
      {tab === 'kendaraan' && <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Kendaraan di sini otomatis muncul sebagai pilihan saat membuat <Link href="/surat-tugas" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>Surat Tugas</Link>. Jumlah pemakaian dan tujuannya dihitung otomatis dari Surat Tugas yang memakai kendaraan itu.</p>}

      {form && (
        <Modal judul={form.id ? `${cfg.tunggal}: ${form.nama || ''}` : `Tambah ${cfg.tunggal}`} onClose={() => setForm(null)} lebar={680}
          footer={<><button className="btn btn-ghost" onClick={() => setForm(null)}>{bolehKelola ? 'Batal' : 'Tutup'}</button>{bolehKelola && <button className="btn btn-primary" onClick={simpan} disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan'}</button>}</>}>
          {galat && <div className="error-box">{galat}</div>}
          {cfg.mode && (
            <div className="aset-mode" role="group" aria-label="Seberapa lengkap isiannya">
              <button type="button" className={!lengkap ? 'aktif' : ''} onClick={() => setLengkap(false)}>Ringkas</button>
              <button type="button" className={lengkap ? 'aktif' : ''} onClick={() => setLengkap(true)}>Lengkap</button>
              <span>{lengkap ? 'Semua kolom detail (merek, nomor seri, garansi, dst.)' : 'Cukup data inti. Pilih Lengkap bila peralatan ini perlu pendataan detail.'}</span>
            </div>
          )}
          <div className="aset-form">
            {cfg.fields.filter(tampilField).map(f => {
              const wajib = f.req || (f.wajib && f.wajib(form))
              return (
                <div className={'field' + (f.type === 'area' || f.lebar ? ' lebar' : '')} key={f.k}>
                  <label>{f.label}{wajib ? ' *' : ''}</label>
                  {f.type === 'select' ? (
                    <select disabled={!bolehKelola} value={form[f.k] || ''} onChange={e => ubah(f, e.target.value)}><option value="">— pilih —</option>{f.opts.map(o => <option key={o}>{o}</option>)}</select>
                  ) : f.type === 'surat' ? (
                    <>
                      <select disabled={!bolehKelola} value={form[f.k] || ''} onChange={e => ubah(f, e.target.value)}>
                        <option value="">— pilih surat bukti —</option>
                        {suratAset.map(s => <option key={s.id} value={s.id}>{s.nomor_surat} · {s.perihal}{s.tujuan_surat ? ' · ' + s.tujuan_surat : ''}</option>)}
                      </select>
                      {suratAset.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>Belum ada Surat Aset. Buat dulu di <Link href="/surat-tugas" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>Surat Tugas → Surat Aset</Link>.</div>}
                    </>
                  ) : f.type === 'area' ? (
                    <textarea disabled={!bolehKelola} rows={3} value={form[f.k] || ''} placeholder={f.ph || ''} onChange={e => ubah(f, e.target.value)} />
                  ) : (
                    <input disabled={!bolehKelola} type={f.type || 'text'} inputMode={f.type === 'number' ? 'decimal' : undefined} value={form[f.k] ?? ''} placeholder={f.ph || ''} onChange={e => ubah(f, e.target.value)} />
                  )}
                  {f.bantu && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>{f.bantu}</div>}
                </div>
              )
            })}
          </div>
          {tab === 'kendaraan' && form.id && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>Riwayat pemakaian: {riwayatForm.length} kali <span style={{ fontWeight: 500, color: 'var(--ink-soft)', fontSize: 13 }}>(otomatis dari Surat Tugas)</span></div>
              {riwayatForm.length === 0 ? <div style={{ color: 'var(--ink-soft)', fontSize: 14 }}>Belum pernah dipakai di Surat Tugas.</div> : (
                <ol style={{ margin: 0, paddingLeft: 18, maxHeight: 190, overflowY: 'auto', fontSize: 14 }}>
                  {riwayatForm.map(s => <li key={s.id} style={{ marginBottom: 4 }}><b>{s.tujuan_surat || '-'}</b> · {s.tanggal_berangkat ? fmtTgl(s.tanggal_berangkat) : fmtTgl(s.tanggal_surat)}{s.tanggal_kembali && s.tanggal_kembali !== s.tanggal_berangkat ? ' – ' + fmtTgl(s.tanggal_kembali) : ''}<div style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>{s.nomor_surat} · {s.perihal}</div></li>)}
                </ol>
              )}
            </div>
          )}
        </Modal>
      )}
    </div></div>
  )
}
