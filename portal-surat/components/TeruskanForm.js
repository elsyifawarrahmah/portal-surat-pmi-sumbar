'use client'
// "Teruskan" / Disposisi gaya Srikandi: pilih kepada siapa, pilih petunjuk, (boleh) tulis pesan, Kirim.
import { useState } from 'react'
import Modal from '@/components/Modal'
import { hariIni } from '@/lib/format'
import { PETUNJUK, SIFAT_DISPOSISI, susunInstruksi } from '@/lib/surat'

const cek = r => { if (r.error) throw new Error(r.error.message); return r }
const besar = { fontSize: 16 }

export default function TeruskanForm({ supabase, surat, units, peran, induk, sudahMenerima = [], onClose, onSaved }) {
  const [dipilih, setDipilih] = useState([])
  const [petunjuk, setPetunjuk] = useState(PETUNJUK[0])
  const [sifat, setSifat] = useState('Biasa')
  const [pesan, setPesan] = useState('')
  const [atasNama, setAtasNama] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const kandidat = units.filter(u => u.aktif && u.tipe !== 'biro_umum' && u.id !== peran.unitId)
  const pilihan = (nama) => [['Pimpinan & Sekretariat', kandidat.filter(u => u.tipe !== 'bidang')], ['Bidang', kandidat.filter(u => u.tipe === 'bidang')]]
  const ganti = id => setDipilih(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]))
  const wakilkan = peran.bisaDisposisi   // Sekretariat/pimpinan boleh mencatat disposisi atas nama Ketua dsb.

  async function kirim() {
    setError('')
    if (dipilih.length === 0) { setError('Pilih dulu kepada siapa surat ini diteruskan.'); return }
    setSaving(true)
    try {
      const dari = (atasNama.trim() || peran.unit?.nama || peran.nama || 'Admin')
      const d = cek(await supabase.from('surat_disposisi').insert({
        surat_id: surat.id, tanggal_diteruskan: hariIni(), dari_unit_id: peran.unitId || null, dari_nama: dari, ...(induk ? { induk_tujuan_id: induk.id } : {}),
      }).select('id').single()).data
      const instruksi = susunInstruksi(sifat, petunjuk, pesan)
      cek(await supabase.from('surat_disposisi_tujuan').insert(dipilih.map(unit_id => ({ disposisi_id: d.id, unit_id, instruksi, perlu_jawaban: /balas/i.test(petunjuk) }))))
      if (induk && ['menunggu', 'dibaca'].includes(induk.status)) await supabase.from('surat_disposisi_tujuan').update({ status: 'diproses' }).eq('id', induk.id)
      onSaved && onSaved()
    } catch (e) { setError('Belum bisa dikirim. ' + e.message) }
    setSaving(false)
  }

  return (
    <Modal judul="Teruskan surat ini" onClose={onClose} lebar={560}
      footer={<><button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={onClose}>Batal</button><button className="btn btn-primary" style={{ minHeight: 48, fontSize: 16, padding: '0 28px' }} onClick={kirim} disabled={saving}>{saving ? 'Mengirim...' : 'Kirim'}</button></>}>
      {error && <div className="error-box">{error}</div>}

      <h4 style={{ margin: '0 0 8px', fontSize: 17 }}>1. Diteruskan kepada siapa?</h4>
      {pilihan().map(([judul, daftar]) => daftar.length > 0 && (
        <div key={judul} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0' }}>{judul}</div>
          {daftar.map(u => {
            const sudah = sudahMenerima.includes(u.id), aktif = dipilih.includes(u.id)
            return (
              <label key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', marginBottom: 6, border: '2px solid ' + (aktif ? 'var(--pmi-red)' : 'var(--line)'), borderRadius: 12, background: aktif ? '#FFF3F1' : '#fff', cursor: sudah ? 'not-allowed' : 'pointer', textTransform: 'none', color: 'var(--ink)', opacity: sudah ? 0.5 : 1, ...besar }}>
                <input type="checkbox" style={{ width: 22, height: 22 }} checked={aktif} disabled={sudah} onChange={() => ganti(u.id)} />
                <span><b>{u.nama}</b>{sudah && <span style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}> — sudah menerima surat ini</span>}</span>
              </label>
            )
          })}
        </div>
      ))}

      <h4 style={{ margin: '18px 0 8px', fontSize: 17 }}>2. Petunjuknya apa?</h4>
      <select value={petunjuk} onChange={e => setPetunjuk(e.target.value)} style={{ ...besar, minHeight: 50, marginBottom: 10 }}>{PETUNJUK.map(p => <option key={p}>{p}</option>)}</select>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SIFAT_DISPOSISI.map(s => <button key={s} type="button" className={'btn ' + (sifat === s ? 'btn-primary' : 'btn-ghost')} style={{ minHeight: 46, fontSize: 15 }} onClick={() => setSifat(s)}>{s}</button>)}
      </div>

      <h4 style={{ margin: '18px 0 8px', fontSize: 17 }}>3. Pesan tambahan <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--ink-soft)' }}>(boleh dikosongkan)</span></h4>
      <textarea rows={3} style={besar} value={pesan} onChange={e => setPesan(e.target.value)} placeholder="Tulis kata-katamu di sini..." />

      {wakilkan && (
        <div style={{ marginTop: 14 }}>
          <label style={{ textTransform: 'none', fontSize: 14 }}>Atas nama siapa? <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(kosongkan kalau atas namamu sendiri)</span></label>
          <input list="atas-nama" style={besar} value={atasNama} onChange={e => setAtasNama(e.target.value)} placeholder={peran.unit?.nama || 'mis. Ketua'} />
          <datalist id="atas-nama"><option value="Ketua" /><option value="Kepala Markas" /><option value="Sekretaris" /></datalist>
        </div>
      )}
    </Modal>
  )
}
