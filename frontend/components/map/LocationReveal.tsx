'use client'

import { useState, useEffect } from 'react'

// Cinematic location title card.
// Each letter types in at 90ms intervals with a brief white bloom on arrival.
// After the full name is spelled, the word holds for 900ms then lifts and fades out.
// Re-mounts (via key prop in parent) on every new location to replay the animation.

const LETTER_INTERVAL_MS = 90
const HOLD_MS = 900
const EXIT_MS = 500 // must match CSS transition duration

const REVEAL_CSS = `
@keyframes ayanaLetterBloom {
  0%   { color: rgba(255,255,255,1); text-shadow: 0 0 24px rgba(255,255,255,0.9); }
  100% { color: rgba(255,255,255,0.82); text-shadow: 0 0 0px rgba(255,255,255,0); }
}
`

interface LocationRevealProps {
  name: string
}

export function LocationReveal({ name }: LocationRevealProps) {
  const [visibleCount, setVisibleCount] = useState(0)
  const [exiting, setExiting] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    // Type letters in one by one
    const timers: ReturnType<typeof setTimeout>[] = []

    for (let i = 1; i <= name.length; i++) {
      timers.push(setTimeout(() => setVisibleCount(i), i * LETTER_INTERVAL_MS))
    }

    // Hold then start exit
    const holdTimer = setTimeout(() => {
      setExiting(true)
    }, name.length * LETTER_INTERVAL_MS + HOLD_MS)

    // Remove from DOM after exit transition
    const goneTimer = setTimeout(() => {
      setGone(true)
    }, name.length * LETTER_INTERVAL_MS + HOLD_MS + EXIT_MS)

    timers.push(holdTimer, goneTimer)
    return () => timers.forEach(clearTimeout)
  }, [name])

  if (gone) return null

  return (
    <>
      <style href="ayana-letter-bloom" precedence="default">{REVEAL_CSS}</style>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          // Exit: lift up + fade out
          opacity: exiting ? 0 : 1,
          transform: exiting ? 'translateY(-14px)' : 'translateY(0px)',
          transition: exiting
            ? `opacity ${EXIT_MS}ms cubic-bezier(0.4,0,1,1), transform ${EXIT_MS}ms cubic-bezier(0.4,0,1,1)`
            : 'none',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontWeight: 200,
            fontSize: 'clamp(28px, 5vw, 52px)',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.82)',
            userSelect: 'none',
          }}
        >
          {name.split('').map((char, i) => (
            <span
              key={i}
              style={
                i < visibleCount
                  ? {
                      display: 'inline-block',
                      // Bloom animation fires once when the letter first appears
                      animation: `ayanaLetterBloom 0.6s ease forwards`,
                      animationDelay: '0s',
                    }
                  : {
                      display: 'inline-block',
                      opacity: 0,
                    }
              }
            >
              {char === ' ' ? '\u00A0' : char}
            </span>
          ))}
        </h2>
      </div>
    </>
  )
}
