'use client'
// Daftar + tambah + hapus lampiran (banyak file) untuk satu surat.
import { useEffect, useState } from 'react'
import { LihatBerkas } from '@/components/PratinjauBerkas'
import { unggahBanyak, simpanLampiran, ketHint, hapusBerkasLama } from '@/lib/berkas'

export default function DaftarLampiran({ supabase, jenis, suratId, fileUtamaUrl, fileUtamaNama, boleh, peran }) {
  const [daftar, setDaftar] = useState([])
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState('')

  async function muat() {
    const { data, error } = await supabase.from('surat_lampiran').select('*').eq('jenis', jenis).eq('surat_id', suratId).order('created_at')
    setDaftar(error ? [] : data || [])
  }
  useEffect(() => { if (suratId) muat() }, [suratId])

  async function tambah(e, jenisBerkas = 'surat') {
    const files = e.target.files; if (!files?.length) return
    setSibuk(true); setPesan('')
    try {
      const { berhasil, gagal } = await unggahBanyak(supabase, files, jenisBerkas)
      const err = await simpanLampiran(supabase, jenis, suratId, berhasil)
      if (err) throw new Error(/surat_lampiran/.test(err.message) ? 'Fitur lampiran banyak belum aktif: jalankan supabase/migrasi-alur-biro-ttd-lampiran.sql.' : err.message)
      if (gagal.length) setPesan('Sebagian file tidak bisa dipakai:\n' + gagal.join('\n'))
      muat()
    } catch (err) { setPesan(err.message) }
    setSibuk(false); e.target.value = ''
  }
  async function hapus(l) {
    if (!confirm('Hapus lampiran ini?')) return
    const { error } = await supabase.from('surat_lampiran').delete().eq('id', l.id)
    if (error) { alert('Belum bisa dihapus: ' + error.message); return }
    hapusBerkasLama(supabase, l.url); muat()
  }

  const semua = [...(fileUtamaUrl ? [{ id: 'utama', url: fileUtamaUrl, nama: fileUtamaNama || 'Berkas surat', utama: true }] : []), ...daftar]
  return (
    <div>
      {semua.length === 0 && <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 8 }}>Belum ada berkas.</div>}
      {semua.map((l, i) => (
        <div key={l.id} style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
          <LihatBerkas url={l.url} style={{ color: 'var(--pmi-red)', fontWeight: 700, fontSize: 15 }}>{i + 1}. {l.nama || 'Berkas'}</LihatBerkas>
          {!l.utama && (boleh || l.dibuat_oleh === peran?.userId) && <button className="btn btn-ghost" style={{ minHeight: 34, fontSize: 13 }} onClick={() => hapus(l)}>Hapus</button>}
        </div>
      ))}
      {boleh && (
        <div style={{ marginTop: 8 }}>
          <label className="btn btn-ghost" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', textTransform: 'none' }}>
            {sibuk ? 'Mengunggah...' : 'Tambah berkas (boleh banyak)'}
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={e => tambah(e, 'surat')} disabled={sibuk} />
          </label>
          {' '}
          <label className="btn btn-ghost" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', textTransform: 'none' }}>
            {sibuk ? 'Mengunggah...' : 'Tambah PDF (surat > 2 lembar)'}
            <input type="file" multiple accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => tambah(e, 'dokumen')} disabled={sibuk} />
          </label>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>{ketHint('surat')}</div>
        </div>
      )}
      {pesan && <div className="error-box" style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{pesan}</div>}
    </div>
  )
}
