'use client'
// Pemantauan Biro Umum: memantau keaktifan tiap bidang (input surat, disposisi) dan "memanggil" bidang yang belum input surat.
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { usePeran, useUnits } from '@/lib/peran'
import Modal, { Info } from '@/components/Modal'
import { fmtTgl, fmtWaktu, hariSejak, sudahLewat, tabelBelumAda, PESAN_MIGRASI } from '@/lib/format'

const JENIS = {
  belum_input: 'Surat belum diinput ke portal',
  belum_dikirim: 'Surat belum dikirim / diteruskan ke Markas',
  tindak_lanjut: 'Disposisi belum ditindaklanjuti',
  lainnya: 'Lainnya',
}
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
const cocokUnit = (r, u) => r.unit_id === u.id || norm(r.divisi) === norm(u.nama) || norm(r.divisi) === norm(u.nama.replace(/^bidang /i, ''))

function templatePesan(jenis, unit, terakhir) {
  const t = {
    belum_input: `Mohon segera input surat yang belum tercatat di portal oleh ${unit}.${terakhir ? ` Input terakhir: ${terakhir}.` : ' Belum ada surat yang diinput.'} Jika memang tidak ada surat, mohon balas panggilan ini.`,
    belum_dikirim: `Mohon surat yang sudah disiapkan oleh ${unit} segera dikirim / diteruskan ke Markas dan dicatat di portal.`,
    tindak_lanjut: `Mohon tindak lanjuti disposisi yang masih menunggu di ${unit}.`,
    lainnya: '',
  }
  return t[jenis]
}

