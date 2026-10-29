// Cetak dokumen kantor (lembar disposisi, buku agenda, riwayat surat) lewat jendela cetak browser.
import { fmtTgl, fmtWaktu } from './format'

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

const jejakCetak = nama => `<div class="foot">Dicetak ${h(fmtWaktu(new Date()))}${nama ? ' oleh ' + h(nama) : ''} · Portal Surat Digital PMI Sumatera Barat</div>`

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
