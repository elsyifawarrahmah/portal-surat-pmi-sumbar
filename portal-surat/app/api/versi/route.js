// Versi aplikasi yang sedang live (dipakai CekVersi untuk membuat tab lama memuat ulang sendiri).
export const dynamic = 'force-dynamic'
export async function GET() {
  return Response.json({ versi: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
