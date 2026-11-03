'use client'
// Formulir kata sandi baru (dipakai di halaman Profil dan halaman atur ulang sandi)
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function GantiSandi({ onSelesai, tombol = 'Simpan kata sandi baru' }) {
  const supabase = createClient()
  const [baru, setBaru] = useState('')
  const [ulang, setUlang] = useState('')
  const [lihat, setLihat] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState(false)
  const [sibuk, setSibuk] = useState(false)

  async function simpan(e) {
    e.preventDefault(); setError(''); setOk(false)
    if (baru.length < 6) { setError('Kata sandi minimal 6 karakter.'); return }
    if (baru !== ulang) { setError('Kedua kata sandi belum sama. Coba ketik lagi.'); return }
    setSibuk(true)
    const { error: err } = await supabase.auth.updateUser({ password: baru })
    setSibuk(false)
    if (err) { setError(/same|different/i.test(err.message) ? 'Kata sandi baru harus berbeda dari yang lama.' : 'Belum bisa disimpan: ' + err.message); return }
    setOk(true); setBaru(''); setUlang('')
    onSelesai && onSelesai()
  }
  return (
    <form onSubmit={simpan}>
      {error && <div className="error-box">{error}</div>}
      {ok && <div style={{ background: 'var(--stock-bg)', color: 'var(--stock)', padding: '10px 14px', borderRadius: 10, fontWeight: 700, marginBottom: 12 }}>✓ Kata sandi sudah diganti.</div>}
      <div className="field"><label>Kata sandi baru</label><input type={lihat ? 'text' : 'password'} value={baru} onChange={e => setBaru(e.target.value)} minLength={6} required placeholder="minimal 6 karakter" style={{ fontSize: 16, minHeight: 50 }} autoComplete="new-password" /></div>
      <div className="field"><label>Ketik sekali lagi</label><input type={lihat ? 'text' : 'password'} value={ulang} onChange={e => setUlang(e.target.value)} minLength={6} required style={{ fontSize: 16, minHeight: 50 }} autoComplete="new-password" /></div>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', fontSize: 14, color: 'var(--ink)', margin: '0 0 12px' }}><input type="checkbox" style={{ width: 18, height: 18 }} checked={lihat} onChange={e => setLihat(e.target.checked)} /> Tampilkan kata sandi</label>
      <button className="btn btn-primary" style={{ minHeight: 50, fontSize: 16, width: '100%' }} disabled={sibuk}>{sibuk ? 'Menyimpan...' : tombol}</button>
    </form>
  )
}
