// Cetak dokumen kantor (lembar disposisi, buku agenda, riwayat surat) lewat jendela cetak browser.
import { fmtTgl, fmtWaktu } from './format'
import { NAMA_APLIKASI } from './config'

const h = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;padding:18px 22px;font-size:12px}
.kop{display:flex;justify-content:space-between;align-items:center;gap:14px;margin-bottom:10px}
.kop .t1{font-size:17px;font-weight:700;line-height:1.2}
.kop .t2{font-size:12.5px;margin-top:3px}
.kop .logo{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px;line-height:1.05}
.kop .logo img{height:50px}
.judul{text-align:center;font-weight:700;font-size:14px;margin:10px 0 2px;text-transform:uppercase}
.sub{text-align:center;color:#333;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
th,td{border:1px solid #000;padding:5px 7px;vertical-align:top;text-align:left}
th{background:#eee;font-size:11px;text-transform:uppercase}
.info td{border:none;padding:2px 6px}
.box{border:1px solid #000}
.box td{border:none;padding:4px 8px;font-size:12.5px}
.disp th,.disp td{border:1px solid #000}
.disp td{height:34px}
.ttd{margin-top:26px;display:flex;justify-content:flex-end}
.ttd div{text-align:center;width:220px}
.foot{margin-top:14px;font-size:10.5px;color:#444}
.num{text-align:right;white-space:nowrap}
@media print{ body{padding:0} @page{margin:12mm} .noprint{display:none} }
`

function kop() {
  const logo = (typeof window !== 'undefined' ? window.location.origin : '') + '/logo-pmi.png'
  return `<div class="kop">
    <div><div class="t1">Palang Merah Indonesia<br>Provinsi Sumatera Barat</div><div class="t2">Jl. Sisingamangaraja No. 43 Padang</div></div>
    <div class="logo"><img src="${logo}" alt=""><div>Palang<br>Merah<br>Indonesia</div></div>
  </div>`
}

function buka(judul, bodyHtml, orientasi = 'portrait') {
  const w = window.open('', '_blank')
  if (!w) { alert('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi.'); return }
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${h(judul)}</title><style>${CSS} @page{size:A4 ${orientasi}}</style></head><body>${bodyHtml}
  <div class="noprint" style="margin-top:16px"><button onclick="window.print()" style="padding:8px 16px;font-size:14px">🖨 Cetak</button></div></body></html>`)
  w.document.close()
  const siap = () => { try { w.focus(); w.print() } catch (e) {} }
  const img = w.document.images[0]
  if (img && !img.complete) { img.onload = siap; img.onerror = siap } else setTimeout(siap, 250)
}

const jejakCetak = nama => `<div class="foot">Dicetak ${h(fmtWaktu(new Date()))}${nama ? ' oleh ' + h(nama) : ''} · ${h(NAMA_APLIKASI)} PMI Sumatera Barat</div>`

// Lembar disposisi — mengikuti format kertas yang dipakai di kantor. Tanpa data disposisi = formulir kosong (isi tangan).
export function cetakLembarDisposisi({ surat, disposisi, tujuan = [], namaPencetak }) {
  const baris = tujuan.map(t => ({ kepada: t.unit?.nama || '', isi: [t.instruksi, t.perlu_jawaban ? '(Perlu surat jawaban)' : '', t.batas_waktu ? 'Batas: ' + fmtTgl(t.batas_waktu) : ''].filter(Boolean).join(' ') }))
  while (baris.length < 6) baris.push({ kepada: '', isi: '' })
  const dari = disposisi?.dari_nama || disposisi?.dari?.nama || ''
  const body = `${kop()}
  <div class="box"><table>
    <tr><td style="width:50%">Tanggal diterima : ${h(fmtTgl(surat?.tanggal_diterima_kantor))}</td><td>Tanggal diteruskan : ${h(disposisi ? fmtTgl(disposisi.tanggal_diteruskan) : '')}</td></tr>
    <tr><td>Macam Surat : ${h(surat?.macam_surat || '')}</td><td>Nomor Agenda : ${h(surat?.nomor_agenda || '')}</td></tr>
    <tr><td>Dari : ${h(surat?.asal_surat || '')}</td><td>Lampiran : ${h(surat?.lampiran || '')}</td></tr>
    <tr><td colspan="2">Perihal : ${h(surat?.perihal || '')}${surat?.nomor_surat ? ' <span style="color:#444">(No. ' + h(surat.nomor_surat) + ', tgl ' + h(fmtTgl(surat.tanggal_surat)) + ')</span>' : ''}</td></tr>
  </table></div>
  <table class="disp" style="margin-top:-1px">
    <thead><tr><th rowspan="2" style="width:20%;text-align:center">Dari</th><th colspan="2" style="text-align:center">DITERUSKAN</th></tr>
    <tr><th style="width:30%;text-align:center">Kepada</th><th style="text-align:center">Disposisi</th></tr></thead>
    <tbody>${baris.map((b, i) => `<tr>${i === 0 ? `<td rowspan="${baris.length}">${h(dari)}${disposisi?.catatan ? '<br><br><i>' + h(disposisi.catatan) + '</i>' : ''}</td>` : ''}<td>${h(b.kepada)}</td><td>${h(b.isi)}</td></tr>`).join('')}</tbody>
  </table>
  ${disposisi?.ttd_url ? `<div class="ttd"><div><div>${h(dari)}</div><img src="${h(disposisi.ttd_url)}" style="height:70px;margin:6px 0" alt="TTD"><div style="font-size:11px">Ditandatangani digital · ${h(fmtWaktu(disposisi.ttd_pada))}${disposisi.ttd_kode ? '<br>Kode: ' + h(disposisi.ttd_kode) : ''}</div></div></div>` : ''}
  ${jejakCetak(namaPencetak)}`
  buka('Lembar Disposisi', body)
}

// Daftar/buku (agenda surat masuk/keluar, buku disposisi, ekspedisi, riwayat) — kolom: [{judul, k, num}], baris: array objek
export function cetakDaftar({ judul, subjudul, kolom, baris, orientasi = 'landscape', namaPencetak }) {
  const body = `${kop()}<div class="judul">${h(judul)}</div>${subjudul ? `<div class="sub">${h(subjudul)}</div>` : ''}
  <table><thead><tr><th style="width:28px">No</th>${kolom.map(k => `<th>${h(k.judul)}</th>`).join('')}</tr></thead>
  <tbody>${baris.length ? baris.map((r, i) => `<tr><td>${i + 1}</td>${kolom.map(k => `<td class="${k.num ? 'num' : ''}">${h(r[k.k] ?? '')}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${kolom.length + 1}" style="text-align:center">Tidak ada data.</td></tr>`}</tbody></table>
  <div class="foot">Jumlah: ${baris.length} data</div>${jejakCetak(namaPencetak)}`
  buka(judul, body, orientasi)
}

// Riwayat lengkap satu surat (garis waktu)
export function cetakRiwayat({ jenis, surat, riwayat, namaPencetak }) {
  const masuk = jenis === 'masuk'
  const info = [
    ['Jenis', masuk ? 'Surat Masuk' : 'Surat Keluar'],
    ['Nomor Agenda', surat.nomor_agenda || '-'],
    ['Nomor Surat', surat.nomor_surat],
    ['Tanggal Surat', fmtTgl(surat.tanggal_surat)],
    ...(masuk ? [['Diterima di Kantor', fmtTgl(surat.tanggal_diterima_kantor)], ['Asal', surat.asal_surat]] : [['Tujuan', surat.tujuan_surat], ['Divisi/Biro', surat.divisi || '-']]),
    ['Perihal', surat.perihal], ['Sifat', surat.sifat],
    ['Dicatat ke sistem', fmtWaktu(surat.created_at)],
  ]
  const body = `${kop()}<div class="judul">Riwayat Surat</div>
  <table class="info" style="margin:8px 0 12px">${info.map(([a, b]) => `<tr><td style="width:150px"><b>${h(a)}</b></td><td>: ${h(b)}</td></tr>`).join('')}</table>
  <table><thead><tr><th style="width:28px">No</th><th style="width:150px">Waktu</th><th>Kejadian</th><th>Keterangan</th><th>Oleh</th></tr></thead>
  <tbody>${riwayat.map((r, i) => `<tr><td>${i + 1}</td><td>${h(fmtWaktu(r.waktu))}</td><td>${h(r.aksi)}</td><td>${h(r.keterangan || '')}</td><td>${h(r.oleh_nama || '')}${r.unit_nama ? '<br><span style="color:#444">' + h(r.unit_nama) + '</span>' : ''}</td></tr>`).join('')}</tbody></table>
  ${jejakCetak(namaPencetak)}`
  buka('Riwayat Surat', body)
}

// Lembar pengesahan surat keluar: kiri = Kepala Markas/Ketua (menyetujui), tengah = Sekretaris (paraf). Memuat kode penanda untuk dicocokkan di web.
export function cetakPengesahanKeluar({ surat, namaPencetak }) {
  const blok = (judul, nama, ttd, kode, waktu) => `<td style="width:33%;text-align:center;vertical-align:top;padding:10px"><div style="font-size:13px">${h(judul)}</div>${ttd ? `<img src="${h(ttd)}" style="height:80px;margin:8px 0" alt="TTD">` : '<div style="height:96px"></div>'}<div style="font-weight:700">${h(nama || '')}</div><div style="font-size:11px">Kode: ${h(kode || '-')}<br>${h(fmtWaktu(waktu))}</div></td>`
  const body = `${kop()}
  <div class="box"><table>
    <tr><td style="width:50%">Nomor surat : ${h(surat.nomor_surat)}</td><td>Tanggal surat : ${h(fmtTgl(surat.tanggal_surat))}</td></tr>
    <tr><td colspan="2">Kepada : ${h(surat.tujuan_surat)}</td></tr>
    <tr><td colspan="2">Perihal : ${h(surat.perihal)}</td></tr>
    <tr><td colspan="2">Tanggal disetujui : <b>${h(fmtWaktu(surat.setuju_pada))}</b></td></tr>
  </table></div>
  <table style="width:100%;margin-top:30px"><tr>
    ${blok('Menyetujui,<br>' + (surat.setuju_jabatan || ''), surat.setuju_nama, surat.setuju_ttd_url, surat.setuju_kode, surat.setuju_pada)}
    ${blok('Diparaf,<br>Sekretaris', surat.paraf_nama, surat.paraf_ttd_url, surat.paraf_kode, surat.paraf_pada)}
    <td style="width:33%"></td>
  </tr></table>
  <div style="font-size:11px;margin-top:24px">Keaslian dapat dicek di portal surat dengan memasukkan kode di atas.</div>
  ${jejakCetak(namaPencetak)}`
  buka('Lembar Pengesahan Surat Keluar', body)
}

// Surat Tugas / Surat Aset / Tugas Kerja Sama — semua kolom terisi otomatis dari data surat (anggota, tanggal, kendaraan, TTD + kode).
// Boleh dicetak kapan saja; sebelum disetujui TTD kosong dan ada keterangan "DRAF".
export function cetakSuratTugas({ surat, skNomor, pksNomor, namaPencetak }) {
  const s = surat, jenis = s.jenis || 'tugas'
  const sah = s.status_persetujuan === 'disetujui'
  const judul = jenis === 'aset' ? 'Surat Aset' : jenis === 'kerja_sama' ? 'Surat Tugas Kerja Sama' : 'Surat Tugas'
  const anggota = Array.isArray(s.anggota) ? s.anggota : []
  const hari = s.tanggal_berangkat && s.tanggal_kembali ? Math.round((new Date(s.tanggal_kembali) - new Date(s.tanggal_berangkat)) / 86400000) + 1 : null
  const baris = (a, b) => `<tr><td style="width:150px;border:none;padding:3px 6px;vertical-align:top">${h(a)}</td><td style="border:none;padding:3px 6px;width:10px">:</td><td style="border:none;padding:3px 6px">${b}</td></tr>`
  const dasar = [s.dasar, skNomor ? 'SK Nomor ' + skNomor : '', pksNomor ? 'PKS Nomor ' + pksNomor : ''].filter(Boolean).map(h).join('<br>')
  const tabelAnggota = anggota.length ? `<table style="margin:6px 0 10px"><thead><tr><th style="width:28px">No</th><th>Nama</th><th>Jabatan</th></tr></thead><tbody>${anggota.map((a, i) => `<tr><td>${i + 1}</td><td>${h(a.nama)}</td><td>${h(a.jabatan || '')}</td></tr>`).join('')}</tbody></table>` : ''
  const ket = []
  if (jenis === 'tugas') {
    ket.push(baris('Tujuan / Lokasi', h(s.tujuan_surat || '-')))
    ket.push(baris('Tanggal berangkat', h(fmtTgl(s.tanggal_berangkat))))
    ket.push(baris('Tanggal kembali', h(fmtTgl(s.tanggal_kembali)) + (hari ? ` (${hari} hari)` : '')))
    ket.push(baris('Kendaraan', s.kendaraan_nama || s.kendaraan_nopol ? h([s.kendaraan_nama, s.kendaraan_nopol ? 'No. Polisi ' + s.kendaraan_nopol : ''].filter(Boolean).join(' · ')) : 'Tanpa kendaraan dinas'))
    if (s.sopir) ket.push(baris('Pengemudi', h(s.sopir)))
  } else {
    ket.push(baris(jenis === 'aset' ? 'Kepada' : 'Mitra / Pihak', h(s.tujuan_surat || '-')))
    if (s.mengetahui) ket.push(baris('Mengetahui', h(s.mengetahui)))
    if (jenis === 'kerja_sama') ket.push(baris('Status pekerjaan', s.status_pekerjaan === 'selesai' ? 'Selesai' : 'Disiapkan'))
  }
  const blok = (j, nama, ttd, kode, waktu) => `<td style="width:50%;text-align:center;vertical-align:top;border:none;padding:8px"><div>${h(j)}</div>${ttd ? `<img src="${h(ttd)}" style="height:76px;margin:6px 0" alt="TTD">` : '<div style="height:88px"></div>'}<div style="font-weight:700">${h(nama || '')}</div>${kode ? `<div style="font-size:11px">Kode: ${h(kode)}<br>${h(fmtWaktu(waktu))}</div>` : ''}</td>`
  const body = `${kop()}
  <div class="judul" style="font-size:16px">${h(judul)}</div>
  <div class="sub" style="margin-bottom:12px">Nomor : ${h(s.nomor_surat)}${sah ? '' : ' &nbsp;<b style="color:#B3261E">(DRAF — belum disetujui)</b>'}</div>
  <table class="info">${dasar ? baris('Dasar', dasar) : ''}${baris('Perihal', h(s.perihal))}</table>
  ${jenis === 'tugas' ? '<p style="margin:12px 0 2px"><b>Menugaskan kepada:</b></p>' : anggota.length ? '<p style="margin:12px 0 2px"><b>Pihak terkait:</b></p>' : ''}
  ${tabelAnggota}
  ${s.rincian ? `<p style="margin:8px 0 2px"><b>${jenis === 'aset' ? 'Uraian aset:' : 'Uraian:'}</b></p><div style="white-space:pre-wrap;margin-bottom:8px">${h(s.rincian)}</div>` : ''}
  <table class="info">${ket.join('')}</table>
  <p style="margin-top:14px">Demikian surat ini dibuat untuk dilaksanakan dengan penuh tanggung jawab.</p>
  <div style="text-align:right;margin-top:10px">Padang, ${h(fmtTgl(s.tanggal_surat))}</div>
  <table style="margin-top:4px;border:none"><tr>${blok('Paraf Sekretaris', s.paraf_nama, s.paraf_ttd_url, s.paraf_kode, s.paraf_pada)}${blok(s.setuju_jabatan || 'Kepala Markas / Ketua', s.setuju_nama, s.setuju_ttd_url, s.setuju_kode, s.setuju_pada)}</tr></table>
  ${jejakCetak(namaPencetak)}`
  buka(judul, body)
}
