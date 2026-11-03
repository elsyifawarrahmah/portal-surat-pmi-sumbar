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
  const [nama, setNama] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [prov, setProv] = useState({ google: false, facebook: false })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
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
    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { nama_lengkap: nama } } })
      if (error) { setError(error.message); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/auth/callback`, shouldCreateUser: false } })
      setLoading(false)
      if (error) { setError(/signup|not allowed|not found/i.test(error.message) ? 'Email ini belum terdaftar. Klik "Daftar di sini" dulu.' : /rate|seconds/i.test(error.message) ? 'Terlalu sering. Tunggu satu menit, lalu coba lagi.' : 'Belum bisa mengirim link. ' + error.message); return }
      setInfo(`Link masuk sudah dikirim ke ${email.trim()}. Buka email kamu lalu klik link-nya. Cek folder Spam bila tidak ada.`); return
    }
    router.push('/dashboard'); router.refresh()
  }

  async function lewat(provider) {
    setError(''); setInfo('')
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } })
    if (error) setError('Belum bisa masuk dengan ' + (provider === 'google' ? 'Google' : 'Facebook') + '. ' + error.message)
  }

  const judul = mode === 'signin' ? 'Masuk' : mode === 'signup' ? 'Daftar Akun Baru' : 'Masuk lewat link email'
  const besar = { fontSize: 16, minHeight: 50 }
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{marginBottom:18}}>
          <div className="brand-logo" style={{gap:12}}>
            <img src="/logo-pmi.png" alt="Lambang Palang Merah Indonesia" width={56} height={56} />
            <div className="brand-name" style={{color:'#000',fontSize:21}}>Palang<br />Merah<br />Indonesia</div>
            <div className="brand-vline" style={{color:'#000'}} />
            <div className="brand-prov" style={{color:'#000',fontSize:16}}>Provinsi<br />Sumatera Barat</div>
          </div>
          <div style={{fontSize:10,color:'var(--ink-soft)',textTransform:'uppercase',letterSpacing:'.04em',marginTop:10}}>{NAMA_APLIKASI}</div>
        </div>
        <h1 style={{fontSize:21,margin:'0 0 4px'}}>{judul}</h1>
        <p style={{fontSize:14,color:'var(--ink-soft)',margin:'0 0 16px'}}>
          {mode === 'signin' ? 'Masuk dengan email dan kata sandi kamu.' : mode === 'signup' ? 'Setelah mendaftar, admin akan menempatkan akunmu di bidang yang sesuai.' : 'Tanpa kata sandi: kami kirim link masuk ke emailmu.'}
        </p>
        {error && <div className="error-box">{error}</div>}
        {info && <div style={{ background: 'var(--stock-bg)', color: 'var(--stock)', padding: '12px 14px', borderRadius: 12, fontSize: 14.5, lineHeight: 1.5, marginBottom: 14 }}>✓ {info}</div>}

        {mode !== 'link' && (prov.google || prov.facebook) && (
          <>
            {prov.google && <button type="button" onClick={() => lewat('google')} className="btn btn-ghost" style={{ ...besar, width: '100%', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>{Glogo} Lanjut dengan Google</button>}
            {prov.facebook && <button type="button" onClick={() => lewat('facebook')} className="btn btn-ghost" style={{ ...besar, width: '100%', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><span style={{ color: '#1877F2', fontWeight: 900, fontSize: 20 }}>f</span> Lanjut dengan Facebook</button>}
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--ink-soft)', margin: '10px 0' }}>— atau pakai email —</div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          {mode==='signup' && (
            <div className="field"><label>Nama Lengkap</label><input value={nama} onChange={e=>setNama(e.target.value)} required placeholder="cth: Rina Andayani" style={besar} /></div>
          )}
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nama@email.com" style={besar} autoComplete="email" /></div>
          {mode !== 'link' && (
            <div className="field"><label>Kata sandi</label>
              <input type={lihat ? 'text' : 'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="minimal 6 karakter" style={besar} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', textTransform: 'none', fontSize: 13.5, color: 'var(--ink)', margin: '8px 0 0' }}><input type="checkbox" style={{ width: 18, height: 18 }} checked={lihat} onChange={e => setLihat(e.target.checked)} /> Tampilkan kata sandi</label>
            </div>
          )}
          <button className="btn btn-primary" style={{width:'100%',marginTop:6,...besar}} disabled={loading}>{loading ? 'Memproses...' : mode==='signin' ? 'Masuk' : mode==='signup' ? 'Daftar' : 'Kirim link masuk ke email saya'}</button>
        </form>

        <div style={{textAlign:'center',marginTop:16,fontSize:14.5,lineHeight:2}}>
          {mode === 'signin' && <><Link href="/lupa-sandi" style={{color:'var(--pmi-red)',fontWeight:700}}>Lupa kata sandi?</Link><br /><a href="#" onClick={e=>{e.preventDefault();setMode('link');setError('');setInfo('')}} style={{color:'var(--pmi-red)',fontWeight:600}}>Masuk tanpa kata sandi (kirim link ke email)</a><br /></>}
          {mode === 'signin' ? <>Belum punya akun? <a href="#" onClick={e=>{e.preventDefault();setMode('signup');setError('');setInfo('')}} style={{color:'var(--pmi-red)',fontWeight:700}}>Daftar di sini</a></>
            : <a href="#" onClick={e=>{e.preventDefault();setMode('signin');setError('');setInfo('')}} style={{color:'var(--pmi-red)',fontWeight:700}}>← Kembali ke halaman masuk</a>}
        </div>
      </div>
    </div>
  )
}
