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
    <div><div class="t1">Palang Merah Indonesia<br>Provinsi Sumatera Barat</div><div class="t2">Jl. Sisingamangaraja No. 34 Padang</div></div>
    <div class="logo"><img src="${logo}" alt=""><div>Palang<br>Merah<br>Indonesia</div></div>
  </div>`
}

// Padatkan bertahap halaman bertanda data-fit sampai muat satu lembar A4 (diukur di iframe selebar A4).
function fitHalaman(d) {
  const batas = 296 * 96 / 25.4
  d.querySelectorAll('.hal[data-fit]').forEach(el => {
    for (const k of ['', 'p1', 'p2', 'p3']) {
      el.classList.remove('p1', 'p2', 'p3'); if (k) el.classList.add(k)
      if (el.getBoundingClientRect().height <= batas + 1.5) break
    }
  })
}
function buka(judul, bodyHtml, orientasi = 'portrait', cssTambahan = '') {
  // Cetak lewat iframe tersembunyi: tidak membuka jendela baru, jadi tidak diblokir pemblokir pop-up browser.
  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${h(judul)}</title><style>${CSS}${cssTambahan} @page{size:A4 ${orientasi}}</style></head><body>${bodyHtml}</body></html>`
  const f = document.createElement('iframe')
  f.setAttribute('aria-hidden', 'true')
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:210mm;height:297mm;border:0;visibility:hidden;pointer-events:none'
  document.body.appendChild(f)
  const w = f.contentWindow, d = w.document
  d.open(); d.write(html); d.close()
  try { fitHalaman(d) } catch (e) {}
  let jalan = false
  const cetak = () => { if (jalan) return; jalan = true; try { w.focus(); w.print() } catch (e) { alert('Gagal membuka cetak: ' + e.message) } setTimeout(() => f.remove(), 120000) }
  const gambar = Array.from(d.images).filter(i => !i.complete)
  if (gambar.length) { let sisa = gambar.length; gambar.forEach(i => { i.onload = i.onerror = () => { if (--sisa === 0) cetak() } }); setTimeout(cetak, 2500) }
  else setTimeout(cetak, 300)
}

