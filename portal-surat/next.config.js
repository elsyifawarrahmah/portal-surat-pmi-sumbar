/** @type {import('next').NextConfig} */
const nextConfig = {
  // Nomor versi (commit) yang sedang live: dipakai agar tab lama tahu ada pembaruan dan memuat ulang sendiri.
  env: { NEXT_PUBLIC_VERSI: process.env.VERCEL_GIT_COMMIT_SHA || 'dev' },
  // pdfjs-dist (membuka surat berbentuk PDF di editor koreksi) mencoba memuat modul 'canvas' milik Node; di browser tidak dipakai.
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false, encoding: false }
    return config
  },
}
module.exports = nextConfig
