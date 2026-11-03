'use client'
// Tujuan link "Lupa kata sandi" di email: pengguna sudah masuk otomatis lewat link, tinggal mengisi kata sandi baru.
import { useRouter } from 'next/navigation'
import GantiSandi from '@/components/GantiSandi'

export default function AturUlangSandi() {
  const router = useRouter()
  return (
    <div className="login-wrap"><div className="login-card">
      <h1 style={{ fontSize: 21, margin: '0 0 6px' }}>Buat kata sandi baru</h1>
      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', margin: '0 0 18px' }}>Tulis kata sandi baru untuk akunmu. Setelah itu kamu langsung masuk.</p>
      <GantiSandi onSelesai={() => setTimeout(() => { router.push('/dashboard'); router.refresh() }, 900)} tombol="Simpan dan masuk" />
    </div></div>
  )
}
