'use client'
// Kotak dialog seragam (sama tampilannya dengan modal lain di aplikasi)
export default function Modal({ judul, onClose, children, footer, lebar = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 12 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: lebar, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18 }}>{judul}</h3>
          <button onClick={onClose} aria-label="Tutup" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, padding: 6 }}>✕</button>
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '12px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>{footer}</div>}
      </div>
    </div>
  )
}

export const Info = ({ children, warna = 'gold' }) => (
  <div style={{ background: `var(--${warna}-bg)`, color: `var(--${warna})`, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{children}</div>
)
