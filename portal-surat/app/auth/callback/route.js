// Penukar kode login: dipakai setelah klik link di email (lupa sandi / link masuk) dan setelah login Google/Facebook.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/dashboard'
  const aman = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'
  if (code) {
    const jar = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      cookies: {
        get(n) { return jar.get(n)?.value },
        set(n, v, o) { jar.set({ name: n, value: v, ...o }) },
        remove(n, o) { jar.set({ name: n, value: '', ...o }) },
      },
    })
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${aman}`)
  }
  return NextResponse.redirect(`${origin}/login?galat=tautan`)
}
