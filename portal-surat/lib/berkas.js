// Aturan unggah berkas: HANYA 1 file, jenis & ukuran dibatasi, foto besar dikecilkan otomatis supaya cepat dibuka di HP.
export const BATAS = {
  surat: { min: 10 * 1024, maks: 5 * 1024 * 1024, tipe: ['pdf', 'jpg', 'jpeg', 'png', 'webp'], nama: 'PDF, JPG, atau PNG' },
  // Dokumen PDF utuh (surat lebih dari 2 lembar): hanya PDF, batas ukuran lebih longgar daripada foto
  dokumen: { min: 10 * 1024, maks: 15 * 1024 * 1024, tipe: ['pdf'], nama: 'PDF' },
  foto: { min: 5 * 1024, maks: 2 * 1024 * 1024, tipe: ['jpg', 'jpeg', 'png', 'webp'], nama: 'JPG atau PNG' },
}
const SISI_MAKS = { surat: 1800, foto: 512 }
const BATAS_ASLI = 30 * 1024 * 1024   // foto mentah di atas ini ditolak sebelum diproses (menjaga memori HP)

export const ketHint = (jenis = 'surat') => {
  const b = BATAS[jenis]
  if (jenis === 'dokumen') return `Khusus file PDF · tiap file minimal ${Math.round(b.min / 1024)} KB, maksimal ${Math.round(b.maks / 1048576)} MB. Boleh lebih dari 1 file. Cocok untuk surat yang lebih dari 2 lembar (scan jadi 1 PDF, tidak perlu banyak foto).`
  return `Boleh lebih dari 1 file (${b.nama}) · tiap file minimal ${Math.round(b.min / 1024)} KB, maksimal ${Math.round(b.maks / 1048576)} MB.` + (jenis === 'surat' ? ' Foto yang besar dikecilkan otomatis.' : ' Foto dipotong persegi dan dikecilkan otomatis.')
}
const ukuran = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')
const ekstensi = f => ((f.name || '').split('.').pop() || '').toLowerCase()

async function muatGambar(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch (e) { /* lanjut ke cara lama */ }
  }
  return await new Promise((ok, gagal) => {
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Foto tidak bisa dibaca. Coba foto ulang.')) }
    img.src = url
  })
}

async function kecilkan(file, sisiMaks, persegi, kualitas = 0.82) {
  const img = await muatGambar(file)
  const w = img.width, h = img.height
  let sx = 0, sy = 0, sw = w, sh = h
  if (persegi) { const s = Math.min(w, h); sx = (w - s) / 2; sy = (h - s) / 2; sw = sh = s }
  const skala = Math.min(1, sisiMaks / Math.max(sw, sh))
  if (!persegi && skala >= 1 && file.size <= 800 * 1024) return file   // sudah cukup kecil: biarkan apa adanya
  const cw = Math.round(sw * skala), ch = Math.round(sh * skala)
  const kanvas = document.createElement('canvas'); kanvas.width = cw; kanvas.height = ch
  const ctx = kanvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
  const blob = await new Promise(r => kanvas.toBlob(r, 'image/jpeg', kualitas))
  if (!blob) throw new Error('Foto tidak bisa diproses. Coba foto ulang.')
  const nama = (file.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], nama, { type: 'image/jpeg' })
}

