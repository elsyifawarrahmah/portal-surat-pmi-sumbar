'use client'
import DokumenPage, { tgl } from '@/components/DokumenPage'

const config = {
  jenis: 'sertifikat',
  judul: 'Sertifikat & Piagam',
  deskripsi: 'Arsip sertifikat dan piagam penghargaan yang diterbitkan atau diterima PMI Sumatera Barat.',
  tombol: '+ Catat Sertifikat / Piagam',
  cari: 'Cari nomor / penerima / keterangan...',
  csvPrefix: 'sertifikat-piagam',
  kodeNomor: f => (f.kategori === 'Piagam' ? 'PIAGAM' : 'SERT'),
  masaBerlaku: false,
  fields: [
    { k: 'kategori', label: 'Jenis', type: 'select', opts: ['Sertifikat', 'Piagam'], req: true },
    { k: 'tanggal', label: 'Tanggal Terbit', type: 'date', req: true },
    { k: 'nomor', label: 'Nomor Sertifikat / Piagam', type: 'text', req: true, ph: '001/SERT/PMI-SB/X/2026' },
    { k: 'pihak', label: 'Nama Penerima', type: 'text', req: true, ph: 'Nama orang / instansi penerima' },
    { k: 'judul', label: 'Dalam Rangka / Keterangan Penghargaan', type: 'text', req: true },
    { k: 'penerbit', label: 'Diterbitkan Oleh', type: 'text', ph: 'PMI Pusat / PMI Prov. Sumbar / dll' },
    { k: 'keterangan', label: 'Catatan', type: 'textarea' },
  ],
  columns: [
    { label: 'Tanggal', render: r => tgl(r.tanggal) },
    { label: 'Jenis', k: 'kategori' },
    { label: 'No. Dokumen', k: 'nomor' },
    { label: 'Penerima', k: 'pihak' },
    { label: 'Dalam Rangka', k: 'judul' },
    { label: 'Diterbitkan Oleh', k: 'penerbit' },
  ],
}

export default function Page() { return <DokumenPage config={config} /> }
