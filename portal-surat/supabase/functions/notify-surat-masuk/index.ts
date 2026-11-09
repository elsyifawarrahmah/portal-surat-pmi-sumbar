// DINONAKTIFKAN. Fungsi lama ini mengirim judul SEMUA surat baru ke SEMUA orang yang menyalakan notifikasi,
// sehingga bertentangan dengan aturan "isi surat hanya untuk yang dituju".
// Notifikasi sekarang dikirim oleh aplikasi sendiri (app/api/notif) hanya ke penerima disposisi / yang perlu memaraf, tanpa isi surat.
// Bila fungsi ini masih terpasang di Supabase, HAPUS fungsi ini dan Database Webhook-nya (lihat panduan).
Deno.serve(() => new Response(JSON.stringify({ nonaktif: true }), { status: 410 }));
