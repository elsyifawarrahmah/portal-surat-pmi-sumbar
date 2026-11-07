'use client'
// Pilih BANYAK foto/PDF sekaligus. Tiap file punya tombol ✕ Batalkan, jadi salah pilih tinggal dibuang satu per satu.
import { useState } from 'react'
import { LihatBerkas } from '@/components/PratinjauBerkas'
import { unggahBanyak, hapusBerkasLama, ketHint } from '@/lib/berkas'

export default function PilihBerkas({ supabase, value = [], onChange, onSibuk, denganDokumen = false, judul = 'Berkas surat (foto / PDF) — boleh lebih dari 1' }) {
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState('')

  async function pilih(e, jenis) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setSibuk(true); onSibuk && onSibuk(true); setPesan('')
    try {
      const { berhasil, gagal } = await unggahBanyak(supabase, files, jenis)
      if (berhasil.length) onChange([...value, ...berhasil])
      if (gagal.length) setPesan('Sebagian file tidak bisa dipakai:\n' + gagal.join('\n'))
    } catch (err) { setPesan(err.message) }
    setSibuk(false); onSibuk && onSibuk(false)
    e.target.value = ''
  }
  function batal(i) {
    const b = value[i]
    if (!b.lama && !b.id) hapusBerkasLama(supabase, b.url)   // baru diunggah dan belum disimpan: langsung dibuang dari penyimpanan
    onChange(value.filter((_, x) => x !== i))
  }
  const tombol = { minHeight: 48, display: 'inline-flex', alignItems: 'center', cursor: sibuk ? 'wait' : 'pointer', textTransform: 'none', fontSize: 15 }
  return (
    <div className="field">
      <label>{judul}</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="btn btn-ghost" style={tombol}>➕ Pilih foto / PDF
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} disabled={sibuk} onChange={e => pilih(e, 'surat')} />
        </label>
        {denganDokumen && <label className="btn btn-ghost" style={tombol}>➕ PDF surat panjang (lebih dari 2 lembar)
          <input type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} disabled={sibuk} onChange={e => pilih(e, 'dokumen')} />
        </label>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>{ketHint('surat')}</div>
      {sibuk && <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginTop: 6 }}>⏳ Mengunggah... tunggu sebentar.</div>}
      {value.length > 0 && <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>{value.length} berkas dipilih{value.length > 1 ? ' (yang pertama jadi berkas utama)' : ''}</div>
        {value.map((b, i) => (
          <div key={(b.id || b.url) + i} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 12, padding: '8px 12px', marginBottom: 6, background: '#fff' }}>
            <span style={{ fontWeight: 800, color: 'var(--ink-soft)' }}>{i + 1}</span>
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14.5 }}>
              <LihatBerkas url={b.url} style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>{/\.pdf$/i.test(b.nama || '') ? '📄' : '🖼️'} {b.nama || 'Berkas'}</LihatBerkas>
            </span>
            <button type="button" onClick={() => batal(i)} className="btn btn-ghost" aria-label={'Batalkan ' + (b.nama || 'berkas')} style={{ minHeight: 40, minWidth: 40, padding: '0 12px', color: '#B3261E', fontWeight: 800, fontSize: 15 }}>✕ Batalkan</button>
          </div>
        ))}
      </div>}
      {pesan && <div className="error-box" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{pesan}</div>}
    </div>
  )
}
