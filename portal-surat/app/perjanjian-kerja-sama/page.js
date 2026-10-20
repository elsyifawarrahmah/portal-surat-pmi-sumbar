'use client'
import DokumenPage, { tgl } from '@/components/DokumenPage'

const config = {
  jenis: 'pks',
  judul: 'Perjanjian Kerja Sama',
  deskripsi: 'Arsip perjanjian kerja sama PMI Sumatera Barat dengan mitra, lengkap dengan masa berlaku.',
  tombol: '+ Catat Perjanjian',
  cari: 'Cari nomor / mitra / tentang...',
  csvPrefix: 'perjanjian-kerja-sama',
  kodeNomor: 'PKS',
  masaBerlaku: true,
  fields: [
    { k: 'tanggal', label: 'Tanggal Perjanjian', type: 'date', req: true },
    { k: 'nomor', label: 'Nomor Perjanjian', type: 'text', req: true, ph: '001/PKS/PMI-SB/X/2026' },
    { k: 'divisi', label: 'Bidang / Divisi / Biro', type: 'text', req: true, saran: true, ph: 'Biro Umum / nama bidang' },
    { k: 'pihak', label: 'Pihak Kedua / Mitra', type: 'text', req: true, ph: 'Nama instansi / lembaga mitra' },
    { k: 'judul', label: 'Tentang (Ruang Lingkup Kerja Sama)', type: 'text', req: true },
    { k: 'tanggal_mulai', label: 'Berlaku Mulai', type: 'date' },
    { k: 'tanggal_berakhir', label: 'Berlaku Sampai', type: 'date' },
    { k: 'keterangan', label: 'Keterangan', type: 'textarea' },
  ],
  columns: [
    { label: 'Tanggal', render: r => tgl(r.tanggal) },
    { label: 'No. Perjanjian', k: 'nomor' },
    { label: 'Bidang/Divisi/Biro', k: 'divisi' },
    { label: 'Pihak Kedua / Mitra', k: 'pihak' },
    { label: 'Tentang', k: 'judul' },
    { label: 'Masa Berlaku', render: r => (r.tanggal_mulai || r.tanggal_berakhir) ? `${tgl(r.tanggal_mulai)} – ${tgl(r.tanggal_berakhir)}` : '-' },
  ],
}

export default function Page() { return <DokumenPage config={config} /> }
