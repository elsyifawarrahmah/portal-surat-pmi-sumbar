'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

import { unduhBerkasZip } from '@/lib/zip'
import { usePeran, useUnits } from '@/lib/peran'
import Modal from '@/components/Modal'
import DisposisiPanel from '@/components/DisposisiPanel'
import RiwayatModal from '@/components/RiwayatModal'
import { fmtTgl, PESAN_MIGRASI, STATUS_DISPOSISI } from '@/lib/format'
import { TAHAP_DEFAULT, labelTahap, isKepalaMarkas, isTujuan, isSelesai, isPengarsipan, statusSurat } from '@/lib/tahap'

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
  const [zipProg, setZipProg] = useState(null)
  const [tahapMap, setTahapMap] = useState({})
  const [tahapanList, setTahapanList] = useState([])
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const peran = usePeran()
  const { units } = useUnits()
  const [disposisiMap, setDisposisiMap] = useState({})
  const [modalDisposisi, setModalDisposisi] = useState(null)
  const [modalRiwayat, setModalRiwayat] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [])

  useEffect(() => {
    const openId = searchParams.get('open')
    if (openId) openTahap(openId)
    const dispId = searchParams.get('disposisi')
    if (dispId) supabase.from('surat_masuk').select('*').eq('id', dispId).maybeSingle().then(({ data }) => { if (data) setModalDisposisi(data) })
  }, [searchParams])

  const isAdmin = peran.isAdmin            // admin: boleh lihat surat Rahasia
  const bolehCatat = peran.bisaCatatMasuk  // admin / Sekretariat: mencatat surat masuk
  const bolehAlur = peran.bisaAlur         // admin / Sekretariat / pimpinan / Biro Umum: mengurus alur & pengarsipan

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('surat_masuk').select('*, profiles(nama_lengkap)').order('tanggal_diterima_kantor', { ascending: false })
    setSurat(data || [])
    const { data: semuaTahap } = await supabase.from('surat_tahapan').select('surat_id, nama_tahap, urutan, tanggal_diterima, tanggal_diteruskan')
    const peta = {}
    ;(semuaTahap || []).forEach(t => { (peta[t.surat_id] = peta[t.surat_id] || []).push(t) })
    setTahapMap(peta)
    // ringkasan disposisi per surat (kosong bila migrasi belum dijalankan)
    const { data: tj, error: errTj } = await supabase.from('surat_disposisi_tujuan').select('status, disposisi:surat_disposisi(surat_id)')
    const dm = {}
    if (!errTj) (tj || []).forEach(t => { const id = t.disposisi?.surat_id; if (!id) return; const d = (dm[id] = dm[id] || { total: 0, selesai: 0 }); d.total++; if (t.status === 'selesai') d.selesai++ })
    setDisposisiMap(dm)
    setLoading(false)
  }

  async function openTahap(suratId) {
    setShowTahapModal(suratId)
    const { data } = await supabase.from('surat_tahapan').select('*').eq('surat_id', suratId).order('urutan')
    if (data && data.length > 0) {
      // Surat lama: tampilkan tahap Selesai & Pengarsipan yang belum ada (tersimpan saat tombol Simpan/Teruskan ditekan)
      const kosong = { penerima_nama: '', tanggal_diterima: null, tanggal_diteruskan: null, catatan: '', _new: true, urutan: 0 }
      const list = [...data]
      if (!list.some(t => isSelesai(t.nama_tahap))) {
        const tj = list.findIndex(t => isTujuan(t.nama_tahap))
        const sel = { ...kosong, nama_tahap: 'Selesai' }
        if (tj >= 0 && list[tj].tanggal_diteruskan) { sel.tanggal_diterima = list[tj].tanggal_diteruskan; sel.tanggal_diteruskan = list[tj].tanggal_diteruskan }
        list.splice(tj >= 0 ? tj + 1 : list.length, 0, sel)
      }
      if (!list.some(t => isPengarsipan(t.nama_tahap))) {
        list.push({ ...kosong, nama_tahap: 'Pengarsipan' }, { ...kosong, nama_tahap: 'Biro Umum (Arsip Kembali)' })
      }
      setTahapanList(list)
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
    if (!payload.macam_surat) delete payload.macam_surat
    if (!payload.lampiran) delete payload.lampiran
    const { data: newSurat, error: err } = await supabase.from('surat_masuk').insert({
      ...payload, petugas_id: userData.user.id
    }).select().single()
    if (err) { setError(/macam_surat|lampiran|nomor_agenda/.test(err.message) ? PESAN_MIGRASI : err.message); return }
    const tahapRows = TAHAP_DEFAULT.map((nama, i) => ({
      surat_id: newSurat.id, nama_tahap: nama, urutan: i + 1,
      tanggal_diterima: i === 0 ? new Date().toISOString() : null,
      penerima_nama: i === 0 ? '' : null,
    }))
    await supabase.from('surat_tahapan').insert(tahapRows)
    setShowAddModal(false); setForm({}); setError('')
    load()
  }

  async function simpanSatu(t) {
    if (t.id) {
      await supabase.from('surat_tahapan').update({
        penerima_nama: t.penerima_nama, tanggal_diterima: t.tanggal_diterima,
        tanggal_diteruskan: t.tanggal_diteruskan, catatan: t.catatan
      }).eq('id', t.id)
      return t
    }
    const { data } = await supabase.from('surat_tahapan').insert({
      surat_id: showTahapModal, nama_tahap: t.nama_tahap, urutan: t.urutan,
      penerima_nama: t.penerima_nama, tanggal_diterima: t.tanggal_diterima,
      tanggal_diteruskan: t.tanggal_diteruskan, catatan: t.catatan
    }).select().single()
    return data ? { ...data } : t
  }
  // Samakan nomor urut tahap di database dengan urutan yang tampil
  async function rapikanUrutan(list) {
    const hasil = []
    for (let i = 0; i < list.length; i++) {
      const t = { ...list[i] }
      if (t.id && t.urutan !== i + 1) await supabase.from('surat_tahapan').update({ urutan: i + 1 }).eq('id', t.id)
      t.urutan = i + 1
      hasil.push(t)
    }
    return hasil
  }
  async function saveTahap(idx) {
    const rapi = await rapikanUrutan(tahapanList)
    const hasil = await simpanSatu(rapi[idx])
    const updated = [...rapi]; updated[idx] = hasil; setTahapanList(updated)
    load()
  }

  function updateTahapField(idx, field, value) {
    const updated = [...tahapanList]
    updated[idx] = { ...updated[idx], [field]: value }
    setTahapanList(updated)
  }

  function terimaSekarang(idx) { updateTahapField(idx, 'tanggal_diterima', new Date().toISOString()) }
  // Teruskan ke tahap berikutnya, langsung tersimpan (tahap ini + tahap berikutnya)
  async function teruskanSekarang(idx) {
    const t = tahapanList[idx]
    if (isTujuan(t.nama_tahap) && !confirm('Apakah proses surat di bidang/divisi tujuan sudah SELESAI?\n\nKlik OK jika sudah selesai — surat akan ditandai SELESAI lalu diserahkan ke Biro Umum untuk diarsip.')) return
    const now = new Date().toISOString()
    const list = (await rapikanUrutan(tahapanList)).map(x => ({ ...x }))
    list[idx].tanggal_diteruskan = now
    const diubah = [idx]
    const next = idx + 1
    if (next < list.length && !list[next].tanggal_diterima) { list[next].tanggal_diterima = now; diubah.push(next) }
    // Tahap "Selesai" tercatat otomatis, lalu langsung ke Biro Umum untuk diarsip
    if (next < list.length && isSelesai(list[next].nama_tahap)) {
      list[next].tanggal_diteruskan = list[next].tanggal_diteruskan || now
      const n2 = next + 1
      if (n2 < list.length && !list[n2].tanggal_diterima) { list[n2].tanggal_diterima = now; diubah.push(n2) }
    }
    const hasil = [...list]
    for (const i of [...new Set(diubah)]) hasil[i] = await simpanSatu(list[i])
    setTahapanList(hasil)
    load()
  }

  // Kepala Markas bisa meneruskan ke tahap lain dulu sebelum ke Bidang/Divisi Tujuan
  async function tambahTahapLain(idx) {
    const nama = prompt('Nama tahap lanjutan setelah ini (mis. Ketua Bidang, Sekretaris, Bendahara):')
    if (!nama || !nama.trim()) return
    const list = [...tahapanList]
    list.splice(idx + 1, 0, { nama_tahap: nama.trim(), penerima_nama: '', tanggal_diterima: null, tanggal_diteruskan: null, catatan: '', _new: true })
    const hasil = []
    for (let i = 0; i < list.length; i++) {
      const t = { ...list[i], urutan: i + 1 }
      if (t.id && list[i].urutan !== t.urutan) await supabase.from('surat_tahapan').update({ urutan: t.urutan }).eq('id', t.id)
      hasil.push(t)
    }
    hasil[idx + 1] = await simpanSatu(hasil[idx + 1])
    setTahapanList(hasil)
    load()
  }

  // Tahap lain boleh disisipkan antara Kepala Markas dan Bidang/Divisi Tujuan, selama surat belum pindah ke tahap berikutnya
  function canTambah(idx) {
    const km = tahapanList.findIndex(x => isKepalaMarkas(x.nama_tahap))
    let tj = tahapanList.findIndex(x => isTujuan(x.nama_tahap))
    if (tj < 0) tj = tahapanList.length
    return km >= 0 && idx >= km && idx < tj - 0 && idx + 1 <= tj && !tahapanList[idx + 1]?.tanggal_diterima
  }

  function hariTertahan(t) {
    if (!t.tanggal_diterima || t.tanggal_diteruskan) return null
    return Math.floor((Date.now() - new Date(t.tanggal_diterima).getTime()) / (1000 * 60 * 60 * 24))
  }

  const filtered = surat.filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))

  // Unduh semua berkas surat masuk (sesuai hasil pencarian) sekaligus dalam satu file ZIP
  async function unduhSemuaBerkas() {
    const boleh = filtered.filter(r => !(r.sifat === 'Rahasia' && !isAdmin))
    const adaBerkas = boleh.filter(r => r.file_bukti_url).length
    if (adaBerkas === 0) { alert('Belum ada berkas surat yang bisa diunduh.'); return }
    const tanpa = boleh.length - adaBerkas
    if (!confirm(`Unduh ${adaBerkas} berkas surat masuk dalam satu file ZIP?` + (tanpa ? `\n(${tanpa} surat lain tidak punya berkas terunggah.)` : ''))) return
    const hasil = await unduhBerkasZip({
      rows: boleh, namaZip: 'berkas-surat-masuk', onProgress: setZipProg,
      namaFile: r => `${r.tanggal_diterima_kantor || 'tanpa-tanggal'}_${r.nomor_surat || 'tanpa-nomor'}`,
      daftarHeader: ['Tanggal Diterima','Nomor Surat','Asal','Perihal','Sifat'],
      daftarBaris: boleh.map(r => [r.tanggal_diterima_kantor, r.nomor_surat, r.asal_surat, r.perihal, r.sifat]),
    })
    setZipProg(null)
    if (hasil.gagal.length) alert(`${hasil.gagal.length} berkas gagal diunduh (daftarnya ada di GAGAL-diunduh.txt di dalam ZIP).`)
  }

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
      <div className="main">
        <div className="topbar">
          <div><h1>Surat Masuk</h1><p className="desc">Pencatatan dan pelacakan surat masuk PMI Sumatera Barat.</p></div>
          {bolehCatat && <button className="btn btn-primary" onClick={() => { setForm({}); setError(''); setShowAddModal(true) }}>+ Catat Surat Masuk</button>}
        </div>

        {!bolehCatat && !peran.loading && (
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>
            👁 Akun kamu hanya bisa melihat surat masuk. Surat masuk dicatat oleh Sekretariat. Buka kolom “Disposisi” untuk melihat disposisi surat.
          </div>
        )}
        {peran.migrasiBelum && (
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>{PESAN_MIGRASI}</div>
        )}

        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari nomor surat / asal / perihal..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:280}} />
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="btn btn-ghost" onClick={unduhSemuaBerkas} disabled={!!zipProg}>{zipProg ? `Menyiapkan ${zipProg.n}/${zipProg.total}...` : '📦 Unduh Semua Berkas (ZIP)'}</button>
              <button className="btn btn-ghost" onClick={exportCSV}>⬇ Export Laporan (CSV)</button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Tgl Diterima Kantor</th><th>Agenda</th><th>No. Surat</th><th>Asal</th><th>Perihal</th><th>Sifat</th><th>Status</th><th>Disposisi</th><th>Bukti</th><th>Petugas</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={11} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={11} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Belum ada surat tercatat.</td></tr> :
                filtered.map(s => {
                  const isRahasia = s.sifat === 'Rahasia' && !isAdmin
                  return (
                  <tr key={s.id} className="row-click" onClick={()=>{ if (!isRahasia) openTahap(s.id) }}>
                    <td data-label="Tgl Diterima">{s.tanggal_diterima_kantor}</td>
                    <td data-label="Agenda" className="mono">{s.nomor_agenda || '-'}</td>
                    <td data-label="No. Surat" className="mono">{isRahasia ? '••••••' : s.nomor_surat}{!isRahasia && s.macam_surat && <div style={{fontSize:11.5,color:'var(--ink-soft)',fontFamily:'inherit'}}>{s.macam_surat}</div>}</td>
                    <td data-label="Asal">{isRahasia ? '🔒 Rahasia' : s.asal_surat}</td>
                    <td data-label="Perihal">{isRahasia ? 'Hanya admin yang bisa lihat' : s.perihal}</td>
                    <td data-label="Sifat"><span className="tag" style={sifatStyle(s.sifat)}>{s.sifat}</span></td>
                    <td data-label="Status">{isRahasia ? '-' : (() => { const st = statusSurat(tahapMap[s.id]); return st ? <span className="tag" style={st.tone === 'ok' ? { background: 'var(--stock-bg)', color: 'var(--stock)' } : { background: 'var(--gold-bg)', color: 'var(--gold)' }}>{st.label}</span> : '-' })()}</td>
                    <td data-label="Disposisi" onClick={e=>e.stopPropagation()}>{isRahasia ? '-' : (() => { const d = disposisiMap[s.id]; return <button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,fontSize:12.5}} onClick={()=>setModalDisposisi(s)}>{d ? <span style={{color: d.selesai === d.total ? 'var(--stock)' : 'var(--gold)',fontWeight:700}}>{d.total} tujuan · {d.selesai} selesai</span> : (peran.bisaDisposisi ? '+ Disposisi' : 'Belum')}</button> })()}</td>
                    <td data-label="Bukti" onClick={e=>e.stopPropagation()}>{!isRahasia && s.file_bukti_url ? <a href={s.file_bukti_url} target="_blank" rel="noreferrer" style={{color:'var(--pmi-red)',fontWeight:600}}>📎 Lihat</a> : '-'}</td>
                    <td data-label="Petugas">{s.profiles?.nama_lengkap || '-'}</td>
                    <td data-label="" style={{color:'var(--ink-soft)',textAlign:'right',whiteSpace:'nowrap'}} onClick={e=>e.stopPropagation()}>{isRahasia ? '' : <><button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,fontSize:12.5,marginRight:6}} onClick={()=>setModalRiwayat(s)}>Riwayat</button><button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,fontSize:12.5}} onClick={()=>openTahap(s.id)}>Alur →</button></>}</td>
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
              <h3 style={{margin:0}}>Catat Surat Masuk Baru <span style={{fontSize:12,fontWeight:400,color:'var(--ink-soft)'}}>· nomor agenda terisi otomatis</span></h3>
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
              <div className="field"><label>Macam Surat</label>
                <input list="macam-surat" value={form.macam_surat||''} onChange={e=>setForm({...form,macam_surat:e.target.value})} placeholder="Undangan / Permohonan / Pemberitahuan / ..." />
                <datalist id="macam-surat">{['Undangan','Permohonan','Pemberitahuan','Surat Edaran','Laporan','Surat Tugas','Balasan','Lain-lain'].map(m=><option key={m} value={m} />)}</datalist>
              </div>
              <div className="field"><label>Lampiran</label><input value={form.lampiran||''} onChange={e=>setForm({...form,lampiran:e.target.value})} placeholder="mis. 1 berkas / 2 lembar / -" /></div>
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

      {modalDisposisi && (
        <Modal judul={`Disposisi — ${modalDisposisi.nomor_surat}`} onClose={() => setModalDisposisi(null)} lebar={760}>
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, marginBottom: 14 }}>
            <b>{modalDisposisi.asal_surat}</b> — {modalDisposisi.perihal}<br />
            <span style={{ color: 'var(--ink-soft)' }}>Agenda {modalDisposisi.nomor_agenda || '-'} · diterima {fmtTgl(modalDisposisi.tanggal_diterima_kantor)}</span>
            {modalDisposisi.file_bukti_url && <> · <a href={modalDisposisi.file_bukti_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>📎 Lihat surat</a></>}
          </div>
          <DisposisiPanel supabase={supabase} surat={modalDisposisi} units={units} peran={peran} onChanged={load} />
        </Modal>
      )}
      {modalRiwayat && <RiwayatModal supabase={supabase} jenis="masuk" surat={modalRiwayat} peran={peran} onClose={() => setModalRiwayat(null)} />}

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
                      <strong>{idx+1}. {labelTahap(t.nama_tahap)}</strong>
                      {tertahan !== null && tertahan >= 2 && <span style={{background:'#FBE7E7',color:'#B3261E',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>⚠ Tertahan {tertahan} hari</span>}
                      {tertahan !== null && tertahan < 2 && <span style={{background:'var(--gold-bg)',color:'var(--gold)',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>Sedang di sini</span>}
                      {t.tanggal_diteruskan && <span style={{background:'var(--stock-bg)',color:'var(--stock)',fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20}}>✓ Selesai diteruskan</span>}
                    </div>
                    {!belumSampai && (
                      <>
                        {bolehAlur ? (
                          <div className="field" style={{marginBottom:8}}>
                            <label>Nama Penerima di Tahap Ini</label>
                            <input value={t.penerima_nama||''} onChange={e=>updateTahapField(idx,'penerima_nama',e.target.value)} placeholder="Nama orangnya" />
                          </div>
                        ) : (
                          <div style={{fontSize:13,marginBottom:8}}>Penerima: <strong>{t.penerima_nama || '-'}</strong></div>
                        )}
                        {isSelesai(t.nama_tahap) && <div style={{fontSize:12.5,color:'var(--stock)',marginBottom:8}}>Tercatat otomatis saat bidang/divisi tujuan menyatakan proses selesai, sebelum diarsip oleh Biro Umum.</div>}
                        <div style={{display:'flex',gap:8,marginBottom:8,fontSize:12.5,color:'var(--ink-soft)',flexWrap:'wrap'}}>
                          <div>Diterima: <strong>{t.tanggal_diterima ? new Date(t.tanggal_diterima).toLocaleString('id-ID') : 'Belum'}</strong></div>
                          <div>Diteruskan: <strong>{t.tanggal_diteruskan ? new Date(t.tanggal_diteruskan).toLocaleString('id-ID') : 'Belum'}</strong></div>
                        </div>
                        {bolehAlur && (
                          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                            {!t.tanggal_diterima && <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:12}} onClick={()=>terimaSekarang(idx)}>Tandai Diterima Sekarang</button>}
                            {t.tanggal_diterima && !t.tanggal_diteruskan && <button className="btn btn-primary" style={{padding:'5px 10px',fontSize:12}} onClick={()=>teruskanSekarang(idx)}>{idx === tahapanList.length - 1 ? '✅ Selesai — Arsip Diterima Biro Umum' : isTujuan(t.nama_tahap) ? '✅ Proses Selesai' : isSelesai(t.nama_tahap) ? 'Serahkan ke Biro Umum untuk Diarsip' : isPengarsipan(t.nama_tahap) ? 'Sudah Diarsip → Kembali ke Biro Umum' : 'Teruskan ke Tahap Berikutnya'}</button>}
                            {canTambah(idx) && <button className="btn btn-ghost" style={{padding:'5px 10px',fontSize:12}} onClick={()=>tambahTahapLain(idx)}>+ Teruskan ke tahap lain dulu</button>}
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
