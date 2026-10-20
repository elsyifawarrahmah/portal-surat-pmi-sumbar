// Unduh banyak berkas (PDF/foto bukti) sekaligus dalam satu file ZIP, plus daftar CSV-nya.
// rows: data yang punya file_bukti_url. Berkas tanpa file dilewati.
export async function unduhBerkasZip({ rows, namaFile, daftarHeader, daftarBaris, namaZip, onProgress }) {
  const target = rows.filter(r => r.file_bukti_url)
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const dipakai = new Set()
  const gagal = []
  let selesai = 0
  onProgress && onProgress({ n: 0, total: target.length })

  const kerjakan = async (r) => {
    try {
      const res = await fetch(r.file_bukti_url)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const blob = await res.blob()
      const ext = (r.file_bukti_url.split('?')[0].split('.').pop() || 'pdf').toLowerCase().slice(0, 5)
      const dasar = String(namaFile(r) || 'berkas').replace(/[^a-zA-Z0-9_\-]+/g, '-').replace(/-+/g, '-')
      let unik = dasar, i = 2
      while (dipakai.has(unik)) unik = `${dasar}-${i++}`
      dipakai.add(unik)
      zip.file(`${unik}.${ext}`, blob)
    } catch (e) {
      gagal.push(`${namaFile(r)} (${r.file_bukti_url})`)
    }
    selesai++
    onProgress && onProgress({ n: selesai, total: target.length })
  }
  for (let i = 0; i < target.length; i += 4) await Promise.all(target.slice(i, i + 4).map(kerjakan))

  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = '\uFEFF' + [daftarHeader.map(esc).join(';'), ...daftarBaris.map(b => b.map(esc).join(';'))].join('\n')
  zip.file('daftar.csv', csv)
  if (gagal.length) zip.file('GAGAL-diunduh.txt', gagal.join('\n'))

  const isi = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(isi)
  const a = document.createElement('a')
  a.href = url; a.download = `${namaZip}-${new Date().toISOString().slice(0, 10)}.zip`
  a.click(); URL.revokeObjectURL(url)
  return { gagal, total: target.length }
}
