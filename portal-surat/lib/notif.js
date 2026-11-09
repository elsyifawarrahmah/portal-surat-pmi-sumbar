// Beri tahu penerima lewat notifikasi HP. Dipanggil setelah surat diteruskan / diajukan / diparaf / disetujui.
// Gagal tidak masalah (misalnya notifikasi belum disiapkan): tidak mengganggu pekerjaan utama.
export function kabarkan(jenis, id) {
  try {
    fetch('/api/notif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jenis, id }), keepalive: true }).catch(() => {})
  } catch (e) {}
}
