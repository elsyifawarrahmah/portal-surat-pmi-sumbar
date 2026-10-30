'use client'
// Peran & hak akses pengguna berdasarkan role (admin/viewer) dan UNIT/BIDANG-nya.
// Aturan ini dicerminkan juga di database (lihat supabase/migrasi-disposisi-pemantauan.sql, fungsi boleh_*).
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export const NAMA_TIPE = { biro_umum: 'Biro Umum', sekretariat: 'Sekretariat', pimpinan: 'Pimpinan', bidang: 'Bidang' }

export function hitungIzin(profil, unit) {
  const isAdmin = profil?.role === 'admin'
  const tipe = unit?.tipe || null
  const adaUnit = !!tipe
  return {
    isAdmin, tipe, unit, adaUnit,
    isBiroUmum: tipe === 'biro_umum',
    aksesPenuh: isAdmin || ['sekretariat', 'pimpinan', 'biro_umum'].includes(tipe),   // boleh membaca isi semua surat
    bisaCatatMasuk: isAdmin || tipe === 'sekretariat',
    bisaDisposisi: isAdmin || ['sekretariat', 'pimpinan'].includes(tipe),
    bisaCatatKeluar: isAdmin || ['sekretariat', 'pimpinan', 'bidang'].includes(tipe),
    bisaAlur: isAdmin || ['sekretariat', 'pimpinan', 'biro_umum'].includes(tipe),
    bisaPantau: isAdmin || tipe === 'biro_umum',
    bisaArsip: isAdmin || tipe === 'biro_umum',
    bisaEkspedisi: isAdmin || adaUnit,
    bisaCatatan: isAdmin || adaUnit,
  }
}

const AWAL = { loading: true, userId: null, nama: '', telepon: '', role: 'viewer', unitId: null, migrasiBelum: false, ...hitungIzin(null, null) }

export function usePeran() {
  const [state, setState] = useState(AWAL)
  useEffect(() => {
    let batal = false
    ;(async () => {
      const supabase = createClient()
      const { data: u } = await supabase.auth.getUser()
      if (!u?.user) { if (!batal) setState(s => ({ ...s, loading: false })); return }
      let profil = null, unit = null, migrasiBelum = false
      // bertahap: kolom telepon (migrasi 2) boleh belum ada, unit (migrasi 1) wajib ada agar fitur bidang jalan
      let r1 = await supabase.from('profiles').select('id, nama_lengkap, role, unit_id, telepon, unit:surat_unit(id, kode, nama, tipe)').eq('id', u.user.id).maybeSingle()
      if (r1.error) r1 = await supabase.from('profiles').select('id, nama_lengkap, role, unit_id, unit:surat_unit(id, kode, nama, tipe)').eq('id', u.user.id).maybeSingle()
      if (r1.error) {
        migrasiBelum = true
        const r2 = await supabase.from('profiles').select('id, nama_lengkap, role').eq('id', u.user.id).maybeSingle()
        profil = r2.data
      } else { profil = r1.data; unit = r1.data?.unit || null }
      if (batal) return
      setState({ loading: false, userId: u.user.id, nama: profil?.nama_lengkap || '', telepon: profil?.telepon || '', role: profil?.role || 'viewer', unitId: profil?.unit_id || null, migrasiBelum, ...hitungIzin(profil, unit) })
    })()
    return () => { batal = true }
  }, [])
  return state
}

// Daftar unit/bidang (urut sesuai kolom urut). Kosong bila migrasi belum dijalankan.
export function useUnits() {
  const [units, setUnits] = useState([])
  const [siap, setSiap] = useState(false)
  async function muat() {
    const supabase = createClient()
    const { data } = await supabase.from('surat_unit').select('*').order('urut').order('nama')
    setUnits(data || []); setSiap(true)
  }
  useEffect(() => { muat() }, [])
  return { units, unitSiap: siap, muatUnit: muat }
}
