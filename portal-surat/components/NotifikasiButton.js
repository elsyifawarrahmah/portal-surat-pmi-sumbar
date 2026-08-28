'use client'
import { useEffect, useState } from 'react'
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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) { setStatus('unsupported'); return }
    if (Notification.permission === 'denied') { setStatus('denied'); return }
    const reg = await navigator.serviceWorker.register('/sw.js')
    const sub = await reg.pushManager.getSubscription()
    setStatus(sub ? 'on' : 'off')
  }

  async function aktifkan() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
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

  if (status === 'unsupported') return null
  if (status === 'checking') return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      background: status === 'on' ? 'var(--stock-bg)' : 'var(--gold-bg)',
      color: status === 'on' ? 'var(--stock)' : 'var(--gold)',
      borderRadius: 10, fontSize: 12.5, fontWeight: 600, marginBottom: 18,
    }}>
      {status === 'on' && '🔔 Notifikasi HP sudah aktif untuk akun ini'}
      {status === 'off' && (
        <>
          🔕 Notifikasi HP belum aktif
          <button className="btn btn-primary" style={{ padding: '5px 12px', fontSize: 12, marginLeft: 'auto' }} onClick={aktifkan} disabled={busy}>
            {busy ? 'Memproses...' : 'Aktifkan Sekarang'}
          </button>
        </>
      )}
      {status === 'denied' && '🚫 Notifikasi diblokir di browser ini — aktifkan lewat setting izin situs di browser HP kamu.'}
    </div>
  )
}
