'use client'
import { NAMA_APLIKASI } from '@/lib/config'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const Glogo = <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>

export default function LoginPage() {
  const [mode, setMode] = useState('signin')   // signin | signup | link
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [lihat, setLihat] = useState(false)
  const [ingat, setIngat] = useState(true)   // ingat email di HP ini (kata sandi tidak pernah disimpan)
  const [nama, setNama] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [kirimUlang, setKirimUlang] = useState(false)
  const [prov, setProv] = useState({ google: false, facebook: false })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    try { const e = localStorage.getItem('satria-email'); if (e) setEmail(e); if (localStorage.getItem('satria-ingat') === '0') setIngat(false) } catch (e) {}
    if (/type=recovery/.test(window.location.hash) && /access_token=/.test(window.location.hash)) { window.location.replace('/atur-ulang-sandi' + window.location.hash); return }
    // tombol Google/Facebook hanya muncul bila sudah diaktifkan admin di Supabase
    fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY } })
      .then(r => r.json()).then(j => setProv({ google: !!j?.external?.google, facebook: !!j?.external?.facebook })).catch(() => {})
    if (new URLSearchParams(window.location.search).get('galat') === 'tautan') setError('Link sudah kedaluwarsa atau sudah dipakai. Silakan minta link baru.')
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setInfo(''); setLoading(true)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) { setError('Email atau kata sandi salah. Lupa kata sandi? Klik "Lupa kata sandi" di bawah.'); setLoading(false); return }
      try { if (ingat) { localStorage.setItem('satria-email', email.trim()); localStorage.setItem('satria-ingat', '1') } else { localStorage.removeItem('satria-email'); localStorage.setItem('satria-ingat', '0') } } catch (e) {}
    } else if (mode === 'signup') {
      const cek = await fetch('/api/cek-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) }).then(r => r.json()).catch(() => ({ ok: true }))
      if (!cek.ok) { setError(cek.pesan); setLoading(false); return }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setError('Kata sandi minimal 8 karakter dan harus ada huruf dan angka.'); setLoading(false); return }
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { nama_lengkap: nama }, emailRedirectTo: `${window.location.origin}/auth/callback` } })
      if (error) { setError(error.message); setLoading(false); return }
      if (data?.session) {   // konfirmasi email belum diaktifkan di Supabase: jangan biarkan masuk
        await supabase.auth.signOut()
        setError('Pendaftaran belum bisa diselesaikan karena pengaturan konfirmasi email belum aktif. Mohon hubungi admin web.'); setLoading(false); return
      }
      setLoading(false); setKirimUlang(true)
      setInfo(`Kami mengirim email konfirmasi ke ${email.trim()}. Buka email itu lalu klik tautannya untuk mengaktifkan akun. Cek folder Spam bila belum ada. Setelah itu admin akan menempatkan akunmu di bidang yang sesuai.`); return
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false } })
      setLoading(false)
      if (error) { setError(/signup|not allowed|not found/i.test(error.message) ? 'Email ini belum terdaftar. Klik "Daftar di sini" dulu.' : /rate|seconds/i.test(error.message) ? 'Terlalu sering. Tunggu satu menit, lalu coba lagi.' : 'Belum bisa mengirim link. ' + error.message); return }
      setInfo(`Link masuk sudah dikirim ke ${email.trim()}. Buka email kamu lalu klik link-nya. Cek folder Spam bila tidak ada.`); return
    }
    router.push('/dashboard'); router.refresh()
  }

  async function kirimUlangEmail() {
    setError(''); setInfo('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
    if (error) setError(/rate|seconds/i.test(error.message) ? 'Terlalu sering. Tunggu satu menit, lalu coba lagi.' : error.message)
    else setInfo('Email konfirmasi dikirim ulang. Cek kotak masuk dan folder Spam.')
  }

  async function lewat(provider) {
    setError(''); setInfo('')
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } })
    if (error) setError('Belum bisa masuk dengan ' + (provider === 'google' ? 'Google' : 'Facebook') + '. ' + error.message)
  }

  const judul = mode === 'signin' ? 'Selamat Datang' : mode === 'signup' ? 'Daftar Akun Baru' : 'Masuk lewat Email'
  const sub = mode === 'signin' ? 'Masuk untuk melanjutkan' : mode === 'signup' ? 'Setelah mendaftar, admin akan menempatkan akunmu di bidang yang sesuai.' : 'Tanpa kata sandi: kami kirim link masuk ke emailmu.'
  const Ik = ({ children }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
  const ikUser = <Ik><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Ik>
  const ikMail = <Ik><rect x="3" y="5" width="18" height="14" rx="3" /><polyline points="3 7 12 13 21 7" /></Ik>
  const ikKunci = <Ik><rect x="4" y="11" width="16" height="10" rx="3" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="16" r="1.2" /></Ik>
  const ikMata = lihat ? <Ik><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" /><circle cx="12" cy="12" r="3" /></Ik> : <Ik><path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a19.8 19.8 0 0 1 5.1-5.9M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 7 11 7a19.9 19.9 0 0 1-3.2 4.2" /><line x1="1" y1="1" x2="23" y2="23" /></Ik>
  return (
    <div className="lg2">
      <i className="lg2-b1" /><i className="lg2-b2" /><i className="lg2-b3" /><i className="lg2-b4" />
      <div className="lg2-isi">
        <div className="lg2-logo"><img src="/icon-satria-v7-512.png" alt={NAMA_APLIKASI + ' - Palang Merah Indonesia Provinsi Sumatera Barat'} /></div>
        <h1 className="lg2-judul">{judul}</h1>
        <p className={'lg2-sub' + (mode === 'signin' ? ' spasi' : '')}>{sub}</p>
        {error && <div className="error-box">{error}</div>}
        {kirimUlang && email.trim() && <button type="button" className="btn btn-ghost" style={{ minHeight: 48, width: '100%', marginBottom: 14 }} onClick={kirimUlangEmail}>Kirim ulang email konfirmasi</button>}
        {info && <div style={{ background: 'var(--stock-bg)', color: 'var(--stock)', padding: '12px 14px', borderRadius: 16, fontSize: 14.5, lineHeight: 1.5, marginBottom: 14 }}>✓ {info}</div>}

        <form onSubmit={handleSubmit} className="lg2-form">
          {mode === 'signup' && (
            <label className="lg2-kolom"><span className="lg2-ik">{ikUser}</span><input value={nama} onChange={e => setNama(e.target.value)} required placeholder="Nama lengkap, cth: Rina Andayani" aria-label="Nama lengkap" /></label>
          )}
          <label className="lg2-kolom"><span className="lg2-ik">{ikMail}</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email" aria-label="Email" autoComplete="email" /></label>
          {mode !== 'link' && (
            <label className="lg2-kolom"><span className="lg2-ik">{ikKunci}</span>
              <input type={lihat ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder={mode === 'signup' ? 'Kata sandi (min. 8 karakter)' : 'Kata sandi'} aria-label="Kata sandi" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
              <button type="button" className="lg2-mata" onClick={() => setLihat(v => !v)} aria-label={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>{ikMata}</button>
            </label>
          )}
          {mode === 'signin' && (
            <div className="lg2-baris">
              <label className="lg2-ingat"><input type="checkbox" checked={ingat} onChange={e => setIngat(e.target.checked)} /><span className="lg2-cek" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 10 18 20 6" /></svg></span>Ingat saya</label>
              <Link href="/lupa-sandi" className="lg2-lupa-t">Lupa kata sandi?</Link>
            </div>
          )}
          <button className="lg2-tombol" disabled={loading}>
            <span>{loading ? 'Memproses...' : mode === 'signin' ? 'Masuk' : mode === 'signup' ? 'Daftar' : 'Kirim link masuk'}</span>
            <span className="lg2-panah" aria-hidden="true"><Ik><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Ik></span>
          </button>
        </form>

        {mode !== 'link' && (prov.google || prov.facebook) && (
          <>
            <div className="lg2-atau"><span>ATAU LANJUTKAN DENGAN</span></div>
            <div className="lg2-sosial">
              {prov.google && <button type="button" onClick={() => lewat('google')} aria-label="Lanjut dengan Google">{Glogo}</button>}
              {prov.facebook && <button type="button" onClick={() => lewat('facebook')} aria-label="Lanjut dengan Facebook"><span style={{ color: '#1877F2', fontWeight: 900, fontSize: 26 }}>f</span></button>}
            </div>
          </>
        )}

        <div className="lg2-tautan">
          {mode === 'signin' && <a href="#" onClick={e => { e.preventDefault(); setMode('link'); setError(''); setInfo('') }}>Masuk tanpa kata sandi (kirim link ke email)</a>}
          {mode === 'signin' ? <>
            <span>Belum punya akun? <a href="#" onClick={e => { e.preventDefault(); setMode('signup'); setError(''); setInfo('') }}><b>Daftar di sini</b></a></span>
            <Link href="/pasang">Pasang di layar HP</Link></>
            : <a href="#" onClick={e => { e.preventDefault(); setMode('signin'); setError(''); setInfo('') }}>← Kembali ke halaman masuk</a>}
        </div>
        <div className="lg2-kaki">SURAT DIGITAL <i>•</i> PMI SUMATERA BARAT</div>
      </div>
    </div>
  )
}
