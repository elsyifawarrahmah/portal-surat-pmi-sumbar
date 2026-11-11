'use client'
// Penjaga tombol Kembali / tutup di HP supaya tidak sengaja keluar atau kehilangan isian surat.
//  1) Di Beranda: tombol kembali HP menampilkan "Apakah Anda ingin keluar?".
//  2) Saat mengisi formulir (kotak dialog) dan sudah mengetik: tombol kembali / muat ulang / tutup tab menanyakan dulu.
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

const TANDA = 'satriaGuard'

export default function KonfirmasiKeluar() {
  const pathname = usePathname() || ''
  const [tanya, setTanya] = useState(null)   // null | 'keluar' | 'isian'
  const diketik = useRef(false)
  const sentinelForm = useRef(false)
  const abaikanPop = useRef(false)   // popstate yang kita picu sendiri (membersihkan tanda riwayat)
  const diBeranda = pathname === '/dashboard'

  // --- 1. Beranda: jaga tombol kembali ---
  useEffect(() => {
    if (!diBeranda) return
    const pasang = () => { try { window.history.pushState({ [TANDA]: 'beranda' }, '') } catch (e) {} }
    pasang()
    const onPop = () => {
      if (abaikanPop.current) return
      if (document.querySelector('[data-guard-modal]')) return       // modal terbuka: ditangani penjaga isian
      setTanya('keluar')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [diBeranda, pathname])

  // --- 2. Isian formulir yang belum disimpan ---
  useEffect(() => {
    const modalAda = () => document.querySelector('[data-guard-modal]')
    const onInput = e => {
      const m = modalAda()
      if (!m || !m.contains(e.target)) return
      const t = e.target
      if (!(t instanceof HTMLElement) || !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.type === 'search') return
      diketik.current = true
      if (!sentinelForm.current) { sentinelForm.current = true; try { window.history.pushState({ [TANDA]: 'isian' }, '') } catch (e) {} }
    }
    const onPop = () => {
      if (abaikanPop.current) { abaikanPop.current = false; return }
      if (sentinelForm.current && modalAda()) {
        sentinelForm.current = false
        if (diketik.current) setTanya('isian')
        else tutupModal()
        return
      }
    }
    const onBeforeUnload = e => { if (diketik.current && modalAda()) { e.preventDefault(); e.returnValue = '' } }
    // reset penanda saat kotak dialog hilang (disimpan / ditutup)
    const mo = new MutationObserver(() => {
      if (modalAda()) return
      diketik.current = false
      if (sentinelForm.current) {   // kotak dialog selesai (disimpan/ditutup): buang tanda riwayat supaya tombol kembali tidak perlu ditekan dua kali
        sentinelForm.current = false
        if (window.history.state && window.history.state[TANDA] === 'isian') { abaikanPop.current = true; window.history.back(); setTimeout(() => { abaikanPop.current = false }, 600) }
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('input', onInput, true)
    document.addEventListener('change', onInput, true)
    window.addEventListener('popstate', onPop)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => { mo.disconnect(); document.removeEventListener('input', onInput, true); document.removeEventListener('change', onInput, true); window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onBeforeUnload) }
  }, [diBeranda])

  function tutupModal() {
    const x = document.querySelector('[data-guard-modal] button[aria-label="Tutup"]')
    if (x) x.click()
  }
  function lanjut() {
    if (tanya === 'keluar') { try { window.history.pushState({ [TANDA]: 'beranda' }, '') } catch (e) {} }
    else { sentinelForm.current = true; try { window.history.pushState({ [TANDA]: 'isian' }, '') } catch (e) {} }
    setTanya(null)
  }
  function keluarAja() {
    if (tanya === 'isian') { diketik.current = false; setTanya(null); tutupModal(); return }
    setTanya(null)
    // Aplikasi terpasang tidak bisa ditutup oleh halaman; mundur sejauh mungkin = keluar ke layar HP (Android). Bila tidak bisa, beri petunjuk.
    try { window.close() } catch (e) {}
    const n = Math.max(window.history.length - 1, 1)
    window.history.go(-n)
    setTimeout(() => { setTanya('petunjuk') }, 700)
  }

  if (!tanya) return null
  const isi = {
    keluar: { judul: 'Keluar dari SATria PMI?', teks: 'Apakah Anda ingin keluar dari aplikasi?', ya: 'Ya, keluar', tidak: 'Tetap di sini' },
    isian: { judul: 'Isian belum disimpan', teks: 'Surat yang sedang Anda isi belum disimpan. Kalau keluar sekarang, isiannya hilang dan harus diketik ulang.', ya: 'Buang & keluar', tidak: 'Lanjut mengisi' },
    petunjuk: { judul: 'Tekan tombol Beranda HP', teks: 'Untuk menutup aplikasi, geser/tekan tombol Beranda (Home) di HP Anda.', ya: null, tidak: 'Mengerti' },
  }[tanya]
  return (
    <div className="kk-latar" role="dialog" aria-modal="true" aria-labelledby="kk-judul">
      <div className="kk-kotak">
        <div className="kk-ikon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {tanya === 'isian' ? <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></> : <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>}
          </svg></div>
        <h3 id="kk-judul">{isi.judul}</h3>
        <p>{isi.teks}</p>
        <div className="kk-aksi">
          <button type="button" className="btn btn-primary" onClick={tanya === 'petunjuk' ? () => setTanya(null) : lanjut}>{isi.tidak}</button>
          {isi.ya && <button type="button" className="btn btn-ghost" onClick={keluarAja}>{isi.ya}</button>}
        </div>
      </div>
    </div>
  )
}
