// Istilah & aturan tampilan "gaya Srikandi": status sederhana, petunjuk disposisi, dsb.
export const PETUNJUK = ['Tindaklanjuti', 'Hadiri', 'Wakili', 'Koordinasikan', 'Untuk diketahui', 'Mohon tanggapan / balas surat', 'Arsipkan']
// Keputusan pimpinan: tinggal sentuh (tidak perlu mengetik)
export const KEPUTUSAN = [
  { k: 'Setuju', ikon: '✅', petunjuk: 'Tindaklanjuti' },
  { k: 'Tidak setuju', ikon: '❌', petunjuk: '' },
  { k: 'Ditunda dulu', ikon: '⏸️', petunjuk: '' },
  { k: 'Dikaji dulu', ikon: '🔎', petunjuk: 'Koordinasikan' },
]
export const KALIMAT_PESAN = ['Segera laporkan hasilnya', 'Koordinasikan dengan bidang terkait', 'Hadir mewakili saya', 'Sesuai aturan yang berlaku', 'Laporkan setelah selesai']
export const KALIMAT_TOLAK = ['Isi surat perlu diperbaiki', 'Nomor atau tanggal surat belum tepat', 'Tujuan surat kurang tepat', 'Lampiran belum lengkap', 'Mohon dilengkapi dulu']
export const KALIMAT_SELESAI = ['Sudah dikerjakan', 'Sudah dikoordinasikan', 'Sudah dilaporkan', 'Sudah dihadiri', 'Surat jawaban sudah dikirim']
export const SIFAT_DISPOSISI = ['Biasa', 'Segera', 'Sangat Segera']

export function susunInstruksi(sifat, petunjuk, pesan, keputusan) {
  return [sifat && sifat !== 'Biasa' ? `[${sifat}]` : '', keputusan ? keputusan.toUpperCase() + '.' : '', petunjuk, pesan ? (keputusan || petunjuk ? '— ' : '') + pesan.trim() : ''].filter(Boolean).join(' ')
}

export const STATUS_SURAT = {
  belum: { label: 'Belum dibaca', bg: '#FBE7E7', fg: '#B3261E' },
  proses: { label: 'Sedang dikerjakan', bg: '#E4EEF9', fg: '#1F5E99' },
  selesai: { label: 'Selesai', bg: '#E7F4EA', fg: '#2E7D32' },
  arsip: { label: 'Diarsipkan', bg: 'var(--stock-bg)', fg: 'var(--stock)' },
  belum_diteruskan: { label: 'Belum diteruskan', bg: 'var(--gold-bg)', fg: 'var(--gold)' },
  berjalan: { label: 'Sedang berjalan', bg: '#E4EEF9', fg: '#1F5E99' },
}
export const TAB_ISI = { belum: ['belum', 'belum_diteruskan'], proses: ['proses', 'berjalan'], selesai: ['selesai', 'arsip'] }

// Status sebuah surat "bagi saya": kalau unit saya penerima, lihat status unit saya; kalau tidak (Sekretariat/Biro Umum/admin), lihat keseluruhan
export function statusUntukSaya(tujuan, unitId) {
  const mine = unitId ? tujuan.filter(t => t.unit_id === unitId) : []
  if (mine.length > 0) {
    if (mine.some(t => t.status === 'menunggu')) return 'belum'
    if (mine.some(t => t.status === 'dibaca' || t.status === 'diproses')) return 'proses'
    return mine.every(t => t.diarsipkan_pada) ? 'arsip' : 'selesai'
  }
  if (tujuan.length === 0) return 'belum_diteruskan'
  if (tujuan.some(t => t.status !== 'selesai')) return 'berjalan'
  return tujuan.every(t => t.diarsipkan_pada) ? 'arsip' : 'selesai'
}
