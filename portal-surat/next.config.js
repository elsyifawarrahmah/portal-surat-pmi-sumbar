/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist (membuka surat berbentuk PDF di editor koreksi) mencoba memuat modul 'canvas' milik Node; di browser tidak dipakai.
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false, encoding: false }
    return config
  },
}
module.exports = nextConfig
