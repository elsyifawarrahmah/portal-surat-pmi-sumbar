'use client'
// Formulir membuat / mengubah disposisi: dari siapa, diteruskan kepada bidang mana, isi disposisi, scan lembar.
import { useState } from 'react'
import Modal from '@/components/Modal'
import { hariIni, unggahBerkas } from '@/lib/format'

const PRESET = ['Untuk diketahui', 'Untuk diproses / ditindaklanjuti', 'Mohon tanggapan / jawaban tertulis', 'Hadiri / wakili', 'Koordinasikan', 'Siapkan laporan', 'Harap segera', 'Arsipkan']
const cek = r => { if (r.error) throw new Error(r.error.message); return r }

export default function DisposisiForm({ supabase, surat, units, disposisi, onClose, onSaved }) {
  const edit = !!disposisi
  const awal = {}
  ;(disposisi?.tujuan || []).forEach(t => { awal[t.unit_id] = { pilih: true, id: t.id, status: t.status, instruksi: t.instruksi || '', perlu_jawaban: !!t.perlu_jawaban, batas_waktu: t.batas_waktu || '' } })
  const [form, setForm] = useState({
    tanggal_diteruskan: disposisi?.tanggal_diteruskan || hariIni(), dari_unit_id: disposisi?.dari_unit_id || '', dari_nama: disposisi?.dari_nama || '',
    catatan: disposisi?.catatan || '', file_scan_url: disposisi?.file_scan_url || '', file_scan_nama: disposisi?.file_scan_nama || '',
  })
  const [tujuan, setTujuan] = useState(awal)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const pemberi = units.filter(u => ['pimpinan', 'sekretariat'].includes(u.tipe))
  const kandidat = units.filter(u => u.tipe !== 'biro_umum' && (u.aktif || awal[u.id]))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const ubahTujuan = (id, patch) => setTujuan(t => ({ ...t, [id]: { pilih: false, instruksi: '', perlu_jawaban: false, batas_waktu: '', ...t[id], ...patch } }))

  function pilihPemberi(id) {
    const u = units.find(x => x.id === id)
    setForm(f => ({ ...f, dari_unit_id: id, dari_nama: !f.dari_nama || pemberi.some(p => p.nama === f.dari_nama) ? (u?.nama || '') : f.dari_nama }))
  }

  async function unggah(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true); setError('')
    try { const url = await unggahBerkas(supabase, file); setForm(f => ({ ...f, file_scan_url: url, file_scan_nama: file.name })) }
    catch (err) { setError(err.message) }
    setUploading(false)
  }

  async function simpan() {
    setError('')
    const dipilih = Object.entries(tujuan).filter(([, v]) => v.pilih)
    if (dipilih.length === 0) { setError('Pilih minimal satu bidang/unit tujuan disposisi.'); return }
    if (!form.dari_nama.trim()) { setError('Isi kolom "Dari" (pemberi disposisi), mis. Ketua atau Kepala Markas.'); return }
    if (dipilih.some(([, v]) => !v.instruksi.trim())) { setError('Isi "Disposisi / perintah" untuk setiap tujuan yang dipilih.'); return }
    setSaving(true)
    try {
      const payload = {
        tanggal_diteruskan: form.tanggal_diteruskan, dari_unit_id: form.dari_unit_id || null, dari_nama: form.dari_nama.trim(),
        catatan: form.catatan.trim() || null, file_scan_url: form.file_scan_url || null, file_scan_nama: form.file_scan_nama || null,
      }
      let id = disposisi?.id
      if (edit) cek(await supabase.from('surat_disposisi').update(payload).eq('id', id))
      else id = cek(await supabase.from('surat_disposisi').insert({ ...payload, surat_id: surat.id }).select('id').single()).data.id
      for (const [unitId, v] of Object.entries(tujuan)) {
        const baris = { instruksi: v.instruksi.trim() || null, perlu_jawaban: !!v.perlu_jawaban, batas_waktu: v.batas_waktu || null }
        if (v.pilih && v.id) cek(await supabase.from('surat_disposisi_tujuan').update(baris).eq('id', v.id))
        else if (v.pilih) cek(await supabase.from('surat_disposisi_tujuan').insert({ ...baris, disposisi_id: id, unit_id: unitId }))
        else if (v.id && v.status === 'menunggu') cek(await supabase.from('surat_disposisi_tujuan').delete().eq('id', v.id))
      }
      onSaved && onSaved()
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  const kelompok = [['Pimpinan & Sekretariat', kandidat.filter(u => u.tipe !== 'bidang')], ['Bidang', kandidat.filter(u => u.tipe === 'bidang')]]

  return (
    <Modal judul={edit ? 'Ubah Disposisi' : 'Buat Disposisi'} onClose={onClose} lebar={640}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={simpan} disabled={saving || uploading}>{saving ? 'Menyimpan...' : 'Simpan Disposisi'}</button></>}>
      {error && <div className="error-box">{error}</div>}
      <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, marginBottom: 16 }}>
        <div><b>{surat.nomor_surat}</b>{surat.nomor_agenda ? ` · Agenda ${surat.nomor_agenda}` : ''}</div>
        <div style={{ color: 'var(--ink-soft)' }}>{surat.asal_surat} — {surat.perihal}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        <div className="field"><label>Tanggal Diteruskan</label><input type="date" value={form.tanggal_diteruskan} onChange={e => set('tanggal_diteruskan', e.target.value)} /></div>
        <div className="field"><label>Pemberi Disposisi (unit)</label>
          <select value={form.dari_unit_id} onChange={e => pilihPemberi(e.target.value)}><option value="">— pilih / ketik di bawah —</option>{pemberi.map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}</select>
        </div>
      </div>
      <div className="field"><label>Dari (tertulis di lembar disposisi) *</label><input value={form.dari_nama} onChange={e => set('dari_nama', e.target.value)} placeholder="mis. Ketua / Kepala Markas / Sekretaris" /></div>

      <label>Diteruskan kepada (centang bidang/unit) *</label>
      {kelompok.map(([judul, daftar]) => daftar.length > 0 && (
        <div key={judul} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', margin: '6px 0' }}>{judul}</div>
          {daftar.map(u => {
            const v = tujuan[u.id] || {}
            const terkunci = v.id && v.status !== 'menunggu'
            return (
              <div key={u.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 12px', marginBottom: 6, background: v.pilih ? '#FFFAF8' : '#fff' }}>
                <label style={{ display: 'flex', gap: 10, alignItems: 'center', textTransform: 'none', fontSize: 14.5, color: 'var(--ink)', margin: 0, cursor: terkunci ? 'not-allowed' : 'pointer' }}>
                  <input type="checkbox" style={{ width: 18, height: 18 }} checked={!!v.pilih} disabled={terkunci} onChange={e => ubahTujuan(u.id, { pilih: e.target.checked })} />
                  <b>{u.nama}</b>{terkunci && <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>(sudah diproses, tidak bisa dicabut)</span>}
                </label>
                {v.pilih && (
                  <div style={{ marginTop: 8 }}>
                    <input list="preset-disposisi" placeholder="Disposisi / perintah untuk unit ini *" value={v.instruksi || ''} onChange={e => ubahTujuan(u.id, { instruksi: e.target.value })} />
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 8, fontSize: 13.5 }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', fontSize: 13.5, color: 'var(--ink)', margin: 0 }}>
                        <input type="checkbox" style={{ width: 16, height: 16 }} checked={!!v.perlu_jawaban} onChange={e => ubahTujuan(u.id, { perlu_jawaban: e.target.checked })} /> Perlu surat jawaban
                      </label>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', textTransform: 'none', fontSize: 13.5, color: 'var(--ink)', margin: 0 }}>
                        Batas waktu <input type="date" style={{ width: 'auto', padding: '5px 8px' }} value={v.batas_waktu || ''} onChange={e => ubahTujuan(u.id, { batas_waktu: e.target.value })} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
      <datalist id="preset-disposisi">{PRESET.map(p => <option key={p} value={p} />)}</datalist>

      <div className="field" style={{ marginTop: 12 }}><label>Catatan umum (opsional)</label><textarea rows={2} value={form.catatan} onChange={e => set('catatan', e.target.value)} /></div>
      <div className="field">
        <label>Foto / scan lembar disposisi yang sudah ditandatangani (opsional)</label>
        <input type="file" accept="image/*,.pdf" onChange={unggah} />
        {uploading && <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>Mengunggah file...</div>}
        {form.file_scan_url && !uploading && <div style={{ fontSize: 12, color: 'var(--stock)', marginTop: 4 }}>✓ {form.file_scan_nama || 'Scan sudah terpasang'}</div>}
      </div>
    </Modal>
  )
}
