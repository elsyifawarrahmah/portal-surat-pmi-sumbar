'use client'
// Alur surat keluar: pembuat ajukan -> Sekretaris paraf -> Kepala Markas/Ketua setuju + TTD -> Biro Umum.
import { useState } from 'react'
import Modal from '@/components/Modal'
import TandaTangan, { unggahTtd } from '@/components/TandaTangan'
import { fmtWaktu } from '@/lib/format'
import { cetakPengesahanKeluar } from '@/lib/cetak'

export const LABEL_SETUJU = {
  null: ['Belum diajukan', '#6B6B6B'], revisi: ['Perlu diperbaiki', '#B3261E'], diajukan: ['Menunggu paraf Sekretaris', '#B07A00'],
  diparaf: ['Menunggu persetujuan Kepala Markas/Ketua', '#1F5E99'], disetujui: ['Disetujui · di Biro Umum', '#2E7D32'],
}
const langkah = [['diajukan', '1. Diajukan'], ['diparaf', '2. Paraf Sekretaris'], ['disetujui', '3. Disetujui + TTD']]
const urut = { diajukan: 1, diparaf: 2, disetujui: 3 }

export default function PersetujuanKeluar({ supabase, surat, peran, bisaUbah, onClose, onChanged }) {
  const st = surat.status_persetujuan || null
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState('')
  const [ttdUrl, setTtdUrl] = useState(peran.ttdUrl || '')
  const [buat, setBuat] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [tolak, setTolak] = useState(false)

  const bisaParaf = (peran.isAdmin || peran.tipe === 'sekretariat') && st === 'diajukan'
  const bisaSetuju = (peran.isAdmin || peran.tipe === 'pimpinan') && st === 'diparaf'
  const bisaAjukan = bisaUbah && (!st || st === 'revisi')
  const bisaKembali = (peran.isAdmin || ['sekretariat', 'pimpinan'].includes(peran.tipe)) && ['diajukan', 'diparaf'].includes(st)

  async function panggil(fn, args) {
    setSibuk(true); setGalat('')
    const { error } = await supabase.rpc(fn, args)
    setSibuk(false)
    if (error) { setGalat(/function|schema cache|does not exist/i.test(error.message) ? 'Fitur ini belum aktif di database. Jalankan supabase/migrasi-persetujuan-paraf.sql dulu.' : error.message); return false }
    onChanged && onChanged(); return true
  }
  async function simpanTtd(file) {
    try {
      const url = await unggahTtd(supabase, file, peran.userId)
      await supabase.from('profiles').update({ ttd_url: url }).eq('id', peran.userId)
      setTtdUrl(url); setBuat(false)
    } catch (e) { setGalat(e.message) }
  }
  const blokTtd = (
    <div style={{ margin: '12px 0' }}>
      {ttdUrl && !buat && <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><img src={ttdUrl} alt="TTD" style={{ height: 70, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 4 }} /><button className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => setBuat(true)}>Buat ulang tanda tangan</button></div>}
      {(!ttdUrl || buat) && <TandaTangan onSimpan={simpanTtd} onBatal={ttdUrl ? () => setBuat(false) : null} />}
    </div>
  )
  const [label, warna] = LABEL_SETUJU[st] || LABEL_SETUJU.null

  return (
    <Modal judul={`Persetujuan — ${surat.nomor_surat}`} onClose={onClose} lebar={600}>
      {galat && <div className="error-box">{galat}</div>}
      <div style={{ fontSize: 14, marginBottom: 12 }}><b>{surat.perihal}</b><br /><span style={{ color: 'var(--ink-soft)' }}>Kepada {surat.tujuan_surat}</span></div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {langkah.map(([k, t]) => <span key={k} className="tag" style={{ background: (urut[st] || 0) >= urut[k] ? '#E7F4EA' : '#F1F1F1', color: (urut[st] || 0) >= urut[k] ? '#2E7D32' : '#777', fontSize: 13, padding: '6px 12px' }}>{(urut[st] || 0) >= urut[k] ? '✔ ' : ''}{t}</span>)}
      </div>
      <div style={{ fontWeight: 700, color: warna, marginBottom: 10 }}>Status: {label}</div>
      {st === 'revisi' && surat.catatan_revisi && <div style={{ background: '#FBE7E7', borderRadius: 10, padding: '8px 12px', marginBottom: 10, fontSize: 14 }}><b>Catatan perbaikan:</b> {surat.catatan_revisi}</div>}

      {surat.paraf_kode && <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <b>Paraf Sekretaris:</b> {surat.paraf_nama} · {fmtWaktu(surat.paraf_pada)}<br />
        {surat.paraf_ttd_url && <img src={surat.paraf_ttd_url} alt="Paraf" style={{ height: 56, margin: '6px 0', background: '#fff' }} />}<br />
        <span className="mono" style={{ fontSize: 13 }}>Kode: {surat.paraf_kode}</span></div>}
      {surat.setuju_kode && <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: 12, marginBottom: 10 }}>
        <b>Disetujui {surat.setuju_jabatan}:</b> {surat.setuju_nama}<br />Tanggal disetujui: <b>{fmtWaktu(surat.setuju_pada)}</b><br />
        {surat.setuju_ttd_url && <img src={surat.setuju_ttd_url} alt="TTD" style={{ height: 64, margin: '6px 0', background: '#fff' }} />}<br />
        <span className="mono" style={{ fontSize: 13 }}>Kode: {surat.setuju_kode}</span></div>}

      {bisaAjukan && <button className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, width: '100%' }} disabled={sibuk} onClick={() => panggil('ajukan_surat_keluar', { p_id: surat.id })}>📨 Ajukan untuk paraf & persetujuan</button>}
      {bisaParaf && <><div style={{ fontWeight: 700 }}>Paraf Sekretaris</div>{blokTtd}<button className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, width: '100%' }} disabled={sibuk || !ttdUrl} onClick={() => panggil('paraf_surat_keluar', { p_id: surat.id, p_ttd: ttdUrl })}>✍️ Paraf & teruskan ke Kepala Markas/Ketua</button></>}
      {bisaSetuju && <><div style={{ fontWeight: 700 }}>Setujui & tanda tangan</div>{blokTtd}<button className="btn btn-primary" style={{ minHeight: 52, fontSize: 16, width: '100%' }} disabled={sibuk || !ttdUrl} onClick={() => panggil('setujui_surat_keluar', { p_id: surat.id, p_ttd: ttdUrl })}>✅ Setujui & tanda tangani</button></>}
      {bisaKembali && !tolak && <button className="btn btn-ghost" style={{ minHeight: 44, width: '100%', marginTop: 10 }} onClick={() => setTolak(true)}>↩ Kembalikan untuk diperbaiki</button>}
      {tolak && <div style={{ marginTop: 10 }}><textarea rows={3} placeholder="Apa yang perlu diperbaiki?" value={alasan} onChange={e => setAlasan(e.target.value)} style={{ fontSize: 16 }} /><button className="btn btn-primary" style={{ minHeight: 44, marginTop: 6 }} disabled={sibuk} onClick={() => panggil('kembalikan_surat_keluar', { p_id: surat.id, p_alasan: alasan })}>Kembalikan</button></div>}
      {st === 'disetujui' && <button className="btn btn-ghost" style={{ minHeight: 48, width: '100%', marginTop: 8 }} onClick={() => cetakPengesahanKeluar({ surat, namaPencetak: peran.nama })}>🖨 Cetak lembar pengesahan (TTD + kode)</button>}
    </Modal>
  )
}
