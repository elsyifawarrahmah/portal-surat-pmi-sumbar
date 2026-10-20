// Kode singkat divisi/biro untuk nomor surat, mis. "Biro Umum" -> "BU",
// "Bidang Penanggulangan Bencana" -> "BPB". Bisa diubah manual di kolom nomor.
export function kodeDivisi(nama) {
  const abaikan = new Set(['dan', '&', 'serta', 'pmi', 'provinsi', 'sumatera', 'barat'])
  return String(nama || '')
    .split(/\s+/)
    .filter(w => w && !abaikan.has(w.toLowerCase()))
    .map(w => w[0].toUpperCase())
    .join('')
}
