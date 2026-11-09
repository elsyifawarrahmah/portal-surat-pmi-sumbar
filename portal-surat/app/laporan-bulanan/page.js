'use client'
// Laporan Bulanan: semua surat masuk yang SELESAI pada bulan terpilih, lengkap dengan disposisi, hasil pengerjaan, dan catatannya.
// Surat dianggap selesai bila semua tujuan disposisinya sudah berstatus selesai; bulannya mengikuti tanggal selesai terakhir.
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { usePeran } from '@/lib/peran'
import { fmtTgl, fmtWaktu, unduhCsv, pesanGalat } from '@/lib/format'
import { cetakDaftar } from '@/lib/cetak'
import { LihatBerkas } from '@/components/PratinjauBerkas'
import { urlAman } from '@/lib/berkas'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const bulanIni = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const namaDariUrl = u => { try { return decodeURIComponent(String(u).split('?')[0].split('/').pop()) } catch { return 'berkas' } }
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
      let surat = [], disp = [], cat = [], lamp = []
      for (const g of potong(ids, 60)) {
        const [a, b, c, d] = await Promise.all([
          supabase.from('surat_masuk').select('*').in('id', g),
          supabase.from('surat_disposisi').select('*, dari:surat_unit(nama), tujuan:surat_disposisi_tujuan!disposisi_id(*, unit:surat_unit(nama))').in('surat_id', g).order('created_at'),
          supabase.from('surat_catatan').select('*, penulis:profiles(nama_lengkap, unit:surat_unit(nama))').in('surat_id', g).order('created_at'),
          supabase.from('surat_lampiran').select('surat_id, url, nama').eq('jenis', 'masuk').in('surat_id', g).order('created_at'),
        ])
        if (a.error) throw a.error; if (b.error) throw b.error
        surat = surat.concat(a.data || []); disp = disp.concat(b.data || []); cat = cat.concat(c.error ? [] : c.data || []); lamp = lamp.concat(d.error ? [] : d.data || [])
      }

      const hasil = surat.map(s => {
        const dList = disp.filter(d => d.surat_id === s.id)
        const semuaTujuan = dList.flatMap(d => d.tujuan || [])
        const selesaiSemua = semuaTujuan.length > 0 && semuaTujuan.every(x => x.status === 'selesai')
        const tglSelesai = semuaTujuan.map(x => x.selesai_pada).filter(Boolean).sort().pop() || null
        const berkas = []
        const tambah = (url, nama) => { if (url && !berkas.some(b => b.url === url)) berkas.push({ url, nama: nama || namaDariUrl(url) }) }
        tambah(s.file_bukti_url, s.file_bukti_nama); lamp.filter(l => l.surat_id === s.id).forEach(l => tambah(l.url, l.nama))
        return { s, dList, tglSelesai, selesaiSemua, berkas, catatan: cat.filter(c => c.surat_id === s.id) }
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
    { judul: 'Tgl Diterima', k: 'terima' }, { judul: 'Tgl Selesai', k: 'selesai' }, { judul: 'Disposisi', k: 'disposisi' }, { judul: 'Hasil / Tanggapan', k: 'hasil' }, { judul: 'Catatan', k: 'catatan' }, { judul: 'File Surat', k: 'berkas' },
  ]
  const baris = () => (rows || []).filter(r => !rahasia(r)).map(r => ({
    agenda: r.s.nomor_agenda || '', nomor: r.s.nomor_surat, asal: r.s.asal_surat, perihal: r.s.perihal, terima: fmtTgl(r.s.tanggal_diterima_kantor), selesai: fmtTgl(r.tglSelesai),
    disposisi: teksDisposisi(r), hasil: teksHasil(r), catatan: teksCatatan(r), berkas: r.berkas.map(b => b.nama).join('\n'),
  }))

  const unduhBlob = (nama, blob) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nama; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
  const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const daftarAman = () => (rows || []).filter(r => !rahasia(r))

  async function unduhExcel() {
    const XLSX = await import('xlsx')
    const data = daftarAman().map(r => ({
      'No. Agenda': r.s.nomor_agenda || '', 'No. Surat': r.s.nomor_surat, 'Asal Surat': r.s.asal_surat, 'Perihal': r.s.perihal,
      'Tgl Diterima': fmtTgl(r.s.tanggal_diterima_kantor), 'Tgl Selesai': fmtTgl(r.tglSelesai),
      'Disposisi': teksDisposisi(r), 'Hasil / Tanggapan': teksHasil(r), 'Catatan': teksCatatan(r),
      'File Surat': r.berkas.map(b => b.nama).join('\n'),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [10, 22, 24, 34, 14, 14, 60, 40, 40, 50].map(w => ({ wch: w }))
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, `Selesai ${judulBulan}`.slice(0, 31))
    XLSX.writeFile(wb, `laporan-surat-${bulan}.xlsx`)
  }

  function htmlLaporan() {
    const br = t => esc(t).replace(/\n/g, '<br>')
    const tr = daftarAman().map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.s.perihal)}</b><br>Agenda: ${esc(r.s.nomor_agenda || '-')}<br>No: ${esc(r.s.nomor_surat)}<br>Dari: ${esc(r.s.asal_surat)}<br>Diterima: ${esc(fmtTgl(r.s.tanggal_diterima_kantor))}</td><td>${esc(fmtTgl(r.tglSelesai))}</td><td>${br(teksDisposisi(r)) || '-'}</td><td>${br(teksHasil(r)) || '-'}</td><td>${br(teksCatatan(r)) || '-'}</td><td>${r.berkas.map(b => esc(b.nama)).join('<br>') || '-'}</td></tr>`).join('')
    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Laporan ${esc(judulBulan)}</title><style>@page{size:A4 landscape;margin:1.5cm}body{font-family:Arial,sans-serif;font-size:10pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:4px;vertical-align:top}th{background:#eee}</style></head><body><h2 style="text-align:center">LAPORAN SURAT MASUK SELESAI<br>${esc(judulBulan.toUpperCase())}</h2><p>Jumlah surat selesai: <b>${daftarAman().length}</b></p><table><thead><tr><th>No</th><th>Surat</th><th>Selesai</th><th>Disposisi</th><th>Hasil / Tanggapan</th><th>Catatan</th><th>File Surat</th></tr></thead><tbody>${tr}</tbody></table></body></html>`
  }
  const unduhWord = () => unduhBlob(`laporan-surat-${bulan}.doc`, new Blob(['\ufeff', htmlLaporan()], { type: 'application/msword' }))

  async function unduhZip() {
    setLoading(true)
    try {
      const JSZip = (await import('jszip')).default
      const zip = new JSZip(), gagal = []
      zip.file(`laporan-surat-${bulan}.doc`, '\ufeff' + htmlLaporan())
      const list = daftarAman(); let n = 0
      for (const [i, r] of list.entries()) {
        const folder = `file-surat/${String(i + 1).padStart(3, '0')}-${(r.s.nomor_agenda || r.s.perihal || 'surat').toString().replace(/[^\w\-]+/g, '_').slice(0, 40)}`
        for (const b of r.berkas) {
          setPesan(`Menyiapkan ZIP: mengunduh file ${++n}...`)
          try { const res = await fetch(await urlAman(supabase, b.url)); if (!res.ok) throw new Error(res.status); zip.file(`${folder}/${b.nama.replace(/[\\/:*?"<>|]+/g, '_')}`, await res.blob()) } catch { gagal.push(`${r.s.nomor_surat}: ${b.nama}`) }
        }
      }
      if (gagal.length) zip.file('GAGAL-DIUNDUH.txt', 'File berikut tidak bisa diambil otomatis, unduh manual dari SATria PMI:\n\n' + gagal.join('\n\n'))
      unduhBlob(`laporan-surat-${bulan}.zip`, await zip.generateAsync({ type: 'blob' }))
      setPesan(gagal.length ? `ZIP terunduh. ${gagal.length} file gagal diambil, daftarnya ada di GAGAL-DIUNDUH.txt.` : '')
    } catch (e) { setPesan(pesanGalat(e)) }
    setLoading(false)
  }

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
                <button className="btn btn-primary" onClick={unduhZip} disabled={loading}>⬇ Unduh Lengkap (ZIP + semua file)</button>
                <button className="btn btn-ghost" onClick={unduhWord}>⬇ Word</button>
                <button className="btn btn-ghost" onClick={unduhExcel}>⬇ Excel</button>
                <button className="btn btn-ghost" onClick={() => cetakDaftar({ judul: `Laporan Surat Masuk Selesai — ${judulBulan}`, subjudul: `${baris().length} surat selesai`, kolom, baris: baris(), namaPencetak: peran.nama })}>🖨 Cetak / PDF</button>
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
              <thead><tr><th>Surat</th><th>Selesai</th><th>Disposisi</th><th>Hasil / Tanggapan</th><th>Catatan</th><th>File</th></tr></thead>
              <tbody>
                {rows === null ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Pilih bulan lalu tekan “Tampilkan laporan”.</td></tr> :
                  rows.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>Tidak ada surat yang selesai pada {judulBulan}.</td></tr> :
                    rows.map(r => {
                      if (rahasia(r)) return <tr key={r.s.id}><td colSpan={6}>🔒 Surat rahasia — hanya admin yang bisa melihat.</td></tr>
                      return (
                        <tr key={r.s.id}>
                          <td data-label="Surat" style={{ minWidth: 220 }}>
                            <b>{r.s.perihal}</b>
                            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{r.s.nomor_agenda ? `Agenda ${r.s.nomor_agenda} · ` : ''}{r.s.nomor_surat}<br />Dari {r.s.asal_surat} · diterima {fmtTgl(r.s.tanggal_diterima_kantor)}</div>
                          </td>
                          <td data-label="Selesai" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{fmtWaktu(r.tglSelesai)}</td>
                          <td data-label="Disposisi" style={{ whiteSpace: 'pre-wrap', fontSize: 13, minWidth: 220 }}>{teksDisposisi(r) || '-'}</td>
                          <td data-label="Hasil" style={{ whiteSpace: 'pre-wrap', fontSize: 13, minWidth: 180 }}>{teksHasil(r) || '-'}</td>
                          <td data-label="Catatan" style={{ whiteSpace: 'pre-wrap', fontSize: 13, minWidth: 200 }}>{teksCatatan(r) || '-'}</td>
                          <td data-label="File" style={{ fontSize: 13, minWidth: 150 }}>{r.berkas.length === 0 ? '-' : r.berkas.map((b, i) => <div key={i}><LihatBerkas url={b.url} judul={b.nama} style={{ color: 'var(--pmi-red)', fontWeight: 600 }}>📎 {b.nama}</LihatBerkas></div>)}</td>
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
