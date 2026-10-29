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
  selesai: { label: 'Selesai · diarsipkan', style: { background: 'var(--stock-bg)', color: 'var(--stock)' } },
}

export const tabelBelumAda = err => !!err && (err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST200' || err.code === '42703' || /does not exist|schema cache|relationship/i.test(err.message || ''))
export const PESAN_MIGRASI = 'Fitur ini butuh pembaruan database. Jalankan file supabase/migrasi-disposisi-pemantauan.sql di Supabase (SQL Editor) satu kali.'

export function unduhCsv(namaFile, header, baris) {
  const esc = v => { const s = String(v ?? '').replace(/"/g, '""'); return /[;"\n]/.test(s) ? `"${s}"` : s }
  const csv = '\uFEFF' + [header, ...baris].map(r => r.map(esc).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  const a = document.createElement('a')
  a.href = url; a.download = `${namaFile}-${hariIni()}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export async function unggahBerkas(supabase, file) {
  const nama = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
  const { error } = await supabase.storage.from('bukti-surat').upload(nama, file)
  if (error) throw new Error('Gagal unggah file: ' + error.message)
  return supabase.storage.from('bukti-surat').getPublicUrl(nama).data.publicUrl
}
