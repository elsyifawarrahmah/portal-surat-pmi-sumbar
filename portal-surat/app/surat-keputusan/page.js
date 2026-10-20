'use client'
import DokumenPage, { tgl } from '@/components/DokumenPage'

const config = {
  jenis: 'sk',
  judul: 'Surat Keputusan',
  deskripsi: 'Arsip Surat Keputusan (SK) yang ditetapkan PMI Sumatera Barat.',
  tombol: '+ Catat Surat Keputusan',
  cari: 'Cari nomor SK / tentang...',
  csvPrefix: 'surat-keputusan',
  kodeNomor: 'SK',
  masaBerlaku: true,
  fields: [
    { k: 'tanggal', label: 'Tanggal Penetapan', type: 'date', req: true },
    { k: 'nomor', label: 'Nomor SK', type: 'text', req: true, ph: '001/SK/PMI-SB/X/2026' },
    { k: 'judul', label: 'Tentang', type: 'text', req: true },
    { k: 'penerbit', label: 'Ditetapkan Oleh', type: 'text', ph: 'Ketua PMI Provinsi Sumatera Barat' },
    { k: 'tanggal_mulai', label: 'Berlaku Mulai', type: 'date' },
    { k: 'tanggal_berakhir', label: 'Berlaku Sampai', type: 'date' },
    { k: 'keterangan', label: 'Keterangan', type: 'textarea' },
  ],
  columns: [
    { label: 'Tanggal', render: r => tgl(r.tanggal) },
    { label: 'No. SK', k: 'nomor' },
    { label: 'Tentang', k: 'judul' },
    { label: 'Ditetapkan Oleh', k: 'penerbit' },
    { label: 'Masa Berlaku', render: r => (r.tanggal_mulai || r.tanggal_berakhir) ? `${tgl(r.tanggal_mulai)} – ${tgl(r.tanggal_berakhir)}` : '-' },
  ],
}

export default function Page() { return <DokumenPage config={config} /> }
