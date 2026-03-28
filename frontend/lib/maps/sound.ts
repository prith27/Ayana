let audio: HTMLAudioElement | null = null

export function playSwoosh() {
  if (typeof window === 'undefined') return
  // Reuse the same element — avoids creating a new one on every transition
  if (!audio) {
    audio = new Audio('/swoosh.mp3')
    audio.volume = 0.4
  }
  audio.currentTime = 0
  audio.play().catch(() => null) // silently ignore if browser blocks autoplay
}
