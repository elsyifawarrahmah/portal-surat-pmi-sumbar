'use client'
import { LihatBerkas } from '@/components/PratinjauBerkas'
// Halaman SATU surat (gaya Srikandi): isi surat, tombol Tindak Lanjut, ke mana diteruskan, perjalanan surat, catatan.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePeran, useUnits } from '@/lib/peran'
import Modal from '@/components/Modal'
import TeruskanForm from '@/components/TeruskanForm'
import DaftarLampiran from '@/components/DaftarLampiran'
import KontakModal from '@/components/KontakModal'
import PeringatanUnit from '@/components/PeringatanUnit'
import { fmtTgl, fmtWaktu, pesanGalat, unggahBerkas } from '@/lib/format'
import { cetakLembarDisposisi } from '@/lib/cetak'
import { STATUS_SURAT, statusUntukSaya } from '@/lib/surat'

const kartu = { background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }
const judulKartu = { margin: '0 0 12px', fontSize: 18 }

function TombolBesar({ ikon, judul, ket, onClick, href, utama, hijau }) {
  const warna = hijau ? '#1E7B3A' : 'var(--pmi-red)'
  const gaya = { display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', padding: '14px 16px', marginBottom: 10, borderRadius: 14, minHeight: 64, textDecoration: 'none', cursor: 'pointer', border: '2px solid ' + (utama || hijau ? warna : 'var(--line)'), background: utama || hijau ? warna : '#fff', color: utama || hijau ? '#fff' : 'var(--ink)', font: 'inherit' }
  const isi = <><span style={{ fontSize: 26 }}>{ikon}</span><span><b style={{ fontSize: 17 }}>{judul}</b><br /><span style={{ fontSize: 13.5, opacity: 0.85 }}>{ket}</span></span></>
  return href ? <Link href={href} style={gaya}>{isi}</Link> : <button type="button" onClick={onClick} style={gaya}>{isi}</button>
}

export default function DetailSurat() {
  const { id } = useParams()
  const supabase = createClient()
  const peran = usePeran()
  const { units } = useUnits()
  const [surat, setSurat] = useState(null)
  const [disposisi, setDisposisi] = useState([])
  const [catatan, setCatatan] = useState([])
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')
  const [teruskan, setTeruskan] = useState(false)
  const [selesai, setSelesai] = useState(null)
  const [teksCatatan, setTeksCatatan] = useState('')
  const [kontak, setKontak] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const [editTujuan, setEditTujuan] = useState(null)   // { t, instruksi, batas }
  const [editSurat, setEditSurat] = useState(null)     // form data surat
  const [editCat, setEditCat] = useState(null)         // { id, isi }
  const [lainnya, setLainnya] = useState(false)
  const [batal, setBatal] = useState(null)             // { alasan }

  useEffect(() => { if (!peran.loading) muat(true) }, [peran.loading, id])

  async function muat(tandaiBaca) {
    setLoading(true)
    const s = await supabase.from('surat_masuk').select('*').eq('id', id).maybeSingle()
    if (s.error) { setGalat(pesanGalat(s.error)); setLoading(false); return }
    if (!s.data) { setSurat(null); setLoading(false); return }
    setSurat(s.data)
    const d = await supabase.from('surat_disposisi').select('*, tujuan:surat_disposisi_tujuan!disposisi_id(*, unit:surat_unit(id, nama, tipe), jawaban:surat_keluar(id, nomor_surat))').eq('surat_id', id).order('created_at')
    if (d.error) setGalat(pesanGalat(d.error))
    const daftar = (d.data || []).map(x => ({ ...x, tujuan: [...(x.tujuan || [])].sort((a, b) => (a.unit?.nama || '').localeCompare(b.unit?.nama || '')) }))
    setDisposisi(daftar)
    const c = await supabase.from('surat_catatan').select('*, penulis:profiles(nama_lengkap, unit:surat_unit(nama))').eq('surat_id', id).order('created_at')
    setCatatan(c.error ? [] : c.data || [])
    const r = await supabase.rpc('lacak_riwayat', { p_jenis: 'masuk', p_surat: id })
    setRiwayat(r.error ? [] : r.data || [])
    setLoading(false)
    // Seperti Srikandi: surat otomatis berstatus "sudah dibaca" begitu dibuka oleh yang dituju
    if (tandaiBaca && peran.unitId) {
      const belum = daftar.flatMap(x => x.tujuan).filter(t => t.unit_id === peran.unitId && t.status === 'menunggu')
      if (belum.length) { await supabase.from('surat_disposisi_tujuan').update({ status: 'dibaca' }).in('id', belum.map(t => t.id)); muat(false) }
    }
  }

  const semuaTujuan = disposisi.flatMap(x => x.tujuan)
  const milik = semuaTujuan.filter(t => peran.unitId && t.unit_id === peran.unitId && t.status !== 'selesai')   // tugas saya yang masih jalan
  const menungguArsip = semuaTujuan.filter(t => t.status === 'selesai' && !t.diarsipkan_pada)
  const sudahMenerima = semuaTujuan.filter(t => t.status !== 'selesai').map(t => t.unit_id)
  const status = statusUntukSaya(semuaTujuan, peran.unitId)
  const st = STATUS_SURAT[status]
  const bisaTeruskan = peran.bisaDisposisi || milik.length > 0
  const unitBiro = units.find(u => u.tipe === 'biro_umum')
  const tuBelumKirim = peran.isTataUsaha && disposisi.length === 0 && surat?.petugas_id === peran.userId
  const bolehBatal = !!surat && (peran.isAdmin || surat.petugas_id === peran.userId || peran.isBiroUmum)

  async function tandaiSelesai() {
    setSibuk(true)
    const ids = milik.map(t => t.id)
    const { error } = await supabase.from('surat_disposisi_tujuan').update({ status: 'selesai', tanggapan: selesai.teks.trim() || null, surat_jawaban_id: selesai.jawabanId || null }).in('id', ids)
    setSibuk(false)
    if (error) { alert('Belum bisa disimpan: ' + error.message); return }
    setSelesai(null); muat(false)
  }
  async function bukaSelesai() {
    const { data } = await supabase.from('surat_keluar').select('id, nomor_surat, perihal').or(`surat_masuk_id.eq.${id},unit_id.eq.${peran.unitId}`).order('created_at', { ascending: false }).limit(50)
    setSelesai({ teks: '', jawabanId: '', opsi: data || [] })
  }
  async function arsipkan() {
    setSibuk(true)
    const { error } = await supabase.from('surat_disposisi_tujuan').update({ diarsipkan_pada: new Date().toISOString() }).in('id', menungguArsip.map(t => t.id))
    setSibuk(false)
    if (error) { alert('Belum bisa diarsipkan: ' + error.message); return }
    muat(false)
  }
  async function kirimCatatan() {
    if (!teksCatatan.trim()) return
    setSibuk(true)
    const { error } = await supabase.from('surat_catatan').insert({ surat_id: id, isi: teksCatatan.trim() })
    setSibuk(false)
    if (error) { alert('Belum bisa dikirim: ' + error.message); return }
    setTeksCatatan(''); muat(false)
  }
  async function simpanEditTujuan() {
    if (!editTujuan.instruksi.trim()) { alert('Isi disposisi tidak boleh kosong.'); return }
    setSibuk(true)
    const { error } = await supabase.from('surat_disposisi_tujuan').update({ instruksi: editTujuan.instruksi.trim(), batas_waktu: editTujuan.batas || null }).eq('id', editTujuan.t.id)
    setSibuk(false)
    if (error) { alert('Belum bisa disimpan: ' + error.message); return }
    setEditTujuan(null); muat(false)
  }
  async function tarikTujuan(t) {
    if (!confirm(`Tarik kembali disposisi ke ${t.unit?.nama}? Surat hilang dari unit itu dan kamu bisa meneruskannya ulang dengan benar.`)) return
    const { error } = await supabase.from('surat_disposisi_tujuan').delete().eq('id', t.id)
    if (error) { alert('Belum bisa ditarik: ' + error.message); return }
    // bila disposisi tidak punya tujuan lagi, hapus juga kepalanya
    const sisa = await supabase.from('surat_disposisi_tujuan').select('id', { count: 'exact', head: true }).eq('disposisi_id', t.disposisi_id)
    if (!sisa.error && (sisa.count || 0) === 0) await supabase.from('surat_disposisi').delete().eq('id', t.disposisi_id)
    muat(false)
  }
  async function simpanEditSurat() {
    const f = editSurat
    if (!f.nomor_surat?.trim() || !f.perihal?.trim() || !f.asal_surat?.trim()) { alert('Nomor surat, asal, dan perihal wajib diisi.'); return }
    setSibuk(true)
    const { error } = await supabase.from('surat_masuk').update({
      nomor_surat: f.nomor_surat.trim(), asal_surat: f.asal_surat.trim(), perihal: f.perihal.trim(),
      tanggal_surat: f.tanggal_surat || null, tanggal_diterima_kantor: f.tanggal_diterima_kantor || null, sifat: f.sifat || 'Biasa',
      macam_surat: f.macam_surat || null, lampiran: f.lampiran || null,
    }).eq('id', id)
    setSibuk(false)
    if (error) { alert('Belum bisa disimpan: ' + error.message); return }
    setEditSurat(null); muat(false)
  }
  async function simpanEditCatatan() {
    if (!editCat.isi.trim()) return
    const { error } = await supabase.from('surat_catatan').update({ isi: editCat.isi.trim(), diubah_pada: new Date().toISOString() }).eq('id', editCat.id)
    if (error) { alert('Belum bisa disimpan: ' + error.message); return }
    setEditCat(null); muat(false)
  }
  async function kirimBiro() {
    setSibuk(true)
    const { error } = await supabase.rpc('kirim_ke_biro_umum', { p_surat: surat.id })
    setSibuk(false)
    if (error) { alert(/function|schema cache|does not exist/i.test(error.message) ? 'Fitur ini belum aktif di database. Jalankan supabase/migrasi-tata-usaha.sql dulu.' : error.message); return }
    muat(false)
  }

  async function batalkanSurat() {
    setSibuk(true)
    const { error } = await supabase.rpc('batalkan_surat_masuk', { p_id: surat.id, p_alasan: batal.alasan })
    setSibuk(false)
    if (error) { alert(/function|schema cache|does not exist/i.test(error.message) ? 'Fitur ini belum aktif di database. Jalankan supabase/migrasi-batal-surat.sql dulu. Pesan teknis: ' + error.message : error.message); return }
    alert('Surat dibatalkan. Bisa dipulihkan dari menu "Surat Dibatalkan".')
    window.location.href = '/surat'
  }

  async function hapusCatatan(c) {
    if (!confirm('Hapus catatan ini?')) return
    const { error } = await supabase.from('surat_catatan').delete().eq('id', c.id)
    if (error) { alert('Belum bisa dihapus: ' + error.message); return }
    muat(false)
  }
  async function unggahScan(d, e) {
    const file = e.target.files[0]; if (!file) return
    try {
      const url = await unggahBerkas(supabase, file)
      const { error } = await supabase.from('surat_disposisi').update({ file_scan_url: url, file_scan_nama: file.name }).eq('id', d.id)
      if (error) throw new Error(error.message)
      muat(false)
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="app"><div className="main kolom" style={{ '--lebar': '860px' }}>
      <div style={{ marginBottom: 12 }}><Link href="/surat" style={{ color: 'var(--pmi-red)', fontWeight: 700, textDecoration: 'none', fontSize: 15 }}>← Kembali ke daftar surat</Link></div>
      <PeringatanUnit peran={peran} />
      {galat && <div className="error-box">{galat}</div>}
      {loading && <div style={{ padding: 30, color: 'var(--ink-soft)' }}>Memuat surat...</div>}
      {!loading && !surat && !galat && (
        <div style={kartu}>
          <h3 style={judulKartu}>Surat tidak ditemukan</h3>
          <p style={{ fontSize: 15.5, lineHeight: 1.6 }}>Surat ini tidak ditujukan ke unit kamu, jadi isinya tidak ditampilkan. Kamu masih bisa melihat <b>posisinya</b> (sampai di mana, sudah dibaca atau belum) di menu <Link href="/lacak" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>Lacak Surat</Link>.</p>
        </div>
      )}

      {surat && (
        <>
          {/* Isi surat */}
          <div style={kartu}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.3, flex: 1, minWidth: 220 }}>{surat.perihal}</h1>
              <span className="tag" style={{ background: st.bg, color: st.fg, fontSize: 14, padding: '6px 14px' }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 16, margin: '10px 0 14px', color: 'var(--ink-soft)' }}>Dari <b style={{ color: 'var(--ink)' }}>{surat.asal_surat}</b></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px 18px', fontSize: 15, marginBottom: 14 }}>
              <div><span style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>Nomor surat</span><br /><b>{surat.nomor_surat}</b></div>
              <div><span style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>Nomor agenda</span><br /><b>{surat.nomor_agenda || '-'}</b></div>
              <div><span style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>Tanggal surat</span><br /><b>{fmtTgl(surat.tanggal_surat)}</b></div>
              <div><span style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>Diterima</span><br /><b>{fmtTgl(surat.tanggal_diterima_kantor)}</b></div>
              {surat.sifat && surat.sifat !== 'Biasa' && <div><span style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}>Sifat</span><br /><b>{surat.sifat}</b></div>}
            </div>
            {(peran.bisaCatatMasuk && (peran.isAdmin || surat.petugas_id === peran.userId || peran.isBiroUmum)) && <button className="btn btn-ghost" style={{ minHeight: 44 }} onClick={() => setEditSurat({ ...surat })}>✏️ Ubah data surat</button>}
          </div>

          {/* Tindak Lanjut — pilihan utama di atas, sisanya dilipat di "Lainnya" */}
          {(bisaTeruskan || peran.bisaCatatan || (peran.bisaArsip && menungguArsip.length > 0) || bolehBatal || peran.isTataUsaha) && (
            <div style={kartu}>
              <h3 style={judulKartu}>Apa yang mau kamu lakukan?</h3>
              {tuBelumKirim && <TombolBesar utama ikon="📤" judul="Kirim ke Biro Umum" ket="Surat ini belum dikirim." onClick={kirimBiro} />}
              {peran.isTataUsaha && unitBiro && <TombolBesar ikon="📞" judul="Hubungi Biro Umum" ket="Kalau surat belum dibaca atau tertahan." onClick={() => setKontak(unitBiro)} />}
              {milik.length > 0 && <TombolBesar hijau ikon="✅" judul="Selesai" ket="Surat sudah saya kerjakan. Setelah semua tujuan selesai, otomatis masuk arsip bulanan." onClick={bukaSelesai} />}
              {peran.bisaArsip && menungguArsip.length > 0 && <TombolBesar hijau ikon="🗄️" judul="Arsipkan" ket="Surat sudah selesai. Simpan ke arsip." onClick={arsipkan} />}
              {bisaTeruskan && <TombolBesar ikon="➡️" judul="Teruskan ke bidang lain" ket="Pilih siapa yang mengerjakan." onClick={() => setTeruskan(true)} />}
              {(milik.length > 0 && peran.bisaCatatKeluar) || peran.bisaCatatan || bolehBatal ? (
                <button type="button" className="btn btn-ghost" style={{ width: '100%', minHeight: 48, fontSize: 15 }} onClick={() => setLainnya(v => !v)}>{lainnya ? '▲ Tutup' : '▼ Pilihan lain'}</button>
              ) : null}
              {lainnya && (
                <div style={{ marginTop: 10 }}>
                  {milik.length > 0 && peran.bisaCatatKeluar && <TombolBesar ikon="✉️" judul="Balas dengan surat" ket="Buat surat jawaban." href={`/surat-keluar?jawab=${surat.id}`} />}
                  {peran.bisaCatatan && <TombolBesar ikon="💬" judul="Tulis catatan" ket="Bertanya atau memberi arahan." onClick={() => document.getElementById('catatan')?.scrollIntoView({ behavior: 'smooth' })} />}
                  {bolehBatal && <TombolBesar ikon="🗑️" judul="Batalkan surat ini" ket="Salah input atau dobel. Bisa dipulihkan." onClick={() => setBatal({ alasan: '' })} />}
                </div>
              )}
            </div>
          )}

          {/* Berkas / lampiran (boleh banyak) */}
          <div style={kartu}>
            <h3 style={judulKartu}>📎 Berkas surat</h3>
            <DaftarLampiran supabase={supabase} jenis="masuk" suratId={surat.id} fileUtamaUrl={surat.file_bukti_url} fileUtamaNama={surat.file_bukti_nama} boleh={peran.bisaCatatMasuk || milik.length > 0 || peran.isAdmin} peran={peran} />
          </div>

          {/* Ke mana diteruskan */}
          <div style={kartu}>
            <h3 style={judulKartu}>Surat ini diteruskan ke</h3>
            {disposisi.length === 0 && <div style={{ fontSize: 15.5, color: 'var(--ink-soft)' }}>Belum diteruskan ke siapa pun.</div>}
            {disposisi.map(d => (
              <div key={d.id} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13.5, color: 'var(--ink-soft)', marginBottom: 6 }}>{d.dari_nama || d.dari?.nama || '-'} · {fmtTgl(d.tanggal_diteruskan)}{d.induk_tujuan_id ? ' (diteruskan lagi)' : ''}</div>
                {d.ttd_url && <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontSize: 12.5, color: 'var(--ink-soft)' }}><img src={d.ttd_url} alt="Tanda tangan digital" style={{ height: 56, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 3 }} /><span>✔ Ditandatangani digital oleh <b style={{ color: 'var(--ink)' }}>{d.ttd_nama || d.dari_nama}</b><br />{fmtWaktu(d.ttd_pada)}{d.ttd_kode && <><br />Kode: <b className="mono" style={{ color: 'var(--ink)' }}>{d.ttd_kode}</b></>}</span></div>}
                {d.tujuan.map(t => {
                  const kunci = t.status === 'selesai' ? (t.diarsipkan_pada ? 'arsip' : 'selesai') : t.status === 'menunggu' ? 'belum' : 'proses'
                  const s2 = STATUS_SURAT[kunci]
                  return (
                    <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <b style={{ fontSize: 16 }}>{t.unit?.nama}</b>
                        <span className="tag" style={{ background: s2.bg, color: s2.fg }}>{s2.label}</span>
                      </div>
                      <div style={{ fontSize: 15, margin: '4px 0' }}>{t.instruksi}</div>
                      {t.tanggapan && <div style={{ fontSize: 14.5, background: 'var(--stock-bg)', borderRadius: 10, padding: '8px 12px', marginTop: 6 }}><b>Hasil dari {t.unit?.nama}:</b> {t.tanggapan}</div>}
                      {t.jawaban && <div style={{ fontSize: 13.5, marginTop: 6 }}>✉️ Surat jawaban: <b>{t.jawaban.nomor_surat}</b></div>}
                      {(d.dibuat_oleh === peran.userId || peran.isAdmin) && ['menunggu', 'dibaca'].includes(t.status) && <span style={{ display: 'inline-flex', gap: 8, marginRight: 8 }}>
                        <button className="btn btn-ghost" style={{ marginTop: 8, minHeight: 40, fontSize: 14 }} onClick={() => setEditTujuan({ t, instruksi: t.instruksi || '', batas: t.batas_waktu || '' })}>✏️ Ubah</button>
                        <button className="btn btn-ghost" style={{ marginTop: 8, minHeight: 40, fontSize: 14, color: '#B3261E' }} onClick={() => tarikTujuan(t)}>↩ Tarik kembali</button>
                      </span>}
                      {t.status !== 'selesai' && t.unit && t.unit_id !== peran.unitId && <button className="btn btn-ghost" style={{ marginTop: 8, minHeight: 40, fontSize: 14 }} onClick={() => setKontak(t.unit)}>📞 Hubungi {t.unit.nama.replace(/^Bidang /, '')}</button>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Perjalanan surat */}
          <div style={kartu}>
            <h3 style={judulKartu}>Perjalanan surat</h3>
            {riwayat.length === 0 && <div style={{ fontSize: 15, color: 'var(--ink-soft)' }}>Belum ada catatan perjalanan.</div>}
            <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {riwayat.map((r, i) => (
                <li key={i} style={{ display: 'flex', gap: 12, paddingBottom: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: i === riwayat.length - 1 ? 'var(--pmi-red)' : 'var(--stock)', marginTop: 6 }} />
                    {i < riwayat.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--line)', marginTop: 2 }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5 }}>{r.aksi}</div>
                    {r.keterangan && <div style={{ fontSize: 14 }}>{r.keterangan}</div>}
                    <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtWaktu(r.waktu)}{r.unit_nama ? ` · ${r.unit_nama}` : ''}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Catatan */}
          <div style={kartu} id="catatan">
            <h3 style={judulKartu}>💬 Catatan</h3>
            {catatan.length === 0 && <div style={{ fontSize: 15, color: 'var(--ink-soft)', marginBottom: 10 }}>Belum ada catatan.</div>}
            {catatan.map(c => (
              <div key={c.id} style={{ background: 'var(--cream)', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}><b style={{ color: 'var(--ink)' }}>{c.penulis?.nama_lengkap || '-'}</b>{c.penulis?.unit?.nama ? ` (${c.penulis.unit.nama})` : ''} · {fmtWaktu(c.created_at)}</div>
                {editCat?.id === c.id
                  ? <div><textarea rows={3} style={{ fontSize: 16 }} value={editCat.isi} onChange={e => setEditCat({ ...editCat, isi: e.target.value })} /><div style={{ display: 'flex', gap: 8, marginTop: 6 }}><button className="btn btn-primary" style={{ minHeight: 40 }} onClick={simpanEditCatatan}>Simpan</button><button className="btn btn-ghost" style={{ minHeight: 40 }} onClick={() => setEditCat(null)}>Batal</button></div></div>
                  : <div style={{ fontSize: 15.5, whiteSpace: 'pre-wrap' }}>{c.isi}{c.diubah_pada && <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}> (diedit)</span>}</div>}
                {(c.dibuat_oleh === peran.userId || peran.isAdmin) && editCat?.id !== c.id && <div style={{ marginTop: 4 }}><button className="btn btn-ghost" style={{ minHeight: 32, fontSize: 12.5, padding: '2px 10px' }} onClick={() => setEditCat({ id: c.id, isi: c.isi })}>✏️ Ubah</button> <button className="btn btn-ghost" style={{ minHeight: 32, fontSize: 12.5, padding: '2px 10px' }} onClick={() => hapusCatatan(c)}>Hapus</button></div>}
              </div>
            ))}
            {peran.bisaCatatan && (
              <div style={{ marginTop: 10 }}>
                <textarea rows={3} style={{ fontSize: 16 }} value={teksCatatan} onChange={e => setTeksCatatan(e.target.value)} placeholder="Tulis catatan di sini..." />
                <button className="btn btn-primary" style={{ marginTop: 8, minHeight: 48, fontSize: 16 }} disabled={sibuk || !teksCatatan.trim()} onClick={kirimCatatan}>Kirim catatan</button>
              </div>
            )}
          </div>

          {/* Lainnya (jarang dipakai) */}
          {disposisi.length > 0 && (
            <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 30 }}>
              <b>Lembar disposisi kertas:</b>{' '}
              {disposisi.map(d => (
                <span key={d.id} style={{ marginRight: 14 }}>
                  <a href="#" style={{ color: 'var(--pmi-red)', fontWeight: 600 }} onClick={e => { e.preventDefault(); cetakLembarDisposisi({ surat, disposisi: d, tujuan: d.tujuan, namaPencetak: peran.nama }) }}>🖨 Cetak ({fmtTgl(d.tanggal_diteruskan)})</a>
                  {d.file_scan_url && <> · <LihatBerkas url={d.file_scan_url} style={{ color: 'var(--pmi-red)', fontWeight: 600 }}>📎 scan</LihatBerkas></>}
                  {peran.bisaDisposisi && <> · <label style={{ textTransform: 'none', display: 'inline', fontSize: 14, color: 'var(--pmi-red)', cursor: 'pointer', fontWeight: 600 }}>⬆ unggah scan<input type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => unggahScan(d, e)} /></label></>}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {teruskan && <TeruskanForm supabase={supabase} surat={surat} units={units} peran={peran} induk={milik[0] || null} sudahMenerima={sudahMenerima} onClose={() => setTeruskan(false)} onSaved={() => { setTeruskan(false); muat(false) }} />}
      {selesai && (
        <Modal judul="Selesai — tulis hasilnya" onClose={() => setSelesai(null)} lebar={520}
          footer={<><button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => setSelesai(null)}>Batal</button><button className="btn btn-primary" style={{ minHeight: 48, fontSize: 16 }} disabled={sibuk} onClick={tandaiSelesai}>Tandai Selesai</button></>}>
          <div className="field"><label style={{ textTransform: 'none', fontSize: 15 }}>Apa yang sudah dikerjakan? <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(boleh dikosongkan)</span></label>
            <textarea rows={4} style={{ fontSize: 16 }} value={selesai.teks} onChange={e => setSelesai({ ...selesai, teks: e.target.value })} placeholder="mis. Sudah dikoordinasikan, laporan dikirim tanggal ..." autoFocus /></div>
          {selesai.opsi.length > 0 && (
            <div className="field"><label style={{ textTransform: 'none', fontSize: 15 }}>Ada surat jawaban? <span style={{ color: 'var(--ink-soft)', fontWeight: 400 }}>(pilih kalau ada)</span></label>
              <select style={{ fontSize: 16 }} value={selesai.jawabanId} onChange={e => setSelesai({ ...selesai, jawabanId: e.target.value })}><option value="">— tidak ada —</option>{selesai.opsi.map(o => <option key={o.id} value={o.id}>{o.nomor_surat} — {o.perihal}</option>)}</select></div>
          )}
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Setelah semua tujuan selesai, surat otomatis masuk Arsip bulan ini (tidak perlu kembali ke Biro Umum).</div>
        </Modal>
      )}
      {editTujuan && (
        <Modal judul={`Ubah disposisi ke ${editTujuan.t.unit?.nama}`} onClose={() => setEditTujuan(null)} lebar={520}
          footer={<><button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => setEditTujuan(null)}>Batal</button><button className="btn btn-primary" style={{ minHeight: 48, fontSize: 16 }} disabled={sibuk} onClick={simpanEditTujuan}>Simpan perubahan</button></>}>
          <div className="field"><label style={{ textTransform: 'none', fontSize: 15 }}>Isi disposisi / petunjuk</label><textarea rows={4} style={{ fontSize: 16 }} value={editTujuan.instruksi} onChange={e => setEditTujuan({ ...editTujuan, instruksi: e.target.value })} autoFocus /></div>
          <div className="field"><label style={{ textTransform: 'none', fontSize: 15 }}>Batas waktu (boleh kosong)</label><input type="date" value={editTujuan.batas} onChange={e => setEditTujuan({ ...editTujuan, batas: e.target.value })} /></div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>Hanya bisa diubah selama penerima belum mulai memproses. Salah penerima? Tutup ini lalu pilih “Tarik kembali”, kemudian teruskan ulang.</div>
        </Modal>
      )}
      {batal && (
        <Modal judul="Batalkan surat ini?" onClose={() => setBatal(null)} lebar={480}
          footer={<><button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => setBatal(null)}>Jangan jadi</button><button className="btn btn-primary" style={{ minHeight: 48 }} disabled={sibuk || batal.alasan.trim().length < 5} onClick={batalkanSurat}>Ya, batalkan</button></>}>
          <div style={{ fontSize: 16, marginBottom: 10 }}>Surat <b>{surat.perihal}</b> akan hilang dari daftar. Surat <b>tidak dihapus permanen</b> dan bisa dipulihkan lagi.</div>
          <div className="field"><label>Kenapa dibatalkan? *</label><textarea rows={3} style={{ fontSize: 16 }} value={batal.alasan} onChange={e => setBatal({ alasan: e.target.value })} placeholder="Contoh: salah input, surat dobel" /></div>
        </Modal>
      )}
      {editSurat && (
        <Modal judul="Ubah data surat" onClose={() => setEditSurat(null)} lebar={560}
          footer={<><button className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => setEditSurat(null)}>Batal</button><button className="btn btn-primary" style={{ minHeight: 48, fontSize: 16 }} disabled={sibuk} onClick={simpanEditSurat}>Simpan perubahan</button></>}>
          {[['nomor_surat', 'Nomor surat', 'text'], ['asal_surat', 'Asal surat', 'text'], ['perihal', 'Perihal', 'text'], ['tanggal_surat', 'Tanggal surat', 'date'], ['tanggal_diterima_kantor', 'Tanggal diterima di kantor', 'date'], ['macam_surat', 'Macam surat', 'text'], ['lampiran', 'Lampiran', 'text']].map(([k, label, tipe]) => (
            <div className="field" key={k}><label>{label}</label><input type={tipe} value={editSurat[k] || ''} onChange={e => setEditSurat({ ...editSurat, [k]: e.target.value })} /></div>
          ))}
          <div className="field"><label>Sifat surat</label><select value={editSurat.sifat || 'Biasa'} onChange={e => setEditSurat({ ...editSurat, sifat: e.target.value })}><option>Biasa</option><option>Penting</option><option>Segera</option><option>Rahasia</option></select></div>
        </Modal>
      )}
      {kontak && <KontakModal supabase={supabase} unit={kontak} onClose={() => setKontak(null)} />}
    </div></div>
  )
}
