'use client'
// Riwayat lengkap satu surat (garis waktu + waktu pasti tiap kejadian) + tombol cetak.
import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import { fmtTgl, fmtWaktu, tabelBelumAda, PESAN_MIGRASI } from '@/lib/format'
import { cetakRiwayat } from '@/lib/cetak'

export default function RiwayatModal({ supabase, jenis, surat, peran, onClose }) {
  const [riwayat, setRiwayat] = useState([])
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const masuk = jenis === 'masuk'

  useEffect(() => { (async () => {
    const { data, error } = await supabase.from('surat_riwayat').select('*').eq('surat_jenis', jenis).eq('surat_id', surat.id).order('waktu').order('id')
    if (error) setPesan(tabelBelumAda(error) ? PESAN_MIGRASI : 'Gagal memuat riwayat: ' + error.message)
    else setRiwayat(data || [])
    setLoading(false)
  })() }, [surat.id, jenis])

  const info = [
    ['No. Agenda', surat.nomor_agenda || '-'], ['No. Surat', surat.nomor_surat],
    [masuk ? 'Asal' : 'Tujuan', masuk ? surat.asal_surat : surat.tujuan_surat],
    ['Perihal', surat.perihal], ['Tanggal Surat', fmtTgl(surat.tanggal_surat)],
    ...(masuk ? [['Diterima di Kantor', fmtTgl(surat.tanggal_diterima_kantor)]] : [['Divisi/Biro', surat.divisi || '-']]),
    ['Dicatat ke sistem', fmtWaktu(surat.created_at)],
  ]

  return (
    <Modal judul={`Riwayat Surat ${masuk ? 'Masuk' : 'Keluar'}`} onClose={onClose} lebar={680}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Tutup</button><button className="btn btn-primary" disabled={loading || !!pesan} onClick={() => cetakRiwayat({ jenis, surat, riwayat, namaPencetak: peran?.nama })}>🖨 Cetak Riwayat</button></>}>
      <div style={{ background: 'var(--cream)', borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '6px 18px', fontSize: 13.5 }}>
        {info.map(([a, b]) => <div key={a}><span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>{a}</span><br /><b>{b}</b></div>)}
        {surat.file_bukti_url && <div><span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>Berkas</span><br /><a href={surat.file_bukti_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>📎 Lihat surat</a></div>}
      </div>
      {pesan && <div className="error-box">{pesan}</div>}
      {loading && <div style={{ color: 'var(--ink-soft)' }}>Memuat riwayat...</div>}
      {!loading && !pesan && riwayat.length === 0 && <div style={{ color: 'var(--ink-soft)' }}>Belum ada kejadian tercatat untuk surat ini.</div>}
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {riwayat.map((r, i) => (
          <li key={r.id} style={{ display: 'flex', gap: 12, paddingBottom: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ width: 12, height: 12, borderRadius: '50%', background: i === riwayat.length - 1 ? 'var(--pmi-red)' : 'var(--stock)', marginTop: 5, flexShrink: 0 }} />
              {i < riwayat.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--line)', marginTop: 2 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{r.aksi}</div>
              {r.keterangan && <div style={{ fontSize: 13.5 }}>{r.keterangan}</div>}
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtWaktu(r.waktu)}{r.oleh_nama ? ` · ${r.oleh_nama}` : ''}{r.unit_nama ? ` (${r.unit_nama})` : ''}</div>
            </div>
          </li>
        ))}
      </ol>
    </Modal>
  )
}
