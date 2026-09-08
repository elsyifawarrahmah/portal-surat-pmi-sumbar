'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'

export default function BackupPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [lastBackup, setLastBackup] = useState(null)

  async function buatBackup() {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')

      const [suratMasuk, suratTahapan, suratKeluar, users, logAktivitas] = await Promise.all([
        supabase.from('surat_masuk').select('*, profiles:petugas_id(nama_lengkap)').order('tanggal_diterima_kantor', { ascending: false }),
        supabase.from('surat_tahapan').select('*'),
        supabase.from('surat_keluar').select('*, profiles:petugas_id(nama_lengkap)').order('tanggal_surat', { ascending: false }),
        supabase.from('profiles').select('nama_lengkap, email, role, last_seen'),
        supabase.from('log_aktivitas').select('*, profiles:dilakukan_oleh(nama_lengkap)').order('waktu', { ascending: false }).limit(1000),
      ])

      const wb = XLSX.utils.book_new()

      const sheetSuratMasuk = (suratMasuk.data || []).map(r => ({
        'Tanggal Diterima': r.tanggal_diterima_kantor, 'Tanggal Surat': r.tanggal_surat,
        'Nomor Surat': r.nomor_surat, 'Asal': r.asal_surat, 'Perihal': r.perihal,
        'Sifat': r.sifat, 'Petugas': r.profiles?.nama_lengkap || '', 'Link Bukti': r.file_bukti_url || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSuratMasuk), 'Surat Masuk')

      const sheetTahapan = (suratTahapan.data || []).map(r => ({
        'Surat ID': r.surat_id, 'Tahap': r.nama_tahap, 'Urutan': r.urutan,
        'Penerima': r.penerima_nama, 'Diterima': r.tanggal_diterima, 'Diteruskan': r.tanggal_diteruskan,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetTahapan), 'Alur Surat Masuk')

      const sheetSuratKeluar = (suratKeluar.data || []).map(r => ({
        'Tanggal': r.tanggal_surat, 'Nomor Surat': r.nomor_surat, 'Tujuan': r.tujuan_surat,
        'Perihal': r.perihal, 'Sifat': r.sifat, 'Petugas': r.profiles?.nama_lengkap || '', 'Link Bukti': r.file_bukti_url || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSuratKeluar), 'Surat Keluar')

      const sheetUsers = (users.data || []).map(r => ({
        'Nama': r.nama_lengkap, 'Email': r.email, 'Role': r.role,
        'Terakhir Aktif': r.last_seen ? new Date(r.last_seen).toLocaleString('id-ID') : '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetUsers), 'Data User')

      const sheetLog = (logAktivitas.data || []).map(r => ({
        'Waktu': new Date(r.waktu).toLocaleString('id-ID'), 'Tabel': r.tabel, 'Aksi': r.aksi,
        'Ringkasan': r.ringkasan, 'Oleh': r.profiles?.nama_lengkap || 'Sistem',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetLog), 'Log Aktivitas')

      const filename = `Backup-Portal-Surat-PMI-Sumbar-${new Date().toISOString().slice(0,10)}.xlsx`
      XLSX.writeFile(wb, filename)
      setLastBackup(new Date())
    } catch (e) {
      alert('Gagal membuat backup: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <div className="topbar">
          <div><h1>Backup Data</h1><p className="desc">Unduh semua data sekaligus dalam satu file Excel, sebagai arsip cadangan.</p></div>
        </div>

        <div className="panel">
          <div className="panel-body" style={{padding:28, textAlign:'center'}}>
            <div style={{fontSize:40, marginBottom:10}}>🗄️</div>
            <h3 style={{margin:'0 0 8px'}}>Backup Lengkap Portal Surat</h3>
            <p style={{color:'var(--ink-soft)', fontSize:13.5, maxWidth:440, margin:'0 auto 20px'}}>
              File Excel ini berisi 5 sheet: Surat Masuk, Alur Surat Masuk, Surat Keluar, Data User, dan Log Aktivitas.
              Simpan file ini secara berkala (misal tiap minggu) di komputer/Google Drive kantor sebagai cadangan.
            </p>
            <button className="btn btn-primary" onClick={buatBackup} disabled={loading} style={{padding:'12px 28px', fontSize:14}}>
              {loading ? 'Menyiapkan file...' : '⬇ Buat & Unduh Backup Sekarang'}
            </button>
            {lastBackup && (
              <div style={{marginTop:14, fontSize:12.5, color:'var(--stock)'}}>
                ✓ Backup terakhir dibuat: {lastBackup.toLocaleString('id-ID')}
              </div>
            )}
          </div>
        </div>

        <div style={{fontSize:12, color:'var(--ink-soft)', background:'var(--cream)', padding:12, borderRadius:10}}>
          💡 <strong>Saran:</strong> jadwalkan 1 orang (misal Sekretaris) untuk klik tombol ini setiap hari Jumat, lalu simpan filenya di Google Drive bersama PMI Sumbar. Ini jaga-jaga kalau ada masalah teknis di server.
        </div>
      </div>
    </div>
  )
}
