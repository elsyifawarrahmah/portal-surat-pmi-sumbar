// Unduh sebagai file Excel asli (.xlsx): kolom langsung rapi, tidak bergantung pada pengaturan koma / titik koma di komputer.
export async function buatXlsxBuffer(header, baris, namaSheet = 'Data') {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.aoa_to_sheet([header, ...baris.map(r => r.map(v => v ?? ''))])
  ws['!cols'] = header.map((h, i) => ({ wch: Math.min(60, Math.max(10, String(h).length + 2, ...baris.slice(0, 200).map(r => String(r[i] ?? '').length + 2))) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, String(namaSheet).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Data')
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
}
export async function unduhXlsx(namaFile, header, baris, namaSheet) {
  const buf = await buatXlsxBuffer(header, baris, namaSheet)
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${namaFile}.xlsx`; a.click(); URL.revokeObjectURL(url)
}
