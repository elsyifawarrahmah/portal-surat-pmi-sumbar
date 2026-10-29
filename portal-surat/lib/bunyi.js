// Bunyi singkat saat ada disposisi / panggilan baru (browser kadang memblokir audio otomatis; abaikan saja)
export function bunyiNotif() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const nada = (f, mulai, dur) => {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0.0001, ctx.currentTime + mulai)
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + mulai + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + mulai + dur)
      o.connect(g); g.connect(ctx.destination); o.start(ctx.currentTime + mulai); o.stop(ctx.currentTime + mulai + dur)
    }
    nada(880, 0, 0.15); nada(1175, 0.15, 0.2)
  } catch (e) { /* diabaikan */ }
}
