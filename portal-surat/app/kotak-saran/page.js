'use client'
// Kotak Saran digital: semua pengguna bisa mengirim (boleh anonim); Biro Umum/admin membaca & menanggapi.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import Modal, { Info } from '@/components/Modal'
import { fmtWaktu, tabelBelumAda, PESAN_MIGRASI, unduhCsv, pesanGalat } from '@/lib/format'
import { cetakDaftar } from '@/lib/cetak'

const KATEGORI = ['Saran', 'Pengaduan', 'Apresiasi', 'Lainnya']
const ST = {
  baru: { l: 'Baru', s: { background: '#FBE7E7', color: '#B3261E' } },
  dibaca: { l: 'Sudah dibaca', s: { background: 'var(--gold-bg)', color: 'var(--gold)' } },
  ditanggapi: { l: 'Ditanggapi', s: { background: '#E4EEF9', color: '#1F5E99' } },
  selesai: { l: 'Selesai', s: { background: 'var(--stock-bg)', color: 'var(--stock)' } },
}

export default function KotakSaranPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [form, setForm] = useState({ kategori: 'Saran', isi: '', anonim: false, fisik: false, nama: '' })
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [saving, setSaving] = useState(false)
  const [fStatus, setFStatus] = useState('semua')
  const [tanggapi, setTanggapi] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase.from('surat_saran').select('*').order('created_at', { ascending: false }).limit(1000)
    if (err) { setPesan(tabelBelumAda(err) ? pesanGalat(err) : 'Gagal memuat: ' + err.message); setRows([]) } else { setPesan(''); setRows(data || []) }
    setLoading(false)
  }

  async function kirim() {
    setError(''); setOk('')
    if (form.isi.trim().length < 5) { setError('Tulis saran / pengaduan minimal beberapa kata.'); return }
    setSaving(true)
    const payload = { kategori: form.kategori, isi: form.isi.trim(), anonim: form.fisik ? !form.nama.trim() : form.anonim, sumber: form.fisik ? 'Kotak fisik' : 'Aplikasi' }
    if (form.fisik && form.nama.trim()) payload.nama_pengirim = form.nama.trim()
    const { error: err } = await supabase.from('surat_saran').insert(payload)   // tanpa .select(): kiriman anonim memang tidak bisa dibaca balik oleh pengirimnya
    setSaving(false)
    if (err) { setError(tabelBelumAda(err) ? pesanGalat(err) : err.message); return }
    setForm({ kategori: 'Saran', isi: '', anonim: false, fisik: false, nama: '' })
    setOk(form.anonim && !form.fisik ? 'Terkirim secara anonim. Terima kasih!' : 'Terkirim. Terima kasih atas masukannya!')
    load()
  }

  async function simpanTanggapan() {
    const { error: err } = await supabase.from('surat_saran').update({ status: tanggapi.status, tanggapan: tanggapi.tanggapan.trim() || null }).eq('id', tanggapi.id)
    if (err) { alert('Gagal: ' + err.message); return }
    setTanggapi(null); load()
  }
  async function tandaiBaca(r) { if (peran.bisaPantau && r.status === 'baru') { await supabase.from('surat_saran').update({ status: 'dibaca' }).eq('id', r.id); load() } }

  const tampil = rows.filter(r => fStatus === 'semua' || r.status === fStatus)
  const kolom = [{ judul: 'Waktu', k: 'waktu' }, { judul: 'Kategori', k: 'kategori' }, { judul: 'Isi', k: 'isi' }, { judul: 'Pengirim', k: 'pengirim' }, { judul: 'Sumber', k: 'sumber' }, { judul: 'Status', k: 'status' }, { judul: 'Tanggapan', k: 'tanggapan' }]
  const baris = () => tampil.map(r => ({ waktu: fmtWaktu(r.created_at), kategori: r.kategori, isi: r.isi, pengirim: r.anonim ? 'Anonim' : `${r.nama_pengirim || '-'}${r.unit_pengirim ? ' (' + r.unit_pengirim + ')' : ''}`, sumber: r.sumber, status: ST[r.status].l, tanggapan: r.tanggapan || '' }))

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Kotak Saran</h1><p className="desc">Sampaikan saran, pengaduan, atau apresiasi untuk PMI Sumatera Barat. Boleh tanpa nama.</p></div></div>
      {peran.migrasiBelum && <Info>Pembaruan database belum dijalankan. {PESAN_MIGRASI}</Info>}
      {pesan && <div className="error-box">{pesan}</div>}

      <div className="panel">
        <div className="panel-head"><h3>Tulis Saran / Pengaduan</h3></div>
        <div className="panel-body">
          {error && <div className="error-box">{error}</div>}
          {ok && <Info warna="stock">{ok}</Info>}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,220px) 1fr', gap: 12 }} className="stack-hp-saran">
            <div className="field"><label>Kategori</label><select value={form.kategori} onChange={e => setForm({ ...form, kategori: e.target.value })}>{KATEGORI.map(k => <option key={k}>{k}</option>)}</select></div>
            <div className="field"><label>Isi *</label><textarea rows={4} value={form.isi} onChange={e => setForm({ ...form, isi: e.target.value })} placeholder="Tulis dengan jelas agar mudah ditindaklanjuti..." /></div>
          </div>
          {peran.bisaPantau && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', fontSize: 14, color: 'var(--ink)', margin: '0 0 10px' }}>
              <input type="checkbox" style={{ width: 18, height: 18 }} checked={form.fisik} onChange={e => setForm({ ...form, fisik: e.target.checked })} /> Catat dari kotak saran fisik (kertas yang diambil dari kotak)
            </label>
          )}
          {form.fisik
            ? <div className="field"><label>Nama pengirim (kosongkan bila tanpa nama)</label><input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} /></div>
            : <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', fontSize: 14, color: 'var(--ink)', margin: '0 0 14px' }}><input type="checkbox" style={{ width: 18, height: 18 }} checked={form.anonim} onChange={e => setForm({ ...form, anonim: e.target.checked })} /> Kirim tanpa nama (anonim) — identitas tidak disimpan</label>}
          <button className="btn btn-primary" onClick={kirim} disabled={saving}>{saving ? 'Mengirim...' : 'Kirim'}</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>{peran.bisaPantau ? 'Semua Masukan' : 'Masukan yang Kamu Kirim'}</h3>
          {peran.bisaPantau && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 'auto' }}><option value="semua">Semua status</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select>
              <button className="btn btn-ghost" onClick={() => cetakDaftar({ judul: 'Rekap Kotak Saran', subjudul: fStatus === 'semua' ? 'Semua masukan' : ST[fStatus].l, kolom, baris: baris(), namaPencetak: peran.nama })}>🖨 Cetak</button>
              <button className="btn btn-ghost" onClick={() => unduhCsv('kotak-saran', kolom.map(k => k.judul), baris().map(b => kolom.map(k => b[k.k])))}>⬇ CSV</button>
            </div>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Waktu</th><th>Kategori</th><th>Isi</th>{peran.bisaPantau && <th>Pengirim</th>}<th>Status</th><th>Tanggapan</th>{peran.bisaPantau && <th></th>}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30 }}>Memuat...</td></tr> :
                tampil.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>{peran.bisaPantau ? 'Belum ada masukan.' : 'Kamu belum mengirim masukan. (Kiriman anonim tidak ditampilkan di sini.)'}</td></tr> :
                  tampil.map(r => (
                    <tr key={r.id} className={peran.bisaPantau ? 'row-click' : ''} onClick={() => tandaiBaca(r)}>
                      <td data-label="Waktu" style={{ fontSize: 12.5 }}>{fmtWaktu(r.created_at)}{r.sumber === 'Kotak fisik' && <div><span className="tag" style={{ background: 'var(--cream)', color: 'var(--ink-soft)' }}>kotak fisik</span></div>}</td>
                      <td data-label="Kategori"><span className="tag" style={{ background: r.kategori === 'Pengaduan' ? '#FBE7E7' : r.kategori === 'Apresiasi' ? 'var(--stock-bg)' : 'var(--gold-bg)', color: r.kategori === 'Pengaduan' ? '#B3261E' : r.kategori === 'Apresiasi' ? 'var(--stock)' : 'var(--gold)' }}>{r.kategori}</span></td>
                      <td data-label="Isi" style={{ maxWidth: 380, whiteSpace: 'pre-wrap' }}>{r.isi}</td>
                      {peran.bisaPantau && <td data-label="Pengirim">{r.anonim ? <i>Anonim</i> : <>{r.nama_pengirim || '-'}{r.unit_pengirim && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{r.unit_pengirim}</div>}</>}</td>}
                      <td data-label="Status"><span className="tag" style={ST[r.status].s}>{ST[r.status].l}</span></td>
                      <td data-label="Tanggapan" style={{ maxWidth: 280 }}>{r.tanggapan || '-'}{r.ditanggapi_pada && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{fmtWaktu(r.ditanggapi_pada)}</div>}</td>
                      {peran.bisaPantau && <td data-label="" onClick={e => e.stopPropagation()}><button className="btn btn-ghost" style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => setTanggapi({ id: r.id, status: r.status === 'baru' ? 'ditanggapi' : r.status, tanggapan: r.tanggapan || '', isi: r.isi })}>Tanggapi</button></td>}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </div>

      {tanggapi && (
        <Modal judul="Tanggapi Masukan" onClose={() => setTanggapi(null)} lebar={500}
          footer={<><button className="btn btn-ghost" onClick={() => setTanggapi(null)}>Batal</button><button className="btn btn-primary" onClick={simpanTanggapan}>Simpan</button></>}>
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '10px 14px', fontSize: 14, marginBottom: 14, whiteSpace: 'pre-wrap' }}>{tanggapi.isi}</div>
          <div className="field"><label>Status</label><select value={tanggapi.status} onChange={e => setTanggapi({ ...tanggapi, status: e.target.value })}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</select></div>
          <div className="field"><label>Tanggapan</label><textarea rows={3} value={tanggapi.tanggapan} onChange={e => setTanggapi({ ...tanggapi, tanggapan: e.target.value })} /></div>
        </Modal>
      )}
    </div></div>
  )
}
