'use client'
// Daftar orang di satu unit + tombol Telepon / WhatsApp (untuk menghubungi saat surat menumpuk)
import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'

const bersih = t => String(t || '').replace(/[^0-9+]/g, '')
const keWa = t => { let n = bersih(t).replace(/^\+/, ''); if (n.startsWith('0')) n = '62' + n.slice(1); return n }

export default function KontakModal({ supabase, unit, pesan, onClose }) {
  const [orang, setOrang] = useState([])
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')

  useEffect(() => { (async () => {
    let r = await supabase.from('profiles').select('id, nama_lengkap, telepon').eq('unit_id', unit.id).order('nama_lengkap')
    if (r.error) { setGalat('Kolom telepon belum ada. Jalankan file supabase/migrasi-alur-berjenjang.sql di Supabase.'); r = await supabase.from('profiles').select('id, nama_lengkap').eq('unit_id', unit.id) }
    setOrang(r.data || []); setLoading(false)
  })() }, [unit.id])

  const teksWa = encodeURIComponent(pesan || `Selamat pagi/siang, ini dari portal surat PMI Sumbar. Mohon dicek surat yang menunggu di ${unit.nama}. Terima kasih.`)
  return (
    <Modal judul={`Hubungi ${unit.nama}`} onClose={onClose} lebar={460}>
      {galat && <div className="error-box">{galat}</div>}
      {loading && <div style={{ color: 'var(--ink-soft)' }}>Memuat...</div>}
      {!loading && orang.length === 0 && <div style={{ color: 'var(--ink-soft)' }}>Belum ada akun yang ditempatkan di unit ini. Atur di menu Data User.</div>}
      {orang.map(o => (
        <div key={o.id} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ fontWeight: 700 }}>{o.nama_lengkap}</div>
          {o.telepon ? (
            <>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '2px 0 8px' }}>{o.telepon}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a className="btn btn-primary" href={`tel:${bersih(o.telepon)}`} style={{ textDecoration: 'none', minHeight: 40, padding: '8px 16px' }}>📞 Telepon</a>
                <a className="btn btn-ghost" href={`https://wa.me/${keWa(o.telepon)}?text=${teksWa}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', minHeight: 40, padding: '8px 16px' }}>💬 WhatsApp</a>
              </div>
            </>
          ) : <div style={{ fontSize: 13, color: '#B3261E' }}>Nomor telepon belum diisi (admin bisa mengisinya di Data User, atau orangnya sendiri lewat menu samping).</div>}
        </div>
      ))}
    </Modal>
  )
}
