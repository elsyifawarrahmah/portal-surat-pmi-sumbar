'use client'
// Lupa kata sandi: kirim link ke email untuk membuat kata sandi baru.
import { useState } from 'react'
import Link from 'next/link'
import { createClient as buatKlien } from '@supabase/supabase-js'

export default function LupaSandi() {
  // Alur "implicit": link di email tidak terikat browser yang meminta, jadi bisa dibuka dari HP atau laptop mana pun.
  const supabase = buatKlien(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { flowType: 'implicit', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const [email, setEmail] = useState('')
  const [terkirim, setTerkirim] = useState(false)
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)

  async function kirim(e) {
    e.preventDefault(); setError(''); setSibuk(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=/atur-ulang-sandi` })
    setSibuk(false)
    if (err) { setError(/rate|seconds/i.test(err.message) ? 'Terlalu sering. Tunggu satu menit, lalu coba lagi.' : 'Belum bisa mengirim email. ' + err.message); return }
    setTerkirim(true)
  }
  return (
    <div className="login-wrap"><i className="lg2-b1" /><i className="lg2-b2" /><i className="lg2-b3" /><i className="lg2-b4" /><div className="login-card"><div className="lg2-logo kecil"><img src="/icon-satria-v6-512.png" alt="SATRIA PMI" /></div>
      <h1 style={{ fontSize: 21, margin: '0 0 6px' }}>Lupa kata sandi?</h1>
      {terkirim ? (
        <>
          <div style={{ background: 'var(--stock-bg)', color: 'var(--stock)', padding: '14px 16px', borderRadius: 12, fontSize: 15.5, lineHeight: 1.5, margin: '12px 0' }}>
            ✓ Link sudah dikirim ke <b>{email}</b>.<br />Buka email kamu, lalu klik link di dalamnya. Kalau tidak ada di kotak masuk, cek folder <b>Spam</b>.
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', margin: '0 0 16px' }}>Tulis email akunmu. Kami kirimkan link untuk membuat kata sandi baru.</p>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={kirim}>
            <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="nama@email.com" style={{ fontSize: 16, minHeight: 50 }} autoFocus /></div>
            <button className="btn btn-primary" style={{ width: '100%', minHeight: 50, fontSize: 16 }} disabled={sibuk}>{sibuk ? 'Mengirim...' : 'Kirim link ke email saya'}</button>
          </form>
        </>
      )}
      <div style={{ marginTop: 16, background: '#EEF5FB', border: '1px solid #1F6FB2', borderRadius: 12, padding: '10px 14px', fontSize: 14.5, lineHeight: 1.5 }}>Email tidak sampai atau link tidak bisa dibuka? <b>Minta admin web mengatur ulang kata sandimu.</b> Admin akan memberi kata sandi baru, lalu kamu bisa menggantinya di menu Profil.</div>
      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 14 }}><Link href="/login" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>← Kembali ke halaman masuk</Link></div>
    </div></div>
  )
}
