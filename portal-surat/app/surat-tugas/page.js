'use client'
import Link from 'next/link'
// Surat Tugas, Surat Aset, Tugas Kerja Sama. Alur persetujuan sama dengan surat keluar (ajukan -> paraf Sekretaris -> setuju + TTD Kepala Markas/Ketua, berkode).
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import Modal from '@/components/Modal'
import PersetujuanKeluar, { LABEL_SETUJU } from '@/components/PersetujuanKeluar'
import { fmtTgl, hariIni, pesanGalat, tabelBelumAda } from '@/lib/format'
import { cetakSuratTugas } from '@/lib/cetak'

const JENIS = { tugas: 'Surat Tugas', aset: 'Surat Aset', kerja_sama: 'Kerja Sama' }
const BELUM_AKTIF = 'Fitur ini belum aktif di database. Jalankan supabase/migrasi-surat-tugas.sql di Supabase (SQL Editor) satu kali.'
const kosong = j => ({ jenis: j, tanggal_surat: hariIni(), anggota: [{ nama: '', jabatan: '' }], ...(j === 'tugas' ? { angkutan: 'Darat', anggaran: 'PMI' } : {}) })
const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const tumpang = (a1, a2, b1, b2) => a1 && a2 && b1 && b2 && a1 <= b2 && b1 <= a2

