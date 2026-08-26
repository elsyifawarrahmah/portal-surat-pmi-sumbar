'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nama, setNama] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError('Email atau password salah.'); setLoading(false); return }
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { nama_lengkap: nama } } })
      if (error) { setError(error.message); setLoading(false); return }
    }
    router.push('/dashboard'); router.refresh()
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:18}}>
          <div style={{width:36,height:36,background:'var(--pmi-red)',borderRadius:8}} />
          <div>
            <div style={{fontWeight:700,fontSize:15}}>Portal Surat Digital</div>
            <div style={{fontSize:11,color:'var(--ink-soft)'}}>PMI Provinsi Sumatera Barat</div>
          </div>
        </div>
        <h1 style={{fontSize:19,margin:'0 0 4px'}}>{mode==='signin' ? 'Masuk Akun Petugas' : 'Daftar Akun Petugas Baru'}</h1>
        <p style={{fontSize:13,color:'var(--ink-soft)',margin:'0 0 18px'}}>
          {mode==='signin' ? 'Gunakan email yang terdaftar untuk tim PMI.' : 'Akun baru otomatis berperan sebagai Petugas.'}
        </p>
        {error && <div className="error-box">{error}</div>}
        <form onSubmit={handleSubmit}>
          {mode==='signup' && (
            <div className="field"><label>Nama Lengkap</label><input value={nama} onChange={e=>setNama(e.target.value)} required placeholder="cth: Rina Andayani" /></div>
          )}
          <div className="field"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="nama@pmisumbar.org" /></div>
          <div className="field"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} placeholder="minimal 6 karakter" /></div>
          <button className="btn btn-primary" style={{width:'100%',marginTop:6}} disabled={loading}>{loading ? 'Memproses...' : (mode==='signin' ? 'Masuk' : 'Daftar')}</button>
        </form>
        <div style={{textAlign:'center',marginTop:16,fontSize:12.5}}>
          {mode==='signin' ? (
            <>Belum punya akun? <a href="#" onClick={e=>{e.preventDefault();setMode('signup');setError('')}} style={{color:'var(--pmi-red)',fontWeight:600}}>Daftar di sini</a></>
          ) : (
            <>Sudah punya akun? <a href="#" onClick={e=>{e.preventDefault();setMode('signin');setError('')}} style={{color:'var(--pmi-red)',fontWeight:600}}>Masuk di sini</a></>
          )}
        </div>
      </div>
    </div>
  )
}
