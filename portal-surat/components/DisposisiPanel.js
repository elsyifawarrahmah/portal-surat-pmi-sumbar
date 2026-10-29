'use client'
// Isi lengkap disposisi sebuah surat masuk: pemberi, tujuan per bidang, status, tanggapan, surat jawaban, scan, cetak.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import DisposisiForm from '@/components/DisposisiForm'
import { fmtTgl, fmtWaktu, sudahLewat, STATUS_DISPOSISI, tabelBelumAda, PESAN_MIGRASI, unggahBerkas } from '@/lib/format'
import { cetakLembarDisposisi } from '@/lib/cetak'

export default function DisposisiPanel({ supabase, surat, units, peran, onChanged }) {
  const [daftar, setDaftar] = useState([])
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [form, setForm] = useState(null)         // { disposisi? }
  const [selesai, setSelesai] = useState(null)   // { t, tanggapan, jawabanId, opsi }
  const [sibuk, setSibuk] = useState(false)

  useEffect(() => { load() }, [surat.id])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('surat_disposisi')
      .select('*, dari:surat_unit(nama), pembuat:profiles(nama_lengkap), tujuan:surat_disposisi_tujuan(*, unit:surat_unit(id, nama, kode, tipe), jawaban:surat_keluar(id, nomor_surat, perihal))')
      .eq('surat_id', surat.id).order('created_at')
    if (error) setPesan(tabelBelumAda(error) ? PESAN_MIGRASI : 'Gagal memuat disposisi: ' + error.message)
    else { setPesan(''); setDaftar((data || []).map(d => ({ ...d, tujuan: [...(d.tujuan || [])].sort((a, b) => (a.unit?.nama || '').localeCompare(b.unit?.nama || '')) }))) }
    setLoading(false)
  }
  const segar = () => { load(); onChanged && onChanged() }

  const bolehBertindak = t => peran.isAdmin || (peran.unitId && peran.unitId === t.unit_id)

  async function ubahStatus(t, status, tambahan = {}) {
    setSibuk(true)
    const { error } = await supabase.from('surat_disposisi_tujuan').update({ status, ...tambahan }).eq('id', t.id)
    setSibuk(false)
    if (error) { alert('Gagal memperbarui: ' + error.message); return }
    setSelesai(null); segar()
  }

  async function bukaSelesai(t) {
    let opsi = []
    const { data } = await supabase.from('surat_keluar').select('id, nomor_surat, perihal, tanggal_surat, surat_masuk_id, unit_id')
      .or(`surat_masuk_id.eq.${surat.id},unit_id.eq.${t.unit_id}`).order('created_at', { ascending: false }).limit(100)
    opsi = (data || []).sort((a, b) => (b.surat_masuk_id === surat.id) - (a.surat_masuk_id === surat.id))
    const cocok = opsi.find(o => o.surat_masuk_id === surat.id && (!o.unit_id || o.unit_id === t.unit_id))
    setSelesai({ t, tanggapan: t.tanggapan || '', jawabanId: t.surat_jawaban_id || cocok?.id || '', opsi })
  }

  async function simpanSelesai() {
    const { t, tanggapan, jawabanId } = selesai
    if (t.perlu_jawaban && !jawabanId && !confirm('Disposisi ini meminta surat jawaban, tetapi belum ada surat jawaban yang dipilih.\n\nTetap tandai selesai?')) return
    await ubahStatus(t, 'selesai', { tanggapan: tanggapan.trim() || null, surat_jawaban_id: jawabanId || null })
  }

  async function unggahScan(d, e) {
    const file = e.target.files[0]; if (!file) return
    try {
      const url = await unggahBerkas(supabase, file)
      const { error } = await supabase.from('surat_disposisi').update({ file_scan_url: url, file_scan_nama: file.name }).eq('id', d.id)
      if (error) throw new Error(error.message)
      segar()
    } catch (err) { alert(err.message) }
  }

  async function hapus(d) {
    if (!confirm('Hapus disposisi ini beserta semua tujuannya?')) return
    const { error } = await supabase.from('surat_disposisi').delete().eq('id', d.id)
    if (error) { alert('Gagal hapus: ' + error.message); return }
    segar()
  }

  if (pesan) return <div className="error-box">{pesan}</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {peran.bisaDisposisi && <button className="btn btn-primary" onClick={() => setForm({})}>+ Buat Disposisi</button>}
        <button className="btn btn-ghost" onClick={() => cetakLembarDisposisi({ surat, namaPencetak: peran.nama })}>🖨 Cetak Lembar Kosong (isi tangan)</button>
      </div>

      {loading && <div style={{ padding: 12, color: 'var(--ink-soft)' }}>Memuat...</div>}
      {!loading && daftar.length === 0 && (
        <div style={{ border: '1px dashed var(--line)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--ink-soft)' }}>
          Surat ini belum didisposisikan.{peran.bisaDisposisi ? ' Klik “Buat Disposisi” untuk meneruskan ke bidang tujuan.' : ' Disposisi dibuat oleh Sekretariat / pimpinan.'}
        </div>
      )}

      {daftar.map(d => (
        <div key={d.id} style={{ border: '1px solid var(--line)', borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ background: 'var(--cream)', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 700 }}>Disposisi dari {d.dari_nama || d.dari?.nama || '-'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Diteruskan {fmtTgl(d.tanggal_diteruskan)} · dicatat {fmtWaktu(d.created_at)}{d.pembuat?.nama_lengkap ? ' oleh ' + d.pembuat.nama_lengkap : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', minHeight: 34, fontSize: 12.5 }} onClick={() => cetakLembarDisposisi({ surat, disposisi: d, tujuan: d.tujuan, namaPencetak: peran.nama })}>🖨 Cetak Lembar</button>
              {peran.bisaDisposisi && <button className="btn btn-ghost" style={{ padding: '5px 10px', minHeight: 34, fontSize: 12.5 }} onClick={() => setForm({ disposisi: d })}>Ubah</button>}
              {peran.isAdmin && <button className="btn btn-ghost" style={{ padding: '5px 10px', minHeight: 34, fontSize: 12.5 }} onClick={() => hapus(d)}>Hapus</button>}
            </div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {d.catatan && <div style={{ fontSize: 13.5, marginBottom: 10 }}><b>Catatan:</b> {d.catatan}</div>}
            <div style={{ fontSize: 13.5, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {d.file_scan_url
                ? <a href={d.file_scan_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pmi-red)', fontWeight: 600 }}>📎 Lihat scan lembar disposisi{d.file_scan_nama ? ` (${d.file_scan_nama})` : ''}</a>
                : <span style={{ color: 'var(--ink-soft)' }}>Belum ada scan lembar disposisi.</span>}
              {peran.bisaDisposisi && <label style={{ textTransform: 'none', fontSize: 13, margin: 0, color: 'var(--pmi-red)', cursor: 'pointer', fontWeight: 600 }}>⬆ {d.file_scan_url ? 'Ganti' : 'Unggah'} scan<input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => unggahScan(d, e)} /></label>}
            </div>

            {d.tujuan.map(t => {
              const st = STATUS_DISPOSISI[t.status] || STATUS_DISPOSISI.menunggu
              const telat = t.status !== 'selesai' && sudahLewat(t.batas_waktu)
              const aksi = bolehBertindak(t)
              return (
                <div key={t.id} style={{ borderTop: '1px solid var(--line)', padding: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <strong>→ {t.unit?.nama}</strong>
                    <span className="tag" style={st.style}>{st.label}</span>
                  </div>
                  <div style={{ fontSize: 14, margin: '4px 0' }}>{t.instruksi || '-'}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {t.batas_waktu && <span style={telat ? { color: '#B3261E', fontWeight: 700 } : null}>{telat ? '⚠ Lewat batas: ' : 'Batas: '}{fmtTgl(t.batas_waktu)}</span>}
                    {t.dibaca_pada && <span>Dibaca {fmtWaktu(t.dibaca_pada)}</span>}
                    {t.selesai_pada && <span>Selesai & diarsipkan {fmtWaktu(t.selesai_pada)}</span>}
                    {t.perlu_jawaban && <span style={{ fontWeight: 700, color: t.jawaban ? 'var(--stock)' : 'var(--gold)' }}>{t.jawaban ? `✓ Surat jawaban: ${t.jawaban.nomor_surat}` : 'Perlu surat jawaban (belum ada)'}</span>}
                    {!t.perlu_jawaban && t.jawaban && <span>Surat jawaban: {t.jawaban.nomor_surat}</span>}
                  </div>
                  {t.tanggapan && <div style={{ fontSize: 13.5, background: 'var(--stock-bg)', borderRadius: 8, padding: '6px 10px', marginTop: 6 }}><b>Tanggapan:</b> {t.tanggapan}</div>}

                  {aksi && selesai?.t.id !== t.id && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {t.status === 'menunggu' && <button className="btn btn-ghost" disabled={sibuk} style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => ubahStatus(t, 'dibaca')}>👁 Tandai sudah dibaca</button>}
                      {['menunggu', 'dibaca'].includes(t.status) && <button className="btn btn-ghost" disabled={sibuk} style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => ubahStatus(t, 'diproses')}>▶ Mulai proses</button>}
                      {t.status !== 'selesai' && <button className="btn btn-primary" disabled={sibuk} style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => bukaSelesai(t)}>✅ Selesai…</button>}
                      {t.status === 'selesai' && <button className="btn btn-ghost" disabled={sibuk} style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => ubahStatus(t, 'diproses')}>↩ Buka kembali</button>}
                    </div>
                  )}

                  {selesai?.t.id === t.id && (
                    <div style={{ background: 'var(--cream)', borderRadius: 10, padding: 12, marginTop: 8 }}>
                      <div className="field"><label>Tanggapan / hasil tindak lanjut</label><textarea rows={2} value={selesai.tanggapan} onChange={e => setSelesai({ ...selesai, tanggapan: e.target.value })} placeholder="mis. Sudah dikoordinasikan, laporan dikirim tanggal ..." /></div>
                      <div className="field"><label>Surat jawaban (surat keluar){t.perlu_jawaban ? ' *' : ''}</label>
                        <select value={selesai.jawabanId} onChange={e => setSelesai({ ...selesai, jawabanId: e.target.value })}>
                          <option value="">— belum ada / tidak ada —</option>
                          {selesai.opsi.map(o => <option key={o.id} value={o.id}>{o.nomor_surat} — {o.perihal}</option>)}
                        </select>
                        <div style={{ fontSize: 12.5, marginTop: 5 }}>Belum dibuat? <Link href={`/surat-keluar?jawab=${surat.id}`} style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>Buat surat jawaban dulu →</Link></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" disabled={sibuk} onClick={simpanSelesai}>Tandai Selesai & Arsipkan</button>
                        <button className="btn btn-ghost" onClick={() => setSelesai(null)}>Batal</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {form && <DisposisiForm supabase={supabase} surat={surat} units={units} disposisi={form.disposisi} onClose={() => setForm(null)} onSaved={() => { setForm(null); segar() }} />}
    </div>
  )
}
