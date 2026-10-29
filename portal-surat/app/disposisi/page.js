'use client'
// Disposisi: kotak masuk disposisi per bidang + Ruang Disposisi (buku/arsip semua disposisi).
import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePeran, useUnits } from '@/lib/peran'
import Modal, { Info } from '@/components/Modal'
import DisposisiPanel from '@/components/DisposisiPanel'
import { fmtTgl, sudahLewat, STATUS_DISPOSISI, tabelBelumAda, PESAN_MIGRASI, unduhCsv } from '@/lib/format'
import { cetakDaftar } from '@/lib/cetak'

export default function DisposisiPage() {
  return <Suspense fallback={null}><Isi /></Suspense>
}

function Isi() {
  const supabase = createClient()
  const peran = usePeran()
  const { units } = useUnits()
  const params = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [pesan, setPesan] = useState('')
  const [fUnit, setFUnit] = useState('')          // '' = otomatis (unit saya / semua)
  const [fStatus, setFStatus] = useState('aktif') // aktif = belum selesai
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)      // surat yang dibuka
  const [pilih, setPilih] = useState(false)
  const [daftarSurat, setDaftarSurat] = useState([])
  const [cari, setCari] = useState('')

  const unitOtomatis = peran.unitId && !peran.isAdmin && peran.tipe !== 'biro_umum' ? peran.unitId : 'semua'
  const unitAktif = fUnit || unitOtomatis

  useEffect(() => { if (!peran.loading) load() }, [peran.loading])
  useEffect(() => {
    const ch = supabase.channel('disposisi-halaman').on('postgres_changes', { event: '*', schema: 'public', table: 'surat_disposisi_tujuan' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])
  useEffect(() => { const id = params.get('surat'); if (id && rows.length === 0) bukaSuratId(id) }, [params])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('surat_disposisi_tujuan')
      .select('*, unit:surat_unit(id, nama), disposisi:surat_disposisi(id, tanggal_diteruskan, dari_nama, file_scan_url, created_at, surat:surat_masuk(*))')
      .order('created_at', { ascending: false }).limit(1500)
    if (error) { setPesan(tabelBelumAda(error) ? PESAN_MIGRASI : 'Gagal memuat disposisi: ' + error.message); setRows([]) }
    else { setPesan(''); setRows((data || []).filter(r => r.disposisi?.surat)) }
    setLoading(false)
  }

  async function bukaSuratId(id) {
    const { data } = await supabase.from('surat_masuk').select('*').eq('id', id).maybeSingle()
    if (data) setDetail(data)
  }
  async function bukaPilih() {
    setPilih(true)
    const { data } = await supabase.from('surat_masuk').select('id, nomor_surat, nomor_agenda, asal_surat, perihal, tanggal_diterima_kantor, sifat').order('tanggal_diterima_kantor', { ascending: false }).limit(300)
    setDaftarSurat(data || [])
  }

  const rahasia = r => r.disposisi.surat.sifat === 'Rahasia' && !peran.isAdmin && peran.unitId !== r.unit_id

  const tampil = useMemo(() => rows.filter(r => {
    if (unitAktif !== 'semua' && r.unit_id !== unitAktif) return false
    if (fStatus === 'aktif' && r.status === 'selesai') return false
    if (fStatus !== 'aktif' && fStatus !== 'semua' && r.status !== fStatus) return false
    if (search) { const s = r.disposisi.surat; const teks = rahasia(r) ? '' : `${s.nomor_surat} ${s.nomor_agenda} ${s.asal_surat} ${s.perihal} ${r.instruksi} ${r.unit?.nama} ${r.disposisi.dari_nama}`; if (!teks.toLowerCase().includes(search.toLowerCase())) return false }
    return true
  }), [rows, unitAktif, fStatus, search, peran.unitId, peran.isAdmin])

  const hitung = st => rows.filter(r => (unitAktif === 'semua' || r.unit_id === unitAktif) && r.status === st).length
  const lewat = rows.filter(r => (unitAktif === 'semua' || r.unit_id === unitAktif) && r.status !== 'selesai' && sudahLewat(r.batas_waktu)).length
  const namaUnit = unitAktif === 'semua' ? 'Semua Unit' : (units.find(u => u.id === unitAktif)?.nama || 'Unit Saya')

  const kolomCetak = [
    { judul: 'Tgl Diteruskan', k: 'tgl' }, { judul: 'No. Agenda', k: 'agenda' }, { judul: 'No. Surat', k: 'nomor' }, { judul: 'Asal', k: 'asal' }, { judul: 'Perihal', k: 'perihal' },
    { judul: 'Dari', k: 'dari' }, { judul: 'Kepada', k: 'kepada' }, { judul: 'Disposisi', k: 'isi' }, { judul: 'Batas', k: 'batas' }, { judul: 'Status', k: 'status' },
  ]
  const barisCetak = () => tampil.filter(r => !rahasia(r)).map(r => { const s = r.disposisi.surat; return { tgl: fmtTgl(r.disposisi.tanggal_diteruskan), agenda: s.nomor_agenda || '', nomor: s.nomor_surat, asal: s.asal_surat, perihal: s.perihal, dari: r.disposisi.dari_nama || '', kepada: r.unit?.nama || '', isi: r.instruksi || '', batas: r.batas_waktu ? fmtTgl(r.batas_waktu) : '', status: STATUS_DISPOSISI[r.status]?.label || r.status } })

  return (
    <div className="app"><div className="main">
      <div className="topbar">
        <div><h1>Disposisi</h1><p className="desc">Disposisi surat masuk ke tiap bidang. Semua tujuan disposisi tercatat dan diarsipkan otomatis saat selesai.</p></div>
        {peran.bisaDisposisi && <button className="btn btn-primary" onClick={bukaPilih}>+ Buat Disposisi</button>}
      </div>

      {peran.migrasiBelum && <Info warna="gold">Pembaruan database belum dijalankan. {PESAN_MIGRASI}</Info>}
      {peran.isBiroUmum && <Info warna="gold">👁 Biro Umum hanya memantau: semua disposisi bisa dilihat dan dicetak, tetapi tindak lanjut dilakukan oleh bidang tujuan.</Info>}
      {pesan && <div className="error-box">{pesan}</div>}

      <div className="grid4">
        <div className="stat" style={{ '--accent': '#B3261E' }}><div className="lbl">Menunggu</div><div className="val">{hitung('menunggu')}</div></div>
        <div className="stat" style={{ '--accent': 'var(--gold)' }}><div className="lbl">Dibaca / Diproses</div><div className="val">{hitung('dibaca') + hitung('diproses')}</div></div>
        <div className="stat" style={{ '--accent': '#7B2CBF' }}><div className="lbl">Lewat Batas Waktu</div><div className="val">{lewat}</div></div>
        <div className="stat" style={{ '--accent': 'var(--stock)' }}><div className="lbl">Selesai · Diarsipkan</div><div className="val">{hitung('selesai')}</div></div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <input placeholder="Cari nomor / asal / perihal / disposisi..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
            <select value={unitAktif} onChange={e => setFUnit(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="semua">Semua unit</option>{units.filter(u => u.tipe !== 'biro_umum').map(u => <option key={u.id} value={u.id}>{u.nama}</option>)}
            </select>
            <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="aktif">Belum selesai</option><option value="semua">Semua status</option><option value="menunggu">Menunggu</option><option value="dibaca">Sudah dibaca</option><option value="diproses">Sedang diproses</option><option value="selesai">Selesai · diarsipkan</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => cetakDaftar({ judul: 'Buku Disposisi', subjudul: `${namaUnit} · ${fStatus === 'aktif' ? 'belum selesai' : fStatus === 'semua' ? 'semua status' : STATUS_DISPOSISI[fStatus]?.label}`, kolom: kolomCetak, baris: barisCetak(), namaPencetak: peran.nama })}>🖨 Cetak Buku Disposisi</button>
            <button className="btn btn-ghost" onClick={() => unduhCsv('disposisi', kolomCetak.map(k => k.judul), barisCetak().map(b => kolomCetak.map(k => b[k.k])))}>⬇ CSV</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Tgl Diteruskan</th><th>Agenda</th><th>Surat</th><th>Dari</th><th>Kepada</th><th>Disposisi</th><th>Batas</th><th>Status</th><th>Scan</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30 }}>Memuat...</td></tr> :
                tampil.length === 0 ? <tr><td colSpan={9} style={{ textAlign: 'center', padding: 30, color: 'var(--ink-soft)' }}>{rows.length === 0 ? 'Belum ada disposisi.' : 'Tidak ada disposisi yang cocok dengan filter.'}</td></tr> :
                  tampil.map(r => {
                    const s = r.disposisi.surat, st = STATUS_DISPOSISI[r.status], sembunyi = rahasia(r), telat = r.status !== 'selesai' && sudahLewat(r.batas_waktu)
                    return (
                      <tr key={r.id} className="row-click" onClick={() => { if (!sembunyi) setDetail(s) }}>
                        <td data-label="Diteruskan">{fmtTgl(r.disposisi.tanggal_diteruskan)}</td>
                        <td data-label="Agenda" className="mono">{s.nomor_agenda || '-'}</td>
                        <td data-label="Surat">{sembunyi ? '🔒 Rahasia' : <><b className="mono" style={{ fontSize: 13 }}>{s.nomor_surat}</b><br /><span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{s.asal_surat} — {s.perihal}</span></>}</td>
                        <td data-label="Dari">{r.disposisi.dari_nama || '-'}</td>
                        <td data-label="Kepada"><b>{r.unit?.nama}</b></td>
                        <td data-label="Disposisi">{sembunyi ? '-' : (r.instruksi || '-')}{r.perlu_jawaban && !sembunyi && <span className="tag" style={{ marginLeft: 6, background: 'var(--gold-bg)', color: 'var(--gold)' }}>perlu jawaban</span>}</td>
                        <td data-label="Batas" style={telat ? { color: '#B3261E', fontWeight: 700 } : null}>{r.batas_waktu ? fmtTgl(r.batas_waktu) : '-'}</td>
                        <td data-label="Status"><span className="tag" style={st.style}>{st.label}</span></td>
                        <td data-label="Scan" onClick={e => e.stopPropagation()}>{r.disposisi.file_scan_url && !sembunyi ? <a href={r.disposisi.file_scan_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pmi-red)', fontWeight: 600 }}>📎 Lihat</a> : '-'}</td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {pilih && (
        <Modal judul="Pilih Surat Masuk untuk Didisposisi" onClose={() => setPilih(false)} lebar={600}>
          <input placeholder="Cari nomor surat / agenda / asal / perihal..." value={cari} onChange={e => setCari(e.target.value)} style={{ marginBottom: 12 }} autoFocus />
          {daftarSurat.filter(s => `${s.nomor_surat} ${s.nomor_agenda} ${s.asal_surat} ${s.perihal}`.toLowerCase().includes(cari.toLowerCase())).slice(0, 50).map(s => (
            <div key={s.id} className="row-click" onClick={() => { setPilih(false); bukaSuratId(s.id) }} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '9px 12px', marginBottom: 6 }}>
              <div style={{ fontWeight: 700 }}>{s.nomor_surat} <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>· Agenda {s.nomor_agenda || '-'} · {fmtTgl(s.tanggal_diterima_kantor)}</span></div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>{s.sifat === 'Rahasia' && !peran.isAdmin ? '🔒 Rahasia' : `${s.asal_surat} — ${s.perihal}`}</div>
            </div>
          ))}
          {daftarSurat.length === 0 && <div style={{ color: 'var(--ink-soft)' }}>Belum ada surat masuk. Catat dulu di menu Surat Masuk.</div>}
        </Modal>
      )}

      {detail && (
        <Modal judul={`Disposisi — ${detail.nomor_surat}`} onClose={() => setDetail(null)} lebar={760}>
          <div style={{ background: 'var(--cream)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, marginBottom: 14 }}>
            <b>{detail.asal_surat}</b> — {detail.perihal}<br /><span style={{ color: 'var(--ink-soft)' }}>Agenda {detail.nomor_agenda || '-'} · diterima {fmtTgl(detail.tanggal_diterima_kantor)}{detail.file_bukti_url ? '' : ''}</span>
            {detail.file_bukti_url && <> · <a href={detail.file_bukti_url} target="_blank" rel="noreferrer" style={{ color: 'var(--pmi-red)', fontWeight: 700 }}>📎 Lihat surat</a></>}
          </div>
          <DisposisiPanel supabase={supabase} surat={detail} units={units} peran={peran} onChanged={load} />
        </Modal>
      )}
    </div></div>
  )
}
