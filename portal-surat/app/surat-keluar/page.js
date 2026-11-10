'use client'
import { hapusBerkasLama } from '@/lib/berkas'
import PilihBerkas from '@/components/PilihBerkas'
import DaftarLampiran from '@/components/DaftarLampiran'
import Modal from '@/components/Modal'
import { LihatBerkas } from '@/components/PratinjauBerkas'
import PeringatanUnit from '@/components/PeringatanUnit'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { kodeDivisi } from '@/lib/divisi'
import { unduhBerkasZip } from '@/lib/zip'
import { usePeran, useUnits } from '@/lib/peran'
import RiwayatModal from '@/components/RiwayatModal'
import PersetujuanKeluar, { LABEL_SETUJU } from '@/components/PersetujuanKeluar'
import { PESAN_MIGRASI } from '@/lib/format'

export default function SuratKeluarPage() {
  return <Suspense fallback={null}><SuratKeluarInner /></Suspense>
}

function SuratKeluarInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const peran = usePeran()
  const { units } = useUnits()
  const [suratMasukList, setSuratMasukList] = useState([])
  const [modalRiwayat, setModalRiwayat] = useState(null)
  const [modalSetuju, setModalSetuju] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [zipProg, setZipProg] = useState(null)
  const [berkas, setBerkas] = useState([])
  const [lampiranAsli, setLampiranAsli] = useState([])
  const [modalBerkas, setModalBerkas] = useState(null)
  const [jumlahLampiran, setJumlahLampiran] = useState({})
  const [kodeSurat, setKodeSurat] = useState('')
  const [kodeLain, setKodeLain] = useState(false)

  const isAdmin = peran.isAdmin
  const bolehCatat = peran.bisaCatatKeluar
  // unit biasa (bukan admin) mengeluarkan surat atas nama unitnya sendiri
  const unitSaya = !peran.isAdmin && peran.unit ? peran.unit : null
  const [divisiLain, setDivisiLain] = useState(false)
  const bisaUbah = r => isAdmin || (bolehCatat && (r.petugas_id === peran.userId || (peran.unitId && r.unit_id === peran.unitId)))

  const fields = [
    { k:'tanggal_surat', label:'Tanggal Surat', type:'date', req:true },
    { k:'divisi', label:'Divisi / Biro yang Mengeluarkan Surat', type:'text', ph:'Biro Umum / nama bidang' },
    { k:'_kode', label:'Kode Surat (pilih, tidak perlu ketik)', type:'kode' },
    { k:'nomor_surat', label:'Nomor Surat', type:'text', req:true, ph:'005/BU/PMI-SB/VIII/2026' },
    { k:'tujuan_surat', label:'Tujuan Surat', type:'text', req:true, ph:'PMI Pusat / Dinas Sosial / dll' },
    { k:'perihal', label:'Perihal', type:'text', req:true },
    { k:'sifat', label:'Sifat Surat', type:'select', opts:['Biasa','Penting','Segera','Rahasia'] },
    { k:'tembusan', label:'Tembusan (opsional)', type:'tembusan' },
  ]
  const columns = [
    { k:'tanggal_surat', label:'Tanggal' },
    { k:'nomor_surat', label:'No. Surat' },
    { k:'divisi', label:'Divisi/Biro' },
    { k:'tujuan_surat', label:'Tujuan' },
    { k:'perihal', label:'Perihal' },
    { k:'sifat', label:'Sifat' },
  ]

  useEffect(() => { if (!peran.loading) load() }, [peran.loading])

  async function load() {
    setLoading(true)
    let r = await supabase.from('surat_keluar').select('*, profiles(nama_lengkap), jawab:surat_masuk(nomor_surat)').order('tanggal_surat', { ascending: false })
    if (r.error) r = await supabase.from('surat_keluar').select('*, profiles(nama_lengkap)').order('tanggal_surat', { ascending: false })  // database belum diperbarui
    setRows(r.data || [])
    const lc = await supabase.from('surat_lampiran').select('surat_id').eq('jenis', 'keluar')
    if (!lc.error) { const m = {}; (lc.data || []).forEach(x => { m[x.surat_id] = (m[x.surat_id] || 0) + 1 }); setJumlahLampiran(m) }
    const { data: sm } = await supabase.from('surat_masuk').select('id, nomor_surat, perihal, asal_surat, sifat').order('created_at', { ascending: false }).limit(300)
    setSuratMasukList((sm || []).filter(x => x.sifat !== 'Rahasia' || isAdmin))
    setLoading(false)
  }

  function openAdd(jawabId) { setBerkas([]); setLampiranAsli([]); setKodeLain(false); setKodeSurat(unitSaya?.kode || ''); if (unitSaya?.kode) setTimeout(() => generateNomorOtomatis(unitSaya.kode), 0); setDivisiLain(false); setEditing(null); setForm({ ...(unitSaya ? { divisi: unitSaya.nama } : {}), ...(jawabId ? { surat_masuk_id: jawabId } : {}) }); setError(''); setShowModal(true) }
  // dari tombol "Buat surat jawaban" di Disposisi: ?jawab=<id surat masuk>
  useEffect(() => { const j = searchParams.get('jawab'); if (j && !peran.loading && bolehCatat) openAdd(j) }, [searchParams, peran.loading])
  async function openEdit(row) {
    setEditing(row); setForm(row); setError(''); setShowModal(true); setKodeLain(false)
    setKodeSurat(units.find(x => x.nama === row.divisi)?.kode || '')
    setBerkas(row.file_bukti_url ? [{ url: row.file_bukti_url, nama: 'Berkas utama', lama: true }] : []); setLampiranAsli([])
    const { data } = await supabase.from('surat_lampiran').select('*').eq('jenis', 'keluar').eq('surat_id', row.id).order('created_at')
    const asli = data || []; setLampiranAsli(asli)
    setBerkas([...(row.file_bukti_url ? [{ url: row.file_bukti_url, nama: 'Berkas utama', lama: true }] : []), ...asli.map(l => ({ id: l.id, url: l.url, nama: l.nama, lama: true }))])
  }

  async function handleSave() {
    for (const f of fields) if (f.req && !form[f.k]) { setError('Lengkapi field wajib: ' + f.label); return }
    if (!editing && !form.divisi) { setError('Lengkapi field wajib: Divisi / Biro yang Mengeluarkan Surat'); return }
    const payload = {}
    fields.forEach(f => {
      if (f.k.startsWith('_')) return
      if (f.k === 'tembusan') { const t = String(form.tembusan || '').trim(); if (t || editing) payload.tembusan = t || null; return }
      payload[f.k] = form[f.k] ?? null
    })
    payload.file_bukti_url = berkas[0]?.url || null
    payload.surat_masuk_id = form.surat_masuk_id || null
    // kaitkan dengan unit: unit sendiri (akun bidang), atau cocokkan nama divisi (admin)
    const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()
    const cocok = units.find(u => norm(u.nama) === norm(form.divisi) || norm(u.nama.replace(/^bidang /i, '')) === norm(form.divisi))
    if (unitSaya) { payload.unit_id = unitSaya.id; payload.divisi = unitSaya.nama } else if (cocok) payload.unit_id = cocok.id
    const galat = e => /tembusan/i.test(e.message) ? 'Kolom Tembusan belum aktif di database. Jalankan supabase/migrasi-tembusan.sql di Supabase (SQL Editor) satu kali.' : pesanError(e)
    let id = editing?.id
    if (editing) {
      const { error } = await supabase.from('surat_keluar').update(payload).eq('id', editing.id)
      if (error) { setError(galat(error)); return }
    } else {
      const { data: userData } = await supabase.auth.getUser()
      payload.petugas_id = userData.user.id
      const { data, error } = await supabase.from('surat_keluar').insert(payload).select('id').single()
      if (error) { setError(galat(error)); return }
      id = data.id
    }
    // berkas ke-2 dst. = lampiran. Yang dibatalkan (✕) dibuang, yang baru ditambahkan.
    const lain = berkas.slice(1)
    const buang = lampiranAsli.filter(r => !lain.some(b => b.id === r.id))
    if (buang.length) {
      await supabase.from('surat_lampiran').delete().in('id', buang.map(r => r.id))
      buang.filter(r => r.url !== payload.file_bukti_url).forEach(r => hapusBerkasLama(supabase, r.url))
    }
    if (editing?.file_bukti_url && !berkas.some(b => b.url === editing.file_bukti_url)) hapusBerkasLama(supabase, editing.file_bukti_url)
    const baru = lain.filter(b => !b.id)
    if (baru.length) {
      const er = await supabase.from('surat_lampiran').insert(baru.map(b => ({ jenis: 'keluar', surat_id: id, url: b.url, nama: b.nama, ukuran: b.ukuran || null })))
      if (er.error) alert('Surat tersimpan, tetapi berkas tambahan belum bisa disimpan: ' + er.error.message)
    }
    setShowModal(false); load()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus data ini?')) return
    const { error } = await supabase.from('surat_keluar').delete().eq('id', id)
    if (error) { alert('Gagal hapus: ' + error.message); return }
    load()
  }

  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))

  // Unduh semua berkas surat keluar (sesuai hasil pencarian) dalam satu file ZIP
  async function unduhSemuaBerkas() {
    const adaBerkas = filtered.filter(r => r.file_bukti_url).length
    if (adaBerkas === 0) { alert('Belum ada berkas surat yang bisa diunduh.'); return }
    const tanpa = filtered.length - adaBerkas
    if (!confirm(`Unduh ${adaBerkas} berkas surat keluar dalam satu file ZIP?` + (tanpa ? `\n(${tanpa} surat lain tidak punya berkas terunggah.)` : ''))) return
    const hasil = await unduhBerkasZip({
      rows: filtered, namaZip: 'berkas-surat-keluar', onProgress: setZipProg,
      namaFile: r => `${r.tanggal_surat || 'tanpa-tanggal'}_${r.nomor_surat || 'tanpa-nomor'}`,
      daftarHeader: ['Tanggal','Nomor Surat','Divisi/Biro','Tujuan','Perihal','Sifat'],
      daftarBaris: filtered.map(r => [r.tanggal_surat, r.nomor_surat, r.divisi || '', r.tujuan_surat, r.perihal, r.sifat]),
    })
    setZipProg(null)
    if (hasil.gagal.length) alert(`${hasil.gagal.length} berkas gagal diunduh (daftarnya ada di GAGAL-diunduh.txt di dalam ZIP).`)
  }

  async function exportCSV() {
    const { unduhXlsx } = await import('@/lib/excel')
    await unduhXlsx(`surat-keluar-${new Date().toISOString().slice(0,10)}`, ['Tanggal','Nomor Surat','Divisi/Biro','Tujuan','Perihal','Sifat','Tembusan','Petugas'], filtered.map(r => [r.tanggal_surat, r.nomor_surat, r.divisi || '', r.tujuan_surat, r.perihal, r.sifat, String(r.tembusan || '').replace(/\n/g, '; '), r.profiles?.nama_lengkap || '']), 'Surat Keluar')
  }

  function pesanError(error) {
    if (/unit_id|surat_masuk_id|nomor_agenda/.test(error.message || '')) return PESAN_MIGRASI
    return /divisi/i.test(error.message || '')
      ? 'Kolom Divisi/Biro belum ada di database. Jalankan file supabase/migrasi-divisi-biro.sql di Supabase (SQL Editor) satu kali.'
      : error.message
  }
  const saranDivisi = [...new Set(['Biro Umum', ...rows.map(r => r.divisi).filter(Boolean)])]
  // tujuan yang paling sering dipakai sebelumnya, supaya tinggal sentuh
  const saranTujuan = (() => { const c = {}; rows.forEach(r => { const t = (r.tujuan_surat || '').trim(); if (t) c[t] = (c[t] || 0) + 1 }); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]) })()

  function kodeAktif() { return (kodeSurat || units.find(u => u.nama === form.divisi)?.kode || '').trim() }
  function generateNomorOtomatis(kodeBaru) {
    const kode = (typeof kodeBaru === 'string' ? kodeBaru : kodeAktif()).trim()
    if (!kode) { setError('Pilih Kode Surat dulu (mis. ORG, SDM).'); return }
    const romawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
    const tgl = new Date(form.tanggal_surat || Date.now()); const d = isNaN(tgl) ? new Date() : tgl
    const th = d.getFullYear()
    const pola = new RegExp('^(\\d+)/' + kode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/')
    let max = 0
    rows.forEach(r => { const n = String(r.nomor_surat || '').trim(); const m = n.match(pola); if (m && n.endsWith('/' + th)) max = Math.max(max, parseInt(m[1], 10)) })
    setError(''); setForm(f => ({ ...f, nomor_surat: `${String(max + 1).padStart(3, '0')}/${kode}/PMI-SB/${romawi[d.getMonth()]}/${th}`, _otoNomor: true }))
  }
  function tambahTembusan(t) {
    setForm(f => { const baris = String(f.tembusan || '').split('\n').map(x => x.trim()).filter(Boolean); if (baris.some(b => b.toLowerCase().includes(t.toLowerCase()))) return f; return { ...f, tembusan: [...baris, t].join('\n') } })
  }

  return (
    <div className="app">
      <div className="main">
        <div className="topbar">
          <div><h1>Surat Keluar</h1><p className="desc">Catatan surat yang dikirim keluar dari PMI Sumatera Barat.</p></div>
          {bolehCatat && <button className="btn btn-primary" onClick={() => openAdd()}>+ Tambah Data</button>}
        </div>

        <PeringatanUnit peran={peran} />
        {!bolehCatat && !peran.loading && (
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>
            👁 {peran.isBiroUmum ? 'Biro Umum hanya memantau: surat keluar dicatat oleh tiap bidang / Sekretaris.' : 'Akun kamu hanya bisa melihat data. Minta admin mengatur unit/bidang kamu di menu Data User agar bisa mencatat surat keluar.'}
          </div>
        )}
        {peran.migrasiBelum && <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>{PESAN_MIGRASI}</div>}

        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:260}} />
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="btn btn-ghost" onClick={unduhSemuaBerkas} disabled={!!zipProg}>{zipProg ? `Menyiapkan ${zipProg.n}/${zipProg.total}...` : '📦 Unduh Semua Berkas (ZIP)'}</button>
              <button className="btn btn-ghost" onClick={exportCSV}>⬇ Export Laporan (Excel)</button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Agenda</th>{columns.map(c=><th key={c.k}>{c.label}</th>)}<th>Persetujuan</th><th>Jawaban untuk</th><th>Bukti</th><th>Petugas</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={columns.length+5} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length===0 ? <tr><td colSpan={columns.length+5} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Belum ada data.</td></tr> :
                filtered.map(r => (
                  <tr key={r.id} style={['revisi','ditolak'].includes(r.status_persetujuan) ? { background: '#FFF1F1', boxShadow: 'inset 5px 0 0 #B3261E' } : undefined}>
                    <td data-label="Agenda" className="mono">{r.nomor_agenda || '-'}</td>
                    {columns.map(c => <td key={c.k} data-label={c.label}>{r[c.k] ?? '-'}</td>)}
                    <td data-label="Persetujuan"><button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,fontSize:12.5,whiteSpace:'normal',textAlign:'left'}} onClick={()=>setModalSetuju(r)}><span style={{color:(LABEL_SETUJU[r.status_persetujuan||null]||LABEL_SETUJU.null)[1],fontWeight:700}}>{(LABEL_SETUJU[r.status_persetujuan||null]||LABEL_SETUJU.null)[0]}</span></button></td>
                    <td data-label="Jawaban untuk" className="mono">{r.jawab?.nomor_surat || '-'}</td>
                    <td data-label="Bukti">{r.file_bukti_url || jumlahLampiran[r.id] ? <button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,color:'var(--pmi-red)',fontWeight:700}} onClick={()=>setModalBerkas(r)}>📎 {(r.file_bukti_url?1:0)+(jumlahLampiran[r.id]||0)} berkas</button> : '-'}</td>
                    <td data-label="Petugas">{r.profiles?.nama_lengkap || '-'}</td>
                    <td data-label="" style={{whiteSpace:'nowrap'}}>
                      <button className="btn btn-ghost" style={{padding:'4px 8px',marginRight:4}} onClick={()=>setModalRiwayat(r)}>Riwayat</button>
                      {bisaUbah(r) && r.status_persetujuan !== 'disetujui' && <button className="btn btn-ghost" style={{padding:'4px 8px',marginRight:4}} onClick={()=>openEdit(r)}>Edit</button>}
                      {isAdmin && <button className="btn btn-ghost" style={{padding:'4px 8px'}} onClick={()=>handleDelete(r.id)}>Hapus</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalSetuju && <PersetujuanKeluar supabase={supabase} surat={rows.find(x => x.id === modalSetuju.id) || modalSetuju} peran={peran} bisaUbah={bisaUbah(modalSetuju)} onClose={() => setModalSetuju(null)} onChanged={load} />}
      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} onClick={e=>{if(e.target===e.currentTarget)setShowModal(false)}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:440,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>{editing?'Edit Data':'Tambah Data'}</h3>
              <button onClick={()=>setShowModal(false)} style={{border:'none',background:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'20px 22px'}}>
              {error && <div className="error-box">{error}</div>}
              {fields.map(f => (
                <div className="field" key={f.k}>
                  <label>{f.label}</label>
                  {f.type==='kode' ? (
                    <>
                      <select value={kodeLain ? '__lain' : kodeAktif()} style={{ fontSize: 16, minHeight: 48 }}
                        onChange={e => { const v = e.target.value; if (v === '__lain') { setKodeLain(true); setKodeSurat('') } else { setKodeLain(false); setKodeSurat(v); if (v && (!form.nomor_surat || form._otoNomor)) generateNomorOtomatis(v) } }}>
                        <option value="">— pilih kode surat —</option>
                        {[...new Map(units.filter(u => u.aktif && u.kode).map(u => [u.kode, u])).values()].map(u => <option key={u.kode} value={u.kode}>{u.kode} — {u.nama}</option>)}
                        <option value="__lain">Lainnya (ketik sendiri)</option>
                      </select>
                      {kodeLain && <input style={{ marginTop: 6 }} value={kodeSurat} placeholder="mis. ORG" onChange={e => setKodeSurat(e.target.value.toUpperCase())} />}
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Contoh nomor: 012/{kodeAktif() || 'ORG'}/PMI-SB/XI/2026 — nomor urut dihitung otomatis.</div>
                    </>
                  ) : f.type==='tembusan' ? (
                    <>
                      <textarea rows={3} value={form.tembusan || ''} placeholder={'1. Ketua PMI Provinsi Sumatera Barat\n2. Arsip'} onChange={e => setForm({ ...form, tembusan: e.target.value })} />
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {['Ketua', 'Kepala Markas', 'Sekretaris', 'Biro Umum', 'Arsip'].map(t => <button key={t} type="button" className="btn btn-ghost" style={{ minHeight: 38, fontSize: 14, padding: '2px 12px', borderRadius: 999, textTransform: 'none' }} onClick={() => tambahTembusan(t)}>+ {t}</button>)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Satu baris satu nama. Boleh dikosongkan.</div>
                    </>
                  ) : f.type==='select' ? (
                    <select value={form[f.k]||''} onChange={e=>setForm({...form,[f.k]:e.target.value})}>
                      {f.opts.map(o=><option key={o}>{o}</option>)}
                    </select>
                  ) : f.k === 'divisi' && unitSaya ? (
                    <input value={unitSaya.nama} disabled />
                  ) : f.k === 'divisi' ? (
                    <>
                      <select value={divisiLain || (form.divisi && !units.some(u => u.nama === form.divisi)) ? '__lain' : (form.divisi || '')} style={{ fontSize: 16, minHeight: 48 }}
                        onChange={e => { if (e.target.value === '__lain') { setDivisiLain(true); setForm({ ...form, divisi: '' }) } else { setDivisiLain(false); setForm({ ...form, divisi: e.target.value }); const u = units.find(x => x.nama === e.target.value); if (u?.kode) { setKodeLain(false); setKodeSurat(u.kode); if (!form.nomor_surat || form._otoNomor) generateNomorOtomatis(u.kode) } } }}>
                        <option value="">— pilih bidang / biro —</option>
                        {units.filter(u => u.aktif).map(u => <option key={u.id} value={u.nama}>{u.nama}</option>)}
                        <option value="__lain">Lainnya (ketik sendiri)</option>
                      </select>
                      {(divisiLain || (form.divisi && !units.some(u => u.nama === form.divisi))) && <input style={{ marginTop: 6 }} value={form.divisi || ''} placeholder="Tulis nama divisi / biro" onChange={e => setForm({ ...form, divisi: e.target.value })} />}
                    </>
                  ) : f.k === 'tujuan_surat' ? (
                    <>
                      <input value={form[f.k] || ''} placeholder={f.ph || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
                      {saranTujuan.length > 0 && <div style={{ marginTop: 6 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 4 }}>Sering dipakai — sentuh untuk memilih:</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{saranTujuan.map(t => <button key={t} type="button" className="btn btn-ghost" style={{ minHeight: 38, fontSize: 14, padding: '2px 12px', borderRadius: 999, textTransform: 'none' }} onClick={() => setForm({ ...form, tujuan_surat: t })}>{t}</button>)}</div>
                      </div>}
                    </>
                  ) : f.k === 'nomor_surat' ? (
                    <div style={{display:'flex',gap:6}}>
                      <input type={f.type} value={form[f.k]||''} placeholder={f.ph||''} onChange={e=>setForm({...form,[f.k]:e.target.value,_otoNomor:false})} />
                      <button type="button" className="btn btn-ghost" style={{whiteSpace:'nowrap',fontSize:12}} onClick={() => generateNomorOtomatis()}>Buat Otomatis</button>
                    </div>
                  ) : (
                    <input type={f.type} value={form[f.k]||''} placeholder={f.ph||''} onChange={e=>setForm({...form,[f.k]:e.target.value})} />
                  )}
                </div>
              ))}
              <div className="field">
                <label>Surat jawaban untuk surat masuk (opsional)</label>
                <select value={form.surat_masuk_id||''} onChange={e=>setForm({...form,surat_masuk_id:e.target.value})}>
                  <option value="">— bukan surat jawaban —</option>
                  {suratMasukList.map(m => <option key={m.id} value={m.id}>{m.nomor_surat} — {m.asal_surat}: {m.perihal}</option>)}
                </select>
                <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:4}}>Nomor agenda surat keluar terisi otomatis. Setelah tersimpan, catat pengirimannya di menu <Link href="/ekspedisi" style={{color:'var(--pmi-red)',fontWeight:700}}>Ekspedisi</Link>.</div>
              </div>
              <PilihBerkas supabase={supabase} value={berkas} onChange={setBerkas} onSibuk={setUploading} />
            </div>
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>Simpan Data</button>
            </div>
          </div>
        </div>
      )}
      {modalBerkas && <Modal judul={`Ruang file — ${modalBerkas.nomor_surat}`} onClose={() => setModalBerkas(null)} lebar={560}><DaftarLampiran supabase={supabase} jenis="keluar" suratId={modalBerkas.id} fileUtamaUrl={modalBerkas.file_bukti_url} fileUtamaNama="Berkas utama" boleh={bisaUbah(modalBerkas) && modalBerkas.status_persetujuan !== 'disetujui'} peran={peran} /></Modal>}
      {modalRiwayat && <RiwayatModal supabase={supabase} jenis="keluar" surat={modalRiwayat} peran={peran} onClose={() => setModalRiwayat(null)} />}
    </div>
  )
}
