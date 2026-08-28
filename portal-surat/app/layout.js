import './globals.css'

export const metadata = {
  title: 'Portal Surat — PMI Sumatera Barat',
  description: 'Sistem digital surat masuk dan keluar PMI Sumatera Barat',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#C8102E" />
      </head>
      <body>{children}</body>
    </html>
  )
}
