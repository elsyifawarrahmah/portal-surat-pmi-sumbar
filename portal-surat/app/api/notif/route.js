// Mengirim notifikasi HP ke orang yang BENAR-BENAR perlu bertindak. Isi surat (perihal/asal) tidak pernah ikut terkirim.
//  jenis 'surat'        -> penerima disposisi terbaru dari sebuah surat masuk
//  jenis 'surat_keluar' / 'surat_tugas' -> sesuai tahap persetujuan (Sekretaris, Kepala Markas/Ketua, pembuat, Biro Umum)
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient as klienAdmin } from '@supabase/supabase-js'
import webpush from 'web-push'

export const runtime = 'nodejs'
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL, ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST(request) {
  const { jenis, id } = await request.json().catch(() => ({}))
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, srk = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!pub || !priv || !srk) return NextResponse.json({ ok: false, alasan: 'notifikasi-belum-disiapkan' })
  if (!id || !['surat', 'surat_keluar', 'surat_tugas'].includes(jenis)) return NextResponse.json({ ok: false }, { status: 400 })

  const jar = cookies()
  const sb = createServerClient(URL_SB, ANON, { cookies: { get: n => jar.get(n)?.value, set() {}, remove() {} } })
  const { data: u } = await sb.auth.getUser()
  const saya = u?.user?.id
  if (!saya) return NextResponse.json({ ok: false }, { status: 401 })
  const db = klienAdmin(URL_SB, srk, { auth: { persistSession: false, autoRefreshToken: false } })

  const unitTipe = async tipe => ((await db.from('surat_unit').select('id').eq('tipe', tipe)).data || []).map(x => x.id)
  const penggunaUnit = async ids => ids.length ? ((await db.from('profiles').select('id').in('unit_id', ids)).data || []).map(x => x.id) : []
  let penerima = [], judul = '', isi = '', url = '/dashboard'

  if (jenis === 'surat') {
    const { data: s } = await sb.from('surat_masuk').select('id, nomor_agenda, petugas_id').eq('id', id).maybeSingle()   // lewat hak akses pemanggil
    if (!s) return NextResponse.json({ ok: false }, { status: 403 })
    const { data: daftar } = await db.from('surat_disposisi').select('*').eq('surat_id', id)
    const d = (daftar || []).sort((a, b) => String(b.created_at || b.tanggal_diteruskan || '').localeCompare(String(a.created_at || a.tanggal_diteruskan || '')))[0]
    if (!d) return NextResponse.json({ ok: true, terkirim: 0 })
    const { data: prof } = await db.from('profiles').select('role').eq('id', saya).maybeSingle()
    if (!(d.dibuat_oleh === saya || s.petugas_id === saya || prof?.role === 'admin')) return NextResponse.json({ ok: false }, { status: 403 })
    const { data: tuj } = await db.from('surat_disposisi_tujuan').select('unit_id, status').eq('disposisi_id', d.id)
    penerima = await penggunaUnit((tuj || []).filter(t => t.status === 'menunggu').map(t => t.unit_id))
    judul = '📩 Ada surat untuk kamu'
    isi = `${s.nomor_agenda ? 'Nomor agenda ' + s.nomor_agenda + '. ' : ''}Buka portal untuk membacanya.`
    url = `/surat/${id}`
  } else {
    const { data: r } = await sb.from(jenis).select('id, status_persetujuan, petugas_id').eq('id', id).maybeSingle()
    if (!r) return NextResponse.json({ ok: false }, { status: 403 })
    const nama = jenis === 'surat_tugas' ? 'surat tugas' : 'surat keluar'
    url = jenis === 'surat_tugas' ? '/surat-tugas' : '/surat-keluar'
    if (r.status_persetujuan === 'diajukan') { penerima = await penggunaUnit(await unitTipe('sekretariat')); judul = '📝 Perlu paraf kamu'; isi = `Ada ${nama} yang menunggu paraf.` }
    else if (r.status_persetujuan === 'diparaf') { penerima = await penggunaUnit(await unitTipe('pimpinan')); judul = '✍️ Perlu persetujuan kamu'; isi = `Ada ${nama} yang menunggu persetujuan dan tanda tangan.` }
    else if (r.status_persetujuan === 'disetujui') { penerima = [r.petugas_id, ...(jenis === 'surat_keluar' ? await penggunaUnit(await unitTipe('biro_umum')) : [])]; judul = '✅ Surat sudah disetujui'; isi = `${nama[0].toUpperCase() + nama.slice(1)} sudah disetujui dan bertanda tangan.` }
    else if (r.status_persetujuan === 'revisi') { penerima = [r.petugas_id]; judul = '↩ Surat dikembalikan'; isi = `Ada ${nama} yang perlu diperbaiki. Buka portal untuk melihat catatannya.` }
  }
  penerima = [...new Set(penerima.filter(x => x && x !== saya))]
  if (!penerima.length) return NextResponse.json({ ok: true, terkirim: 0 })

  webpush.setVapidDetails('mailto:admin@pmisumbar.or.id', pub, priv)
  const { data: langganan } = await db.from('push_subscriptions').select('*').in('petugas_id', penerima)
  const muatan = JSON.stringify({ title: judul, body: isi, url })
  let terkirim = 0
  await Promise.all((langganan || []).map(async l => {
    try { await webpush.sendNotification({ endpoint: l.endpoint, keys: { p256dh: l.p256dh, auth: l.auth } }, muatan); terkirim++ }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', l.endpoint) }
  }))
  return NextResponse.json({ ok: true, terkirim })
}
