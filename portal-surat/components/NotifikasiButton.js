'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

export default function NotifikasiButton() {
  const supabase = createClient()
  const [status, setStatus] = useState('checking') // checking | off | on | unsupported | denied
  const [busy, setBusy] = useState(false)

  useEffect(() => { checkStatus() }, [])

  async function checkStatus() {
    const ua = navigator.userAgent
    const iphone = /iPad|iPhone|iPod/.test(ua)
    const terpasang = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus(iphone ? (terpasang ? 'ios-lama' : 'ios-pasang') : 'unsupported'); return
    }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    const reg = await navigator.serviceWorker.register('/sw.js')
    const sub = await reg.pushManager.getSubscription()
    setStatus(sub ? 'on' : 'off')
  }

  async function aktifkan() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) { alert('Notifikasi belum disiapkan oleh admin web (kunci notifikasi belum dipasang). Hubungi admin web.'); setBusy(false); return }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setStatus('denied'); setBusy(false); return }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      })
      const { data: userData } = await supabase.auth.getUser()
      const subJson = sub.toJSON()
      await supabase.from('push_subscriptions').upsert({
        endpoint: subJson.endpoint,
        p256dh: subJson.keys.p256dh,
        auth: subJson.keys.auth,
        petugas_id: userData.user.id,
      }, { onConflict: 'endpoint' })
      setStatus('on')
    } catch (e) {
      console.error(e)
      alert('Gagal mengaktifkan notifikasi: ' + e.message)
    }
    setBusy(false)
  }

  if (status === 'checking') return null
  if (status === 'unsupported' && !/Android/.test(navigator.userAgent)) return null
  const kotakInfo = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--gold-bg)', color: 'var(--gold)', borderRadius: 10, fontSize: 14, fontWeight: 600, marginBottom: 18, lineHeight: 1.45 }
  const tombolPasang = <Link href="/pasang" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 14, marginLeft: 'auto', textDecoration: 'none' }}>Lihat cara pasang</Link>
  if (status === 'ios-pasang') return <div style={kotakInfo}>Notifikasi di iPhone: <b>pasang dulu ke Layar Utama</b>, lalu buka SATria PMI dari ikon merah PMI dan aktifkan di sini. {tombolPasang}</div>
  if (status === 'ios-lama') return <div style={kotakInfo}>Notifikasi butuh iPhone dengan <b>iOS 16.4 atau lebih baru</b>. Perbarui iOS di Pengaturan → Umum → Pembaruan Perangkat Lunak.</div>
  if (status === 'unsupported') return <div style={kotakInfo}>Browser ini belum mendukung notifikasi. Buka SATria PMI di <b>Chrome</b> lalu pasang di layar HP. {tombolPasang}</div>

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: status === 'on' ? 'var(--stock-bg)' : 'var(--gold-bg)',
      color: status === 'on' ? 'var(--stock)' : 'var(--gold)',
      borderRadius: 10, fontSize: 12.5, fontWeight: 600, marginBottom: 18,
    }}>
      {status === 'on' && 'Notifikasi HP sudah aktif untuk akun ini'}
      {status === 'off' && (
        <>
          Notifikasi HP belum aktif
          <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12, marginLeft: 'auto' }} onClick={aktifkan} disabled={busy}>
            {busy ? 'Memproses...' : 'Aktifkan Sekarang'}
          </button>
        </>
      )}
      {status === 'denied' && 'Notifikasi diblokir di browser ini — aktifkan lewat setting izin situs di browser HP kamu.'}
    </div>
  )
}