const jejakCetak = nama => `<div class="foot">Dicetak ${h(fmtWaktu(new Date()))}${nama ? ' oleh ' + h(nama) : ''} · ${h(NAMA_APLIKASI)} · Sumatera Barat</div>`

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
  ${surat.tembusan ? '<div style="margin-top:18px;font-size:13px"><b>Tembusan:</b><ol style="margin:4px 0 0 18px;padding:0">' + String(surat.tembusan).split('\n').map(x => x.trim()).filter(Boolean).map(x => '<li>' + h(x.replace(/^\d+[.)]\s*/, '')) + '</li>').join('') + '</ol></div>' : ''}
  <div style="font-size:11px;margin-top:24px">Keaslian dapat dicek di SATria PMI (menu Cek Kode Paraf) dengan memasukkan kode di atas.</div>
  ${jejakCetak(namaPencetak)}`
  buka('Lembar Pengesahan Surat Keluar', body)
}

// Surat Tugas / Surat Aset / Tugas Kerja Sama — semua kolom terisi otomatis dari data surat (anggota, tanggal, kendaraan, TTD + kode).
// Boleh dicetak kapan saja; sebelum disetujui TTD kosong dan ada keterangan "DRAF".
// ===== Surat Tugas — format kertas PMI Sumatera Barat (satu halaman: daftar nama masuk di tabel, lampiran hanya bila > 8 orang) =====
const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const tglPanjang = v => { if (!v) return ''; const d = new Date(String(v).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? '' : `${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}` }
// Sampai 14 nama tetap satu halaman (tabel otomatis dipadatkan); lebih dari itu baru dipindah ke lampiran.
const MAKS_NAMA_SATU_HALAMAN = 14

const CSS_TUGAS = `
body{font-size:10.5pt;line-height:1.33;padding:0}
.hal{position:relative;width:210mm;min-height:296mm;display:flex;flex-direction:column;page-break-after:always}
.isi{flex:1 0 auto}
.hal:last-child{page-break-after:auto}
.banner{display:flex;align-items:stretch;height:17mm;margin-top:8mm}
.banner .b1{flex:4.2;background:#DE5B4C}.banner .b2{flex:2.3;background:#E88C80}.banner .b3{flex:1.4;background:#F2B7AF}.banner .b4{flex:1;background:#F8D9D4}
.banner .lg{flex:2.5;display:flex;align-items:center;gap:2mm;padding-left:3mm;font-weight:700;font-size:8.5pt;line-height:1.05}
.banner .lg img{height:13mm}
.isi{padding:6mm 20mm 0 20mm}
.jdl{text-align:center;font-weight:700;text-decoration:underline;font-size:11.5pt;margin-top:2mm}
.nmr{text-align:center;margin-bottom:4mm}
.kv{width:100%;border-collapse:collapse;margin:0}
.kv td{border:none;padding:1.1mm 0;vertical-align:top}
.kv td.k{width:33mm}.kv td.t{width:4mm}
.nm{width:calc(100% - 5mm);margin:1mm 0 3mm 5mm;border-collapse:collapse}
.nm th,.nm td{border:1px solid #000;padding:.9mm 2mm;font-size:10pt;text-align:left;vertical-align:top;text-transform:none}
.nm th{background:#f2f2f2;font-size:9.5pt}
.ttdbox{margin:4mm 0 0 98mm;width:72mm;text-align:center}
.ttdarea{height:19mm;display:flex;align-items:center;justify-content:center}
.ttdarea img{max-height:19mm;max-width:60mm}
.mgt td{border:none;padding:1.5mm 0;vertical-align:bottom}
.ft{margin:auto 20mm 9mm;padding-top:3mm;font-size:9pt;font-weight:700;line-height:1.35;flex-shrink:0}
/* padat otomatis (diukur saat cetak): p1 ringan, p2 sedang, p3 paling rapat — supaya tetap satu lembar */
.hal.p1 .isi{padding-top:4mm}.hal.p1 .nm td,.hal.p1 .nm th{padding:.6mm 2mm;font-size:9.8pt}.hal.p1 .kv td{padding:.8mm 0}.hal.p1 .ttdarea{height:15mm}.hal.p1 .ttdbox{margin-top:3mm}.hal.p1 .mgt td{padding:1mm 0}
.hal.p2 .isi{padding-top:3mm}.hal.p2 .banner{height:15mm;margin-top:6mm}.hal.p2 .banner .lg img{height:12mm}.hal.p2 .nm td,.hal.p2 .nm th{padding:.4mm 2mm;font-size:9.4pt}.hal.p2 .kv td{padding:.5mm 0;font-size:10pt}.hal.p2 .ttdarea{height:12mm}.hal.p2 .ttdbox{margin-top:2mm}.hal.p2 .mgt td{padding:.5mm 0}.hal.p2 .nmr{margin-bottom:3mm}
.hal.p3 .isi{padding-top:2mm}.hal.p3 .banner{height:13mm;margin-top:4mm}.hal.p3 .banner .lg img{height:10mm}.hal.p3 .nm td,.hal.p3 .nm th{padding:.2mm 2mm;font-size:9pt}.hal.p3 .kv td{padding:.3mm 0;font-size:9.5pt}.hal.p3 .ttdarea{height:9mm}.hal.p3 .ttdbox{margin-top:1mm;font-size:9.5pt}.hal.p3 .mgt td{padding:.3mm 0;font-size:9.5pt}.hal.p3 p{font-size:9.5pt}.hal.p3 .nmr{margin-bottom:2mm}
.lamp{margin:0 0 3.5mm}.lamp td{border:none;padding:0 2mm 0 0;vertical-align:top}
@media print{@page{margin:0}}
.stempel{position:absolute;top:196mm;left:16mm;transform:rotate(-14deg);border:1.4mm solid #C8102E;color:#C8102E;font-weight:800;font-size:23pt;padding:1mm 6mm;opacity:.72;letter-spacing:.5pt;z-index:5}
.koreksi{position:absolute;left:20mm;right:20mm;bottom:22mm;border:.4mm solid #C8102E;color:#C8102E;padding:2mm 3mm;font-size:9pt;line-height:1.3}
`

function cetakSuratTugasPMI({ surat: s, skNomor, namaSekretaris }) {
  const sah = s.status_persetujuan === 'disetujui'
  const anggota = (Array.isArray(s.anggota) ? s.anggota : []).filter(a => a && a.nama)
  const lampiran = anggota.length > MAKS_NAMA_SATU_HALAMAN
  const logo = (typeof window !== 'undefined' ? window.location.origin : '') + '/logo-pmi.png'
  const kv = (k, v) => `<tr><td class="k">${h(k)}</td><td class="t">:</td><td>${v}</td></tr>`
  const dasar = [s.dasar, skNomor ? 'SK Nomor ' + skNomor : ''].filter(Boolean).map(h).join('<br>')
  const angkutan = [h(s.angkutan || 'Kendaraan PMI'), s.kendaraan_nama || s.kendaraan_nopol ? '(' + h([s.kendaraan_nama, s.kendaraan_nopol, s.sopir ? 'Sopir: ' + s.sopir : ''].filter(Boolean).join(' · ')) + ')' : ''].filter(Boolean).join(' ')
  const tabelNama = lampiran
    ? '<div style="margin:1mm 0 3mm 5mm">Nama-nama terlampir</div>'
    : anggota.length
      ? `<table class="nm"><thead><tr><th style="width:9mm">No</th><th style="width:60mm">Nama</th><th>Jabatan</th></tr></thead><tbody>${anggota.map((a, i) => `<tr><td>${i + 1}</td><td>${h(a.nama)}</td><td>${h(a.jabatan || '')}</td></tr>`).join('')}</tbody></table>`
      : '<div style="margin:1mm 0 3mm 5mm">........................................</div>'
  const kodeSah = sah && s.setuju_kode ? `<div style="font-size:7.5pt;color:#444;margin-top:1mm">Disetujui digital oleh ${h(s.setuju_nama || '')} · Kode ${h(s.setuju_kode)} · ${h(fmtWaktu(s.setuju_pada))}</div>` : ''
  const merahStatus = ['revisi', 'ditolak'].includes(s.status_persetujuan)
  const stempel = merahStatus ? `<div class="stempel">${s.status_persetujuan === 'ditolak' ? 'DITOLAK' : 'PERLU DIPERBAIKI'}</div>` : ''
  const catatanMerah = merahStatus && s.catatan_revisi ? `<div class="koreksi"><b>Catatan koreksi:</b> ${h(s.catatan_revisi)}</div>` : ''
  const halaman1 = `<div class="hal" data-fit="1">${stempel}${catatanMerah}
    <div class="banner"><div class="b1"></div><div class="b2"></div><div class="b3"></div><div class="b4"></div><div class="lg"><img src="${logo}" alt=""><div>Palang<br>Merah<br>Indonesia</div></div></div>
    <div class="isi">
      <div class="jdl">SURAT TUGAS</div>
      <div class="nmr">Nomor : ${h(s.nomor_surat)}</div>
      <table class="kv">${kv('Dasar', dasar || '-')}</table>
      <p style="margin:3mm 0 0">Ditugaskan Kepada :</p>
      ${tabelNama}
      <table class="kv">
        ${kv('Tugas', h(s.perihal))}
        ${kv('Tujuan', h(s.tujuan_surat || '-'))}
        ${kv('Berangkat', h(tglPanjang(s.tanggal_berangkat)))}
        ${kv('Kembali', h(tglPanjang(s.tanggal_kembali)))}
        ${kv('Angkutan', angkutan)}
        ${kv('Anggaran', h(s.anggaran || 'PMI'))}
      </table>
      <p style="margin:3.5mm 0 1.5mm">Demikian kami sampaikan, atas perhatian serta kerjasama yang baik diucapkan terima kasih</p>
      <p style="margin:0">Demikian surat tugas ini dibuat, untuk dapat dilaksanakan dan dipergunakan sebagaimana mestinya serta pihak-pihak lain mempermudah selama proses penugasan terima kasih.</p>
      <div class="ttdbox">
        <div>Padang, ${h(tglPanjang(s.tanggal_surat))}</div>
        <div>Pengurus Provinsi</div><div>PALANG MERAH INDONESIA</div><div>Sumatera Barat</div><div>Sekretaris,</div>
        <div class="ttdarea">${s.paraf_ttd_url ? `<img src="${h(s.paraf_ttd_url)}" alt="TTD">` : ''}</div>
        <div>${h(s.paraf_nama || namaSekretaris || '')}</div>
        ${kodeSah}
      </div>
      <div style="margin-top:3mm"><b>Mengetahui :</b></div>
      <table class="mgt">
        <tr><td style="width:50mm">Tiba di Lokasi tanggal</td><td style="width:4mm">:</td><td style="width:62mm">.....................................</td><td>(.....................................)</td></tr>
        <tr><td style="padding-top:5mm">Kembali ke Markas tanggal</td><td style="padding-top:5mm">:</td><td style="padding-top:5mm">.....................................</td><td style="padding-top:5mm">(.....................................)</td></tr>
      </table>
      ${s.tembusan ? `<div style="margin-top:3mm;font-size:10.5pt"><b>Tembusan :</b><br>${String(s.tembusan).split('\n').map(x => x.trim()).filter(Boolean).map((x, i) => `${i + 1}. ${h(x.replace(/^\d+[.)]\s*/, ''))}`).join('<br>')}</div>` : ''}
    </div>
    <div class="ft"><span style="color:#B3282D">Markas PMI Provinsi Sumatera Barat</span> Jl. Sisingamangaraja No. 34 Padang<br>Telepon : 0751-8951757 email: sumatera_barat@pmi.or.id</div>
  </div>`
  const halaman2 = lampiran ? `<div class="hal"><div class="isi" style="padding-top:22mm">
      <div>Lampiran Surat Tugas</div><div>Nomor &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${h(s.nomor_surat)}</div><hr style="border:0;border-top:1px solid #000;margin:2mm 0 8mm">
      ${anggota.map((a, i) => `<table class="lamp"><tr><td style="width:8mm">${i + 1}.</td><td style="width:18mm">Nama</td><td>: ${h(a.nama)}</td></tr><tr><td></td><td>Jabatan</td><td>: ${h(a.jabatan || '')}</td></tr></table>`).join('')}
    </div></div>` : ''
  buka('Surat Tugas', halaman1 + halaman2, 'portrait', CSS_TUGAS)
}

export function cetakSuratTugas({ surat, skNomor, pksNomor, namaPencetak, namaSekretaris }) {
  const s = surat, jenis = s.jenis || 'tugas'
  if (jenis === 'tugas') return cetakSuratTugasPMI({ surat: s, skNomor, namaSekretaris })
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

// Lembar koreksi: seperti naskah yang dicoret pimpinan dengan tinta merah. Dicetak bila surat dikembalikan / ditolak.
export function cetakLembarKoreksi({ surat, riwayat = [], namaPencetak, jenis = 'Surat Keluar' }) {
  const merah = '#C8102E', ditolak = surat.status_persetujuan === 'ditolak'
  const NAMA = { koreksi: 'Perlu diperbaiki', tolak: 'Ditolak (tidak setuju)', ke_sekretaris: 'Dikembalikan ke Sekretaris' }
  const catatan = riwayat.length ? riwayat.map(r => `<div style="border-left:5px solid ${merah};background:#FFF3F3;color:#8C1010;padding:8px 12px;margin:8px 0"><b>${h(NAMA[r.tipe] || r.tipe)}</b> · ${h(r.oleh_nama || '')} (${h(r.oleh_peran || '')}) · ${h(fmtWaktu(r.created_at))}<div style="color:#5A1010;margin-top:3px">${h(r.catatan)}</div></div>`).join('')
    : `<div style="border-left:5px solid ${merah};background:#FFF3F3;color:#8C1010;padding:8px 12px">${h(surat.catatan_revisi || '-')}</div>`
  const body = `${kop()}
  <div style="border:5px solid ${merah};color:${merah};font-weight:800;font-size:28px;text-align:center;padding:6px 14px;transform:rotate(-5deg);width:max-content;margin:44px auto 26px;opacity:.88">${ditolak ? 'DITOLAK — TIDAK DISETUJUI' : 'PERLU DIPERBAIKI'}</div>
  <div class="box"><table>
    <tr><td style="width:50%">${h(jenis)} nomor : ${h(surat.nomor_surat)}</td><td>Tanggal surat : ${h(fmtTgl(surat.tanggal_surat))}</td></tr>
    <tr><td colspan="2">Perihal : ${h(surat.perihal)}</td></tr>
    ${surat.tujuan_surat ? `<tr><td colspan="2">Tujuan : ${h(surat.tujuan_surat)}</td></tr>` : ''}
  </table></div>
  <h3 style="color:${merah};margin:18px 0 4px">Catatan koreksi</h3>
  ${catatan}
  <p style="margin-top:20px;font-size:13px">Setelah diperbaiki, surat diajukan kembali ke Sekretaris untuk diparaf, lalu ke Kepala Markas / Ketua untuk disetujui.</p>
  ${jejakCetak(namaPencetak)}`
  buka('Lembar Koreksi', body)
}
