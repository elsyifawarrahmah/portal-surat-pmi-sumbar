// Admin web mengatur ulang kata sandi seorang pengguna (cadangan bila email reset tidak sampai).
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as klienAdmin } from '@supabase/supabase-js'

export const runtime = 'nodejs'
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request) {
  const { id, sandi } = await request.json().catch(() => ({}))
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!srk) return NextResponse.json({ ok: false, pesan: 'Kunci server (SUPABASE_SERVICE_ROLE_KEY) belum dipasang di Vercel. Lihat panduan, lalu Redeploy.' })
  const jar = cookies()
  const sb = createServerClient(URL_SB, ANON, { cookies: { get: n => jar.get(n)?.value, set() {}, remove() {} } })
  const { data: u } = await sb.auth.getUser()
  if (!u?.user) return NextResponse.json({ ok: false, pesan: 'Harus masuk dulu.' }, { status: 401 })
  const db = klienAdmin(URL_SB, srk, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: prof } = await db.from('profiles').select('role').eq('id', u.user.id).maybeSingle()
  if (prof?.role !== 'admin') return NextResponse.json({ ok: false, pesan: 'Hanya admin web.' }, { status: 403 })
  if (!id || typeof sandi !== 'string' || sandi.length < 8 || !/[A-Za-z]/.test(sandi) || !/\d/.test(sandi)) return NextResponse.json({ ok: false, pesan: 'Kata sandi minimal 8 karakter, ada huruf dan angka.' }, { status: 400 })
  const { error } = await db.auth.admin.updateUserById(id, { password: sandi })
  if (error) return NextResponse.json({ ok: false, pesan: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
