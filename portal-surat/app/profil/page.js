'use client'
// Profil: biodata sendiri, foto profil (1 foto), ganti kata sandi.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Avatar from '@/components/Avatar'
import GantiSandi from '@/components/GantiSandi'
import { unggahSatu, hapusBerkasLama, ketHint } from '@/lib/berkas'
import { fmtTgl, fmtWaktu, pesanGalat } from '@/lib/format'
import { NAMA_TIPE } from '@/lib/peran'

const kartu = { background: '#fff', border: '1px solid var(--line)', borderRadius: 16, padding: '18px 20px', marginBottom: 16 }

export default function ProfilPage() {
  const supabase = createClient()
  const [user, setUser] = useState(null)
  const [p, setP] = useState(null)
  const [unit, setUnit] = useState(null)
  const [form, setForm] = useState({ nama_lengkap: '', jabatan: '', telepon: '' })
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')
  const [ok, setOk] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [fotoSibuk, setFotoSibuk] = useState(false)
  const [sandi, setSandi] = useState(false)

  useEffect(() => { muat() }, [])
  async function muat() {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) return
    setUser(u.user)
    let r = await supabase.from('profiles').select('*, unit:surat_unit(id, nama, tipe)').eq('id', u.user.id).maybeSingle()
    if (r.error) r = await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle()
    if (r.error) { setGalat(pesanGalat(r.error)); setLoading(false); return }
    setP(r.data); setUnit(r.data?.unit || null)
    setForm({ nama_lengkap: r.data?.nama_lengkap || '', jabatan: r.data?.jabatan || '', telepon: r.data?.telepon || '' })
    setLoading(false)
  }

  async function simpan(e) {
    e.preventDefault(); setGalat(''); setOk('')
    if (!form.nama_lengkap.trim()) { setGalat('Nama lengkap tidak boleh kosong.'); return }
    setSibuk(true)
    const { error } = await supabase.from('profiles').update({ nama_lengkap: form.nama_lengkap.trim(), jabatan: form.jabatan.trim() || null, telepon: form.telepon.trim() || null }).eq('id', user.id)
    setSibuk(false)
    if (error) { setGalat(/jabatan|telepon|column/i.test(error.message) ? 'Bagian biodata ini belum siap. Mohon beri tahu admin web. (' + error.message + ')' : pesanGalat(error)); return }
    setOk('Biodata sudah disimpan.'); muat()
  }

  async function ubahFoto(e) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setGalat(''); setOk(''); setFotoSibuk(true)
    try {
      const r = await unggahSatu(supabase, files, 'foto', `profil/${user.id}-`)
      const { error } = await supabase.from('profiles').update({ foto_url: r.url }).eq('id', user.id)
      if (error) throw new Error(/foto_url|column/i.test(error.message) ? 'Fitur foto profil belum siap. Mohon beri tahu admin web.' : error.message)
      if (p?.foto_url) hapusBerkasLama(supabase, p.foto_url)
      setOk('Foto profil sudah diganti.'); muat()
    } catch (err) { setGalat(err.message) }
    setFotoSibuk(false); e.target.value = ''
  }
  async function hapusFoto() {
    if (!confirm('Hapus foto profil?')) return
    const lama = p?.foto_url
    const { error } = await supabase.from('profiles').update({ foto_url: null }).eq('id', user.id)
    if (error) { setGalat(pesanGalat(error)); return }
    if (lama) hapusBerkasLama(supabase, lama)
    muat()
  }

  const baris = (a, b) => <div style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}><div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{a}</div><div style={{ fontSize: 16, fontWeight: 600 }}>{b || '-'}</div></div>

  return (
    <div className="app"><div className="main" style={{ maxWidth: 720 }}>
      <div className="topbar"><div><h1>Profil Saya</h1><p className="desc">Biodata dan foto akunmu.</p></div></div>
      {galat && <div className="error-box">{galat}</div>}
      {ok && <div style={{ background: 'var(--stock-bg)', color: 'var(--stock)', padding: '10px 14px', borderRadius: 10, fontWeight: 700, marginBottom: 14 }}>✓ {ok}</div>}
      {loading ? <div style={{ padding: 30, color: 'var(--ink-soft)' }}>Memuat...</div> : (
        <>
          <div style={{ ...kartu, display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ borderRadius: '50%', background: '#eee' }}><Avatar url={p?.foto_url} nama={p?.nama_lengkap} ukuran={96} /></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{p?.nama_lengkap}</div>
              <div style={{ color: 'var(--ink-soft)', fontSize: 15 }}>{p?.role === 'admin' ? 'Admin web' : unit?.nama || 'Belum ada unit'}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <label className="btn btn-primary" style={{ cursor: fotoSibuk ? 'wait' : 'pointer', minHeight: 46, display: 'inline-flex', alignItems: 'center' }}>{fotoSibuk ? 'Memproses...' : p?.foto_url ? '📷 Ganti foto' : '📷 Pasang foto'}<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={ubahFoto} disabled={fotoSibuk} /></label>
                {p?.foto_url && <button className="btn btn-ghost" style={{ minHeight: 46 }} onClick={hapusFoto}>Hapus foto</button>}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 8 }}>{ketHint('foto')}</div>
            </div>
          </div>

          <form onSubmit={simpan} style={kartu}>
            <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Biodata</h3>
            <div className="field"><label>Nama lengkap</label><input value={form.nama_lengkap} onChange={e => setForm({ ...form, nama_lengkap: e.target.value })} required style={{ fontSize: 16, minHeight: 50 }} /></div>
            <div className="field"><label>Jabatan</label><input value={form.jabatan} onChange={e => setForm({ ...form, jabatan: e.target.value })} placeholder="mis. Sekretaris, Staf Bidang PB" style={{ fontSize: 16, minHeight: 50 }} /></div>
            <div className="field"><label>Nomor HP / WhatsApp</label><input value={form.telepon} onChange={e => setForm({ ...form, telepon: e.target.value })} inputMode="tel" placeholder="08xxxxxxxxxx" style={{ fontSize: 16, minHeight: 50 }} />
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 4 }}>Dipakai bila ada surat yang menunggu dan perlu dihubungi.</div></div>
            <button className="btn btn-primary" style={{ minHeight: 50, fontSize: 16 }} disabled={sibuk}>{sibuk ? 'Menyimpan...' : 'Simpan biodata'}</button>
          </form>

          <div style={kartu}>
            <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>Data akun</h3>
            {baris('Email', user?.email)}
            {baris('Bidang / unit', p?.role === 'admin' ? 'Admin web' : unit ? `${unit.nama} (${NAMA_TIPE[unit.tipe] || unit.tipe})` : 'Belum ditempatkan — minta admin mengaturnya')}
            {baris('Bergabung', fmtTgl(user?.created_at))}
            {baris('Terakhir aktif', p?.last_seen ? fmtWaktu(p.last_seen) : '-')}
            <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginTop: 8 }}>Email dan unit/bidang diatur oleh admin web.</div>
          </div>

          <div style={kartu}>
            <button type="button" onClick={() => setSandi(s => !s)} style={{ background: 'none', border: 'none', font: 'inherit', fontSize: 18, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', justifyContent: 'space-between', width: '100%' }}>🔑 Ganti kata sandi <span>{sandi ? '▴' : '▾'}</span></button>
            {sandi && <div style={{ marginTop: 14 }}><GantiSandi /></div>}
          </div>
        </>
      )}
    </div></div>
  )
}
