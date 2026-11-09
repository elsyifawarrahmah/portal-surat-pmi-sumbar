'use client'
// Cek keaslian kode penanda (PMI-XXXX-XXXX) pada paraf / persetujuan / tanda tangan disposisi.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { fmtWaktu } from '@/lib/format'

export default function CekKode() {
  const supabase = createClient()
  const [kode, setKode] = useState('')
  const [hasil, setHasil] = useState(null)   // null | [] | [..]
  const [galat, setGalat] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function cek(e) {
    e.preventDefault(); setGalat(''); setHasil(null)
    const k = kode.trim().toUpperCase()
    if (!/^PMI-[0-9A-F]{4}-[0-9A-F]{4}$/.test(k)) { setGalat('Format kode: PMI-XXXX-XXXX (huruf A-F dan angka).'); return }
    setSibuk(true)
    const { data, error } = await supabase.rpc('cek_kode_penanda', { p_kode: k })
    setSibuk(false)
    if (error) { setGalat(/function|schema cache|does not exist/i.test(error.message) ? 'Fitur ini belum aktif di database. Jalankan supabase/migrasi-notifikasi.sql di Supabase (SQL Editor) satu kali. Pesan teknis: ' + error.message : error.message); return }
    setHasil(data || [])
  }
  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Cek Kode Paraf</h1><p className="desc">Pastikan tanda tangan dan paraf di surat memang dibuat lewat portal ini.</p></div></div>
      <div className="panel" style={{ maxWidth: 640 }}><div className="panel-body">
        <form onSubmit={cek}>
          <div className="field"><label>Kode di surat</label><input value={kode} onChange={e => setKode(e.target.value)} placeholder="PMI-A1B2-C3D4" style={{ fontSize: 20, minHeight: 56, letterSpacing: 1 }} autoCapitalize="characters" /></div>
          <button className="btn btn-primary" style={{ minHeight: 56, fontSize: 18, width: '100%' }} disabled={sibuk}>{sibuk ? 'Memeriksa...' : '🔍 Periksa kode'}</button>
        </form>
        {galat && <div className="error-box" style={{ marginTop: 14 }}>{galat}</div>}
        {hasil && hasil.length === 0 && <div style={{ marginTop: 16, background: '#FBE7E7', border: '2px solid #B3261E', borderRadius: 14, padding: 16, fontSize: 18 }}>❌ <b>Kode tidak ditemukan.</b><br />Kode ini tidak tercatat di portal. Periksa lagi penulisannya, atau anggap tanda tangan itu tidak sah.</div>}
        {hasil && hasil.map((h, i) => (
          <div key={i} style={{ marginTop: 16, background: '#E7F4EA', border: '2px solid #2E7D32', borderRadius: 14, padding: 16, fontSize: 18, lineHeight: 1.6 }}>
            ✅ <b>KODE ASLI</b><br />
            <b>{h.peran}</b> pada <b>{h.jenis}</b><br />
            Oleh: <b>{h.nama || '-'}</b>{h.jabatan ? ` (${h.jabatan})` : ''}<br />
            Waktu: <b>{h.waktu ? fmtWaktu(h.waktu) : '-'}</b>{h.nomor ? <><br />Nomor surat: <b>{h.nomor}</b></> : null}
          </div>
        ))}
      </div></div>
    </div></div>
  )
}
