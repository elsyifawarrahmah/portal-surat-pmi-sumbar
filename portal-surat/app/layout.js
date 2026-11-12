import './globals.css'
import AppShell from '@/components/AppShell'

import { NAMA_LENGKAP } from '@/lib/config'

// Splash dalam aplikasi: hanya saat dibuka dari ikon layar HP (standalone), sekali per sesi. Dipasang sebelum halaman tampil agar iOS tidak putih kosong.
const SKRIP_SPLASH = "try{var s=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;if(s&&!sessionStorage.getItem('satria-splash'))document.documentElement.classList.add('tampil-splash')}catch(e){}"

export const metadata = {
  title: NAMA_LENGKAP,
  description: 'Sistem digital surat masuk dan keluar PMI Sumatera Barat',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
  themeColor: '#C8102E',
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@600;700&family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon-v4.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1290x2796.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1179x2556.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1284x2778.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1170x2532.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1125x2436.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1242x2688.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/splash-828x1792.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1242x2208.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/splash-750x1334.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1206x2622.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/splash-1320x2868.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/splash-1668x2388.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/splash-2048x2732.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/splash-1640x2360.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/splash-1620x2160.jpg" />
        <link rel="apple-touch-startup-image" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/splash-1536x2048.jpg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="SATRIA PMI" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: SKRIP_SPLASH }} />
        <meta name="color-scheme" content="light only" />
      </head>
      <body>
        <div id="splash" aria-hidden="true">
          <div className="splash-isi">
            <img src="/icon-satria-v4-512.png" alt="" className="splash-ikon" />
            <div className="splash-nama">SATRIA PMI</div>
            <div className="splash-prov">PROV. SUMBAR</div>
          </div>
          <svg className="splash-ombak" viewBox="0 0 400 170" preserveAspectRatio="none"><path d="M0 70 C 90 20, 170 120, 260 70 S 360 30, 400 60 V170 H0Z" fill="rgba(255,255,255,.35)" /><path d="M0 105 C 100 60, 180 150, 270 105 S 360 80, 400 100 V170 H0Z" fill="#fff" /></svg>
        </div>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
