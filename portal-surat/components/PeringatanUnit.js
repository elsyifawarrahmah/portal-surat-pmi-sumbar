'use client'
// Muncul bila akun belum ditempatkan di bidang/unit: tanpa unit, surat belum bisa diterima atau dilihat.
export default function PeringatanUnit({ peran }) {
  if (peran.loading || peran.isAdmin || peran.unitId || peran.migrasiBelum) return null
  return (
    <div style={{ background: 'var(--gold-bg)', color: 'var(--gold)', padding: '12px 16px', borderRadius: 12, fontSize: 14.5, fontWeight: 600, marginBottom: 18, lineHeight: 1.5 }}>
      Akun kamu belum ditempatkan di bidang / unit, jadi belum bisa menerima atau melihat surat. Mohon minta admin web mengaturnya di menu <b>Data User &amp; Unit</b>.
    </div>
  )
}
