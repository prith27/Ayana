'use client'

/**
 * Cinematic loading screen audio — infrastructure ready, inactive until assets added.
 *
 * To activate: add these files to public/sounds/
 *   - ambient-pad.mp3   (base warm cinematic pad, loops)
 *   - wind.mp3          (wind layer, loops, fades in at 2.5s)
 *   - heartbeat.mp3     (soft heartbeat, loops, fades in at 4s)
 *   - cinematic-swell.mp3 (uplift swell, plays once at 8s)
 *
 * Pattern: same HTMLAudioElement reuse as lib/maps/sound.ts
 */

// TODO: implement when audio files are placed in public/sounds/
// Phase schedule:
//   0.0s → ambient-pad fades in (0→0.18 vol over 2s)
//   2.5s → wind layer fades in  (0→0.12 vol over 1.5s)
//   4.0s → heartbeat fades in   (0→0.09 vol over 1s)
//   8.0s → cinematic-swell plays (0.22 vol, no loop)
//   onComplete → all layers fade out (over 0.8s)

export function useCinematicAudio(_active: boolean): void {
  // no-op until assets are available
}
