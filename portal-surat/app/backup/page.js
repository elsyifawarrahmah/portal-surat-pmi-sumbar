'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function BackupPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [lastBackup, setLastBackup] = useState(null)

  async function buatBackup() {
    setLoading(true)
    try {
      const XLSX = await import('xlsx')

      const [suratMasuk, suratTahapan, suratKeluar, users, logAktivitas, arsip, catatanArsip, disposisi, tujuanDisp, panggilan, riwayat, ekspedisi, saran, unitData] = await Promise.all([
        supabase.from('surat_masuk').select('*, profiles:petugas_id(nama_lengkap)').order('tanggal_diterima_kantor', { ascending: false }),
        supabase.from('surat_tahapan').select('*'),
        supabase.from('surat_keluar').select('*, profiles:petugas_id(nama_lengkap)').order('tanggal_surat', { ascending: false }),
        supabase.from('profiles').select('nama_lengkap, email, role, last_seen'),
        supabase.from('log_aktivitas').select('*, profiles:dilakukan_oleh(nama_lengkap)').order('waktu', { ascending: false }).limit(1000),
        supabase.from('arsip_dokumen').select('*, profiles:petugas_id(nama_lengkap)').order('tanggal', { ascending: false }),
        supabase.from('arsip_catatan').select('*, profiles:diarsip_oleh(nama_lengkap)').order('tanggal_arsip', { ascending: false }),
        supabase.from('surat_disposisi').select('*, surat:surat_masuk(nomor_surat, nomor_agenda, perihal)').order('created_at', { ascending: false }),
        supabase.from('surat_disposisi_tujuan').select('*, unit:surat_unit(nama), disposisi:surat_disposisi(surat_id, dari_nama, tanggal_diteruskan, surat:surat_masuk(nomor_surat, nomor_agenda, perihal))').order('created_at', { ascending: false }),
        supabase.from('surat_panggilan').select('*, unit:surat_unit(nama)').order('created_at', { ascending: false }),
        supabase.from('surat_riwayat').select('*').order('waktu', { ascending: false }).limit(20000),
        supabase.from('surat_ekspedisi').select('*, surat:surat_keluar(nomor_surat, nomor_agenda, tujuan_surat, perihal)').order('created_at', { ascending: false }),
        supabase.from('surat_saran').select('*').order('created_at', { ascending: false }),
        supabase.from('surat_unit').select('*').order('urut'),
      ])

      const wb = XLSX.utils.book_new()

      const sheetSuratMasuk = (suratMasuk.data || []).map(r => ({
        'Tanggal Diterima': r.tanggal_diterima_kantor, 'Tanggal Surat': r.tanggal_surat,
        'Nomor Agenda': r.nomor_agenda || '', 'Macam Surat': r.macam_surat || '', 'Lampiran': r.lampiran || '', 'Nomor Surat': r.nomor_surat, 'Asal': r.asal_surat, 'Perihal': r.perihal,
        'Sifat': r.sifat, 'Petugas': r.profiles?.nama_lengkap || '', 'Link Bukti': r.file_bukti_url || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSuratMasuk), 'Surat Masuk')

      const sheetTahapan = (suratTahapan.data || []).map(r => ({
        'Surat ID': r.surat_id, 'Tahap': r.nama_tahap, 'Urutan': r.urutan,
        'Penerima': r.penerima_nama, 'Diterima': r.tanggal_diterima, 'Diteruskan': r.tanggal_diteruskan,
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetTahapan), 'Alur Surat Masuk')

      const sheetSuratKeluar = (suratKeluar.data || []).map(r => ({
        'Tanggal': r.tanggal_surat, 'Nomor Agenda': r.nomor_agenda || '', 'Nomor Surat': r.nomor_surat, 'Divisi/Biro': r.divisi || '', 'Tujuan': r.tujuan_surat,
        'Perihal': r.perihal, 'Sifat': r.sifat, 'Petugas': r.profiles?.nama_lengkap || '', 'Link Bukti': r.file_bukti_url || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSuratKeluar), 'Surat Keluar')

      // Perjanjian Kerja Sama, Sertifikat & Piagam, Surat Keputusan (dari tabel arsip_dokumen;
      // kalau tabelnya belum dibuat, sheet-nya kosong dan backup lain tetap jalan)
      const arsipRows = arsip.data || []
      const sheetPks = arsipRows.filter(r => r.jenis === 'pks').map(r => ({
        'Tanggal': r.tanggal, 'Nomor Perjanjian': r.nomor, 'Bidang/Divisi/Biro': r.divisi || '', 'Pihak Kedua / Mitra': r.pihak, 'Tentang': r.judul,
        'Berlaku Mulai': r.tanggal_mulai || '', 'Berlaku Sampai': r.tanggal_berakhir || '', 'Keterangan': r.keterangan || '',
        'Petugas': r.profiles?.nama_lengkap || '', 'Link Dokumen': r.file_bukti_url || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetPks), 'Perjanjian Kerja Sama')

      const sheetSertifikat = arsipRows.filter(r => r.jenis === 'sertifikat').map(r => ({
        'Tanggal Terbit': r.tanggal, 'Jenis': r.kategori || '', 'Nomor': r.nomor, 'Penerima': r.pihak,
        'Nama Kegiatan': r.judul, 'Diterbitkan Oleh': r.penerbit || '', 'Catatan': r.keterangan || '',
        'Petugas': r.profiles?.nama_lengkap || '', 'Link Dokumen': r.file_bukti_url || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSertifikat), 'Sertifikat & Piagam')

      const sheetSk = arsipRows.filter(r => r.jenis === 'sk').map(r => ({
        'Tanggal': r.tanggal, 'Nomor SK': r.nomor, 'Bidang/Divisi/Biro': r.divisi || '', 'Tentang': r.judul, 'Ditetapkan Oleh': r.penerbit || '',
        'Berlaku Mulai': r.tanggal_mulai || '', 'Berlaku Sampai': r.tanggal_berakhir || '', 'Keterangan': r.keterangan || '',
        'Petugas': r.profiles?.nama_lengkap || '', 'Link Dokumen': r.file_bukti_url || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSk), 'Surat Keputusan')

      // Register arsip Biro Umum (lokasi simpan) — kosong bila tabel arsip_catatan belum dibuat
      const sheetArsip = (catatanArsip.data || []).map(r => ({
        'Jenis': r.jenis, 'ID Dokumen': r.ref_id, 'Lokasi Arsip': r.lokasi_arsip || '',
        'Tanggal Arsip': r.tanggal_arsip, 'Diarsip Oleh': r.profiles?.nama_lengkap || '', 'Catatan': r.catatan || '',
      }))
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetArsip), 'Register Arsip')

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

      // Disposisi, panggilan, riwayat, ekspedisi, kotak saran, unit (kosong bila database belum diperbarui)
      const sheet = (rows, nama) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), nama)
      sheet((tujuanDisp.data || []).map(t => ({ 'Tgl Diteruskan': t.disposisi?.tanggal_diteruskan || '', 'No. Agenda': t.disposisi?.surat?.nomor_agenda || '', 'No. Surat': t.disposisi?.surat?.nomor_surat || '', 'Perihal': t.disposisi?.surat?.perihal || '', 'Dari': t.disposisi?.dari_nama || '', 'Kepada': t.unit?.nama || '', 'Disposisi': t.instruksi || '', 'Perlu Jawaban': t.perlu_jawaban ? 'Ya' : 'Tidak', 'Batas Waktu': t.batas_waktu || '', 'Status': t.status, 'Dibaca': t.dibaca_pada || '', 'Selesai': t.selesai_pada || '', 'Diarsipkan Biro Umum': t.diarsipkan_pada || '', 'Tanggapan': t.tanggapan || '' })), 'Disposisi')
      sheet((disposisi.data || []).filter(d => d.file_scan_url).map(d => ({ 'No. Surat': d.surat?.nomor_surat || '', 'Tgl Diteruskan': d.tanggal_diteruskan, 'Dari': d.dari_nama || '', 'Link Scan Lembar Disposisi': d.file_scan_url })), 'Scan Disposisi')
      sheet((panggilan.data || []).map(p => ({ 'Waktu': p.created_at, 'Unit': p.unit?.nama || '', 'Jenis': p.jenis, 'Pesan': p.pesan || '', 'Dibaca': p.dibaca_pada || '', 'Selesai': p.selesai_pada || '', 'Balasan': p.balasan || '' })), 'Panggilan Biro Umum')
      sheet((riwayat.data || []).map(r => ({ 'Waktu': r.waktu, 'Jenis Surat': r.surat_jenis, 'Surat ID': r.surat_id, 'Kejadian': r.aksi, 'Keterangan': r.keterangan || '', 'Oleh': r.oleh_nama || '', 'Unit': r.unit_nama || '' })), 'Riwayat Surat')
      sheet((ekspedisi.data || []).map(e => ({ 'No. Surat': e.surat?.nomor_surat || '', 'No. Agenda': e.surat?.nomor_agenda || '', 'Tujuan': e.surat?.tujuan_surat || '', 'Tgl Kirim': e.tanggal_kirim, 'Via': e.dikirim_via, 'Penerima': e.penerima || '', 'Pengantar': e.pengantar || '', 'Status': e.status, 'Tgl Diterima': e.tanggal_diterima || '', 'Link Tanda Terima': e.tanda_terima_url || '', 'Catatan': e.catatan || '' })), 'Ekspedisi')
      sheet((saran.data || []).map(r => ({ 'Waktu': r.created_at, 'Kategori': r.kategori, 'Isi': r.isi, 'Pengirim': r.anonim ? 'Anonim' : (r.nama_pengirim || ''), 'Unit': r.unit_pengirim || '', 'Sumber': r.sumber, 'Status': r.status, 'Tanggapan': r.tanggapan || '' })), 'Kotak Saran')
      sheet((unitData.data || []).map(u => ({ 'Kode': u.kode, 'Nama Unit': u.nama, 'Jenis': u.tipe, 'Aktif': u.aktif ? 'Ya' : 'Tidak' })), 'Unit')

      XLSX.writeFile(wb, filename)
      setLastBackup(new Date())
    } catch (e) {
      alert('Gagal membuat backup: ' + e.message)
    }
    setLoading(false)
  }

  return (
    <div className="app">
      <div className="main">
        <div className="topbar">
          <div><h1>Backup Data</h1><p className="desc">Unduh semua data sekaligus dalam satu file Excel, sebagai arsip cadangan.</p></div>
        </div>

        <div className="panel">
          <div className="panel-body" style={{padding:28, textAlign:'center'}}>
            <div style={{fontSize:40, marginBottom:10}}>🗄️</div>
            <h3 style={{margin:'0 0 8px'}}>Backup Lengkap Portal Surat</h3>
            <p style={{color:'var(--ink-soft)', fontSize:13.5, maxWidth:440, margin:'0 auto 20px'}}>
              File Excel ini berisi 9 sheet: Surat Masuk, Alur Surat Masuk, Surat Keluar, Perjanjian Kerja Sama, Sertifikat & Piagam, Surat Keputusan, Register Arsip, Data User, dan Log Aktivitas.
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
