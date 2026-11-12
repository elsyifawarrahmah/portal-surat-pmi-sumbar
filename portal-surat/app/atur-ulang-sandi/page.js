'use client'
// Tujuan link "Lupa kata sandi" di email. Halaman ini sendiri yang memeriksa link (kode / token / galat), lalu memberi pesan jelas.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import GantiSandi from '@/components/GantiSandi'

export default function AturUlangSandi() {
  const supabase = createClient()
  const router = useRouter()
  const [tahap, setTahap] = useState('cek')   // cek | siap | gagal
  const [alasan, setAlasan] = useState('')

  useEffect(() => {
    let selesai = false
    const siap = () => { if (selesai) return; selesai = true; setTahap('siap'); try { window.history.replaceState(null, '', '/atur-ulang-sandi') } catch (e) {} }
    const gagal = a => { if (selesai) return; selesai = true; setAlasan(a); setTahap('gagal') }
    const { data: sub } = supabase.auth.onAuthStateChange((ev, sesi) => { if (sesi && (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN')) siap() })

    ;(async () => {
      const q = new URLSearchParams(window.location.search)
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const galat = q.get('galat') || h.get('error_code') || h.get('error') || q.get('error_code')
      if (galat) { gagal(/tautan/.test(galat) ? 'tautan' : 'kedaluwarsa'); return }
      const at = h.get('access_token'), rt = h.get('refresh_token')
      if (at && rt) {   // link bentuk token di bagian #: bisa dibuka di perangkat mana pun
        const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
        if (error) gagal('kedaluwarsa'); else siap()
        return
      }
      const th = q.get('token_hash')
      if (th) {   // link bentuk token_hash: bisa dibuka di perangkat mana pun
        const { error } = await supabase.auth.verifyOtp({ token_hash: th, type: q.get('type') || 'recovery' })
        if (error) gagal('kedaluwarsa'); else siap()
        return
      }
      // Sesi sudah terbentuk (lewat penukar kode di server, atau token di bagian #). Beri waktu singkat untuk dibaca.
      for (let i = 0; i < 8 && !selesai; i++) {
        const { data } = await supabase.auth.getSession()
        if (data?.session) { siap(); return }
        await new Promise(r => setTimeout(r, 500))
      }
      gagal(q.get('code') ? 'tautan' : 'kosong')
    })()
    return () => { selesai = true; sub?.subscription?.unsubscribe() }
  }, [])

  const PESAN = {
    kedaluwarsa: 'Link ini sudah kedaluwarsa atau sudah pernah dibuka. Kadang aplikasi email membukanya lebih dulu secara otomatis, jadi link langsung hangus.',
    tautan: 'Link ini tidak bisa dipakai di browser ini. Link hanya bisa dibuka di browser dan perangkat yang sama dengan yang dipakai saat menekan “Lupa kata sandi”.',
    kosong: 'Link tidak terbaca. Pastikan kamu membuka link dari email terbaru, dengan menyalin alamatnya utuh.',
  }
  return (
    <div className="login-wrap"><i className="lg2-b1" /><i className="lg2-b2" /><i className="lg2-b3" /><i className="lg2-b4" /><div className="login-card"><div className="lg2-logo kecil"><img src="/icon-satria-v5-512.png" alt="SATRIA PMI" /></div>
      <h1 style={{ fontSize: 21, margin: '0 0 6px' }}>Buat kata sandi baru</h1>
      {tahap === 'cek' && <p style={{ fontSize: 15.5, color: 'var(--ink-soft)' }}>⏳ Memeriksa link dari email... tunggu sebentar.</p>}
      {tahap === 'siap' && <>
        <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', margin: '0 0 18px' }}>Tulis kata sandi baru untuk akunmu. Setelah itu kamu langsung masuk.</p>
        <GantiSandi onSelesai={() => setTimeout(() => { router.push('/dashboard'); router.refresh() }, 900)} tombol="Simpan dan masuk" />
      </>}
      {tahap === 'gagal' && <>
        <div className="error-box" style={{ fontSize: 15, lineHeight: 1.5 }}>{PESAN[alasan] || PESAN.kosong}</div>
        <p style={{ fontSize: 14.5, margin: '12px 0' }}>Solusinya mudah: minta link baru, lalu <b>langsung buka dari email di perangkat yang sama</b>.</p>
        <Link href="/lupa-sandi" className="btn btn-primary" style={{ display: 'block', textAlign: 'center', minHeight: 50, lineHeight: '50px', fontSize: 16 }}>Minta link baru</Link>
        <p style={{ textAlign: 'center', marginTop: 12 }}><Link href="/login" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>Kembali ke halaman masuk</Link></p>
      </>}
    </div></div>
  )
}
