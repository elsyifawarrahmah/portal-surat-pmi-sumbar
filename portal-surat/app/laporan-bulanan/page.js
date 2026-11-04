'use client'
// Laporan Bulanan: semua surat masuk yang SELESAI pada bulan terpilih, lengkap dengan disposisi, hasil pengerjaan, dan catatannya.
// Surat dianggap selesai bila semua tujuan disposisinya sudah berstatus selesai; bulannya mengikuti tanggal selesai terakhir.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import { fmtTgl, fmtWaktu, unduhCsv, pesanGalat } from '@/lib/format'
import { cetakDaftar } from '@/lib/cetak'
import { LihatBerkas } from '@/components/PratinjauBerkas'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const bulanIni = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const potong = (arr, n) => { const h = []; for (let i = 0; i < arr.length; i += n) h.push(arr.slice(i, i + n)); return h }

export default function LaporanBulananPage() {
  const supabase = createClient()
  const peran = usePeran()
  const [bulan, setBulan] = useState(bulanIni())
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(false)
  const [pesan, setPesan] = useState('')

  const [thn, bln] = bulan.split('-').map(Number)
  const judulBulan = `${NAMA_BULAN[(bln || 1) - 1]} ${thn}`

  async function buat() {
    setLoading(true); setPesan(''); setRows(null)
    try {
      const awal = new Date(thn, bln - 1, 1), akhir = new Date(thn, bln, 1)
      // 1) tujuan disposisi yang selesai di bulan ini -> surat kandidat
      const t = await supabase.from('surat_disposisi_tujuan').select('id, disposisi:surat_disposisi!disposisi_id(surat_id)')
        .eq('status', 'selesai').gte('selesai_pada', awal.toISOString()).lt('selesai_pada', akhir.toISOString()).limit(5000)
      if (t.error) throw t.error
      const ids = [...new Set((t.data || []).map(x => x.disposisi?.surat_id).filter(Boolean))]
      if (ids.length === 0) { setRows([]); setLoading(false); return }

      // 2) data lengkap per surat (dipotong per 60 id supaya alamat permintaan tidak terlalu panjang)
      let surat = [], disp = [], cat = []
      for (const g of potong(ids, 60)) {
        const [a, b, c] = await Promise.all([
          supabase.from('surat_masuk').select('*').in('id', g),
          supabase.from('surat_disposisi').select('*, dari:surat_unit(nama), tujuan:surat_disposisi_tujuan!disposisi_id(*, unit:surat_unit(nama))').in('surat_id', g).order('created_at'),
          supabase.from('surat_catatan').select('*, penulis:profiles(nama_lengkap, unit:surat_unit(nama))').in('surat_id', g).order('created_at'),
        ])
        if (a.error) throw a.error; if (b.error) throw b.error
        surat = surat.concat(a.data || []); disp = disp.concat(b.data || []); cat = cat.concat(c.error ? [] : c.data || [])
      }

      const hasil = surat.map(s => {
        const dList = disp.filter(d => d.surat_id === s.id)
        const semuaTujuan = dList.flatMap(d => d.tujuan || [])
        const selesaiSemua = semuaTujuan.length > 0 && semuaTujuan.every(x => x.status === 'selesai')
        const tglSelesai = semuaTujuan.map(x => x.selesai_pada).filter(Boolean).sort().pop() || null
        return { s, dList, tglSelesai, selesaiSemua, catatan: cat.filter(c => c.surat_id === s.id) }
      })
        .filter(r => r.selesaiSemua && r.tglSelesai && new Date(r.tglSelesai) >= awal && new Date(r.tglSelesai) < akhir)
        .sort((x, y) => (x.tglSelesai < y.tglSelesai ? -1 : 1))
      setRows(hasil)
    } catch (e) { setPesan(pesanGalat(e)) }
    setLoading(false)
  }

  const rahasia = r => r.s.sifat === 'Rahasia' && !peran.isAdmin
  const teksDisposisi = r => r.dList.map(d => {
    const dari = d.dari_nama || d.dari?.nama || '-'
    const isi = (d.tujuan || []).map(x => `${x.unit?.nama || '-'}: ${x.instruksi || '-'}`).join('; ')
    return `[${fmtTgl(d.tanggal_diteruskan)}] ${dari} → ${isi}${d.catatan ? ' (Catatan disposisi: ' + d.catatan + ')' : ''}`
  }).join('\n')
  const teksHasil = r => r.dList.flatMap(d => d.tujuan || []).filter(x => x.tanggapan).map(x => `${x.unit?.nama || '-'}: ${x.tanggapan}`).join('\n')
  const teksCatatan = r => r.catatan.map(c => `${c.penulis?.nama_lengkap || '-'}${c.penulis?.unit?.nama ? ' (' + c.penulis.unit.nama + ')' : ''}, ${fmtTgl(c.created_at)}: ${c.isi}`).join('\n')

  const kolom = [
    { judul: 'No. Agenda', k: 'agenda' }, { judul: 'No. Surat', k: 'nomor' }, { judul: 'Asal', k: 'asal' }, { judul: 'Perihal', k: 'perihal' },
    { judul: 'Tgl Diterima', k: 'terima' }, { judul: 'Tgl Selesai', k: 'selesai' }, { judul: 'Disposisi', k: 'disposisi' }, { judul: 'Hasil / Tanggapan', k: 'hasil' }, { judul: 'Catatan', k: 'catatan' },
  ]
  const baris = () => (rows || []).filter(r => !rahasia(r)).map(r => ({
    agenda: r.s.nomor_agenda || '', nomor: r.s.nomor_surat, asal: r.s.asal_surat, perihal: r.s.perihal, terima: fmtTgl(r.s.tanggal_diterima_kantor), selesai: fmtTgl(r.tglSelesai),
    disposisi: teksDisposisi(r), hasil: teksHasil(r), catatan: teksCatatan(r),
  }))
  const aman = peran.bisaPantau || peran.loading

  return (
    <div className="app"><div className="main">
      <div className="topbar"><div><h1>Laporan Bulanan</h1><p className="desc">Semua surat masuk yang selesai pada bulan terpilih, lengkap dengan disposisi, hasil pengerjaan, dan catatannya.</p></div></div>
      {!aman && <div className="error-box">Laporan bulanan hanya untuk admin dan Biro Umum.</div>}
      {pesan && <div className="error-box">{pesan}</div>}
      {aman && (
        <div className="panel">
          <div className="panel-head">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
              <input type="month" value={bulan} onChange={e => { setBulan(e.target.value); setRows(null) }} style={{ maxWidth: 190 }} aria-label="Pilih bulan" />
              <button className="btn btn-primary" onClick={buat} disabled={loading || !bulan}>{loading ? 'Menyusun...' : `Tampilkan laporan ${judulBulan}`}</button>
            </div>
            {rows && rows.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => cetakDaftar({ judul: `Laporan Surat Masuk Selesai — ${judulBulan}`, subjudul: `${baris().length} surat selesai`, kolom, baris: baris(), namaPencetak: peran.nama })}>🖨 Cetak / PDF</button>
                <button className="btn btn-ghost" onClick={() => unduhCsv(`laporan-surat-${bulan}`, kolom.map(k => k.judul), baris().map(b => kolom.map(k => b[k.k])))}>⬇ CSV</button>
              </div>
            )}
          </div>
          {rows && (
            <div style={{ padding: '10px 20px', fontSize: 14 }}>
              <b>{rows.length}</b> surat selesai pada {judulBulan}.
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>Surat</th><th>Selesai</th><th>Disposisi</th><th>Hasil / Tanggapan</th><th>Catatan</th></tr></thead>
              <tbody>
                {rows === null ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Pilih bulan lalu tekan “Tampilkan laporan”.</td></tr> :
                  rows.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Tidak ada surat yang selesai pada {judulBulan}.</td></tr> :
                    rows.map(r => {
                      if (rahasia(r)) return <tr key={r.s.id}><td colSpan={5}>🔒 Surat rahasia — hanya admin yang bisa melihat.</td></tr>
                      return (
                        <tr key={r.s.id}>
                          <td data-label="Surat" style={{ minWidth: 220 }}>
                            <b>{r.s.perihal}</b>
                            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.s.nomor_agenda ? `Agenda ${r.s.nomor_agenda} · ` : ''}{r.s.nomor_surat}<br />Dari {r.s.asal_surat} · diterima {fmtTgl(r.s.tanggal_diterima_kantor)}</div>
                            {r.s.file_bukti_url && <LihatBerkas url={r.s.file_bukti_url} style={{ color: 'var(--pmi-red)', fontWeight: 600, fontSize: 13 }}>📎 Lihat surat</LihatBerkas>}
                          </td>
                          <td data-label="Selesai" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{fmtWaktu(r.tglSelesai)}</td>
                          <td data-label="Disposisi" style={{ whiteSpace: 'pre-wrap', fontSize: 13, minWidth: 220 }}>{teksDisposisi(r) || '-'}</td>
                          <td data-label="Hasil" style={{ whiteSpace: 'pre-wrap', fontSize: 13, minWidth: 180 }}>{teksHasil(r) || '-'}</td>
                          <td data-label="Catatan" style={{ whiteSpace: 'pre-wrap', fontSize: 13, minWidth: 200 }}>{teksCatatan(r) || '-'}</td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div></div>
  )
}
