'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { kodeDivisi } from '@/lib/divisi'
import { unduhBerkasZip } from '@/lib/zip'

export default function SuratKeluarPage() {
  const supabase = createClient()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [myRole, setMyRole] = useState('viewer')
  const [uploading, setUploading] = useState(false)
  const [zipProg, setZipProg] = useState(null)

  const isAdmin = myRole === 'admin'

  const fields = [
    { k:'tanggal_surat', label:'Tanggal Surat', type:'date', req:true },
    { k:'divisi', label:'Divisi / Biro yang Mengeluarkan Surat', type:'text', ph:'Biro Umum / nama bidang' },
    { k:'nomor_surat', label:'Nomor Surat', type:'text', req:true, ph:'005/BU/PMI-SB/VIII/2026' },
    { k:'tujuan_surat', label:'Tujuan Surat', type:'text', req:true, ph:'PMI Pusat / Dinas Sosial / dll' },
    { k:'perihal', label:'Perihal', type:'text', req:true },
    { k:'sifat', label:'Sifat Surat', type:'select', opts:['Biasa','Penting','Segera','Rahasia'] },
  ]
  const columns = [
    { k:'tanggal_surat', label:'Tanggal' },
    { k:'nomor_surat', label:'No. Surat' },
    { k:'divisi', label:'Divisi/Biro' },
    { k:'tujuan_surat', label:'Tujuan' },
    { k:'perihal', label:'Perihal' },
    { k:'sifat', label:'Sifat' },
  ]

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
      if (profile) setMyRole(profile.role)
    }
    const { data } = await supabase.from('surat_keluar').select('*, profiles(nama_lengkap)').order('tanggal_surat', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  function openAdd() { setEditing(null); setForm({}); setError(''); setShowModal(true) }
  function openEdit(row) { setEditing(row); setForm(row); setError(''); setShowModal(true) }

  async function handleUploadBukti(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
    const { error: uploadErr } = await supabase.storage.from('bukti-surat').upload(filename, file)
    if (uploadErr) { setError('Gagal upload file: ' + uploadErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('bukti-surat').getPublicUrl(filename)
    setForm(f => ({ ...f, file_bukti_url: urlData.publicUrl, file_bukti_nama: file.name }))
    setUploading(false)
  }

  async function handleSave() {
    for (const f of fields) if (f.req && !form[f.k]) { setError('Lengkapi field wajib: ' + f.label); return }
    if (!editing && !form.divisi) { setError('Lengkapi field wajib: Divisi / Biro yang Mengeluarkan Surat'); return }
    const payload = {}
    fields.forEach(f => payload[f.k] = form[f.k] ?? null)
    if (form.file_bukti_url) payload.file_bukti_url = form.file_bukti_url
    if (editing) {
      const { error } = await supabase.from('surat_keluar').update(payload).eq('id', editing.id)
      if (error) { setError(pesanError(error)); return }
    } else {
      const { data: userData } = await supabase.auth.getUser()
      payload.petugas_id = userData.user.id
      const { error } = await supabase.from('surat_keluar').insert(payload)
      if (error) { setError(pesanError(error)); return }
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

  function exportCSV() {
    const header = ['Tanggal','Nomor Surat','Divisi/Biro','Tujuan','Perihal','Sifat','Petugas'].join(';')
    const csvRows = filtered.map(r => [r.tanggal_surat, r.nomor_surat, r.divisi||'', r.tujuan_surat, r.perihal, r.sifat, r.profiles?.nama_lengkap||''].join(';'))
    const csv = '\uFEFF' + [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `surat-keluar-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function pesanError(error) {
    return /divisi/i.test(error.message || '')
      ? 'Kolom Divisi/Biro belum ada di database. Jalankan file supabase/migrasi-divisi-biro.sql di Supabase (SQL Editor) satu kali.'
      : error.message
  }
  const saranDivisi = [...new Set(['Biro Umum', ...rows.map(r => r.divisi).filter(Boolean)])]

  function generateNomorOtomatis() {
    const bulanRomawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
    const now = new Date()
    const nomorUrut = String(rows.length + 1).padStart(3, '0')
    const kode = kodeDivisi(form.divisi)
    const nomor = `${nomorUrut}/${kode ? kode + '/' : ''}PMI-SB/${bulanRomawi[now.getMonth()]}/${now.getFullYear()}`
    setForm(f => ({ ...f, nomor_surat: nomor }))
  }

  return (
    <div className="app">
      <div className="main">
        <div className="topbar">
          <div><h1>Surat Keluar</h1><p className="desc">Catatan surat yang dikirim keluar dari PMI Sumatera Barat.</p></div>
          {isAdmin && <button className="btn btn-primary" onClick={openAdd}>+ Tambah Data</button>}
        </div>

        {!isAdmin && (
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>
            👁 Akun kamu hanya bisa melihat data. Untuk menambah atau mengubah, hubungi admin (Kabid).
          </div>
        )}

        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:260}} />
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="btn btn-ghost" onClick={unduhSemuaBerkas} disabled={!!zipProg}>{zipProg ? `Menyiapkan ${zipProg.n}/${zipProg.total}...` : '📦 Unduh Semua Berkas (ZIP)'}</button>
              <button className="btn btn-ghost" onClick={exportCSV}>⬇ Export Laporan (CSV)</button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr>{columns.map(c=><th key={c.k}>{c.label}</th>)}<th>Bukti</th><th>Petugas</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={columns.length+3} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length===0 ? <tr><td colSpan={columns.length+3} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Belum ada data.</td></tr> :
                filtered.map(r => (
                  <tr key={r.id}>
                    {columns.map(c => <td key={c.k} data-label={c.label}>{r[c.k] ?? '-'}</td>)}
                    <td data-label="Bukti">{r.file_bukti_url ? <a href={r.file_bukti_url} target="_blank" rel="noreferrer" style={{color:'var(--pmi-red)',fontWeight:600}}>📎 Lihat</a> : '-'}</td>
                    <td data-label="Petugas">{r.profiles?.nama_lengkap || '-'}</td>
                    {isAdmin && (
                      <td data-label="">
                        <button className="btn btn-ghost" style={{padding:'4px 8px',marginRight:4}} onClick={()=>openEdit(r)}>Edit</button>
                        <button className="btn btn-ghost" style={{padding:'4px 8px'}} onClick={()=>handleDelete(r.id)}>Hapus</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                  {f.type==='select' ? (
                    <select value={form[f.k]||''} onChange={e=>setForm({...form,[f.k]:e.target.value})}>
                      {f.opts.map(o=><option key={o}>{o}</option>)}
                    </select>
                  ) : f.k === 'divisi' ? (
                    <>
                      <input list="saran-divisi" value={form[f.k]||''} placeholder={f.ph||''} onChange={e=>setForm({...form,[f.k]:e.target.value})} />
                      <datalist id="saran-divisi">{saranDivisi.map(d => <option key={d} value={d} />)}</datalist>
                    </>
                  ) : f.k === 'nomor_surat' ? (
                    <div style={{display:'flex',gap:6}}>
                      <input type={f.type} value={form[f.k]||''} placeholder={f.ph||''} onChange={e=>setForm({...form,[f.k]:e.target.value})} />
                      <button type="button" className="btn btn-ghost" style={{whiteSpace:'nowrap',fontSize:12}} onClick={generateNomorOtomatis}>Buat Otomatis</button>
                    </div>
                  ) : (
                    <input type={f.type} value={form[f.k]||''} placeholder={f.ph||''} onChange={e=>setForm({...form,[f.k]:e.target.value})} />
                  )}
                </div>
              ))}
              <div className="field">
                <label>File Bukti (PDF/Foto Surat) — opsional</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUploadBukti} />
                {uploading && <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:4}}>Mengunggah file...</div>}
                {form.file_bukti_nama && <div style={{fontSize:12,color:'var(--stock)',marginTop:4}}>✓ {form.file_bukti_nama} terunggah</div>}
                {!form.file_bukti_nama && form.file_bukti_url && <div style={{fontSize:12,color:'var(--stock)',marginTop:4}}>✓ File sudah terpasang sebelumnya</div>}
              </div>
            </div>
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-ghost" onClick={()=>setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>Simpan Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
