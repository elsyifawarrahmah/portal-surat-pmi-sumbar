'use client'
// Profil: banner + foto bulat, biodata dua kolom, data akun, keamanan (ganti kata sandi).
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Avatar from '@/components/Avatar'
import GantiSandi from '@/components/GantiSandi'
import TandaTangan, { unggahTtd } from '@/components/TandaTangan'
import { unggahSatu, hapusBerkasLama, ketHint } from '@/lib/berkas'
import { fmtTgl, fmtWaktu, pesanGalat } from '@/lib/format'
import { NAMA_TIPE } from '@/lib/peran'

const Baris = ({ a, children }) => <div className="profil-baris"><span>{a}</span><b>{children || '-'}</b></div>

export default function ProfilPage() {
  const supabase = createClient()
  const [user, setUser] = useState(null)
  const [p, setP] = useState(null)
  const [unit, setUnit] = useState(null)
  const [awal, setAwal] = useState({ nama_lengkap: '', jabatan: '', telepon: '' })
  const [form, setForm] = useState(awal)
  const [loading, setLoading] = useState(true)
  const [galat, setGalat] = useState('')
  const [ok, setOk] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [fotoSibuk, setFotoSibuk] = useState(false)
  const [sandi, setSandi] = useState(false)
  const [buatTtd, setBuatTtd] = useState(false)
  async function simpanTtd(file) {
    try {
      const url = await unggahTtd(supabase, file, user.id)
      const { error } = await supabase.from('profiles').update({ ttd_url: url }).eq('id', user.id)
      if (error) throw new Error(/ttd_url/.test(error.message) ? 'Fitur tanda tangan belum siap. Mohon beri tahu admin web (migrasi-alur-biro-ttd-lampiran.sql).' : error.message)
      setP(x => ({ ...x, ttd_url: url })); setBuatTtd(false)
    } catch (e) { setGalat(e.message) }
  }

  useEffect(() => { muat() }, [])
  async function muat() {
    const { data: u } = await supabase.auth.getUser()
    if (!u?.user) return
    setUser(u.user)
    let r = await supabase.from('profiles').select('*, unit:surat_unit(id, nama, tipe)').eq('id', u.user.id).maybeSingle()
    if (r.error) r = await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle()
    if (r.error) { setGalat(pesanGalat(r.error)); setLoading(false); return }
    const f = { nama_lengkap: r.data?.nama_lengkap || '', jabatan: r.data?.jabatan || '', telepon: r.data?.telepon || '' }
    setP(r.data); setUnit(r.data?.unit || null); setAwal(f); setForm(f); setLoading(false)
  }
  const berubah = JSON.stringify(form) !== JSON.stringify(awal)

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

  const admin = p?.role === 'admin'
  return (
    <div className="app"><div className="main kolom" style={{ '--lebar': '1040px' }}>
      <div className="topbar"><div><h1>Profil Saya</h1><p className="desc">Kelola biodata, foto, dan keamanan akunmu.</p></div></div>
      {galat && <div className="error-box">{galat}</div>}
      {ok && <div style={{ background: 'var(--stock-bg)', color: 'var(--stock)', padding: '11px 16px', borderRadius: 12, fontWeight: 700, marginBottom: 16 }}>✓ {ok}</div>}
      {loading ? <div style={{ padding: 30, color: 'var(--ink-soft)' }}>Memuat...</div> : (
        <>
          <div className="profil-kepala">
            <div className="profil-banner" />
            <div className="profil-isi">
              <div className="profil-foto">
                <Avatar url={p?.foto_url} nama={p?.nama_lengkap} ukuran={122} />
                <label className="profil-kamera" title={p?.foto_url ? 'Ganti foto' : 'Pasang foto'} style={{ cursor: fotoSibuk ? 'wait' : 'pointer' }}>{fotoSibuk ? '…' : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>}<input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={ubahFoto} disabled={fotoSibuk} /></label>
              </div>
              <div className="profil-nama">
                <h1>{p?.nama_lengkap}</h1>
                <div className="profil-sub">{p?.jabatan || (admin ? 'Admin web' : unit?.nama || 'Belum ada jabatan')}</div>
                <div>
                  <span className="chip" style={{ background: admin ? '#FBE7E7' : 'var(--gold-bg)', color: admin ? 'var(--pmi-red-dark)' : 'var(--gold)' }}>{admin ? 'Admin web' : '' + (unit?.nama || 'Belum ada unit')}</span>
                  <span className="chip" style={{ background: 'var(--stock-bg)', color: 'var(--stock)' }}>● Aktif</span>
                  {p?.foto_url && <a href="#" onClick={e => { e.preventDefault(); hapusFoto() }} style={{ fontSize: 13, color: 'var(--ink-soft)', textDecoration: 'underline', marginLeft: 4 }}>Hapus foto</a>}
                </div>
              </div>
            </div>
            <div className="profil-catatan">Klik ikon kamera untuk {p?.foto_url ? 'mengganti' : 'memasang'} foto. {ketHint('foto')}</div>
          </div>

          <div className="profil-grid">
            <form onSubmit={simpan} className="profil-kartu">
              <h3>Biodata</h3>
              <p className="ket">Data ini terlihat oleh rekan kerja di SATria PMI.</p>
              <div className="profil-2kol">
                <div className="field"><label>Nama lengkap</label><input value={form.nama_lengkap} onChange={e => setForm({ ...form, nama_lengkap: e.target.value })} required /></div>
                <div className="field"><label>Jabatan</label><input value={form.jabatan} onChange={e => setForm({ ...form, jabatan: e.target.value })} placeholder="mis. Sekretaris" /></div>
                <div className="field"><label>Nomor HP / WhatsApp</label><input value={form.telepon} onChange={e => setForm({ ...form, telepon: e.target.value })} inputMode="tel" placeholder="08xxxxxxxxxx" /></div>
                <div className="field"><label>Email</label><input value={user?.email || ''} disabled style={{ background: '#F3EFE9', color: 'var(--ink-soft)' }} /></div>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Nomor HP dipakai bila ada surat yang menunggu dan perlu dihubungi. Email diatur oleh admin web.</div>
              <div className="profil-aksi">
                {berubah && <button type="button" className="btn btn-ghost" onClick={() => setForm(awal)}>Batalkan perubahan</button>}
                <button className="btn btn-primary" disabled={sibuk || !berubah}>{sibuk ? 'Menyimpan...' : 'Simpan perubahan'}</button>
              </div>
            </form>

            <div>
              <div className="profil-kartu">
                <h3>Data akun</h3>
                <p className="ket">Diatur oleh admin web.</p>
                <Baris a="Bidang / unit">{admin ? 'Admin web' : unit ? `${unit.nama}` : 'Belum ditempatkan'}</Baris>
                {unit && !admin && <Baris a="Jenis unit">{NAMA_TIPE[unit.tipe] || unit.tipe}</Baris>}
                <Baris a="Peran">{admin ? 'Admin' : 'Pengguna'}</Baris>
                <Baris a="Bergabung">{fmtTgl(user?.created_at)}</Baris>
                <Baris a="Terakhir aktif">{p?.last_seen ? fmtWaktu(p.last_seen) : '-'}</Baris>
              </div>

              <div className="profil-kartu">
                <h3>Tanda tangan digital</h3>
                <p className="ket">Dipakai saat meneruskan / mendisposisikan surat.</p>
                {p?.ttd_url && !buatTtd && <img src={p.ttd_url} alt="Tanda tangan" style={{ maxWidth: '100%', height: 90, background: '#fff', border: '1px solid var(--line)', borderRadius: 8, padding: 4 }} />}
                {!buatTtd
                  ? <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => setBuatTtd(true)}>{p?.ttd_url ? 'Buat ulang tanda tangan' : 'Buat tanda tangan'}</button>
                  : <div style={{ marginTop: 12 }}><TandaTangan onSimpan={simpanTtd} onBatal={() => setBuatTtd(false)} simpanLabel="Simpan tanda tangan" /></div>}
              </div>

              <div className="profil-kartu">
                <h3>Keamanan</h3>
                <p className="ket">Jaga akunmu tetap aman.</p>
                <Baris a="Kata sandi">••••••••</Baris>
                {!sandi
                  ? <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: 12 }} onClick={() => setSandi(true)}>Ganti kata sandi</button>
                  : <div style={{ marginTop: 14 }}><GantiSandi onSelesai={() => setTimeout(() => setSandi(false), 1500)} /></div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div></div>
  )
}
