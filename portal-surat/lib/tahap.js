// Alur perjalanan surat masuk.
// Biro Umum -> Sekretaris -> Kepala Markas -> (tahap lain bila perlu) -> Bidang/Divisi Tujuan
// -> Pengarsipan -> kembali ke Biro Umum.
export const TAHAP_DEFAULT = [
  'Biro Umum',
  'Sekretaris',
  'Kepala Markas',
  'Ketua / Ketua Bidang',
  'Bidang / Divisi Tujuan',
  'Pengarsipan',
  'Biro Umum (Arsip Kembali)',
]

// Nama tahap lama (sudah tersimpan di database) ditampilkan dengan nama baru.
const LABEL_LAMA = {
  'Ketua Markas': 'Kepala Markas',
  'Ketua': 'Ketua / Ketua Bidang',
  'Divisi Tujuan': 'Bidang / Divisi Tujuan',
}
export const labelTahap = n => LABEL_LAMA[n] || n

export const isKepalaMarkas = n => /(kepala|ketua) markas/i.test(n || '')
export const isTujuan = n => /tujuan/i.test(n || '')
export const isPengarsipan = n => /pengarsipan/i.test(n || '')