export default function PemantauanPage() {
  const supabase = createClient()
  const peran = usePeran()
  const { units } = useUnits()
  const [data, setData] = useState({ keluar: [], tujuan: [], panggilan: [], masuk: [], disposisiSurat: new Set() })
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [batas, setBatas] = useState(7)
  const [panggil, setPanggil] = useState(null)   // { unit, jenis, pesan, suratId }
  const [balas, setBalas] = useState(null)       // { p, teks }
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)

  useEffect(() => { if (!peran.loading) load() }, [peran.loading])
  useEffect(() => {
    const ch = supabase.channel('pemantauan').on('postgres_changes', { event: '*', schema: 'public', table: 'surat_panggilan' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function load() {
    setLoading(true)
    const [k, t, p, m, d] = await Promise.all([
      supabase.from('surat_keluar').select('id, unit_id, divisi, created_at, nomor_surat').order('created_at', { ascending: false }).limit(3000),
      supabase.from('surat_disposisi_tujuan').select('id, unit_id, status, batas_waktu, perlu_jawaban, surat_jawaban_id, created_at, disposisi:surat_disposisi(surat_id, surat:surat_masuk(id, nomor_surat, perihal, asal_surat, sifat))').limit(2000),
      supabase.from('surat_panggilan').select('*, unit:surat_unit(nama), pembuat:profiles!surat_panggilan_dibuat_oleh_fkey(nama_lengkap), surat:surat_masuk(nomor_surat)').order('created_at', { ascending: false }).limit(300),
      supabase.from('surat_masuk').select('id, nomor_surat, nomor_agenda, asal_surat, perihal, created_at, sifat').order('created_at', { ascending: false }).limit(1000),
      supabase.from('surat_disposisi').select('surat_id').limit(3000),
    ])
    const gagal = [k, t, p, m, d].find(r => r.error)
    if (gagal) { setPesan(tabelBelumAda(gagal.error) ? PESAN_MIGRASI : 'Gagal memuat data: ' + gagal.error.message); setLoading(false); return }
    setPesan('')
    setData({ keluar: k.data || [], tujuan: t.data || [], panggilan: p.data || [], masuk: m.data || [], disposisiSurat: new Set((d.data || []).map(x => x.surat_id)) })
    setLoading(false)
  }

  const awalBulan = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const unitPantau = units.filter(u => u.aktif && u.tipe !== 'biro_umum')

  const baris = useMemo(() => unitPantau.map(u => {
    const kel = data.keluar.filter(r => cocokUnit(r, u))
    const tj = data.tujuan.filter(r => r.unit_id === u.id)
    const terakhir = kel[0]?.created_at || null
    const hari = hariSejak(terakhir)
    const terbuka = data.panggilan.filter(p => p.unit_id === u.id && !p.selesai_pada).length
    return {
      u, bulanIni: kel.filter(r => r.created_at >= awalBulan).length, total: kel.length, terakhir, hari,
      menunggu: tj.filter(r => r.status === 'menunggu').length, proses: tj.filter(r => ['dibaca', 'diproses'].includes(r.status)).length,
      lewat: tj.filter(r => r.status !== 'selesai' && sudahLewat(r.batas_waktu)).length, terbuka,
      tidakAktif: terakhir === null || hari >= batas,
    }
  }), [units, data, batas])

  const belumDisposisi = data.masuk.filter(m => !data.disposisiSurat.has(m.id) && hariSejak(m.created_at) >= 1)
  const menungguJawaban = data.tujuan.filter(t => t.perlu_jawaban && !t.surat_jawaban_id).map(t => ({ ...t, unit: units.find(u => u.id === t.unit_id), surat: t.disposisi?.surat }))
  const panggilanSaya = data.panggilan.filter(p => peran.unitId && p.unit_id === peran.unitId)

  function bukaPanggil(unit, jenis = 'belum_input') {
    const b = baris.find(x => x.u.id === unit.id)
    setError('')
    setPanggil({ unit, jenis, pesan: templatePesan(jenis, unit.nama, b?.terakhir ? fmtWaktu(b.terakhir) : ''), suratId: '' })
  }
  async function kirim() {
    if (!panggil.pesan.trim()) { setError('Isi pesan panggilan.'); return }
    setSibuk(true)
    const { error: err } = await supabase.from('surat_panggilan').insert({ unit_id: panggil.unit.id, jenis: panggil.jenis, pesan: panggil.pesan.trim(), surat_masuk_id: panggil.suratId || null })
    setSibuk(false)
    if (err) { setError(err.message); return }
    setPanggil(null); load()
  }
  async function panggilSemua() {
    const sasaran = baris.filter(b => b.tidakAktif && b.terbuka === 0)
    if (sasaran.length === 0) { alert('Tidak ada unit yang perlu dipanggil (semua aktif atau sudah dipanggil dan belum membalas).'); return }
    if (!confirm(`Kirim panggilan "belum input surat" ke ${sasaran.length} unit?\n\n${sasaran.map(b => '• ' + b.u.nama).join('\n')}`)) return
    const rows = sasaran.map(b => ({ unit_id: b.u.id, jenis: 'belum_input', pesan: templatePesan('belum_input', b.u.nama, b.terakhir ? fmtWaktu(b.terakhir) : '') }))
    const { error: err } = await supabase.from('surat_panggilan').insert(rows)
    if (err) { alert('Gagal: ' + err.message); return }
    load()
  }
  async function selesaikan() {
    setSibuk(true)
    const { error: err } = await supabase.from('surat_panggilan').update({ balasan: balas.teks.trim() || null, selesai_pada: new Date().toISOString() }).eq('id', balas.p.id)
    setSibuk(false)
    if (err) { alert('Gagal: ' + err.message); return }
    setBalas(null); load()
  }
  async function tandaiBaca(p) {
    await supabase.from('surat_panggilan').update({ dibaca_pada: new Date().toISOString() }).eq('id', p.id)
    load()
  }

  const statusPanggilan = p => p.selesai_pada ? { l: 'Sudah ditindaklanjuti', s: { background: 'var(--stock-bg)', color: 'var(--stock)' } } : p.dibaca_pada ? { l: 'Sudah dibaca', s: { background: 'var(--gold-bg)', color: 'var(--gold)' } } : { l: 'Belum dibaca', s: { background: '#FBE7E7', color: '#B3261E' } }

  return (
    <div className="app"><div className="main">
      <div className="topbar">
        <div><h1>Pemantauan</h1><p className="desc">{peran.bisaPantau ? 'Biro Umum memantau keaktifan tiap bidang. Bidang yang belum input surat bisa dipanggil.' : 'Panggilan dari Biro Umum untuk unit kamu.'}</p></div>
        {peran.bisaPantau && <button className="btn btn-primary" onClick={panggilSemua}>📣 Panggil Semua yang Belum Aktif</button>}
      </div>

      {peran.migrasiBelum && <Info>Pembaruan database belum dijalankan. {PESAN_MIGRASI}</Info>}
      {pesan && <div className="error-box">{pesan}</div>}

      {/* Panggilan untuk unit saya */}
      {peran.unitId && !peran.isBiroUmum && (
        <div className="panel">
          <div className="panel-head"><h3>📣 Panggilan untuk {peran.unit?.nama || 'unit kamu'}</h3></div>
          <div className="panel-body">
            {panggilanSaya.length === 0 ? <div style={{ color: 'var(--ink-soft)' }}>Tidak ada panggilan. Terima kasih sudah aktif 👍</div> :
              panggilanSaya.map(p => { const s = statusPanggilan(p); return (
                <div key={p.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><b>{JENIS[p.jenis]}</b><span className="tag" style={s.s}>{s.l}</span></div>
                  <div style={{ fontSize: 14 }}>{p.pesan}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{fmtWaktu(p.created_at)} · {p.pembuat?.nama_lengkap || 'Biro Umum'}{p.surat?.nomor_surat ? ` · surat ${p.surat.nomor_surat}` : ''}</div>
                  {p.balasan && <div style={{ fontSize: 13.5, background: 'var(--stock-bg)', borderRadius: 8, padding: '6px 10px', marginTop: 6 }}><b>Balasan:</b> {p.balasan}</div>}
                  {!p.selesai_pada && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {!p.dibaca_pada && <button className="btn btn-ghost" style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => tandaiBaca(p)}>👁 Tandai sudah dibaca</button>}
                    <button className="btn btn-primary" style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => setBalas({ p, teks: '' })}>✅ Sudah ditindaklanjuti…</button>
                    {p.jenis === 'belum_input' && <Link href="/surat-keluar" className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 13, textDecoration: 'none' }}>Input surat keluar →</Link>}
                  </div>}
                </div>) })}
          </div>
        </div>
      )}

      {peran.bisaPantau && (
        <>
          <div className="panel">
            <div className="panel-head">
              <h3>Keaktifan Tiap Bidang</h3>
              <label style={{ textTransform: 'none', margin: 0, display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}>Dianggap belum aktif bila tidak input surat dalam
                <select value={batas} onChange={e => setBatas(Number(e.target.value))} style={{ width: 'auto', padding: '5px 8px' }}>{[3, 7, 14, 30].map(n => <option key={n} value={n}>{n} hari</option>)}</select>
              </label>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead><tr><th>Unit / Bidang</th><th>Surat keluar bulan ini</th><th>Terakhir input</th><th>Disposisi menunggu</th><th>Diproses</th><th>Lewat batas</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24 }}>Memuat...</td></tr> :
                    baris.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--ink-soft)' }}>Daftar unit belum ada. {PESAN_MIGRASI}</td></tr> :
                      baris.map(b => (
                        <tr key={b.u.id}>
                          <td data-label="Unit"><b>{b.u.nama}</b></td>
                          <td data-label="Bulan ini">{b.bulanIni}</td>
                          <td data-label="Terakhir input">{b.terakhir ? <>{fmtTgl(b.terakhir)}<span style={{ color: 'var(--ink-soft)', fontSize: 12.5 }}> ({b.hari === 0 ? 'hari ini' : b.hari + ' hari lalu'})</span></> : <span style={{ color: '#B3261E' }}>Belum pernah</span>}</td>
                          <td data-label="Menunggu">{b.menunggu}</td>
                          <td data-label="Diproses">{b.proses}</td>
                          <td data-label="Lewat batas" style={b.lewat ? { color: '#B3261E', fontWeight: 700 } : null}>{b.lewat}</td>
                          <td data-label="Status">{b.tidakAktif ? <span className="tag" style={{ background: '#FBE7E7', color: '#B3261E' }}>Perlu dipanggil</span> : <span className="tag" style={{ background: 'var(--stock-bg)', color: 'var(--stock)' }}>Aktif</span>}{b.terbuka > 0 && <span style={{ fontSize: 12, color: 'var(--ink-soft)', marginLeft: 6 }}>{b.terbuka} panggilan terbuka</span>}</td>
                          <td data-label=""><button className="btn btn-ghost" style={{ padding: '5px 12px', minHeight: 36, fontSize: 13 }} onClick={() => bukaPanggil(b.u)}>📣 Panggil</button></td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Surat masuk belum didisposisi (≥ 1 hari)</h3><span className="tag" style={{ background: belumDisposisi.length ? '#FBE7E7' : 'var(--stock-bg)', color: belumDisposisi.length ? '#B3261E' : 'var(--stock)' }}>{belumDisposisi.length}</span></div>
            <div style={{ overflowX: 'auto' }}><table>
              <thead><tr><th>Dicatat</th><th>Agenda</th><th>No. Surat</th><th>Asal</th><th>Perihal</th><th>Sudah</th><th></th></tr></thead>
              <tbody>{belumDisposisi.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: 22, color: 'var(--ink-soft)' }}>Semua surat masuk sudah didisposisi 👍</td></tr> : belumDisposisi.slice(0, 50).map(m => (
                <tr key={m.id}>
                  <td data-label="Dicatat">{fmtWaktu(m.created_at)}</td><td data-label="Agenda" className="mono">{m.nomor_agenda || '-'}</td><td data-label="No. Surat" className="mono">{m.sifat === 'Rahasia' && !peran.isAdmin ? '••••' : m.nomor_surat}</td>
                  <td data-label="Asal">{m.sifat === 'Rahasia' && !peran.isAdmin ? '🔒 Rahasia' : m.asal_surat}</td><td data-label="Perihal">{m.sifat === 'Rahasia' && !peran.isAdmin ? '-' : m.perihal}</td>
                  <td data-label="Sudah"><span className="tag" style={{ background: '#FBE7E7', color: '#B3261E' }}>{hariSejak(m.created_at)} hari</span></td>
                  <td data-label=""><Link href={`/surat-masuk?disposisi=${m.id}`} style={{ color: 'var(--pmi-red)', fontWeight: 700, textDecoration: 'none' }}>Lihat →</Link></td>
                </tr>))}</tbody>
            </table></div>
          </div>

          <div className="panel">
            <div className="panel-head"><h3>Menunggu surat jawaban</h3><span className="tag" style={{ background: menungguJawaban.length ? 'var(--gold-bg)' : 'var(--stock-bg)', color: menungguJawaban.length ? 'var(--gold)' : 'var(--stock)' }}>{menungguJawaban.length}</span></div>
            <div style={{ overflowX: 'auto' }}><table>
              <thead><tr><th>Unit</th><th>Surat</th><th>Batas</th><th>Status disposisi</th></tr></thead>
              <tbody>{menungguJawaban.length === 0 ? <tr><td colSpan={4} style={{ textAlign: 'center', padding: 22, color: 'var(--ink-soft)' }}>Tidak ada surat jawaban yang tertunggak.</td></tr> : menungguJawaban.map(t => (
                <tr key={t.id}>
                  <td data-label="Unit"><b>{t.unit?.nama}</b></td>
                  <td data-label="Surat">{t.surat?.sifat === 'Rahasia' && !peran.isAdmin ? '🔒 Rahasia' : `${t.surat?.nomor_surat} — ${t.surat?.perihal}`}</td>
                  <td data-label="Batas" style={t.status !== 'selesai' && sudahLewat(t.batas_waktu) ? { color: '#B3261E', fontWeight: 700 } : null}>{t.batas_waktu ? fmtTgl(t.batas_waktu) : '-'}</td>
                  <td data-label="Status">{t.status}</td>
                </tr>))}</tbody>
            </table></div>
          </div>
        </>
      )}

      {(peran.bisaPantau || peran.isAdmin) && (
        <div className="panel">
          <div className="panel-head"><h3>Riwayat Panggilan</h3></div>
          <div style={{ overflowX: 'auto' }}><table>
            <thead><tr><th>Waktu</th><th>Unit</th><th>Jenis</th><th>Pesan</th><th>Status</th><th>Balasan</th></tr></thead>
            <tbody>{data.panggilan.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 22, color: 'var(--ink-soft)' }}>Belum ada panggilan.</td></tr> : data.panggilan.slice(0, 100).map(p => { const s = statusPanggilan(p); return (
              <tr key={p.id}>
                <td data-label="Waktu">{fmtWaktu(p.created_at)}</td><td data-label="Unit"><b>{p.unit?.nama}</b></td><td data-label="Jenis">{JENIS[p.jenis]}</td><td data-label="Pesan" style={{ maxWidth: 320 }}>{p.pesan}</td>
                <td data-label="Status"><span className="tag" style={s.s}>{s.l}</span>{p.selesai_pada && <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{fmtWaktu(p.selesai_pada)}</div>}</td><td data-label="Balasan">{p.balasan || '-'}</td>
              </tr>) })}</tbody>
          </table></div>
        </div>
      )}

      {panggil && (
        <Modal judul={`Panggil ${panggil.unit.nama}`} onClose={() => setPanggil(null)} lebar={520}
          footer={<><button className="btn btn-ghost" onClick={() => setPanggil(null)}>Batal</button><button className="btn btn-primary" disabled={sibuk} onClick={kirim}>{sibuk ? 'Mengirim...' : '📣 Kirim Panggilan'}</button></>}>
          {error && <div className="error-box">{error}</div>}
          <div className="field"><label>Keperluan</label>
            <select value={panggil.jenis} onChange={e => { const b = baris.find(x => x.u.id === panggil.unit.id); setPanggil({ ...panggil, jenis: e.target.value, pesan: templatePesan(e.target.value, panggil.unit.nama, b?.terakhir ? fmtWaktu(b.terakhir) : '') }) }}>
              {Object.entries(JENIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="field"><label>Pesan</label><textarea rows={4} value={panggil.pesan} onChange={e => setPanggil({ ...panggil, pesan: e.target.value })} /></div>
          <div className="field"><label>Terkait surat masuk (opsional)</label>
            <select value={panggil.suratId} onChange={e => setPanggil({ ...panggil, suratId: e.target.value })}>
              <option value="">— tidak terkait surat tertentu —</option>{data.masuk.filter(m => m.sifat !== 'Rahasia' || peran.isAdmin).slice(0, 100).map(m => <option key={m.id} value={m.id}>{m.nomor_surat} — {m.perihal}</option>)}
            </select></div>
        </Modal>
      )}

      {balas && (
        <Modal judul="Tindak lanjut panggilan" onClose={() => setBalas(null)} lebar={480}
          footer={<><button className="btn btn-ghost" onClick={() => setBalas(null)}>Batal</button><button className="btn btn-primary" disabled={sibuk} onClick={selesaikan}>Simpan</button></>}>
          <div style={{ fontSize: 14, marginBottom: 12 }}>{balas.p.pesan}</div>
          <div className="field"><label>Balasan untuk Biro Umum (opsional)</label><textarea rows={3} value={balas.teks} onChange={e => setBalas({ ...balas, teks: e.target.value })} placeholder="mis. Surat sudah diinput. / Tidak ada surat keluar minggu ini." /></div>
        </Modal>
      )}
    </div></div>
  )
}
