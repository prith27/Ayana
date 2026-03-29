'use client'

import { useEffect, useRef } from 'react'

const TRACK_SRC   = '/sounds/loading-theme.mp3'
const PEAK_VOL    = 0.28
const FADE_IN_MS  = 1_500
const FADE_OUT_MS = 4_000

/** Smoothly ramp an audio element's volume from `from` to `to` over `ms` milliseconds.
 *  Returns a cancel function to stop the ramp early. */
function rampVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  ms: number,
): () => void {
  const steps = Math.ceil(ms / 50)
  const delta = (to - from) / steps
  let step = 0
  audio.volume = Math.max(0, Math.min(1, from))
  const id = setInterval(() => {
    step++
    audio.volume = Math.max(0, Math.min(1, from + delta * step))
    if (step >= steps) clearInterval(id)
  }, 50)
  return () => clearInterval(id)
}

/**
 * Plays the loading screen background music.
 *
 * @param active   true when the overlay is mounted and error-free
 * @param fadeOut  true when the AYANA phase begins (readyToTransition)
 */
export function useCinematicAudio(active: boolean, fadeOut: boolean): void {
  const audioRef  = useRef<HTMLAudioElement | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  // Mount / unmount — start or stop the music
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (active) {
      const audio = new Audio(TRACK_SRC)
      audio.volume = 0
      audio.currentTime = 0
      audioRef.current = audio

      audio.play().then(() => {
        cancelRef.current?.()
        cancelRef.current = rampVolume(audio, 0, PEAK_VOL, FADE_IN_MS)
      }).catch(() => {
        // Browser blocked autoplay — silently ignore
      })
    } else {
      cancelRef.current?.()
      cancelRef.current = null
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }

    return () => {
      cancelRef.current?.()
      cancelRef.current = null
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // Fade out when AYANA phase begins
  useEffect(() => {
    if (!fadeOut || !audioRef.current) return
    const audio = audioRef.current
    cancelRef.current?.()
    cancelRef.current = rampVolume(audio, audio.volume, 0, FADE_OUT_MS)
  }, [fadeOut])
}