export default function SuratTugasPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [rows, setRows] = useState([])
  const [kendaraan, setKendaraan] = useState([])
  const [dokumen, setDokumen] = useState([])
  const [orang, setOrang] = useState([])
  const [namaSekretaris, setNamaSekretaris] = useState('')
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [tab, setTab] = useState('tugas')
  const [cari, setCari] = useState('')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [setuju, setSetuju] = useState(null)
  const [modalMobil, setModalMobil] = useState(false)
  const [mobil, setMobil] = useState({})

  const bolehBuat = peran.isAdmin || peran.adaUnit
  const bisaUbah = r => r.status_persetujuan !== 'disetujui' && (peran.isAdmin || (bolehBuat && (r.petugas_id === peran.userId || (peran.unitId && r.unit_id === peran.unitId))))
  const bisaHapus = r => peran.isAdmin || (r.petugas_id === peran.userId && !r.status_persetujuan) || (r.petugas_id === peran.userId && r.status_persetujuan === 'revisi')

  useEffect(() => { if (!peran.loading) muat() }, [peran.loading])

  async function muat() {
    setLoading(true)
    const [r, k, d, p] = await Promise.all([
      supabase.from('surat_tugas').select('*').order('tanggal_surat', { ascending: false }).limit(1000),
      supabase.from('kendaraan').select('*').order('nama'),
      supabase.from('arsip_dokumen').select('id, jenis, nomor, judul').in('jenis', ['sk', 'pks']).order('tanggal', { ascending: false }),
      supabase.from('profiles').select('nama_lengkap, jabatan').order('nama_lengkap'),
    ])
    if (r.error) setPesan(tabelBelumAda(r.error) ? BELUM_AKTIF : pesanGalat(r.error)); else setPesan('')
    setRows(r.data || []); setKendaraan(k.data || []); setDokumen(d.data || [])
    setOrang((p.data || []).filter(x => x.nama_lengkap))
    // cari nama Sekretaris (unit bertipe sekretariat) untuk dicetak di kolom tanda tangan
    const sk = await supabase.from('profiles').select('nama_lengkap, unit:surat_unit(tipe)')
    if (!sk.error) setNamaSekretaris((sk.data || []).find(x => x.unit?.tipe === 'sekretariat')?.nama_lengkap || '')
    setLoading(false)
  }

  const tampil = useMemo(() => rows.filter(r => r.jenis === tab && (!cari || `${r.nomor_surat} ${r.perihal} ${r.tujuan_surat || ''} ${(r.anggota || []).map(a => a.nama).join(' ')}`.toLowerCase().includes(cari.toLowerCase()))), [rows, tab, cari])
  const nomorDok = id => dokumen.find(d => d.id === id)?.nomor || ''
  const sedangTugas = r => r.jenis === 'tugas' && r.status_persetujuan === 'disetujui' && r.tanggal_berangkat <= hariIni() && hariIni() <= (r.tanggal_kembali || r.tanggal_berangkat)

  function buka(r) { setEditing(r || null); setForm(r ? { ...r, anggota: r.anggota?.length ? r.anggota : [{ nama: '', jabatan: '' }] } : kosong(tab)); setError('') }
  const ubahAnggota = (i, k, v) => setForm(f => {
    const a = f.anggota.map((x, j) => (j === i ? { ...x, [k]: v } : x))
    if (k === 'nama') { const o = orang.find(p => p.nama_lengkap === v); if (o && !a[i].jabatan) a[i].jabatan = o.jabatan || '' }
    return { ...f, anggota: a }
  })

  function bentrok(f) {
    if (f.jenis !== 'tugas') return []
    const nama = (f.anggota || []).map(a => (a.nama || '').trim().toLowerCase()).filter(Boolean)
    const hasil = []
    rows.filter(r => r.jenis === 'tugas' && r.id !== editing?.id && r.status_persetujuan !== 'revisi' && tumpang(f.tanggal_berangkat, f.tanggal_kembali || f.tanggal_berangkat, r.tanggal_berangkat, r.tanggal_kembali || r.tanggal_berangkat)).forEach(r => {
      if (f.kendaraan_id && r.kendaraan_id === f.kendaraan_id) hasil.push(`Kendaraan ${r.kendaraan_nama || ''} ${r.kendaraan_nopol || ''} sudah dipakai di ${r.nomor_surat} (${fmtTgl(r.tanggal_berangkat)} – ${fmtTgl(r.tanggal_kembali)})`)
      ;(r.anggota || []).forEach(a => { if (nama.includes((a.nama || '').trim().toLowerCase())) hasil.push(`${a.nama} sudah bertugas di ${r.nomor_surat} (${fmtTgl(r.tanggal_berangkat)} – ${fmtTgl(r.tanggal_kembali)})`) })
    })
    return hasil
  }

  async function simpan(langsungCetak = false) {
    const f = form
    if (!f.nomor_surat || !f.tanggal_surat || !f.perihal) { setError('Lengkapi nomor surat, tanggal surat, dan perihal.'); return }
    if (f.jenis === 'tugas') {
      if (!f.tanggal_berangkat || !f.tanggal_kembali) { setError('Isi tanggal berangkat dan tanggal kembali.'); return }
      if (f.tanggal_kembali < f.tanggal_berangkat) { setError('Tanggal kembali tidak boleh sebelum tanggal berangkat.'); return }
      if (!(f.anggota || []).some(a => (a.nama || '').trim())) { setError('Isi minimal 1 nama yang ditugaskan.'); return }
    }
    const b = bentrok(f)
    if (b.length && !confirm('Ada jadwal yang bertabrakan:\n\n' + b.join('\n') + '\n\nTetap simpan?')) return
    const mb = kendaraan.find(k => k.id === f.kendaraan_id)
    const bersih = v => (v === '' || v === undefined ? null : v)
    const payload = {
      jenis: f.jenis, nomor_surat: f.nomor_surat.trim(), tanggal_surat: f.tanggal_surat, perihal: f.perihal.trim(),
      ...(('tembusan' in f) || bersih(f.tembusan) ? { tembusan: bersih(f.tembusan) } : {}),
      tujuan_surat: bersih(f.tujuan_surat), dasar: bersih(f.dasar), rincian: bersih(f.rincian), mengetahui: bersih(f.mengetahui),
      anggota: (f.anggota || []).filter(a => (a.nama || '').trim()).map(a => ({ nama: a.nama.trim(), jabatan: (a.jabatan || '').trim() })),
      tanggal_berangkat: bersih(f.tanggal_berangkat), tanggal_kembali: bersih(f.tanggal_kembali),
      kendaraan_id: bersih(f.kendaraan_id), kendaraan_nama: mb?.nama || null, kendaraan_nopol: mb?.nopol || null, sopir: mb?.sopir || null,
      sk_id: bersih(f.sk_id), pks_id: bersih(f.pks_id),
      angkutan: bersih(f.angkutan), anggaran: bersih(f.anggaran),
    }
    const tulis = async data => editing
      ? supabase.from('surat_tugas').update(data).eq('id', editing.id).select().single()
      : supabase.from('surat_tugas').insert({ ...data, petugas_id: peran.userId, ...(f.jenis === 'kerja_sama' ? { status_pekerjaan: 'disiapkan' } : {}) }).select().single()
    let { data: tersimpan, error: err } = await tulis(payload)
    if (err && /angkutan|anggaran/i.test(err.message)) {   // migrasi format belum dijalankan: simpan tanpa dua kolom itu
      const { angkutan, anggaran, ...tanpa } = payload
      ;({ data: tersimpan, error: err } = await tulis(tanpa))
      if (!err) alert('Tersimpan, tetapi kolom Angkutan dan Anggaran belum aktif di database. Jalankan supabase/migrasi-surat-tugas-format.sql di Supabase supaya tercetak.')
    }
    if (err) { setError(tabelBelumAda(err) ? BELUM_AKTIF : err.message); return }
    setForm(null); muat()
    if (langsungCetak && tersimpan) cetak(tersimpan)
  }

  async function hapus(r) {
    if (!confirm(`Hapus ${JENIS[r.jenis]} ${r.nomor_surat}?`)) return
    const { error: e } = await supabase.from('surat_tugas').delete().eq('id', r.id)
    if (e) alert('Belum bisa dihapus: ' + e.message); else muat()
  }
  async function statusKerja(r, st) {
    const { error: e } = await supabase.rpc('status_pekerjaan_tugas', { p_id: r.id, p_status: st })
    if (e) alert(e.message); else muat()
  }
  async function simpanMobil() {
    if (!mobil.nama || !mobil.nopol) { alert('Isi nama kendaraan dan nomor polisi.'); return }
    const { error: e } = await supabase.from('kendaraan').insert({ nama: mobil.nama.trim(), nopol: mobil.nopol.trim().toUpperCase(), sopir: mobil.sopir || null })
    if (e) { alert(/duplicate|unique/i.test(e.message) ? 'Nomor polisi itu sudah terdaftar.' : tabelBelumAda(e) ? BELUM_AKTIF : e.message); return }
    setMobil({}); muat()
  }
  async function hapusMobil(k) {
    if (!confirm(`Hapus kendaraan ${k.nama} ${k.nopol}?`)) return
    const { error: e } = await supabase.from('kendaraan').delete().eq('id', k.id)
    if (e) alert('Belum bisa dihapus: ' + e.message); else muat()
  }
  const cetak = r => cetakSuratTugas({ surat: r, skNomor: nomorDok(r.sk_id), pksNomor: nomorDok(r.pks_id), namaPencetak: peran.nama, namaSekretaris })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const j = form?.jenis

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Surat Tugas</h1><p className="desc">Surat tugas (anggota, tanggal berangkat–kembali, kendaraan), surat serah terima aset, dan tugas kerja sama. Data inventaris aset ada di menu Data Aset. Disetujui lewat paraf Sekretaris dan TTD Kepala Markas/Ketua, lalu siap dicetak otomatis.</p></div></div>
      {pesan && <div className="error-box">{pesan}</div>}
      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            {Object.entries(JENIS).map(([k, n]) => <button key={k} className={`btn ${tab === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(k)}>{n}</button>)}
            <input placeholder="Cari nomor / perihal / nama..." value={cari} onChange={e => setCari(e.target.value)} style={{ maxWidth: 240 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {tab === 'tugas' && <Link href="/data-aset?tab=kendaraan" className="btn btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Kelola Data Aset Kendaraan</Link>}
            {bolehBuat && <button className="btn btn-primary" onClick={() => buka(null)}>+ Buat {JENIS[tab]}</button>}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Tanggal</th><th>Nomor</th><th>Perihal</th>{tab === 'tugas' && <><th>Yang ditugaskan</th><th>Berangkat – Kembali</th><th>Kendaraan</th></>}{tab !== 'tugas' && <th>{tab === 'aset' ? 'Kepada' : 'Mitra'}</th>}{tab === 'kerja_sama' && <th>Pekerjaan</th>}<th>Persetujuan</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30 }}>Memuat...</td></tr> :
                tampil.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Belum ada {JENIS[tab]}.</td></tr> :
                  tampil.map(r => {
                    const [label, warna] = LABEL_SETUJU[r.status_persetujuan || null] || LABEL_SETUJU.null
                    return (
                      <tr key={r.id} style={['revisi', 'ditolak'].includes(r.status_persetujuan) ? { background: '#FFF1F1', boxShadow: 'inset 5px 0 0 #B3261E' } : undefined}>
                        <td data-label="Tanggal">{fmtTgl(r.tanggal_surat)}</td>
                        <td data-label="Nomor" className="mono">{r.nomor_surat}</td>
                        <td data-label="Perihal">{r.perihal}{sedangTugas(r) && <span className="tag" style={{ marginLeft: 6, background: 'var(--gold-bg)', color: 'var(--gold)' }}>Sedang bertugas</span>}</td>
                        {tab === 'tugas' && <>
                          <td data-label="Ditugaskan" style={{ fontSize: 13 }}>{(r.anggota || []).map(a => a.nama).join(', ') || '-'}</td>
                          <td data-label="Tanggal tugas" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{fmtTgl(r.tanggal_berangkat)} – {fmtTgl(r.tanggal_kembali)}<div style={{ color: 'var(--ink-soft)' }}>{String(r.tujuan_surat || '').split('\n').filter(Boolean).join(' · ')}</div></td>
                          <td data-label="Kendaraan" style={{ fontSize: 13 }}>{r.kendaraan_nama ? <>{r.kendaraan_nama}<br />{r.kendaraan_nopol}</> : '-'}</td>
                        </>}
                        {tab !== 'tugas' && <td data-label="Pihak">{r.tujuan_surat || '-'}</td>}
                        {tab === 'kerja_sama' && <td data-label="Pekerjaan">{r.status_pekerjaan === 'selesai' ? 'Selesai' : 'Disiapkan'}{r.status_persetujuan === 'disetujui' && <div><button className="btn btn-ghost" style={{ minHeight: 30, fontSize: 12, padding: '2px 8px' }} onClick={() => statusKerja(r, r.status_pekerjaan === 'selesai' ? 'disiapkan' : 'selesai')}>{r.status_pekerjaan === 'selesai' ? 'Buka lagi' : 'Tandai selesai'}</button></div>}</td>}
                        <td data-label="Persetujuan"><button className="btn btn-ghost" style={{ padding: '4px 10px', minHeight: 34, fontSize: 12.5, whiteSpace: 'normal', textAlign: 'left' }} onClick={() => setSetuju(r)}><span style={{ color: warna, fontWeight: 700 }}>{label}</span></button></td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-ghost" style={{ padding: '4px 8px', marginRight: 4 }} onClick={() => cetak(r)}>Cetak</button>
                          {bisaUbah(r) && <button className="btn btn-ghost" style={{ padding: '4px 8px', marginRight: 4 }} onClick={() => buka(r)}>Edit</button>}
                          {bisaHapus(r) && <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => hapus(r)}>Hapus</button>}
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {setuju && <PersetujuanKeluar supabase={supabase} surat={rows.find(x => x.id === setuju.id) || setuju} peran={peran} bisaUbah={bisaUbah(setuju)} onClose={() => setSetuju(null)} onChanged={muat}
        rpc="surat_tugas" migrasi="migrasi-surat-tugas.sql" cetak={({ surat }) => cetak(surat)} />}

      {form && (
        <Modal judul={`${editing ? 'Edit' : 'Buat'} ${JENIS[j]}`} onClose={() => setForm(null)} lebar={680}
          footer={<><button className="btn btn-ghost" onClick={() => setForm(null)}>Batal</button><button className="btn btn-ghost" onClick={() => simpan(false)}>Simpan</button><button className="btn btn-primary" onClick={() => simpan(true)}>Simpan & Cetak</button></>}>
          {error && <div className="error-box" style={{ whiteSpace: 'pre-wrap' }}>{error}</div>}
          <div className="field"><label>Tanggal Surat *</label><input type="date" value={form.tanggal_surat || ''} onChange={e => set('tanggal_surat', e.target.value)} /></div>
          <div className="field"><label>Nomor Surat *</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={form.nomor_surat || ''} onChange={e => set('nomor_surat', e.target.value)} placeholder="/01.04.00/ST-ORG/XI/2026" />
              {j === 'tugas' && <button type="button" className="btn btn-ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => { const d = new Date((form.tanggal_surat || hariIni()) + 'T00:00:00'); set('nomor_surat', `/01.04.00/ST-ORG/${ROMAWI[d.getMonth()]}/${d.getFullYear()}`) }}>Pakai format</button>}
            </div>
            {j === 'tugas' && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Tekan “Pakai format”, lalu tambahkan nomor urut di depan garis miring pertama.</div>}</div>
          <div className="field"><label>{j === 'tugas' ? 'Tugas *' : 'Perihal *'}</label>{j === 'tugas' ? <textarea rows={2} value={form.perihal || ''} onChange={e => set('perihal', e.target.value)} placeholder="mis. Pendampingan Monitoring PMI Pusat dan Distribusi Voucher ..." /> : <input value={form.perihal || ''} onChange={e => set('perihal', e.target.value)} />}</div>
          <div className="field"><label>Dasar{j === 'tugas' ? ' (satu poin per baris)' : ''}</label><textarea rows={j === 'tugas' ? 3 : 2} value={form.dasar || ''} onChange={e => set('dasar', e.target.value)} placeholder={j === 'tugas' ? 'Program Kerja PMI Provinsi Sumatera Barat tahun 2026\nRencana Kegiatan PMI Kabupaten Solok' : 'mis. Undangan dari ... / Surat Keputusan ...'} />{j === 'tugas' && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3 }}>Bila lebih dari satu baris, di surat tercetak sebagai daftar bertanda “-”.</div>}</div>
          <div className="field"><label>{j === 'tugas' ? 'Tujuan (satu tempat per baris)' : j === 'aset' ? 'Kepada' : 'Mitra / Pihak'}</label>{j === 'tugas' ? <textarea rows={3} value={form.tujuan_surat || ''} onChange={e => set('tujuan_surat', e.target.value)} placeholder={'PMI Kabupaten Solok\nKecamatan Bayang\nKecamatan Batang Kapas'} /> : <input value={form.tujuan_surat || ''} onChange={e => set('tujuan_surat', e.target.value)} />}{j === 'tugas' && <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 3 }}>Bila lebih dari satu baris, di surat tercetak bernomor 1, 2, 3.</div>}</div>
          {j === 'tugas' && <>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Tanggal Berangkat *</label><input type="date" value={form.tanggal_berangkat || ''} onChange={e => set('tanggal_berangkat', e.target.value)} /></div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Tanggal Kembali *</label><input type="date" value={form.tanggal_kembali || ''} onChange={e => set('tanggal_kembali', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Angkutan</label><input list="opsi-angkutan" value={form.angkutan || ''} onChange={e => set('angkutan', e.target.value)} placeholder="Darat" /><datalist id="opsi-angkutan"><option value="Darat" /><option value="Laut" /><option value="Udara" /><option value="Kendaraan PMI" /></datalist></div>
              <div className="field" style={{ flex: 1, minWidth: 160 }}><label>Anggaran</label><input value={form.anggaran || ''} onChange={e => set('anggaran', e.target.value)} placeholder="PMI" /></div>
            </div>
            <div className="field"><label>Kendaraan (untuk jadwal; tampil di cetakan)</label>
              <select value={form.kendaraan_id || ''} onChange={e => set('kendaraan_id', e.target.value)}>
                <option value="">Tanpa kendaraan dinas</option>
                {kendaraan.map(k => <option key={k.id} value={k.id}>{k.nama} · {k.nopol}{k.sopir ? ' · ' + k.sopir : ''}</option>)}
              </select>
              {kendaraan.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Belum ada data kendaraan. Tambah di menu Data Aset → Kendaraan.</div>}
            </div>
          </>}
          {(j === 'tugas' || j === 'kerja_sama') && (
            <div className="field"><label>{j === 'tugas' ? 'Nama yang ditugaskan *' : 'Pihak / petugas terkait'}</label>
              <datalist id="daftar-orang">{orang.map(o => <option key={o.nama_lengkap} value={o.nama_lengkap} />)}</datalist>
              {(form.anggota || []).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                  <input list="daftar-orang" placeholder="Nama" value={a.nama} onChange={e => ubahAnggota(i, 'nama', e.target.value)} style={{ flex: 2, minWidth: 160 }} />
                  <input placeholder="Jabatan" value={a.jabatan} onChange={e => ubahAnggota(i, 'jabatan', e.target.value)} style={{ flex: 2, minWidth: 140 }} />
                  <button type="button" className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => set('anggota', form.anggota.filter((_, x) => x !== i))}>✕</button>
                </div>
              ))}
              <button type="button" className="btn btn-ghost" onClick={() => set('anggota', [...(form.anggota || []), { nama: '', jabatan: '' }])}>+ Tambah orang</button>
            </div>
          )}
          {j === 'aset' && <div className="field"><label>Mengetahui</label><input value={form.mengetahui || ''} onChange={e => set('mengetahui', e.target.value)} placeholder="Nama / jabatan yang mengetahui" /></div>}
          {j !== 'tugas' && <div className="field"><label>{j === 'aset' ? 'Uraian Aset' : 'Uraian Pekerjaan'}</label><textarea rows={4} value={form.rincian || ''} onChange={e => set('rincian', e.target.value)} /></div>}
          <div className="field"><label>Dasar Surat Keputusan (opsional)</label>
            <select value={form.sk_id || ''} onChange={e => set('sk_id', e.target.value)}><option value="">— tidak ada —</option>{dokumen.filter(d => d.jenis === 'sk').map(d => <option key={d.id} value={d.id}>{d.nomor} — {d.judul}</option>)}</select></div>
          {j === 'tugas' && <div className="field"><label>Tembusan (opsional)</label><textarea rows={2} value={form.tembusan || ''} onChange={e => set('tembusan', e.target.value)} placeholder={'Satu baris satu nama, mis.\nKetua PMI Provinsi\nArsip'} /></div>}
          {j === 'kerja_sama' && <div className="field"><label>Terkait Perjanjian Kerja Sama (opsional)</label>
            <select value={form.pks_id || ''} onChange={e => set('pks_id', e.target.value)}><option value="">— tidak ada —</option>{dokumen.filter(d => d.jenis === 'pks').map(d => <option key={d.id} value={d.id}>{d.nomor} — {d.judul}</option>)}</select></div>}
        </Modal>
      )}

    </div></div>
  )
}