// Menerima FileList/array. Mengembalikan File siap unggah, atau melempar Error berbahasa awam.
export async function siapkanBerkas(daftar, jenis = 'surat') {
  const b = BATAS[jenis]
  const files = Array.from(daftar || [])
  if (files.length === 0) throw new Error('Belum ada file yang dipilih.')
  if (files.length > 1) throw new Error('Pilih 1 file saja. Kalau suratnya beberapa halaman, gabungkan dulu jadi 1 file PDF.')
  let f = files[0]
  const ext = ekstensi(f)
  if (!b.tipe.includes(ext)) throw new Error(`Jenis file tidak bisa dipakai (.${ext || '?'}). Gunakan ${b.nama}.`)
  if (f.size < b.min) throw new Error(`File terlalu kecil (${ukuran(f.size)}), kemungkinan kosong atau rusak. Minimal ${Math.round(b.min / 1024)} KB.`)
  const gambar = ext !== 'pdf'
  if (gambar) {
    if (f.size > BATAS_ASLI) throw new Error(`Foto terlalu besar (${ukuran(f.size)}). Maksimal ${ukuran(BATAS_ASLI)}.`)
    f = await kecilkan(f, SISI_MAKS[jenis], jenis === 'foto')
  }
  if (f.size > b.maks) throw new Error(`File terlalu besar (${ukuran(f.size)}). Maksimal ${ukuran(b.maks)}.${gambar ? ' Coba foto ulang dengan jarak lebih dekat.' : ' Kecilkan dulu PDF-nya.'}`)
  return f
}

// Validasi + (kecilkan) + unggah. Mengembalikan { url, nama, ukuran }.
export async function unggahSatu(supabase, daftar, jenis = 'surat', awalan = '') {
  const f = await siapkanBerkas(daftar, jenis)
  const nama = `${awalan}${Date.now()}-${f.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
  const { error } = await supabase.storage.from('bukti-surat').upload(nama, f)
  if (error) throw new Error('Gagal mengunggah file: ' + error.message)
  return { url: supabase.storage.from('bukti-surat').getPublicUrl(nama).data.publicUrl, nama: f.name, ukuran: f.size, path: nama }
}

export async function hapusBerkasLama(supabase, url) {
  try {
    const m = String(url || '').match(/\/bukti-surat\/(.+)$/)
    if (m) await supabase.storage.from('bukti-surat').remove([decodeURIComponent(m[1])])
  } catch (e) { /* tidak apa-apa bila gagal */ }
}

// ---- Banyak file sekaligus (lampiran surat). Tiap file divalidasi sendiri-sendiri; yang gagal dilaporkan, yang lolos tetap terunggah. ----
export const MAKS_LAMPIRAN = 10
export async function unggahBanyak(supabase, daftar, jenis = 'surat', awalan = '') {
  const files = Array.from(daftar || [])
  if (files.length === 0) throw new Error('Belum ada file yang dipilih.')
  if (files.length > MAKS_LAMPIRAN) throw new Error(`Maksimal ${MAKS_LAMPIRAN} file sekali pilih.`)
  const berhasil = [], gagal = []
  for (const f of files) {
    try { berhasil.push(await unggahSatu(supabase, [f], jenis, awalan)) }
    catch (e) { gagal.push(`${f.name}: ${e.message}`) }
  }
  return { berhasil, gagal }
}

// Simpan hasil unggah ke tabel surat_lampiran. Mengembalikan galat (atau null).
export async function simpanLampiran(supabase, jenis, suratId, hasil) {
  if (!hasil.length) return null
  const { error } = await supabase.from('surat_lampiran').insert(hasil.map(h => ({ jenis, surat_id: suratId, url: h.url, nama: h.nama, ukuran: h.ukuran })))
  return error || null
}

// ===== Berkas privat: alamat tersimpan tetap sama, tetapi dibuka lewat alamat sementara bertanda tangan =====
const AWALAN_PUBLIK = '/storage/v1/object/public/bukti-surat/'
const simpanan = new Map()
export function namaDariUrl(url) { try { return decodeURIComponent(String(url || '').split('?')[0].split('/').pop()) } catch { return '' } }
export async function urlAman(supabase, url) {
  if (!url) return url
  const i = String(url).indexOf(AWALAN_PUBLIK)
  if (i < 0) return url            // bukan berkas bucket ini (mis. data URL tanda tangan)
  const path = decodeURIComponent(String(url).slice(i + AWALAN_PUBLIK.length).split('?')[0])
  const c = simpanan.get(path)
  if (c && c.exp > Date.now()) return c.url
  const { data, error } = await supabase.storage.from('bukti-surat').createSignedUrl(path, 3600)
  if (error || !data?.signedUrl) return url
  simpanan.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 })
  return data.signedUrl
}
