'use client'
// Alur surat seperti Srikandi: disposisi berjenjang (diteruskan lagi oleh penerima), kata-kata tiap orang,
// catatan bersama, selesai → menunggu Biro Umum mengarsipkan. Plus tombol menghubungi orang yang memegang surat.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import DisposisiForm from '@/components/DisposisiForm'
import KontakModal from '@/components/KontakModal'
import { fmtTgl, fmtWaktu, sudahLewat, STATUS_DISPOSISI, statusTampil, tabelBelumAda, PESAN_MIGRASI, unggahBerkas, pesanGalat } from '@/lib/format'
import { cetakLembarDisposisi } from '@/lib/cetak'

const kecil = { padding: '5px 12px', minHeight: 36, fontSize: 13 }

export default function DisposisiPanel({ supabase, surat, units, peran, onChanged }) {
  const [daftar, setDaftar] = useState([])
  const [catatan, setCatatan] = useState([])
  const [teksCatatan, setTeksCatatan] = useState('')
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [form, setForm] = useState(null)         // { disposisi? , induk? }
  const [selesai, setSelesai] = useState(null)   // { t, tanggapan, jawabanId, opsi }
  const [kontak, setKontak] = useState(null)     // unit yang mau dihubungi
  const [sibuk, setSibuk] = useState(false)

  useEffect(() => { load() }, [surat.id])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('surat_disposisi')
      .select('*, dari:surat_unit(nama), pembuat:profiles(nama_lengkap), tujuan:surat_disposisi_tujuan(*, unit:surat_unit(id, nama, kode, tipe), jawaban:surat_keluar(id, nomor_surat, perihal))')
      .eq('surat_id', surat.id).order('created_at')
    if (error) { setPesan(tabelBelumAda(error) ? pesanGalat(error) : 'Gagal memuat disposisi: ' + error.message); setLoading(false); return }
    setPesan('')
    setDaftar((data || []).map(d => ({ ...d, tujuan: [...(d.tujuan || [])].sort((a, b) => (a.unit?.nama || '').localeCompare(b.unit?.nama || '')) })))
    const c = await supabase.from('surat_catatan').select('*, penulis:profiles(nama_lengkap, unit:surat_unit(nama))').eq('surat_id', surat.id).order('created_at')
    setCatatan(c.error ? [] : (c.data || []))
    setLoading(false)
  }
  const segar = () => { load(); onChanged && onChanged() }

  const semuaTujuan = daftar.flatMap(d => d.tujuan)
  const namaIndukDari = d => { const t = semuaTujuan.find(x => x.id === d.induk_tujuan_id); return t?.unit?.nama }
  const bolehBertindak = t => peran.isAdmin || (peran.unitId && peran.unitId === t.unit_id)

  async function ubahStatus(t, status, tambahan = {}) {
    setSibuk(true)
    const { error } = await supabase.from('surat_disposisi_tujuan').update({ status, ...tambahan }).eq('id', t.id)
    setSibuk(false)
    if (error) { alert('Gagal memperbarui: ' + error.message); return }
    setSelesai(null); segar()
  }
  async function arsipkan(t) {
    setSibuk(true)
    const { error } = await supabase.from('surat_disposisi_tujuan').update({ diarsipkan_pada: new Date().toISOString() }).eq('id', t.id)
    setSibuk(false)
    if (error) { alert('Gagal mengarsipkan: ' + error.message); return }
    segar()
  }

  async function bukaSelesai(t) {
    const { data } = await supabase.from('surat_keluar').select('id, nomor_surat, perihal, tanggal_surat, surat_masuk_id, unit_id')
      .or(`surat_masuk_id.eq.${surat.id},unit_id.eq.${t.unit_id}`).order('created_at', { ascending: false }).limit(100)
    const opsi = (data || []).sort((a, b) => (b.surat_masuk_id === surat.id) - (a.surat_masuk_id === surat.id))
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
  async function kirimCatatan() {
    if (!teksCatatan.trim()) return
    setSibuk(true)
    const { error } = await supabase.from('surat_catatan').insert({ surat_id: surat.id, isi: teksCatatan.trim() })
    setSibuk(false)
    if (error) { alert('Gagal mengirim catatan: ' + (tabelBelumAda(error) ? 'jalankan supabase/migrasi-alur-berjenjang.sql dulu.' : error.message)); return }
    setTeksCatatan(''); segar()
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
              <div style={{ fontWeight: 700 }}>{d.induk_tujuan_id ? '↪ Diteruskan lagi oleh ' + (namaIndukDari(d) || '-') + ' — ' : 'Disposisi dari '}{d.dari_nama || d.dari?.nama || '-'}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Diteruskan {fmtTgl(d.tanggal_diteruskan)} · dicatat {fmtWaktu(d.created_at)}{d.pembuat?.nama_lengkap ? ' oleh ' + d.pembuat.nama_lengkap : ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" style={{ ...kecil, minHeight: 34, fontSize: 12.5 }} onClick={() => cetakLembarDisposisi({ surat, disposisi: d, tujuan: d.tujuan, namaPencetak: peran.nama })}>🖨 Cetak Lembar</button>
              {(peran.bisaDisposisi || d.dibuat_oleh === peran.userId) && <button className="btn btn-ghost" style={{ ...kecil, minHeight: 34, fontSize: 12.5 }} onClick={() => setForm({ disposisi: d })}>Ubah</button>}
              {peran.isAdmin && <button className="btn btn-ghost" style={{ ...kecil, minHeight: 34, fontSize: 12.5 }} onClick={() => hapus(d)}>Hapus</button>}
            </div>
          </div>
          <div style={{ padding: '12px 16px' }}>
            {d.catatan && <div style={{ fontSize: 13.5, marginBottom: 10 }}><b>Catatan:</b> {d.catatan}</div>}
            <div style={{ fontSize: 13.5, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {d.file_scan_url
                ? <a href={d.file_scan_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pmi-red)', fontWeight: 600 }}>📎 Lihat scan lembar disposisi{d.file_scan_nama ? ` (${d.file_scan_nama})` : ''}</a>
                : <span style={{ color: 'var(--ink-soft)' }}>Belum ada scan lembar disposisi.</span>}
              {(peran.bisaDisposisi || d.dibuat_oleh === peran.userId) && <label style={{ textTransform: 'none', fontSize: 13, margin: 0, color: 'var(--pmi-red)', cursor: 'pointer', fontWeight: 600 }}>⬆ {d.file_scan_url ? 'Ganti' : 'Unggah'} scan<input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => unggahScan(d, e)} /></label>}
            </div>

            {d.tujuan.map(t => {
              const kunci = statusTampil(t), st = STATUS_DISPOSISI[kunci] || STATUS_DISPOSISI.menunggu
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
                    {t.dibaca_pada && <span>Sampai & dibaca {fmtWaktu(t.dibaca_pada)}</span>}
                    {t.selesai_pada && <span>Selesai {fmtWaktu(t.selesai_pada)}</span>}
                    {t.diarsipkan_pada && <span>Diarsipkan Biro Umum {fmtWaktu(t.diarsipkan_pada)}</span>}
                    {t.perlu_jawaban && <span style={{ fontWeight: 700, color: t.jawaban ? 'var(--stock)' : 'var(--gold)' }}>{t.jawaban ? `✓ Surat jawaban: ${t.jawaban.nomor_surat}` : 'Perlu surat jawaban (belum ada)'}</span>}
                    {!t.perlu_jawaban && t.jawaban && <span>Surat jawaban: {t.jawaban.nomor_surat}</span>}
                  </div>
                  {t.tanggapan && <div style={{ fontSize: 13.5, background: 'var(--stock-bg)', borderRadius: 8, padding: '6px 10px', marginTop: 6 }}><b>Kata-kata {t.unit?.nama}:</b> {t.tanggapan}</div>}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {aksi && selesai?.t.id !== t.id && <>
                      {t.status === 'menunggu' && <button className="btn btn-ghost" disabled={sibuk} style={kecil} onClick={() => ubahStatus(t, 'dibaca')}>👁 Surat sudah sampai di saya</button>}
                      {['menunggu', 'dibaca'].includes(t.status) && <button className="btn btn-ghost" disabled={sibuk} style={kecil} onClick={() => ubahStatus(t, 'diproses')}>▶ Mulai proses</button>}
                      {t.status !== 'selesai' && <button className="btn btn-ghost" disabled={sibuk} style={kecil} onClick={() => setForm({ induk: t })}>↪ Teruskan ke bidang lain</button>}
                      {t.status !== 'selesai' && <button className="btn btn-primary" disabled={sibuk} style={kecil} onClick={() => bukaSelesai(t)}>✅ Selesai + tulis kata-kata…</button>}
                      {t.status === 'selesai' && !t.diarsipkan_pada && <button className="btn btn-ghost" disabled={sibuk} style={kecil} onClick={() => ubahStatus(t, 'diproses')}>↩ Buka kembali</button>}
                    </>}
                    {t.status === 'selesai' && !t.diarsipkan_pada && peran.bisaArsip && <button className="btn btn-primary" disabled={sibuk} style={kecil} onClick={() => arsipkan(t)}>🗄 Arsipkan (Biro Umum)</button>}
                    {t.status !== 'selesai' && t.unit && <button className="btn btn-ghost" style={kecil} onClick={() => setKontak(t.unit)}>📞 Hubungi {t.unit.nama.replace(/^Bidang /, '')}</button>}
                  </div>

                  {selesai?.t.id === t.id && (
                    <div style={{ background: 'var(--cream)', borderRadius: 10, padding: 12, marginTop: 8 }}>
                      <div className="field"><label>Kata-katamu (setelah surat sampai di kamu)</label><textarea rows={3} value={selesai.tanggapan} onChange={e => setSelesai({ ...selesai, tanggapan: e.target.value })} placeholder="mis. Sudah kami koordinasikan, laporan dikirim tanggal ..." /></div>
                      <div className="field"><label>Surat jawaban (surat keluar){t.perlu_jawaban ? ' *' : ''}</label>
                        <select value={selesai.jawabanId} onChange={e => setSelesai({ ...selesai, jawabanId: e.target.value })}>
                          <option value="">— belum ada / tidak ada —</option>
                          {selesai.opsi.map(o => <option key={o.id} value={o.id}>{o.nomor_surat} — {o.perihal}</option>)}
                        </select>
                        <div style={{ fontSize: 12.5, marginTop: 5 }}>Belum dibuat? <Link href={`/surat-keluar?jawab=${surat.id}`} style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>Buat surat jawaban dulu →</Link></div>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 8 }}>Setelah selesai, surat diserahkan ke Biro Umum untuk diarsipkan.</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" disabled={sibuk} onClick={simpanSelesai}>Tandai Selesai</button>
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

      {/* Catatan bersama: siapa pun yang punya unit bisa menulis, semua orang bisa melihat */}
      {!loading && (
        <div style={{ borderTop: '2px solid var(--line)', marginTop: 8, paddingTop: 14 }}>
          <h4 style={{ margin: '0 0 10px' }}>💬 Catatan pada surat ini</h4>
          {catatan.length === 0 && <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 10 }}>Belum ada catatan.</div>}
          {catatan.map(c => (
            <div key={c.id} style={{ background: 'var(--cream)', borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}><b style={{ color: 'var(--ink)' }}>{c.penulis?.nama_lengkap || '-'}</b>{c.penulis?.unit?.nama ? ` (${c.penulis.unit.nama})` : ''} · {fmtWaktu(c.created_at)}</div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.isi}</div>
            </div>
          ))}
          {peran.bisaCatatan
            ? <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <textarea rows={2} style={{ flex: 1, minWidth: 220 }} value={teksCatatan} onChange={e => setTeksCatatan(e.target.value)} placeholder="Tulis catatan / pertanyaan / balasan untuk surat ini..." />
                <button className="btn btn-primary" disabled={sibuk || !teksCatatan.trim()} onClick={kirimCatatan}>Kirim Catatan</button>
              </div>
            : <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Akun kamu belum punya unit, jadi belum bisa menulis catatan.</div>}
        </div>
      )}

      {form && <DisposisiForm supabase={supabase} surat={surat} units={units} disposisi={form.disposisi} induk={form.induk}
        dariDefault={form.induk ? { unitId: peran.unitId, nama: peran.unit?.nama || peran.nama } : null}
        onClose={() => setForm(null)} onSaved={() => { setForm(null); segar() }} />}
      {kontak && <KontakModal supabase={supabase} unit={kontak} onClose={() => setKontak(null)} />}
    </div>
  )
}
