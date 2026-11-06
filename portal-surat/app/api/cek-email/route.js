// Memeriksa email saat mendaftar: format, alamat sekali-pakai/palsu yang umum, dan apakah domainnya benar-benar bisa menerima email (MX).
// Catatan: pemeriksaan penentu tetap tautan konfirmasi yang dikirim Supabase (pengaturan "Confirm email").
import { NextResponse } from 'next/server'
import dns from 'node:dns/promises'

export const runtime = 'nodejs'

const SEKALI_PAKAI = new Set(['mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'sharklasers.com', '10minutemail.com', '10minutemail.net', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com', 'yopmail.com', 'yopmail.fr', 'trashmail.com', 'getnada.com', 'maildrop.cc', 'throwawaymail.com', 'dispostable.com', 'fakeinbox.com', 'mailnesia.com', 'mohmal.com', 'emailondeck.com', 'mintemail.com', 'tempr.email', 'discard.email', 'spamgourmet.com', 'moakt.com', 'mail.tm', 'burnermail.io', 'example.com', 'example.org', 'test.com', 'email.com', 'mail.com.test'])
const SALAH_KETIK = new Set(['gmial.com', 'gmai.com', 'gmail.co', 'gmail.con', 'gamil.com', 'gnail.com', 'yahooo.com', 'yaho.com', 'yahoo.co', 'hotmial.com', 'outlok.com'])

export async function POST(request) {
  let email = ''
  try { email = String((await request.json())?.email || '').trim().toLowerCase() } catch {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return NextResponse.json({ ok: false, pesan: 'Alamat email tidak valid. Tulis email yang benar, misalnya nama@gmail.com.' })
  const domain = email.split('@')[1]
  if (SALAH_KETIK.has(domain)) return NextResponse.json({ ok: false, pesan: `Sepertinya ada salah ketik pada "${domain}". Periksa lagi alamat emailmu.` })
  if (SEKALI_PAKAI.has(domain) || /(^|\.)(mailinator|guerrillamail|tempmail|trashmail|yopmail|10minutemail)\./.test(domain)) return NextResponse.json({ ok: false, pesan: 'Gunakan email pribadi yang aktif, bukan email sementara atau percobaan.' })
  try {
    const mx = await Promise.race([dns.resolveMx(domain), new Promise((_, no) => setTimeout(() => no(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })), 4000))])
    if (!mx || mx.length === 0) throw Object.assign(new Error('none'), { code: 'ENODATA' })
  } catch (e) {
    if (['ENOTFOUND', 'ENODATA'].includes(e.code)) return NextResponse.json({ ok: false, pesan: `Domain "${domain}" tidak bisa menerima email. Pakai email yang aktif.` })
    // gangguan DNS sementara: jangan menghalangi pengguna asli
  }
  return NextResponse.json({ ok: true })
}
