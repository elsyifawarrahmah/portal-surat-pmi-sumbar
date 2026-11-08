// Format tanggal/waktu, status, dan unduh CSV yang dipakai banyak halaman.
export const hariIni = () => new Date().toISOString().slice(0, 10)

export function fmtTgl(v) {
  if (!v) return '-'
  const d = new Date(String(v).length <= 10 ? v + 'T00:00:00' : v)
  return isNaN(d) ? String(v) : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}
export function fmtWaktu(v) {
  if (!v) return '-'
  const d = new Date(v)
  return isNaN(d) ? String(v) : d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')
}
export const hariSejak = v => (v ? Math.floor((Date.now() - new Date(v).getTime()) / 86400000) : null)
export const sudahLewat = tgl => !!tgl && tgl < hariIni()

export const STATUS_DISPOSISI = {
  menunggu: { label: 'Menunggu', style: { background: '#FBE7E7', color: '#B3261E' } },
  dibaca: { label: 'Sudah dibaca', style: { background: 'var(--gold-bg)', color: 'var(--gold)' } },
  diproses: { label: 'Sedang diproses', style: { background: '#E4EEF9', color: '#1F5E99' } },
  selesai: { label: 'Selesai · masuk arsip', style: { background: '#E7F4EA', color: '#2E7D32' } },
  diarsip: { label: 'Diarsipkan', style: { background: 'var(--stock-bg)', color: 'var(--stock)' } },
}
// Status yang ditampilkan: selesai + sudah diarsipkan Biro Umum = "diarsip"
export const statusTampil = t => (t.status === 'selesai' && t.diarsipkan_pada ? 'diarsip' : t.status)

export const tabelBelumAda = err => !!err && (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST200' || err.code === '42703' || /does not exist|schema cache|relationship/i.test(err.message || ''))
export const PESAN_MIGRASI = 'Bagian ini belum bisa dipakai. Mohon beri tahu admin web agar diperbaiki.'
// Pesan galat untuk orang awam; keterangan teknis ditaruh di akhir kalimat supaya admin bisa membacanya dari screenshot
export function pesanGalat(err) {
  const detail = err && err.message ? ` (Keterangan untuk admin: ${err.message}${err.code ? ' [' + err.code + ']' : ''})` : ''
  return 'Data belum bisa ditampilkan. Mohon beri tahu admin web agar diperbaiki.' + detail
}

// Nama lama dipertahankan agar semua halaman tetap jalan; hasilnya sekarang file Excel (.xlsx) yang rapi.
export async function unduhCsv(namaFile, header, baris) {
  const { unduhXlsx } = await import('@/lib/excel')
  await unduhXlsx(`${namaFile}-${hariIni()}`, header, baris, namaFile)
}

export async function unggahBerkas(supabase, file, jenis = 'surat') {
  const { unggahSatu } = await import('./berkas')
  return (await unggahSatu(supabase, [file], jenis)).url
}
