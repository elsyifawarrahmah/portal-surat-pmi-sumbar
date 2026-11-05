'use client'
// "Teruskan" / Disposisi gaya Srikandi: pilih kepada siapa, pilih petunjuk, (boleh) tulis pesan, Kirim.
import { useState } from 'react'
import Modal from '@/components/Modal'
import { hariIni } from '@/lib/format'
import { PETUNJUK, SIFAT_DISPOSISI, KEPUTUSAN, KALIMAT_PESAN, susunInstruksi } from '@/lib/surat'
import { KalimatCepat, TombolBicara, tambahKalimat } from '@/components/PilihanCepat'
import TandaTangan, { unggahTtd } from '@/components/TandaTangan'

const kodePenanda = () => { const a = new Uint8Array(4); crypto.getRandomValues(a); const h = Array.from(a, x => x.toString(16).padStart(2, '0')).join('').toUpperCase(); return `PMI-${h.slice(0, 4)}-${h.slice(4)}` }
const cek = r => { if (r.error) throw new Error(r.error.message); return r }
const besar = { fontSize: 16 }

export default function TeruskanForm({ supabase, surat, units, peran, induk, sudahMenerima = [], onClose, onSaved }) {
  const [dipilih, setDipilih] = useState([])
  const [petunjuk, setPetunjuk] = useState(PETUNJUK[0])
  const [sifat, setSifat] = useState('Biasa')
  const [pesan, setPesan] = useState('')
  const [keputusan, setKeputusan] = useState('')
  const [atasNama, setAtasNama] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [pakaiTtd, setPakaiTtd] = useState(false)
  const [ttdUrl, setTtdUrl] = useState(peran.ttdUrl || '')
  const [buatTtd, setBuatTtd] = useState(false)

  async function simpanTtd(file) {
    try {
      const url = await unggahTtd(supabase, file, peran.userId)
      const { error } = await supabase.from('profiles').update({ ttd_url: url }).eq('id', peran.userId)
      if (error) throw new Error(/ttd_url/.test(error.message) ? 'Database belum diperbarui (jalankan migrasi-alur-biro-ttd-lampiran.sql).' : error.message)
      setTtdUrl(url); setBuatTtd(false); setPakaiTtd(true)
    } catch (e) { setError(e.message) }
  }

  const kandidat = units.filter(u => u.aktif && u.tipe !== 'biro_umum' && u.id !== peran.unitId)
  const pilihan = (nama) => [['Pimpinan & Sekretariat', [...kandidat.filter(u => u.tipe === 'pimpinan'), ...kandidat.filter(u => !['bidang', 'pimpinan'].includes(u.tipe))]], ['Bidang', kandidat.filter(u => u.tipe === 'bidang')]]
  const pimpinan = kandidat.filter(u => u.tipe === 'pimpinan' && !sudahMenerima.includes(u.id))
  const semuaPimpinanDipilih = pimpinan.length > 0 && pimpinan.every(u => dipilih.includes(u.id))
  const togglePimpinan = () => setDipilih(d => semuaPimpinanDipilih ? d.filter(x => !pimpinan.some(p => p.id === x)) : [...new Set([...d, ...pimpinan.map(p => p.id)])])
  const ganti = id => setDipilih(d => (d.includes(id) ? d.filter(x => x !== id) : [...d, id]))
  const wakilkan = peran.bisaDisposisi   // Sekretariat/pimpinan boleh mencatat disposisi atas nama Ketua dsb.

  async function kirim() {
    setError('')
    if (dipilih.length === 0) { setError('Pilih dulu kepada siapa surat ini diteruskan.'); return }
    setSaving(true)
    try {
      const dari = (atasNama.trim() || peran.unit?.nama || peran.nama || 'Admin')
      const dasar = { surat_id: surat.id, tanggal_diteruskan: hariIni(), dari_unit_id: peran.unitId || null, dari_nama: dari, ...(induk ? { induk_tujuan_id: induk.id } : {}) }
      if (pakaiTtd && !ttdUrl) { setError('Buat tanda tangan dulu, atau matikan pilihan tanda tangan digital.'); setSaving(false); return }
      const denganTtd = pakaiTtd ? { ...dasar, ttd_url: ttdUrl, ttd_nama: dari, ttd_pada: new Date().toISOString(), ttd_kode: kodePenanda() } : dasar
      const d = cek(await supabase.from('surat_disposisi').insert(denganTtd).select('id').single()).data
      const instruksi = susunInstruksi(sifat, petunjuk, pesan, keputusan)
      cek(await supabase.from('surat_disposisi_tujuan').insert(dipilih.map(unit_id => ({ disposisi_id: d.id, unit_id, instruksi, perlu_jawaban: /balas/i.test(petunjuk || '') }))))
      if (induk && ['menunggu', 'dibaca'].includes(induk.status)) await supabase.from('surat_disposisi_tujuan').update({ status: 'diproses' }).eq('id', induk.id)
      onSaved && onSaved()
    } catch (e) { setError('Belum bisa dikirim. ' + e.message) }
    setSaving(false)
  }

  return (
    <Modal judul="Teruskan surat ini" onClose={onClose} lebar={560}
      footer={<><button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={onClose}>Batal</button><button className="btn btn-primary" style={{ minHeight: 48, fontSize: 16, padding: '0 28px' }} onClick={kirim} disabled={saving}>{saving ? 'Mengirim...' : 'Kirim'}</button></>}>
      {error && <div className="error-box">{error}</div>}

      {(peran.isAdmin || ['pimpinan', 'sekretariat'].includes(peran.tipe)) && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 17 }}>Keputusan <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--ink-soft)' }}>(tinggal sentuh)</span></h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {KEPUTUSAN.map(o => {
              const on = keputusan === o.k
              return <button key={o.k} type="button" onClick={() => { setKeputusan(on ? '' : o.k); if (!on) setPetunjuk(o.petunjuk) }}
                style={{ minHeight: 64, fontSize: 18, fontWeight: 700, borderRadius: 14, cursor: 'pointer', border: '2px solid ' + (on ? 'var(--pmi-red)' : 'var(--line)'), background: on ? 'var(--pmi-red)' : '#fff', color: on ? '#fff' : 'var(--ink)', font: 'inherit' }}>{o.ikon} {o.k}</button>
            })}
          </div>
        </div>
      )}

      <h4 style={{ margin: '0 0 8px', fontSize: 17 }}>1. Diteruskan kepada siapa? <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--ink-soft)' }}>(boleh centang lebih dari satu)</span></h4>
      {pimpinan.length > 1 && <button type="button" className={'btn ' + (semuaPimpinanDipilih ? 'btn-primary' : 'btn-ghost')} style={{ minHeight: 44, marginBottom: 10 }} onClick={togglePimpinan}>{semuaPimpinanDipilih ? '✓ ' : ''}Pilih sekaligus: {pimpinan.map(p => p.nama).join(' + ')}</button>}
      {pilihan().map(([judul, daftar]) => daftar.length > 0 && (
        <div key={judul} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '6px 0' }}>{judul}</div>
          {daftar.map(u => {
            const sudah = sudahMenerima.includes(u.id), aktif = dipilih.includes(u.id)
            return (
              <label key={u.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', marginBottom: 6, border: '2px solid ' + (aktif ? 'var(--pmi-red)' : 'var(--line)'), borderRadius: 12, background: aktif ? '#FFF3F1' : '#fff', cursor: 'pointer', textTransform: 'none', color: 'var(--ink)', ...besar }}>
                <input type="checkbox" style={{ width: 22, height: 22 }} checked={aktif} onChange={() => ganti(u.id)} />
                <span><b>{u.nama}</b>{sudah && <span style={{ fontSize: 12.5, color: 'var(--gold)' }}> — sudah pernah menerima (centang untuk kirim ulang)</span>}</span>
              </label>
            )
          })}
        </div>
      ))}

      <h4 style={{ margin: '18px 0 8px', fontSize: 17 }}>2. Petunjuknya apa?</h4>
      <select value={petunjuk} onChange={e => setPetunjuk(e.target.value)} style={{ ...besar, minHeight: 50, marginBottom: 10 }}><option value="">— tanpa petunjuk lain —</option>{PETUNJUK.map(p => <option key={p}>{p}</option>)}</select>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {SIFAT_DISPOSISI.map(s => <button key={s} type="button" className={'btn ' + (sifat === s ? 'btn-primary' : 'btn-ghost')} style={{ minHeight: 46, fontSize: 15 }} onClick={() => setSifat(s)}>{s}</button>)}
      </div>

      <h4 style={{ margin: '18px 0 8px', fontSize: 17 }}>3. Pesan tambahan <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--ink-soft)' }}>(boleh dikosongkan)</span></h4>
      <KalimatCepat daftar={KALIMAT_PESAN} onPilih={k => setPesan(p => tambahKalimat(p, k))} />
      <TombolBicara onTeks={t => setPesan(p => tambahKalimat(p, t))} />
      <textarea rows={3} style={besar} value={pesan} onChange={e => setPesan(e.target.value)} placeholder="Atau tulis kata-katamu di sini..." />

      <div style={{ marginTop: 18, border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', textTransform: 'none', fontSize: 16, color: 'var(--ink)', margin: 0, cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 22, height: 22 }} checked={pakaiTtd} onChange={e => { setPakaiTtd(e.target.checked); if (e.target.checked && !ttdUrl) setBuatTtd(true) }} />
          <b>✍️ Bubuhkan tanda tangan digital saya</b>
        </label>
        {pakaiTtd && ttdUrl && !buatTtd && (
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <img src={ttdUrl} alt="Tanda tangan" style={{ height: 70, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 4 }} />
            <button type="button" className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => setBuatTtd(true)}>Buat ulang</button>
          </div>
        )}
        {buatTtd && <div style={{ marginTop: 10 }}><TandaTangan onSimpan={simpanTtd} onBatal={() => { setBuatTtd(false); if (!ttdUrl) setPakaiTtd(false) }} /></div>}
      </div>

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
