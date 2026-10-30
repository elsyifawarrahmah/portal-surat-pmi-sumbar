'use client'
// Cek Database: menguji satu per satu query yang dipakai fitur baru dan menampilkan penyebab bila gagal.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const CEK = [
  ['Akun saya + unit (menu, hak akses)', s => s.from('profiles').select('id, nama_lengkap, role, unit_id, unit:surat_unit(id, kode, nama, tipe)').limit(1)],
  ['Kolom telepon pada akun (migrasi 2)', s => s.from('profiles').select('id, telepon').limit(1)],
  ['Daftar unit / bidang', s => s.from('surat_unit').select('*').limit(1)],
  ['Surat masuk: nomor agenda, macam surat, lampiran', s => s.from('surat_masuk').select('id, nomor_agenda, macam_surat, lampiran').limit(1)],
  ['Surat keluar: agenda, unit, surat jawaban', s => s.from('surat_keluar').select('id, nomor_agenda, unit_id, surat_masuk_id, jawab:surat_masuk(nomor_surat)').limit(1)],
  ['Disposisi + pemberi + tujuan + surat jawaban', s => s.from('surat_disposisi').select('*, dari:surat_unit(nama), pembuat:profiles(nama_lengkap), tujuan:surat_disposisi_tujuan(*, unit:surat_unit(id, nama), jawaban:surat_keluar(id, nomor_surat))').limit(1)],
  ['Disposisi lanjutan (induk_tujuan_id, migrasi 2)', s => s.from('surat_disposisi').select('id, induk_tujuan_id').limit(1)],
  ['Daftar disposisi (halaman Disposisi)', s => s.from('surat_disposisi_tujuan').select('*, unit:surat_unit(id, nama), disposisi:surat_disposisi(id, tanggal_diteruskan, surat:surat_masuk(*))').limit(1)],
  ['Pengarsipan oleh Biro Umum (diarsipkan_oleh, migrasi 2)', s => s.from('surat_disposisi_tujuan').select('id, diarsipkan_pada, diarsipkan_oleh').limit(1)],
  ['Panggilan Biro Umum', s => s.from('surat_panggilan').select('*, unit:surat_unit(nama), pembuat:profiles!surat_panggilan_dibuat_oleh_fkey(nama_lengkap), surat:surat_masuk(nomor_surat)').limit(1)],
  ['Catatan pada surat (migrasi 2)', s => s.from('surat_catatan').select('*, penulis:profiles(nama_lengkap, unit:surat_unit(nama))').limit(1)],
  ['Riwayat surat', s => s.from('surat_riwayat').select('*').limit(1)],
  ['Tahapan surat (posisi surat)', s => s.from('surat_tahapan').select('surat_id, nama_tahap, urutan, tanggal_diterima, tanggal_diteruskan, penerima_nama').limit(1)],
  ['Ekspedisi', s => s.from('surat_keluar').select('*, ekspedisi:surat_ekspedisi(*)').limit(1)],
  ['Kotak saran', s => s.from('surat_saran').select('*').limit(1)],
  ['Lacak surat (migrasi 3: privasi per unit)', s => s.rpc('lacak_surat')],
  ['Jejak surat (migrasi 3)', s => s.rpc('lacak_riwayat', { p_jenis: 'masuk', p_surat: '00000000-0000-0000-0000-000000000000' })],
]

export default function DiagnosaPage() {
  const supabase = createClient()
  const [hasil, setHasil] = useState([])
  const [jalan, setJalan] = useState(true)
  const host = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host } catch (e) { return '(tidak terbaca)' } })()

  async function uji() {
    setJalan(true)
    const out = []
    for (const [nama, fn] of CEK) {
      try { const { error } = await fn(supabase); out.push({ nama, ok: !error, error }) }
      catch (e) { out.push({ nama, ok: false, error: { message: String(e) } }) }
    }
    setHasil(out); setJalan(false)
  }
  useEffect(() => { uji() }, [])

  const gagal = hasil.filter(h => !h.ok)
  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Cek Database</h1><p className="desc">Menguji tiap bagian fitur baru. Kalau ada yang ✗, kirim screenshot halaman ini ke asisten.</p></div><button className="btn btn-primary" onClick={uji} disabled={jalan}>{jalan ? 'Menguji...' : 'Uji ulang'}</button></div>
      <div className="panel"><div className="panel-body" style={{ fontSize: 14 }}>
        Portal ini terhubung ke project Supabase: <b className="mono">{host}</b><br />
        <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>Alamat ini harus sama dengan Project URL di Supabase → Project Settings → API (tempat kamu menjalankan SQL).</span>
      </div></div>
      {!jalan && <div style={{ background: gagal.length ? '#FBE7E7' : 'var(--stock-bg)', color: gagal.length ? '#B3261E' : 'var(--stock)', padding: '10px 14px', borderRadius: 10, fontWeight: 700, marginBottom: 16 }}>{gagal.length ? `${gagal.length} dari ${hasil.length} pengujian gagal` : `Semua ${hasil.length} pengujian lolos ✓`}</div>}
      <div className="panel"><div style={{ overflowX: 'auto' }}><table>
        <thead><tr><th style={{ width: 40 }}></th><th>Bagian</th><th>Keterangan</th></tr></thead>
        <tbody>{hasil.map(h => (
          <tr key={h.nama}>
            <td style={{ fontSize: 18 }}>{h.ok ? '✅' : '❌'}</td>
            <td><b>{h.nama}</b></td>
            <td style={{ fontSize: 13, color: h.ok ? 'var(--ink-soft)' : '#B3261E' }}>{h.ok ? 'OK' : <>{h.error?.message}{h.error?.code ? <> <span className="mono">[{h.error.code}]</span></> : null}{h.error?.hint ? <div style={{ color: 'var(--ink-soft)' }}>Petunjuk: {h.error.hint}</div> : null}</>}</td>
          </tr>))}</tbody>
      </table></div></div>
    </div></div>
  )
}
