'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useUnits, NAMA_TIPE } from '@/lib/peran'
import { PESAN_MIGRASI } from '@/lib/format'

export default function DataUserPage() {
  const supabase = createClient()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState('viewer')
  const [search, setSearch] = useState('')
  const { units, unitSiap, muatUnit } = useUnits()
  const [unitBaru, setUnitBaru] = useState({ kode: '', nama: '', tipe: 'bidang' })
  const [pesanUnit, setPesanUnit] = useState('')

  const isAdmin = myRole === 'admin'

  useEffect(() => {
    load()
    const interval = setInterval(load, 20000) // refresh status online tiap 20 detik
    return () => clearInterval(interval)
  }, [])

  async function load() {
    const { data: userData } = await supabase.auth.getUser()
    if (userData?.user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', userData.user.id).single()
      if (profile) setMyRole(profile.role)
    }
    const { data } = await supabase.from('profiles').select('*').order('nama_lengkap')
    setUsers(data || [])
    setLoading(false)
  }

  const [meId, setMeId] = useState('')
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id || '')) }, [])
  async function aturSandi(u) {
    const saran = 'Satria' + Math.floor(1000 + Math.random() * 9000)
    const baru = prompt(`Kata sandi BARU untuk "${u.nama_lengkap}" (${u.email || ''}).\n\nMinimal 8 karakter, ada huruf dan angka. Boleh pakai saran ini:`, saran)
    if (!baru) return
    if (baru.length < 8 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) { alert('Kata sandi minimal 8 karakter, ada huruf dan angka.'); return }
    const r = await fetch('/api/admin-sandi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: u.id, sandi: baru }) }).then(x => x.json()).catch(() => ({ ok: false, pesan: 'Tidak tersambung ke server.' }))
    if (!r.ok) { alert('Belum berhasil: ' + (r.pesan || 'coba lagi')); return }
    alert(`Kata sandi ${u.nama_lengkap} sudah diganti menjadi:\n\n${baru}\n\nBeri tahu orangnya. Setelah masuk, ia bisa menggantinya di menu Profil.`)
  }
  async function hapusUser(u) {
    if (u.id === meId) { alert('Kamu tidak bisa menghapus akunmu sendiri.'); return }
    if (!confirm(`Hapus akun "${u.nama_lengkap}" (${u.email || 'tanpa email'})?\n\nAkun ini tidak bisa masuk lagi. Surat yang pernah dia catat tetap ada.\nTindakan ini tidak bisa dibatalkan.`)) return
    const { error } = await supabase.rpc('hapus_user', { p_id: u.id })
    if (error) { alert(/function|schema cache|does not exist/i.test(error.message) ? 'Fitur hapus belum aktif di database. Jalankan supabase/migrasi-hapus-user.sql di Supabase (SQL Editor) satu kali.\n\nPesan teknis: ' + error.message : 'Belum bisa menghapus: ' + error.message); return }
    load()
  }

  async function ubahRole(id, role) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    load()
  }

  async function simpanTelepon(id, nilai, lama) {
    const baru = nilai.trim()
    if (baru === (lama || '')) return
    const { error } = await supabase.from('profiles').update({ telepon: baru || null }).eq('id', id)
    if (error) { alert('Gagal menyimpan telepon: ' + (/telepon/.test(error.message) ? 'jalankan supabase/migrasi-alur-berjenjang.sql dulu.' : error.message)); return }
    load()
  }
  async function ubahUnit(id, unitId) {
    const { error } = await supabase.from('profiles').update({ unit_id: unitId || null }).eq('id', id)
    if (error) { alert('Gagal mengubah unit: ' + error.message); return }
    load()
  }
  async function tambahUnit() {
    setPesanUnit('')
    const kode = unitBaru.kode.trim().toUpperCase(), nama = unitBaru.nama.trim()
    if (!kode || !nama) { setPesanUnit('Isi kode dan nama unit.'); return }
    const { error } = await supabase.from('surat_unit').insert({ kode, nama, tipe: unitBaru.tipe, urut: 100 + units.length })
    if (error) { setPesanUnit(error.message); return }
    setUnitBaru({ kode: '', nama: '', tipe: 'bidang' }); muatUnit()
  }
  async function ubahAktifUnit(u) {
    const { error } = await supabase.from('surat_unit').update({ aktif: !u.aktif }).eq('id', u.id)
    if (error) { alert('Gagal: ' + error.message); return }
    muatUnit()
  }

  function isOnline(lastSeen) {
    if (!lastSeen) return false
    return (Date.now() - new Date(lastSeen).getTime()) < 90 * 1000 // online kalau ping < 90 detik lalu
  }

  const filtered = users.filter(u => (u.nama_lengkap || '').toLowerCase().includes(search.toLowerCase()) || (u.email || '').toLowerCase().includes(search.toLowerCase()))
  const onlineCount = users.filter(u => isOnline(u.last_seen)).length

  if (!isAdmin && !loading) {
    return (
      <div className="app">
        <div className="main">
          <div className="topbar"><div><h1>Data User</h1><p className="desc">Halaman ini khusus admin.</p></div></div>
          <div style={{background:'var(--gold-bg)',color:'var(--gold)',padding:'12px 16px',borderRadius:10,fontSize:13,fontWeight:600}}>
            🔒 Kamu tidak punya akses ke halaman ini. Hubungi admin (Kabid) kalau butuh akses.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="main">
        <div className="topbar">
          <div><h1>Data User</h1><p className="desc">Semua akun yang terdaftar, dan siapa saja yang sedang online sekarang.</p></div>
        </div>

        <div className="grid4" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
          <div className="stat" style={{'--accent':'var(--stock)'}}><div className="lbl">Total Akun</div><div className="val">{users.length}</div></div>
          <div className="stat" style={{'--accent':'var(--pmi-red)'}}><div className="lbl">Sedang Online</div><div className="val">{onlineCount}</div></div>
          <div className="stat" style={{'--accent':'var(--gold)'}}><div className="lbl">Admin</div><div className="val">{users.filter(u=>u.role==='admin').length}</div></div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <input placeholder="Cari nama / email..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:260}} />
          </div>
          <div style={{overflowX:'auto'}}>
            <table>
              <thead><tr><th>Status</th><th>Nama</th><th>Email</th><th>Role</th><th>Unit / Bidang</th><th>Telepon / WA</th><th>Terakhir Aktif</th><th>Ubah Role</th><th>Sandi</th><th>Hapus</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={10} style={{textAlign:'center',padding:30}}>Memuat...</td></tr> :
                filtered.length===0 ? <tr><td colSpan={10} style={{textAlign:'center',padding:30,color:'var(--ink-soft)'}}>Tidak ada user ditemukan.</td></tr> :
                filtered.map(u => {
                  const online = isOnline(u.last_seen)
                  return (
                    <tr key={u.id}>
                      <td>
                        <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color: online ? 'var(--stock)' : 'var(--ink-soft)'}}>
                          <span style={{width:8,height:8,borderRadius:'50%',background: online ? '#2FA84F' : '#C9C1B8',display:'inline-block'}}></span>
                          {online ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td><strong>{u.nama_lengkap}</strong></td>
                      <td>{u.email || '-'}</td>
                      <td><span className="tag" style={u.role==='admin' ? {background:'var(--stock-bg)',color:'var(--stock)'} : {background:'var(--cream)',color:'var(--ink-soft)'}}>{u.role}</span></td>
                      <td>
                        <select value={u.unit_id || ''} onChange={e=>ubahUnit(u.id, e.target.value)} style={{padding:'5px 8px',fontSize:12.5,minWidth:170}}>
                          <option value="">— belum ada unit —</option>
                          {units.map(x => <option key={x.id} value={x.id}>{x.nama}</option>)}
                        </select>
                      </td>
                      <td><input defaultValue={u.telepon || ''} placeholder="08xxxxxxxxxx" inputMode="tel" onBlur={e=>simpanTelepon(u.id, e.target.value, u.telepon)} style={{padding:'5px 8px',fontSize:12.5,minWidth:130}} /></td>
                      <td style={{fontSize:12.5,color:'var(--ink-soft)'}}>{u.last_seen ? new Date(u.last_seen).toLocaleString('id-ID') : 'Belum pernah'}</td>
                      <td>
                        <select value={u.role} onChange={e=>ubahRole(u.id, e.target.value)} style={{padding:'5px 8px',fontSize:12.5}}>
                          <option value="admin">admin</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </td>
                      <td><button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,fontSize:12.5}} onClick={()=>aturSandi(u)}>Atur sandi</button></td>
                      <td>{u.id === meId ? <span style={{fontSize:12,color:'var(--ink-soft)'}}>akunmu</span> : <button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,fontSize:12.5,color:'#B3261E',fontWeight:700}} onClick={()=>hapusUser(u)}>Hapus</button>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Unit / Bidang</h3></div>
          <div className="panel-body">
            <p style={{fontSize:13.5,color:'var(--ink-soft)',marginTop:0}}>Unit menentukan hak akses tiap akun: <b>Biro Umum</b> memantau (hanya lihat, memanggil, mengarsip); <b>Sekretaris</b> mencatat surat masuk &amp; membuat disposisi; <b>Pimpinan</b> (Ketua, Kepala Markas) membuat disposisi; <b>Bidang</b> menerima disposisi dan mencatat surat keluarnya. Atur unit tiap akun di tabel di atas.</p>
            {!unitSiap || units.length === 0 ? <div className="error-box">Daftar unit belum ada. {PESAN_MIGRASI}</div> : (
              <div style={{overflowX:'auto'}}><table>
                <thead><tr><th>Kode</th><th>Nama Unit</th><th>Jenis</th><th>Anggota</th><th>Status</th></tr></thead>
                <tbody>{units.map(u => (
                  <tr key={u.id}>
                    <td className="mono">{u.kode}</td><td><b>{u.nama}</b></td><td>{NAMA_TIPE[u.tipe]}</td>
                    <td>{users.filter(x => x.unit_id === u.id).map(x => x.nama_lengkap).join(', ') || <span style={{color:'var(--ink-soft)'}}>-</span>}</td>
                    <td><button className="btn btn-ghost" style={{padding:'4px 10px',minHeight:34,fontSize:12.5}} onClick={()=>ubahAktifUnit(u)}>{u.aktif ? 'Aktif — nonaktifkan' : 'Nonaktif — aktifkan'}</button></td>
                  </tr>))}</tbody>
              </table></div>
            )}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:14,alignItems:'flex-end'}}>
              <div style={{width:110}}><label>Kode</label><input value={unitBaru.kode} onChange={e=>setUnitBaru({...unitBaru,kode:e.target.value})} placeholder="mis. KSR" /></div>
              <div style={{flex:1,minWidth:200}}><label>Nama unit baru</label><input value={unitBaru.nama} onChange={e=>setUnitBaru({...unitBaru,nama:e.target.value})} placeholder="mis. Bidang Kepemudaan" /></div>
              <div style={{width:160}}><label>Jenis</label><select value={unitBaru.tipe} onChange={e=>setUnitBaru({...unitBaru,tipe:e.target.value})}>{Object.entries(NAMA_TIPE).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
              <button className="btn btn-primary" onClick={tambahUnit}>+ Tambah Unit</button>
            </div>
            {pesanUnit && <div className="error-box" style={{marginTop:10}}>{pesanUnit}</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
