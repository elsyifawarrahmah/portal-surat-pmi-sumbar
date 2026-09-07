'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'

const TAHAP_DEFAULT = ['Biro Umum', 'Sekretaris', 'Ketua Markas', 'Ketua', 'Divisi Tujuan']

export default function SuratMasukPage() {
  return (
    <Suspense fallback={null}>
      <SuratMasukInner />
    </Suspense>
  )
}

function SuratMasukInner() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [surat, setSurat] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTahapModal, setShowTahapModal] = useState(null)
  const [tahapanList, setTahapanList] = useState([])
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [myRole, setMyRole] = useState('viewer')
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId) openTahap(openId)
  }, [searchParams])

  const isAdmin = myRole === 'admin'

  async function load() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
      if (profile) setMyRole(profile.role)
    }
    const { data } = await supabase.from('surat_masuk').select('*, profiles(nama_lengkap)').order('tanggal_diterima_kantor', { ascending: false })
    setSurat(data || [])
    setLoading(false)
  }

  async function openTahap(suratId) {
    setShowTahapModal(suratId)
    const { data } = await supabase.from('surat_tahapan').select('*').eq('surat_id', suratId).order('urutan')
    if (data && data.length > 0) {
      setTahapanList(data)
    } else {
      setTahapanList(TAHAP_DEFAULT.map((nama, i) => ({ nama_tahap: nama, urutan: i + 1, penerima_nama: '', tanggal_diterima: null, tanggal_diteruskan: null, catatan: '', _new: true })))
    }
  }

  async function handleUploadBukti(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
    const { data, error: uploadErr } = await supabase.storage.from('bukti-surat').upload(filename, file)
    if (uploadErr) { setError('Gagal upload file: ' + uploadErr.message); setUploading(false); return }
    const { data: urlData } = supabase.storage.from('bukti-surat').getPublicUrl(filename)
    setForm(f => ({ ...f, file_bukti_url: urlData.publicUrl, file_bukti_nama: file.name }))
    setUploading(false)
  }

  async function handleAddSurat() {
    if (!form.nomor_surat || !form.tanggal_surat || !form.tanggal_diterima_kantor || !form.asal_surat || !form.perihal) {
      setError('Lengkapi semua field wajib.'); return
    }
    // cek nomor surat sudah pernah dicatat atau belum, biar data tidak dobel
    const { data: existing } = await supabase.from('surat_masuk').select('id').eq('nomor_surat', form.nomor_surat.trim())
    if (existing && existing.length > 0) {
      setError(`Nomor surat "${form.nomor_surat}" sudah pernah dicatat sebelumnya. Cek lagi di daftar surat masuk.`); return
    }
    const { data: userData } = await supabase.auth.getUser()
    const { file_bukti_nama, ...payload } = form
    const { data: newSurat, error: err } = await supabase.from('surat_masuk').insert({
      ...payload, petugas_id: userData.user.id
    }).select().single()
    if (err) { setError(err.message); return }
    const tahapRows = TAHAP_DEFAULT.map((nama, i) => ({
      surat_id: newSurat.id, nama_tahap: nama, urutan: i + 1,
      tanggal_diterima: i === 0 ? new Date().toISOString() : null,
      penerima_nama: i === 0 ? '' : null,
    }))
    await supabase.from('surat_tahapan').insert(tahapRows)
    setShowAddModal(false); setForm({}); setError('')
    load()
  }

  async function saveTahap(idx) {
    const t = tahapanList[idx]
    if (t.id) {
      await supabase.from('surat_tahapan').update({
        penerima_nama: t.penerima_nama, tanggal_diterima: t.tanggal_diterima,
        tanggal_diteruskan: t.tanggal_diteruskan, catatan: t.catatan
      }).eq('id', t.id)
    } else {
      const { data } = await supabase.from('surat_tahapan').insert({
        surat_id: showTahapModal, nama_tahap: t.nama_tahap, urutan: t.urutan,
        penerima_nama: t.penerima_nama, tanggal_diterima: t.tanggal_diterima,
        tanggal_diteruskan: t.tanggal_diteruskan, catatan: t.catatan
      }).select().single()
      const updated = [...tahapanList]; updated[idx] = { ...data }; setTahapanList(updated)
    }
    load()
  }

  function updateTahapField(idx, field, value) {
    const updated = [...tahapanList]
    updated[idx] = { ...updated[idx], [field]: value }
    setTahapanList(updated)
  }

  function terimaSekarang(idx) { updateTahapField(idx, 'tanggal_diterima', new Date().toISOString()) }
  function teruskanSekarang(idx) {
    updateTahapField(idx, 'tanggal_diteruskan', new Date().toISOString())
    if (idx + 1 < tahapanList.length && !tahapanList[idx + 1].tanggal_diterima) {
      const updated = [...tahapanList]
      updated[idx + 1] = { ...updated[idx + 1], tanggal_diterima: new Date().toISOString() }
      setTahapanList(updated)
    }
  }

  function hariTertahan(t) {
    if (!t.tanggal_diterima || t.tanggal_diteruskan) return null
    return Math.floor((Date.now() - new Date(t.tanggal_diterima).getTime()) / (1000 * 60 * 60 * 24))
  }

  const filtered = surat.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))

  function exportCSV() {
    const header = ['Tanggal Diterima','Nomor Surat','Asal','Perihal','Sifat','Petugas'].join(';')
    const csvRows = filtered.map(r => [r.tanggal_diterima_kantor, r.nomor_surat, r.asal_surat, r.perihal, r.sifat, r.profiles?.nama_lengkap||''].join(';'))
    const csv = '\uFEFF' + [header, ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `surat-masuk-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  function generateNomorOtomatis() {
    const bulanRomawi = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
    const now = new Date()
    const nomorUrut = String(surat.length + 1).padStart(3, '0')
    const nomor = `${nomorUrut}/PMI-SB/${bulanRomawi[now.getMonth()]}/${now.getFullYear()}`
    setForm(f => ({ ...f, nomor_surat: nomor }))
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div><h1>Surat Masuk</h1><p className="desc">Pencatatan dan pelacakan surat masuk PMI Sumatera Barat.</p></div>
          {isAdmin && <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setShowAddModal(true) }}>+ Catat Surat Masuk</button>}
        </div>

        {!isAdmin && (
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>
            👁 Akun kamu hanya bisa melihat data. Untuk menambah atau mengubah, hubungi admin (Kabid).
          </div>
        )}

        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari nomor surat / asal / perihal..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}} />
            <button className="btn btn-ghost" onClick={exportCSV}>⬇ Export Laporan (CSV)</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Tgl Diterima Kantor</th><th>No. Surat</th><th>Asal</th><th>Perihal</th><th>Sifat</th><th>Bukti</th><th>Petugas</th><th>Alur</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={8} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Belum ada surat tercatat.</td></tr> :
                filtered.map(s => {
                  const isRahasia = s.sifat === 'Rahasia' && !isAdmin
                  return (
                  <tr key={s.id} className="row-click" onClick={()=>{ if (!isRahasia) openTahap(s.id) }}>
                    <td data-label="Tgl Diterima">{s.tanggal_diterima_kantor}</td>
                    <td data-label="No. Surat" className="mono">{isRahasia ? '••••••' : s.nomor_surat}</td>
                    <td data-label="Asal">{isRahasia ? '🔒 Rahasia' : s.asal_surat}</td>
                    <td data-label="Perihal">{isRahasia ? 'Hanya admin yang bisa lihat' : s.perihal}</td>
                    <td data-label="Sifat"><span className="tag" style={sifatStyle(s.sifat)}>{s.sifat}</span></td>
                    <td data-label="Bukti" onClick={e=>e.stopPropagation()}>{!isRahasia && s.file_bukti_url ? <a href={s.file_bukti_url} target="_blank" rel="noreferrer" style={{color:'var(--pmi-red)',fontWeight:600}}>📎 Lihat</a> : '-'}</td>
                    <td data-label="Petugas">{s.profiles?.nama_lengkap || '-'}</td>
                    <td data-label="" style={{color:'var(--ink-soft)',textAlign:'right'}}>{isRahasia ? '' : 'Lihat Alur →'}</td>
                  </tr>
                )})}
              </tbody>
            </table>
            {surat.some(s => s.sifat === 'Rahasia') && !isAdmin && (
              <div style={{padding:'10px 20px',fontSize:12,color:'var(--ink-soft)',borderTop:'1px solid var(--line)'}}>
                🔒 Sebagian surat ditandai Rahasia dan hanya bisa dibuka oleh admin (Kabid).
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} onClick={e=>{if(e.target===e.currentTarget)setShowAddModal(false)}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:460,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Catat Surat Masuk Baru</h3>
              <button onClick={()=>setShowAddModal(false)} style={{border:'none',background:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'20px 22px'}}>
              {error && <div className="error-box">{error}</div>}
              <div className="field">
                <label>Nomor Surat</label>
                <div style={{display:'flex',gap:6}}>
                  <input value={form.nomor_surat||''} onChange={e=>setForm({...form,nomor_surat:e.target.value})} placeholder="005/PMI-SB/VIII/2026" />
                  <button type="button" className="btn btn-ghost" style={{whiteSpace:'nowrap',fontSize:12}} onClick={generateNomorOtomatis}>Buat Otomatis</button>
                </div>
              </div>
              <div className="field"><label>Tanggal Surat (tertulis di surat)</label><input type="date" value={form.tanggal_surat||''} onChange={e=>setForm({...form,tanggal_surat:e.target.value})} /></div>
              <div className="field"><label>Tanggal Diterima di Kantor</label><input type="date" value={form.tanggal_diterima_kantor||''} onChange={e=>setForm({...form,tanggal_diterima_kantor:e.target.value})} /></div>
              <div className="field"><label>Asal Surat</label><input value={form.asal_surat||''} onChange={e=>setForm({...form,asal_surat:e.target.value})} placeholder="PMI Pusat / Dinas Sosial / dll" /></div>
              <div className="field"><label>Perihal</label><input value={form.perihal||''} onChange={e=>setForm({...form,perihal:e.target.value})} placeholder="Undangan rapat koordinasi" /></div>
              <div className="field"><label>Sifat Surat</label>
                <select value={form.sifat||'Biasa'} onChange={e=>setForm({...form,sifat:e.target.value})}>
                  <option>Biasa</option><option>Penting</option><option>Segera</option><option>Rahasia</option>
                </select>
              </div>
              <div className="field">
                <label>File Bukti (PDF/Foto Surat) — opsional</label>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUploadBukti} />
                {uploading && <div style={{fontSize:12,color:'var(--ink-soft)',marginTop:4}}>Mengunggah file...</div>}
                {form.file_bukti_nama && <div style={{fontSize:12,color:'var(--stock)',marginTop:4}}>✓ {form.file_bukti_nama} terunggah</div>}
              </div>
            </div>
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-ghost" onClick={()=>setShowAddModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddSurat} disabled={uploading}>Simpan & Mulai Alur</button>
            </div>
          </div>
        </div>
      )}

      {showTahapModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} onClick={e=>{if(e.target===e.currentTarget)setShowTahapModal(null)}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:560,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Alur Perjalanan Surat</h3>
              <button onClick={()=>setShowTahapModal(null)} style={{border:'none',background:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:14}}>
              {tahapanList.map((t, idx) => {
                const tertahan = hariTertahan(t)
                const belumSampai = idx > 0 && !tahapanList[idx-1].tanggal_diteruskan
                return (
                  <div key={idx} style={{border:'1px solid var(--line)',borderRadius:12,padding:14,opacity: belumSampai ? 0.45 : 1}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
                      <strong>{idx+1}. {t.nama_tahap}</strong>
                      {tertahan !== null && tertahan >= 2 && <span style={{background:'#FBE7E7',color:'#B3261E',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>⚠ Tertahan {tertahan} hari</span>}
                      {tertahan !== null && tertahan < 2 && <span style={{background:'var(--gold-bg)',color:'var(--gold)',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>Sedang di sini</span>}
                      {t.tanggal_diteruskan && <span style={{background:'var(--stock-bg)',color:'var(--stock)',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>✓ Selesai diteruskan</span>}
                    </div>
                    {!belumSampai && (
                      <>
                        {isAdmin ? (
                          <div className="field" style={{marginBottom:8}}>
                            <label>Nama Penerima di Tahap Ini</label>
                            <input value={t.penerima_nama||''} onChange={e=>updateTahapField(idx,'penerima_nama',e.target.value)} placeholder="Nama orangnya" />
                          </div>
                        ) : (
                          <div style={{fontSize:13,marginBottom:8}}>Penerima: <strong>{t.penerima_nama || '-'}</strong></div>
                        )}
                        <div style={{display:'flex',gap:8,marginBottom:8,fontSize:12.5,color:'var(--ink-soft)',flexWrap:'wrap'}}>
                          <div>Diterima: <strong>{t.tanggal_diterima ? new Date(t.tanggal_diterima).toLocaleString('id-ID') : 'Belum'}</strong></div>
                          <div>Diteruskan: <strong>{t.tanggal_diteruskan ? new Date(t.tanggal_diteruskan).toLocaleString('id-ID') : 'Belum'}</strong></div>
                        </div>
                        {isAdmin && (
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                            {!t.tanggal_diterima && <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:12}} onClick={()=>terimaSekarang(idx)}>Tandai Diterima Sekarang</button>}
                            {t.tanggal_diterima && !t.tanggal_diteruskan && <button className="btn btn-primary" style={{padding:'5px 10px',fontSize:12}} onClick={()=>teruskanSekarang(idx)}>Teruskan ke Tahap Berikutnya</button>}
                            <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:12}} onClick={()=>saveTahap(idx)}>Simpan</button>
                          </div>
                        )}
                      </>
                    )}
                    {belumSampai && <div style={{fontSize:12.5,color:'var(--ink-soft)'}}>Menunggu tahap sebelumnya diteruskan.</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function sifatStyle(s) {
  if (s === 'Rahasia') return { background: '#F3E8FB', color: '#7B2CBF' }
  if (s === 'Segera') return { background: '#FBE7E7', color: '#B3261E' }
  if (s === 'Penting') return { background: 'var(--gold-bg)', color: 'var(--gold)' }
  return { background: 'var(--stock-bg)', color: 'var(--stock)' }
}
