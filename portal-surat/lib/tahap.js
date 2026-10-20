// Alur perjalanan surat masuk.
// Biro Umum -> Sekretaris -> Kepala Markas -> (tahap lain bila perlu) -> Bidang/Divisi Tujuan
// -> Selesai (dicatat saat bidang/divisi tujuan menyatakan proses selesai)
// -> Pengarsipan oleh Biro Umum -> kembali ke Biro Umum.
export const TAHAP_DEFAULT = [
  'Biro Umum',
  'Sekretaris',
  'Kepala Markas',
  'Ketua / Ketua Bidang',
  'Bidang / Divisi Tujuan',
  'Selesai',
  'Pengarsipan',
  'Biro Umum (Arsip Kembali)',
]

// Nama tahap lama (sudah tersimpan di database) ditampilkan dengan nama baru.
const LABEL_LAMA = {
  'Ketua Markas': 'Kepala Markas',
  'Ketua': 'Ketua / Ketua Bidang',
  'Divisi Tujuan': 'Bidang / Divisi Tujuan',
  'Pengarsipan': 'Pengarsipan oleh Biro Umum',
}
export const labelTahap = n => LABEL_LAMA[n] || n

export const isKepalaMarkas = n => /(kepala|ketua) markas/i.test(n || '')
export const isTujuan = n => /tujuan/i.test(n || '')
export const isSelesai = n => /^selesai$/i.test((n || '').trim())
export const isPengarsipan = n => /pengarsipan/i.test(n || '')

// Status ringkas surat masuk berdasarkan tahapannya (untuk kolom Status di daftar)
export function statusSurat(list) {
  if (!list || list.length === 0) return null
  const urut = [...list].sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
  const selesai = urut.find(t => isSelesai(t.nama_tahap))
  const adaArsip = urut.some(t => isPengarsipan(t.nama_tahap))
  if (urut.every(t => t.tanggal_diteruskan)) {
    return { label: adaArsip ? 'Selesai & diarsipkan' : 'Selesai (belum diarsip)', tone: 'ok' }
  }
  if (selesai && selesai.tanggal_diteruskan) return { label: 'Selesai · menunggu diarsip Biro Umum', tone: 'ok' }
  const sedang = urut.find(t => t.tanggal_diterima && !t.tanggal_diteruskan)
  if (sedang) return { label: 'Di: ' + labelTahap(sedang.nama_tahap), tone: 'proses' }
  return { label: 'Menunggu tahap berikutnya', tone: 'proses' }
}
