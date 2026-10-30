'use client'
// Ekspedisi: buku pengiriman surat keluar + tanda terima.
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import Modal, { Info } from '@/components/Modal'
import { fmtTgl, hariIni, tabelBelumAda, PESAN_MIGRASI, unduhCsv, unggahBerkas, pesanGalat } from '@/lib/format'
import { cetakDaftar } from '@/lib/cetak'

const VIA = ['Diantar langsung', 'Kurir', 'Pos', 'Email', 'WhatsApp', 'Lainnya']
const ST = {
  belum: { l: 'Belum dikirim', s: { background: '#FBE7E7', color: '#B3261E' } },
  dikirim: { l: 'Dikirim', s: { background: 'var(--gold-bg)', color: 'var(--gold)' } },
  diterima: { l: 'Diterima', s: { background: 'var(--stock-bg)', color: 'var(--stock)' } },
  kembali: { l: 'Kembali / tidak sampai', s: { background: '#F3E8FB', color: '#7B2CBF' } },
}

export default function EkspedisiPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [fStatus, setFStatus] = useState('semua')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase.from('surat_keluar').select('*, ekspedisi:surat_ekspedisi(*)').order('tanggal_surat', { ascending: false }).limit(1500)
    if (err) { setPesan(tabelBelumAda(err) ? pesanGalat(err) : 'Gagal memuat: ' + err.message); setRows([]) }
    else {
      setPesan('')
      setRows((data || []).map(r => { const e = [...(r.ekspedisi || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] || null; return { ...r, eks: e, st: e ? e.status : 'belum' } }))
    }
    setLoading(false)
  }

  const tampil = useMemo(() => rows.filter(r => (fStatus === 'semua' || r.st === fStatus) &&
    (r.sifat === 'Rahasia' && !peran.isAdmin ? !search : `${r.nomor_surat} ${r.nomor_agenda} ${r.tujuan_surat} ${r.perihal} ${r.divisi} ${r.eks?.penerima}`.toLowerCase().includes(search.toLowerCase()))), [rows, fStatus, search, peran.isAdmin])
  const hitung = s => rows.filter(r => r.st === s).length

  function buka(r) {
    setError('')
    const e = r.eks
    setForm(e ? { ...e, penerima: e.penerima || '', pengantar: e.pengantar || '', catatan: e.catatan || '' } : { tanggal_kirim: hariIni(), dikirim_via: 'Diantar langsung', penerima: r.tujuan_surat || '', pengantar: '', status: 'dikirim', catatan: '', tanda_terima_url: '' })
    setModal(r)
  }
  async function unggah(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true)
    try { const url = await unggahBerkas(supabase, file); setForm(f => ({ ...f, tanda_terima_url: url })) } catch (err) { setError(err.message) }
    setUploading(false)
  }
  async function simpan() {
    setError('')
    if (!form.tanggal_kirim) { setError('Isi tanggal kirim.'); return }
    if (form.status === 'diterima' && !form.tanggal_diterima) { setError('Isi tanggal diterima.'); return }
    setSaving(true)
    const payload = { tanggal_kirim: form.tanggal_kirim, dikirim_via: form.dikirim_via, penerima: form.penerima?.trim() || null, pengantar: form.pengantar?.trim() || null, status: form.status, tanggal_diterima: form.status === 'diterima' ? form.tanggal_diterima : null, tanda_terima_url: form.tanda_terima_url || null, catatan: form.catatan?.trim() || null }
    const q = modal.eks ? supabase.from('surat_ekspedisi').update(payload).eq('id', modal.eks.id) : supabase.from('surat_ekspedisi').insert({ ...payload, surat_keluar_id: modal.id })
    const { error: err } = await q
    setSaving(false)
    if (err) { setError(err.message); return }
    setModal(null); load()
  }

  const kolom = [{ judul: 'Tgl Surat', k: 'tgl' }, { judul: 'No. Agenda', k: 'agenda' }, { judul: 'No. Surat', k: 'nomor' }, { judul: 'Tujuan', k: 'tujuan' }, { judul: 'Perihal', k: 'perihal' }, { judul: 'Divisi/Biro', k: 'divisi' }, { judul: 'Tgl Kirim', k: 'kirim' }, { judul: 'Via', k: 'via' }, { judul: 'Penerima', k: 'penerima' }, { judul: 'Pengantar', k: 'pengantar' }, { judul: 'Status', k: 'status' }]
  const baris = () => tampil.filter(r => !(r.sifat === 'Rahasia' && !peran.isAdmin)).map(r => ({ tgl: fmtTgl(r.tanggal_surat), agenda: r.nomor_agenda || '', nomor: r.nomor_surat, tujuan: r.tujuan_surat, perihal: r.perihal, divisi: r.divisi || '', kirim: r.eks ? fmtTgl(r.eks.tanggal_kirim) : '', via: r.eks?.dikirim_via || '', penerima: r.eks?.penerima || '', pengantar: r.eks?.pengantar || '', status: ST[r.st].l }))

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Ekspedisi</h1><p className="desc">Buku pengiriman surat keluar: kapan dikirim, lewat apa, siapa penerimanya, dan tanda terimanya.</p></div></div>
      {peran.migrasiBelum && <Info>Pembaruan database belum dijalankan. {PESAN_MIGRASI}</Info>}
      {pesan && <div className="error-box">{pesan}</div>}
      {!peran.bisaEkspedisi && !peran.loading && <Info>👁 Akun kamu belum terhubung ke unit/bidang, jadi hanya bisa melihat. Minta admin mengatur unit kamu di menu Data User.</Info>}

      <div className="grid4">
        {['belum', 'dikirim', 'diterima', 'kembali'].map(s => <div key={s} className="stat" style={{ '--accent': s === 'diterima' ? 'var(--stock)' : s === 'belum' ? '#B3261E' : 'var(--gold)' }}><div className="lbl">{ST[s].l}</div><div className="val">{hitung(s)}</div></div>)}
      </div>

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <input placeholder="Cari nomor / tujuan / perihal / penerima..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ maxWidth: 220 }}><option value="semua">Semua status</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => cetakDaftar({ judul: 'Buku Ekspedisi', subjudul: fStatus === 'semua' ? 'Semua surat keluar' : ST[fStatus].l, kolom, baris: baris(), namaPencetak: peran.nama })}>🖨 Cetak Buku Ekspedisi</button>
            <button className="btn btn-ghost" onClick={() => unduhCsv('ekspedisi', kolom.map(k => k.judul), baris().map(b => kolom.map(k => b[k.k])))}>⬇ CSV</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Tgl Surat</th><th>Agenda</th><th>No. Surat</th><th>Tujuan</th><th>Perihal</th><th>Pengiriman</th><th>Status</th><th>Tanda Terima</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30 }}>Memuat...</td></tr> :
                tampil.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Belum ada data.</td></tr> :
                  tampil.map(r => {
                    const sem = r.sifat === 'Rahasia' && !peran.isAdmin
                    return (
                      <tr key={r.id}>
                        <td data-label="Tgl Surat">{fmtTgl(r.tanggal_surat)}</td><td data-label="Agenda" className="mono">{r.nomor_agenda || '-'}</td>
                        <td data-label="No. Surat" className="mono">{sem ? '••••••' : r.nomor_surat}</td><td data-label="Tujuan">{sem ? '🔒 Rahasia' : r.tujuan_surat}</td><td data-label="Perihal">{sem ? '-' : r.perihal}</td>
                        <td data-label="Pengiriman">{r.eks ? <>{fmtTgl(r.eks.tanggal_kirim)} · {r.eks.dikirim_via}<div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.eks.penerima ? 'Penerima: ' + r.eks.penerima : ''}{r.eks.pengantar ? ' · oleh ' + r.eks.pengantar : ''}</div></> : '-'}</td>
                        <td data-label="Status"><span className="tag" style={ST[r.st].s}>{ST[r.st].l}</span>{r.eks?.tanggal_diterima && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{fmtTgl(r.eks.tanggal_diterima)}</div>}</td>
                        <td data-label="Tanda terima">{r.eks?.tanda_terima_url ? <a href={r.eks.tanda_terima_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pmi-red)', fontWeight: 600 }}>📎 Lihat</a> : '-'}</td>
                        <td data-label="">{peran.bisaEkspedisi && !sem && <button className="btn btn-ghost" style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => buka(r)}>{r.eks ? 'Ubah / Tanda Terima' : 'Catat Kirim'}</button>}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal judul={modal.eks ? 'Ubah Pengiriman / Tanda Terima' : 'Catat Pengiriman Surat'} onClose={() => setModal(null)} lebar={520}
          footer={<><button className="btn btn-ghost" onClick={() => setModal(null)}>Batal</button><button className="btn btn-primary" disabled={saving || uploading} onClick={simpan}>{saving ? 'Menyimpan...' : 'Simpan'}</button></>}>
          {error && <div className="error-box">{error}</div>}
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, marginBottom: 14 }}><b>{modal.nomor_surat}</b> · {modal.tujuan_surat}<br />{modal.perihal}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
            <div className="field"><label>Tanggal Kirim *</label><input type="date" value={form.tanggal_kirim || ''} onChange={e => setForm({ ...form, tanggal_kirim: e.target.value })} /></div>
            <div className="field"><label>Dikirim Via</label><select value={form.dikirim_via} onChange={e => setForm({ ...form, dikirim_via: e.target.value })}>{VIA.map(v => <option key={v}>{v}</option>)}</select></div>
          </div>
          <div className="field"><label>Penerima / Instansi Penerima</label><input value={form.penerima || ''} onChange={e => setForm({ ...form, penerima: e.target.value })} /></div>
          <div className="field"><label>Petugas Pengantar / Kurir</label><input value={form.pengantar || ''} onChange={e => setForm({ ...form, pengantar: e.target.value })} /></div>
          <div className="field"><label>Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value, tanggal_diterima: e.target.value === 'diterima' ? form.tanggal_diterima || hariIni() : form.tanggal_diterima })}><option value="dikirim">Dikirim</option><option value="diterima">Diterima (ada tanda terima)</option><option value="kembali">Kembali / tidak sampai</option></select></div>
          {form.status === 'diterima' && <div className="field"><label>Tanggal Diterima *</label><input type="date" value={form.tanggal_diterima || ''} onChange={e => setForm({ ...form, tanggal_diterima: e.target.value })} /></div>}
          <div className="field"><label>Foto / scan tanda terima (opsional)</label><input type="file" accept="image/*,.pdf" onChange={unggah} />{uploading && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Mengunggah...</div>}{form.tanda_terima_url && !uploading && <div style={{ fontSize: 12, color: 'var(--stock)', marginTop: 4 }}>✓ Tanda terima terpasang</div>}</div>
          <div className="field"><label>Catatan</label><textarea rows={2} value={form.catatan || ''} onChange={e => setForm({ ...form, catatan: e.target.value })} /></div>
        </Modal>
      )}
    </div></div>
  )
}
