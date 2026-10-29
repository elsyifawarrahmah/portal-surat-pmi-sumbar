'use client'
// Arsip Biro Umum: satu tempat untuk mengarsipkan semua jenis dokumen + mencatat lokasi simpannya.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import { statusSurat, isPengarsipan, labelTahap } from '@/lib/tahap'
import { unduhBerkasZip } from '@/lib/zip'

const JENIS = {
  surat_masuk: 'Surat Masuk',
  surat_keluar: 'Surat Keluar',
  pks: 'Perjanjian Kerja Sama',
  sertifikat: 'Sertifikat & Piagam',
  sk: 'Surat Keputusan',
}
const STATUS_STYLE = {
  siap: { background: 'var(--gold-bg)', color: 'var(--gold)' },
  arsip: { background: 'var(--stock-bg)', color: 'var(--stock)' },
  proses: { background: '#EEF1F6', color: '#4A5568' },
}
const STATUS_LABEL = { siap: 'Siap diarsip', arsip: 'Sudah diarsip', proses: 'Masih berjalan' }

function tgl(v) {
  if (!v) return '-'
  const d = new Date(String(v).slice(0, 10) + 'T00:00:00')
  return isNaN(d) ? v : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ArsipPage() {
  const supabase = createClient()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const peran = usePeran()
  const bisaArsip = peran.bisaArsip   // admin atau Biro Umum
  const [fJenis, setFJenis] = useState('semua')
  const [fStatus, setFStatus] = useState('semua')
  const [fTahun, setFTahun] = useState('semua')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)   // baris yang sedang diarsipkan / diedit
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [zipProg, setZipProg] = useState(null)
  const [tahapMap, setTahapMap] = useState({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
      setIsAdmin(profile?.role === 'admin')
    }
    const [masuk, keluar, dok, tahap, cat] = await Promise.all([
      supabase.from('surat_masuk').select('*'),
      supabase.from('surat_keluar').select('*'),
      supabase.from('arsip_dokumen').select('*'),
      supabase.from('surat_tahapan').select('id, surat_id, nama_tahap, urutan, tanggal_diterima, tanggal_diteruskan'),
      supabase.from('arsip_catatan').select('*, profiles:diarsip_oleh(nama_lengkap)'),
    ])

    if (cat.error) {
      const belumAda = cat.error.code === '42P01' || cat.error.code === 'PGRST205' || /arsip_catatan/.test(cat.error.message || '')
      setLoadError(belumAda
        ? 'Tabel arsip belum dibuat. Jalankan file supabase/migrasi-arsip-biro-umum.sql di Supabase (SQL Editor) satu kali.'
        : 'Gagal memuat catatan arsip: ' + cat.error.message)
    } else setLoadError('')

    const peta = {}
    ;(tahap.data || []).forEach(t => { (peta[t.surat_id] = peta[t.surat_id] || []).push(t) })
    setTahapMap(peta)

    const catMap = {}
    ;(cat.data || []).forEach(c => { catMap[c.jenis + ':' + c.ref_id] = c })

    const semua = []
    ;(masuk.data || []).forEach(r => semua.push({
      jenis: 'surat_masuk', id: r.id, tanggal: r.tanggal_diterima_kantor, nomor: r.nomor_surat,
      judul: r.perihal, pihak: r.asal_surat, divisi: '', sifat: r.sifat, file: r.file_bukti_url,
    }))
    ;(keluar.data || []).forEach(r => semua.push({
      jenis: 'surat_keluar', id: r.id, tanggal: r.tanggal_surat, nomor: r.nomor_surat,
      judul: r.perihal, pihak: r.tujuan_surat, divisi: r.divisi || '', sifat: r.sifat, file: r.file_bukti_url,
    }))
    ;(dok.data || []).forEach(r => semua.push({
      jenis: r.jenis, id: r.id, tanggal: r.tanggal, nomor: r.nomor,
      judul: r.judul, pihak: r.pihak || r.penerbit || '', divisi: r.divisi || '', sifat: null, file: r.file_bukti_url,
    }))

    const hasil = semua.map(r => {
      const c = catMap[r.jenis + ':' + r.id] || null
      let status = 'siap'
      let info = ''
      if (c) status = 'arsip'
      else if (r.jenis === 'surat_masuk') {
        const st = statusSurat(peta[r.id])
        if (st && st.tone !== 'ok') { status = 'proses'; info = st.label }
      }
      return { ...r, key: r.jenis + ':' + r.id, catat: c, status, info }
    }).sort((a, b) => String(b.tanggal || '').localeCompare(String(a.tanggal || '')))

    setRows(hasil)
    setLoading(false)
  }

  const tahunList = [...new Set(rows.map(r => String(r.tanggal || '').slice(0, 4)).filter(Boolean))].sort().reverse()
  const hitung = s => rows.filter(r => r.status === s).length

  const filtered = rows.filter(r => {
    if (fJenis !== 'semua' && r.jenis !== fJenis) return false
    if (fStatus !== 'semua' && r.status !== fStatus) return false
    if (fTahun !== 'semua' && String(r.tanggal || '').slice(0, 4) !== fTahun) return false
    if (!search) return true
    const gabung = [r.nomor, r.judul, r.pihak, r.divisi, r.catat?.lokasi_arsip, r.catat?.catatan, JENIS[r.jenis]].join(' ').toLowerCase()
    return gabung.includes(search.toLowerCase())
  })

  const rahasia = r => r.sifat === 'Rahasia' && !isAdmin

  function bukaArsip(r) {
    setModal(r); setError('')
    setForm({
      lokasi_arsip: r.catat?.lokasi_arsip || '',
      tanggal_arsip: r.catat?.tanggal_arsip || new Date().toISOString().slice(0, 10),
      catatan: r.catat?.catatan || '',
    })
  }

  async function simpanArsip() {
    if (!form.lokasi_arsip || !form.lokasi_arsip.trim()) { setError('Isi lokasi simpan arsip (mis. Lemari A / Rak 2 / Map Biru).'); return }
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error: err } = await supabase.from('arsip_catatan').upsert({
      jenis: modal.jenis, ref_id: modal.id,
      lokasi_arsip: form.lokasi_arsip.trim(), tanggal_arsip: form.tanggal_arsip || new Date().toISOString().slice(0, 10),
      catatan: form.catatan || null, diarsip_oleh: userData.user.id,
    }, { onConflict: 'jenis,ref_id' })
    if (err) { setError(err.message); setSaving(false); return }

    // Surat masuk: tutup alurnya (Pengarsipan selesai -> kembali ke Biro Umum)
    if (modal.jenis === 'surat_masuk') {
      const list = [...(tahapMap[modal.id] || [])].sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
      const i = list.findIndex(t => isPengarsipan(t.nama_tahap) && t.tanggal_diterima && !t.tanggal_diteruskan)
      if (i >= 0) {
        const now = new Date().toISOString()
        await supabase.from('surat_tahapan').update({ tanggal_diteruskan: now }).eq('id', list[i].id)
        const next = list[i + 1]
        if (next && !next.tanggal_diteruskan) {
          await supabase.from('surat_tahapan').update({ tanggal_diterima: next.tanggal_diterima || now, tanggal_diteruskan: now }).eq('id', next.id)
        }
      }
    }
    setSaving(false); setModal(null); load()
  }

  async function batalArsip(r) {
    if (!confirm('Batalkan status arsip untuk dokumen ini? (Catatan lokasi akan dihapus.)')) return
    const { error: err } = await supabase.from('arsip_catatan').delete().eq('id', r.catat.id)
    if (err) { alert('Gagal: ' + err.message); return }
    load()
  }

  function exportCSV() {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['Jenis','Tanggal','Nomor','Perihal / Judul','Asal / Tujuan / Pihak','Divisi/Biro','Status','Lokasi Arsip','Tanggal Arsip','Diarsip Oleh','Catatan'].map(esc).join(';')
    const baris = filtered.filter(r => !rahasia(r)).map(r => [
      JENIS[r.jenis], r.tanggal, r.nomor, r.judul, r.pihak, r.divisi, STATUS_LABEL[r.status],
      r.catat?.lokasi_arsip || '', r.catat?.tanggal_arsip || '', r.catat?.profiles?.nama_lengkap || '', r.catat?.catatan || '',
    ].map(esc).join(';'))
    const csv = '\uFEFF' + [header, ...baris].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a')
    a.href = url; a.download = `register-arsip-${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  async function unduhBerkas() {
    const boleh = filtered.filter(r => !rahasia(r))
    const ada = boleh.filter(r => r.file).length
    if (ada === 0) { alert('Belum ada berkas yang bisa diunduh pada daftar ini.'); return }
    if (!confirm(`Unduh ${ada} berkas dalam satu file ZIP?`)) return
    const hasil = await unduhBerkasZip({
      rows: boleh.map(r => ({ ...r, file_bukti_url: r.file })), namaZip: 'berkas-arsip', onProgress: setZipProg,
      namaFile: r => `${JENIS[r.jenis].replace(/[^A-Za-z]+/g, '')}_${r.tanggal || 'tanpa-tanggal'}_${r.nomor || 'tanpa-nomor'}`,
      daftarHeader: ['Jenis','Tanggal','Nomor','Perihal / Judul','Status','Lokasi Arsip'],
      daftarBaris: boleh.map(r => [JENIS[r.jenis], r.tanggal, r.nomor, r.judul, STATUS_LABEL[r.status], r.catat?.lokasi_arsip || '']),
    })
    setZipProg(null)
    if (hasil.gagal.length) alert(`${hasil.gagal.length} berkas gagal diunduh (daftarnya ada di GAGAL-diunduh.txt di dalam ZIP).`)
  }

  const kartu = (status, warna) => (
    <div className="stat row-click" style={{ '--accent': warna, outline: fStatus === status ? '2px solid ' + warna : 'none' }}
         onClick={() => setFStatus(fStatus === status ? 'semua' : status)}>
      <div className="lbl">{STATUS_LABEL[status]}</div><div className="val">{hitung(status)}</div>
    </div>
  )

  return (
    <div className="app">
      <div className="main">
        <div className="topbar">
          <div><h1>Arsip Biro Umum</h1><p className="desc">Register arsip semua dokumen: catat lokasi simpan, tandai sudah diarsip, dan cari dengan cepat.</p></div>
        </div>

        {!bisaArsip && !peran.loading && (
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'10px 14px',borderRadius:10,fontSize:12.5,fontWeight:600,marginBottom:18}}>
            👁 Akun kamu hanya bisa melihat arsip. Pengarsipan dilakukan oleh Biro Umum.
          </div>
        )}
        {loadError && <div className="error-box" style={{marginBottom:18}}>{loadError}</div>}

        <div className="grid4" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          {kartu('siap', 'var(--gold)')}
          {kartu('arsip', 'var(--stock)')}
          {kartu('proses', '#4A5568')}
        </div>

        <div className="panel">
          <div className="panel-head" style={{flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',flex:1}}>
              <input placeholder="Cari nomor / perihal / lokasi arsip..." value={search} onChange={e => setSearch(e.target.value)} style={{maxWidth:260}} />
              <select value={fJenis} onChange={e => setFJenis(e.target.value)} style={{width:'auto'}}>
                <option value="semua">Semua jenis</option>
                {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{width:'auto'}}>
                <option value="semua">Semua status</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select value={fTahun} onChange={e => setFTahun(e.target.value)} style={{width:'auto'}}>
                <option value="semua">Semua tahun</option>
                {tahunList.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button className="btn btn-ghost" onClick={unduhBerkas} disabled={!!zipProg}>{zipProg ? `Menyiapkan ${zipProg.n}/${zipProg.total}...` : '📦 Unduh Berkas (ZIP)'}</button>
              <button className="btn btn-ghost" onClick={exportCSV}>⬇ Register Arsip (CSV)</button>
            </div>
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Jenis</th><th>Tanggal</th><th>Nomor</th><th>Perihal / Judul</th><th>Asal / Tujuan</th><th>Status</th><th>Lokasi Arsip</th><th>Berkas</th>{bisaArsip && <th></th>}</tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={9} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Tidak ada dokumen yang cocok.</td></tr> :
                filtered.map(r => {
                  const tutup = rahasia(r)
                  return (
                    <tr key={r.key}>
                      <td data-label="Jenis">{JENIS[r.jenis]}</td>
                      <td data-label="Tanggal">{tgl(r.tanggal)}</td>
                      <td data-label="Nomor" className="mono">{tutup ? '••••••' : (r.nomor || '-')}</td>
                      <td data-label="Perihal">{tutup ? '🔒 Rahasia' : (r.judul || '-')}{!tutup && r.divisi ? <div style={{fontSize:11.5,color:'var(--ink-soft)'}}>{r.divisi}</div> : null}</td>
                      <td data-label="Asal/Tujuan">{tutup ? '-' : (r.pihak || '-')}</td>
                      <td data-label="Status">
                        <span className="tag" style={STATUS_STYLE[r.status]}>{STATUS_LABEL[r.status]}</span>
                        {r.status === 'proses' && r.info && <div style={{fontSize:11.5,color:'var(--ink-soft)',marginTop:3}}>{r.info}</div>}
                        {r.status === 'arsip' && r.catat?.tanggal_arsip && <div style={{fontSize:11.5,color:'var(--ink-soft)',marginTop:3}}>{tgl(r.catat.tanggal_arsip)}</div>}
                      </td>
                      <td data-label="Lokasi Arsip">{r.catat?.lokasi_arsip || '-'}{r.catat?.catatan ? <div style={{fontSize:11.5,color:'var(--ink-soft)'}}>{r.catat.catatan}</div> : null}</td>
                      <td data-label="Berkas">{!tutup && r.file ? <a href={r.file} target="_blank" rel="noreferrer" style={{color:'var(--pmi-red)',fontWeight:600}}>📎 Lihat</a> : '-'}</td>
                      {bisaArsip && (
                        <td data-label="">
                          {r.status === 'siap' && <button className="btn btn-primary" style={{padding:'4px 10px',fontSize:12}} onClick={() => bukaArsip(r)}>Arsipkan</button>}
                          {r.status === 'arsip' && (
                            <>
                              <button className="btn btn-ghost" style={{padding:'4px 8px',marginRight:4,fontSize:12}} onClick={() => bukaArsip(r)}>Ubah</button>
                              <button className="btn btn-ghost" style={{padding:'4px 8px',fontSize:12}} onClick={() => batalArsip(r)}>Batal</button>
                            </>
                          )}
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

      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:50}} onClick={e => { if (e.target === e.currentTarget) setModal(null) }}>
          <div style={{background:'#fff',borderRadius:16,width:'100%',maxWidth:440,maxHeight:'90vh',overflowY:'auto',margin:12}}>
            <div style={{padding:'18px 22px',borderBottom:'1px solid var(--line)',display:'flex',justifyContent:'space-between'}}>
              <h3 style={{margin:0}}>{modal.catat ? 'Ubah Catatan Arsip' : 'Arsipkan Dokumen'}</h3>
              <button onClick={() => setModal(null)} style={{border:'none',background:'none',cursor:'pointer',fontSize:16}}>✕</button>
            </div>
            <div style={{padding:'20px 22px'}}>
              <div style={{background:'var(--cream)',border:'1px solid var(--line)',borderRadius:10,padding:'10px 12px',fontSize:13,marginBottom:14}}>
                <div style={{fontSize:11.5,color:'var(--ink-soft)',fontWeight:700}}>{JENIS[modal.jenis]}</div>
                <div className="mono">{modal.nomor}</div>
                <div>{modal.judul}</div>
              </div>
              {error && <div className="error-box">{error}</div>}
              <div className="field">
                <label>Lokasi Simpan Arsip</label>
                <input value={form.lokasi_arsip || ''} onChange={e => setForm({ ...form, lokasi_arsip: e.target.value })} placeholder="Lemari A / Rak 2 / Map Biru" autoFocus />
              </div>
              <div className="field">
                <label>Tanggal Diarsipkan</label>
                <input type="date" value={form.tanggal_arsip || ''} onChange={e => setForm({ ...form, tanggal_arsip: e.target.value })} />
              </div>
              <div className="field">
                <label>Catatan — opsional</label>
                <textarea rows={2} value={form.catatan || ''} onChange={e => setForm({ ...form, catatan: e.target.value })} />
              </div>
              {modal.jenis === 'surat_masuk' && !modal.catat && (
                <div style={{fontSize:12,color:'var(--ink-soft)'}}>Alur surat ini ikut ditutup: tahap Pengarsipan selesai dan kembali ke Biro Umum.</div>
              )}
            </div>
            <div style={{padding:'14px 22px',borderTop:'1px solid var(--line)',display:'flex',justifyContent:'flex-end',gap:8}}>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Batal</button>
              <button className="btn btn-primary" onClick={simpanArsip} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Arsip'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
