'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'

const TAHAP_DEFAULT = ['Resepsionis', 'Sekretaris', 'Pimpinan', 'Divisi Tujuan']

export default function SuratMasukPage() {
  const supabase = createClient()
  const [surat, setSurat] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTahapModal, setShowTahapModal] = useState(null) // surat_id yang lagi dibuka detailnya
  const [tahapanList, setTahapanList] = useState([])
  const [form, setForm] = useState({})
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
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
      // belum ada tahapan sama sekali -> siapkan draft dari TAHAP_DEFAULT
      setTahapanList(TAHAP_DEFAULT.map((nama, i) => ({ nama_tahap: nama, urutan: i + 1, penerima_nama: '', tanggal_diterima: null, tanggal_diteruskan: null, catatan: '', _new: true })))
    }
  }

  async function handleAddSurat() {
    if (!form.nomor_surat || !form.tanggal_surat || !form.tanggal_diterima_kantor || !form.asal_surat || !form.perihal) {
      setError('Lengkapi semua field wajib.'); return
    }
    const { data: userData } = await supabase.auth.getUser()
    const { data: newSurat, error: err } = await supabase.from('surat_masuk').insert({
      ...form, petugas_id: userData.user.id
    }).select().single()
    if (err) { setError(err.message); return }
    // otomatis buat draft tahapan default untuk surat baru ini
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

  function terimaSekarang(idx) {
    updateTahapField(idx, 'tanggal_diterima', new Date().toISOString())
  }
  function teruskanSekarang(idx) {
    updateTahapField(idx, 'tanggal_diteruskan', new Date().toISOString())
    // otomatis set tahap berikutnya jadi "diterima sekarang" juga
    if (idx + 1 < tahapanList.length && !tahapanList[idx + 1].tanggal_diterima) {
      const updated = [...tahapanList]
      updated[idx + 1] = { ...updated[idx + 1], tanggal_diterima: new Date().toISOString() }
      setTahapanList(updated)
    }
  }

  function hariTertahan(t) {
    if (!t.tanggal_diterima || t.tanggal_diteruskan) return null
    const days = Math.floor((Date.now() - new Date(t.tanggal_diterima).getTime()) / (1000 * 60 * 60 * 24))
    return days
  }

  function statusSurat(suratId) {
    // dipakai di tabel utama: cari tahap yang "sedang berhenti" (diterima tapi belum diteruskan)
    return null // dihitung on-demand saat modal dibuka; tabel utama cukup tampilkan tanggal terima kantor
  }

  const filtered = surat.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div><h1>Surat Masuk</h1><p className="desc">Pantau surat dari diterima sampai selesai — kelihatan siapa yang menahan lama.</p></div>
          <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setShowAddModal(true) }}>+ Catat Surat Masuk</button>
        </div>

        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari nomor surat / asal / perihal..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}} />
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Tgl Diterima Kantor</th><th>No. Surat</th><th>Asal</th><th>Perihal</th><th>Sifat</th><th>Petugas</th><th>Alur</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={7} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Belum ada surat tercatat.</td></tr> :
                filtered.map(s => (
                  <tr key={s.id}>
                    <td>{s.tanggal_diterima_kantor}</td>
                    <td className="mono">{s.nomor_surat}</td>
                    <td>{s.asal_surat}</td>
                    <td>{s.perihal}</td>
                    <td><span className="tag" style={sifatStyle(s.sifat)}>{s.sifat}</span></td>
                    <td>{s.profiles?.nama_lengkap || '-'}</td>
                    <td><button className="btn btn-ghost" style={{padding:'5px 10px'}} onClick={()=>openTahap(s.id)}>Lihat Alur →</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL: Tambah Surat */}
      {showAddModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} onClick={e=>{if(e.target===e.currentTarget)setShowAddModal(false)}}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:460,maxHeight:'90vh',overflowY:'auto'}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>Catat Surat Masuk Baru</h3>
              <button onClick={()=>setShowAddModal(false)} style={{border:'none',background:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'20px 22px'}}>
              {error && <div className="error-box">{error}</div>}
              <div className="field"><label>Nomor Surat</label><input value={form.nomor_surat||''} onChange={e=>setForm({...form,nomor_surat:e.target.value})} placeholder="005/PMI-SB/VIII/2026" /></div>
              <div className="field"><label>Tanggal Surat (tertulis di surat)</label><input type="date" value={form.tanggal_surat||''} onChange={e=>setForm({...form,tanggal_surat:e.target.value})} /></div>
              <div className="field"><label>Tanggal Diterima di Kantor</label><input type="date" value={form.tanggal_diterima_kantor||''} onChange={e=>setForm({...form,tanggal_diterima_kantor:e.target.value})} /></div>
              <div className="field"><label>Asal Surat</label><input value={form.asal_surat||''} onChange={e=>setForm({...form,asal_surat:e.target.value})} placeholder="PMI Pusat / Dinas Sosial / dll" /></div>
              <div className="field"><label>Perihal</label><input value={form.perihal||''} onChange={e=>setForm({...form,perihal:e.target.value})} placeholder="Undangan rapat koordinasi" /></div>
              <div className="field"><label>Sifat Surat</label>
                <select value={form.sifat||'Biasa'} onChange={e=>setForm({...form,sifat:e.target.value})}>
                  <option>Biasa</option><option>Penting</option><option>Segera</option><option>Rahasia</option>
                </select>
              </div>
            </div>
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-ghost" onClick={()=>setShowAddModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddSurat}>Simpan & Mulai Alur</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Lihat/Update Alur Tahapan */}
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
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                      <strong>{idx+1}. {t.nama_tahap}</strong>
                      {tertahan !== null && tertahan >= 2 && (
                        <span style={{background:'#FBE7E7',color:'#B3261E',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>⚠ Tertahan {tertahan} hari</span>
                      )}
                      {tertahan !== null && tertahan < 2 && (
                        <span style={{background:'var(--gold-bg)',color:'var(--gold)',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>Sedang di sini</span>
                      )}
                      {t.tanggal_diteruskan && (
                        <span style={{background:'var(--stock-bg)',color:'var(--stock)',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>✓ Selesai diteruskan</span>
                      )}
                    </div>
                    {!belumSampai && (
                      <>
                        <div className="field" style={{marginBottom:8}}>
                          <label>Nama Penerima di Tahap Ini</label>
                          <input value={t.penerima_nama||''} onChange={e=>updateTahapField(idx,'penerima_nama',e.target.value)} placeholder="Nama orangnya" />
                        </div>
                        <div style={{display:'flex',gap:8,marginBottom:8,fontSize:12.5,color:'var(--ink-soft)'}}>
                          <div>Diterima: <strong>{t.tanggal_diterima ? new Date(t.tanggal_diterima).toLocaleString('id-ID') : 'Belum'}</strong></div>
                          <div>Diteruskan: <strong>{t.tanggal_diteruskan ? new Date(t.tanggal_diteruskan).toLocaleString('id-ID') : 'Belum'}</strong></div>
                        </div>
                        <div style={{display:'flex',gap:6}}>
                          {!t.tanggal_diterima && <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:12}} onClick={()=>terimaSekarang(idx)}>Tandai Diterima Sekarang</button>}
                          {t.tanggal_diterima && !t.tanggal_diteruskan && <button className="btn btn-primary" style={{padding:'5px 10px',fontSize:12}} onClick={()=>teruskanSekarang(idx)}>Teruskan ke Tahap Berikutnya</button>}
                          <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:12}} onClick={()=>saveTahap(idx)}>Simpan</button>
                        </div>
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
