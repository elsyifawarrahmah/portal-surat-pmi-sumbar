'use client'
// Halaman arsip dokumen serbaguna: dipakai Perjanjian Kerja Sama, Sertifikat & Piagam, dan Surat Keputusan.
// Pola sama dengan Surat Keluar: tabel, cari, export CSV, upload bukti, hanya admin yang bisa tambah/ubah/hapus.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'

const BULAN_ROMAWI = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']

export function tgl(v) {
  if (!v) return '-'
  const d = new Date(v + 'T00:00:00')
  return isNaN(d) ? v : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Status masa berlaku (untuk dokumen yang punya tanggal berakhir)
export function statusMasa(r) {
  if (!r.tanggal_berakhir) return null
  const akhir = new Date(r.tanggal_berakhir + 'T23:59:59')
  const sisa = Math.ceil((akhir - new Date()) / 86400000)
  if (sisa < 0) return { label: 'Berakhir', style: { background: '#FBE7E7', color: '#B3261E' } }
  if (sisa <= 30) return { label: `Sisa ${sisa} hari`, style: { background: 'var(--gold-bg)', color: 'var(--gold)' } }
  return { label: 'Aktif', style: { background: 'var(--stock-bg)', color: 'var(--stock)' } }
}

export default function DokumenPage({ config }) {
  const supabase = createClient()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [myRole, setMyRole] = useState('viewer')
  const [uploading, setUploading] = useState(false)

  const isAdmin = myRole === 'admin'
  const { fields } = config

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
      if (profile) setMyRole(profile.role)
    }
    const { data, error } = await supabase
      .from('arsip_dokumen')
      .select('*, profiles:petugas_id(nama_lengkap)')
      .eq('jenis', config.jenis)
      .order('tanggal', { ascending: false })
    if (error) {
      const belumAda = error.code === '42P01' || error.code === 'PGRST205' || /arsip_dokumen/.test(error.message || '')
      setLoadError(belumAda
        ? 'Tabel database untuk halaman ini belum dibuat. Jalankan file supabase/migrasi-arsip-dokumen.sql di Supabase (SQL Editor) satu kali.'
        : 'Gagal memuat data: ' + error.message)
      setRows([])
    } else {
      setLoadError('')
      setRows(data || [])
    }
    setLoading(false)
  }

  function nilaiAwal() {
    const f = {}
    fields.forEach(x => { if (x.type === 'select') f[x.k] = x.opts[0] })
    return f
  }
  function openAdd() { setEditing(null); setForm(nilaiAwal()); setError(''); setShowModal(true) }
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
    if (form.tanggal_mulai && form.tanggal_berakhir && form.tanggal_berakhir < form.tanggal_mulai) {
      setError('Tanggal berakhir tidak boleh lebih awal dari tanggal mulai.'); return
    }
    const payload = { jenis: config.jenis }
    fields.forEach(f => { payload[f.k] = (form[f.k] === '' || form[f.k] === undefined) ? null : form[f.k] })
    if (form.file_bukti_url) payload.file_bukti_url = form.file_bukti_url
    if (editing) {
      const { error } = await supabase.from('arsip_dokumen').update(payload).eq('id', editing.id)
      if (error) { setError(error.message); return }
    } else {
      const { data: userData } = await supabase.auth.getUser()
      payload.petugas_id = userData.user.id
      const { error } = await supabase.from('arsip_dokumen').insert(payload)
      if (error) { setError(error.message); return }
    }
    setShowModal(false); load()
  }

  async function handleDelete(id) {
    if (!confirm('Hapus data ini?')) return
    const { error } = await supabase.from('arsip_dokumen').delete().eq('id', id)
    if (error) { alert('Gagal hapus: ' + error.message); return }
    load()
  }

  const filtered = rows.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))

  function exportCSV() {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = [...fields.map(f => f.label), ...(config.masaBerlaku ? ['Status'] : []), 'Petugas', 'Link Bukti'].map(esc).join(';')
    const csvRows = filtered.map(r => [
      ...fields.map(f => f.type === 'date' ? tgl(r[f.k]) : (r[f.k] ?? '')),
      ...(config.masaBerlaku ? [statusMasa(r)?.label || ''] : []),
      r.profiles?.nama_lengkap || '', r.file_bukti_url || '',
    ].map(esc).join(';'))
    const csv = '\uFEFF' + [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${config.csvPrefix}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function generateNomorOtomatis() {
    const now = new Date()
    const urut = String(rows.length + 1).padStart(3, '0')
    const kode = typeof config.kodeNomor === 'function' ? config.kodeNomor(form) : config.kodeNomor
    setForm(f => ({ ...f, nomor: `${urut}/${kode}/PMI-SB/${BULAN_ROMAWI[now.getMonth()]}/${now.getFullYear()}` }))
  }

  const jumlahKolom = config.columns.length + (config.masaBerlaku ? 1 : 0) + 3

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div><h1>{config.judul}</h1><p className="desc">{config.deskripsi}</p></div>
          {isAdmin && <button className="btn btn-primary" onClick={openAdd}>{config.tombol}</button>}
        </div>

        {!isAdmin && (
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>
            👁 Akun kamu hanya bisa melihat data. Untuk menambah atau mengubah, hubungi admin (Kabid).
          </div>
        )}

        {loadError && (
          <div className="error-box" style={{marginBottom:18}}>{loadError}</div>
        )}

        <div className="panel">
          <div className="panel-head">
            <input placeholder={config.cari || 'Cari...'} value={search} onChange={e => setSearch(e.target.value)} style={{maxWidth:260}} />
            <button className="btn btn-ghost" onClick={exportCSV}>⬇ Export Laporan (CSV)</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead>
                <tr>
                  {config.columns.map(c => <th key={c.label}>{c.label}</th>)}
                  {config.masaBerlaku && <th>Status</th>}
                  <th>Bukti</th><th>Petugas</th>{isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan={jumlahKolom} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={jumlahKolom} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Belum ada data.</td></tr> :
                filtered.map(r => {
                  const st = config.masaBerlaku ? statusMasa(r) : null
                  return (
                    <tr key={r.id}>
                      {config.columns.map(c => <td key={c.label} data-label={c.label}>{c.render ? c.render(r) : (r[c.k] ?? '-')}</td>)}
                      {config.masaBerlaku && (
                        <td data-label="Status">{st ? <span className="tag" style={st.style}>{st.label}</span> : '-'}</td>
                      )}
                      <td data-label="Bukti">{r.file_bukti_url ? <a href={r.file_bukti_url} target="_blank" rel="noreferrer" style={{color:'var(--pmi-red)',fontWeight:600}}>📎 Lihat</a> : '-'}</td>
                      <td data-label="Petugas">{r.profiles?.nama_lengkap || '-'}</td>
                      {isAdmin && (
                        <td data-label="">
                          <button className="btn btn-ghost" style={{padding:'4px 8px',marginRight:4}} onClick={() => openEdit(r)}>Edit</button>
                          <button className="btn btn-ghost" style={{padding:'4px 8px'}} onClick={() => handleDelete(r.id)}>Hapus</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:460,maxHeight:'90vh',overflowY:'auto',margin:12}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>{editing ? 'Edit Data' : 'Tambah Data'} — {config.judul}</h3>
              <button onClick={() => setShowModal(false)} style={{border:'none',background:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'20px 22px'}}>
              {error && <div className="error-box">{error}</div>}
              {fields.map(f => (
                <div className="field" key={f.k}>
                  <label>{f.label}{f.req ? '' : ' — opsional'}</label>
                  {f.type === 'select' ? (
                    <select value={form[f.k] || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })}>
                      {f.opts.map(o => <option key={o}>{o}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea rows={3} value={form[f.k] || ''} placeholder={f.ph || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
                  ) : f.k === 'nomor' ? (
                    <div style={{display:'flex',gap:6}}>
                      <input type="text" value={form[f.k] || ''} placeholder={f.ph || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
                      <button type="button" className="btn btn-ghost" style={{whiteSpace:'nowrap',fontSize:12}} onClick={generateNomorOtomatis}>Buat Otomatis</button>
                    </div>
                  ) : (
                    <input type={f.type} value={form[f.k] || ''} placeholder={f.ph || ''} onChange={e => setForm({ ...form, [f.k]: e.target.value })} />
                  )}
                </div>
              ))}
              <div className="field">
                <label>File Dokumen (PDF/Foto) — opsional</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUploadBukti} />
                {uploading && <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:4}}>Mengunggah file...</div>}
                {form.file_bukti_nama && <div style={{fontSize:12,color:'var(--stock)',marginTop:4}}>✓ {form.file_bukti_nama} terunggah</div>}
                {!form.file_bukti_nama && form.file_bukti_url && <div style={{fontSize:12,color:'var(--stock)',marginTop:4}}>✓ File sudah terpasang sebelumnya</div>}
              </div>
            </div>
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={uploading}>Simpan Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
