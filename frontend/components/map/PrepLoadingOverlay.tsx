'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Persona } from '@/lib/ayana/prep'
import { PERSONA_META } from '@/lib/ayana/prep'
import { mapRef } from '@/lib/maps/mapRef'
import { useCinematicAudio } from '@/lib/maps/cinematicAudio'

interface PrepLoadingOverlayProps {
  persona: Persona
  errorMessage?: string | null
  onRetry?: () => void
  fadeOut?: boolean
  isLoaded?: boolean
  onComplete?: () => void
}

type CinematicPhase = 'emergence' | 'alive' | 'calling' | 'who' | 'ayana'

const PHASE_TEXT: Record<CinematicPhase, string | null> = {
  emergence: 'Somewhere on Earth\u2026',
  alive:     '\u2026a story is waiting.',
  calling:   "And it\u2019s calling you.",
  who:       'Who will you be?',
  ayana:     null,
}

// Geo-coordinates of real places — whisper over the globe as it materializes
const COORD_WHISPERS = [
  { top: '33%', left: '40%', text: '48.8\u00b0N \u00b7 2.3\u00b0E',    dur: 6.0, delay: 0.6  }, // Paris
  { top: '39%', left: '63%', text: '35.6\u00b0N \u00b7 139.6\u00b0E',  dur: 7.2, delay: 1.8  }, // Tokyo
  { top: '45%', left: '31%', text: '40.7\u00b0N \u00b7 74.0\u00b0W',   dur: 5.8, delay: 3.2  }, // New York
  { top: '50%', left: '54%', text: '1.3\u00b0N \u00b7 36.8\u00b0E',    dur: 6.5, delay: 1.2  }, // Nairobi
  { top: '36%', left: '52%', text: '55.7\u00b0N \u00b7 37.6\u00b0E',   dur: 7.0, delay: 2.6  }, // Moscow
  { top: '43%', left: '70%', text: '22.3\u00b0N \u00b7 114.1\u00b0E',  dur: 5.5, delay: 4.0  }, // Hong Kong
]

const CSS = `
/* Slow edge-pulse — whole frame breathes */
@keyframes vignetteBreath {
  0%,100% { opacity: 0;   }
  50%     { opacity: 1;   }
}
/* Grid lines materialize one by one */
@keyframes gridLineIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
/* Constellation lines draw from one end */
@keyframes constellationDraw {
  from { opacity: 0; stroke-dashoffset: 1; }
  to   { opacity: 1; stroke-dashoffset: 0; }
}
/* Coordinate strings ghost in and out */
@keyframes coordWhisper {
  0%,15%    { opacity: 0;    transform: translateY(3px);  }
  30%,70%   { opacity: 1;    transform: translateY(0);    }
  85%,100%  { opacity: 0;    transform: translateY(-2px); }
}
/* Horizon dawn glow */
@keyframes horizonDawn {
  0%   { opacity: 0; }
  22%  { opacity: 1; }
  62%  { opacity: 0.5; }
  100% { opacity: 0; }
}
/* Aurora band */
@keyframes auroraWave {
  0%   { opacity: 0;   transform: scaleX(0.7) translateY(4px);  }
  28%  { opacity: 1;   transform: scaleX(1.0) translateY(0);    }
  68%  { opacity: 0.6; transform: scaleX(1.1) translateY(-2px); }
  100% { opacity: 0;   transform: scaleX(0.9) translateY(2px);  }
}
/* Globe scan line */
@keyframes globeScan {
  from { transform: translateY(-40px); opacity: 0.55; }
  85%  { opacity: 0.25; }
  to   { transform: translateY(110vh); opacity: 0;    }
}
@keyframes ayanaBloomIn {
  from { opacity: 0; letter-spacing: 0.72em; filter: blur(10px); }
  to   { opacity: 1; letter-spacing: 0.48em; filter: blur(0);    }
}
@keyframes ayanaPersonaIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
@keyframes ayanaLetterIn {
  0%   { opacity: 0; transform: translateY(24px) scale(0.92); filter: blur(6px); }
  60%  { opacity: 1; transform: translateY(-2px) scale(1.01); filter: blur(0); }
  100% { opacity: 1; transform: translateY(0)    scale(1);    filter: blur(0); }
}
@keyframes ayanaLineExpand {
  from { width: 0; opacity: 0; }
  to   { width: 48px; opacity: 1; }
}
@keyframes ayanaSubIn {
  from { opacity: 0; letter-spacing: 0.52em; }
  to   { opacity: 0.38; letter-spacing: 0.44em; }
}
@keyframes cinematicFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0);    }
}
@keyframes prepScan {
  0%   { transform: translateX(-120%); }
  100% { transform: translateX(220%);  }
}
`

// Lat/lon grid — horizontal latitude bands + vertical longitude lines
const LAT_LINES  = ['27%', '36%', '45%', '54%', '63%']
const LON_LINES  = ['22%', '34%', '50%', '66%', '78%']

export function PrepLoadingOverlay({
  persona,
  errorMessage,
  onRetry,
  fadeOut = false,
  isLoaded = false,
  onComplete,
}: PrepLoadingOverlayProps) {
  const { label, accent, borderAlpha } = PERSONA_META[persona]
  const isError = Boolean(errorMessage)

  const [mounted, setMounted] = useState(false)
  const [darkVeilMounted, setDarkVeilMounted] = useState(false)
  const [phase, setPhase] = useState<CinematicPhase>('emergence')
  const [textVisible, setTextVisible] = useState(false)
  const [showAtmosphere, setShowAtmosphere] = useState(false)
  const [readyToTransition, setReadyToTransition] = useState(false)

  useCinematicAudio(!isError && mounted)

  // Mount entrance (opacity 0→1)
  useEffect(() => {
    const f = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setMounted(true)
        setDarkVeilMounted(true)
      })
    )
    return () => cancelAnimationFrame(f)
  }, [])

  // Text entrance after initial mount
  useEffect(() => {
    if (!mounted || isError) return
    const t = setTimeout(() => setTextVisible(true), 100)
    return () => clearTimeout(t)
  }, [mounted, isError])

  // Crossfade helper
  const crossfade = useCallback((next: CinematicPhase) => {
    setTextVisible(false)
    setTimeout(() => {
      setPhase(next)
      setTextVisible(true)
      if (next === 'alive' || next === 'calling' || next === 'who' || next === 'ayana') {
        setShowAtmosphere(true)
      }
    }, 420)
  }, [])

  // Main cinematic timeline
  useEffect(() => {
    if (isError) return

    const t1 = setTimeout(() => crossfade('alive'), 2500)

    const t2 = setTimeout(() => {
      const map = mapRef.current
      if (map) {
        void map.flyCameraTo({
          endCamera: {
            center: map.center ?? { lat: 20, lng: 0, altitude: 0 },
            range: Math.max(3000, (map.range ?? 15_000) * 0.25),
            tilt: map.tilt ?? 22,
            heading: map.heading ?? 0,
          },
          durationMillis: 2500,
        })
      }
      crossfade('calling')
    }, 6000)

    const t3 = setTimeout(() => crossfade('who'), 8500)

    const t4 = setTimeout(() => {
      crossfade('ayana')
      setReadyToTransition(true)
    }, 10000)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [isError, crossfade])

  // Transition gate: cinematic done AND data loaded
  useEffect(() => {
    if (!readyToTransition || !isLoaded) return
    const t = setTimeout(() => onComplete?.(), 1500)
    return () => clearTimeout(t)
  }, [readyToTransition, isLoaded, onComplete])

  const phaseText = PHASE_TEXT[phase]
  const isCallingPhase = phase === 'calling'

  return (
    <>
      <style>{CSS}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 32,
          background: [
            'linear-gradient(to bottom,',
            '  rgba(2,3,8,0.97) 0%,',
            '  rgba(2,3,8,0.74) 16%,',
            '  rgba(2,3,8,0.05) 34%,',
            '  rgba(2,3,8,0.03) 52%,',
            '  rgba(2,3,8,0.05) 68%,',
            '  rgba(2,3,8,0.74) 84%,',
            '  rgba(2,3,8,0.97) 100%',
            ')',
          ].join(' '),
          pointerEvents: isError ? 'auto' : 'none',
          opacity: fadeOut ? 0 : mounted ? 1 : 0,
          transition: 'opacity 0.58s cubic-bezier(0.22,1,0.36,1)',
          overflow: 'hidden',
        }}
      >
        {/* ── Radial darkness veil: center illuminates first ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 55% 42% at 50% 52%, rgba(2,3,8,0.32) 0%, rgba(2,3,8,1) 82%)',
            opacity: darkVeilMounted ? 0 : 1,
            transition: 'opacity 3s cubic-bezier(0.22,1,0.36,1)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Horizon dawn: warm amber light bleeding up from the planet's edge ── */}
        {!isError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(160,80,18,0.30) 0%, rgba(120,58,12,0.10) 20%, transparent 42%)',
              animation: 'horizonDawn 5.8s ease-in-out forwards',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Aurora band: faint teal shimmer as the globe wakes ── */}
        {!isError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, transparent 14%, rgba(68,188,158,0.065) 23%, rgba(88,208,138,0.048) 30%, transparent 40%)',
              animation: 'auroraWave 7.5s ease-in-out 1.6s forwards',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Globe scan line: single sweep as the world comes online ── */}
        {!isError && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(to right, transparent 6%, rgba(180,220,255,0.20) 32%, rgba(210,235,255,0.34) 50%, rgba(180,220,255,0.20) 68%, transparent 94%)',
              animation: 'globeScan 2.6s cubic-bezier(0.42,0,0.9,1) 0.5s forwards',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Breathing vignette: slow 5s pulse at screen edges ── */}
        {!isError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse 82% 82% at 50% 50%, transparent 32%, rgba(2,3,8,0.45) 100%)',
              animation: 'vignetteBreath 5s ease-in-out 2s infinite',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* ── Ghost lat/lon grid: cartographic materialization ── */}
        {showAtmosphere && !isError && (
          <>
            {LAT_LINES.map((top, i) => (
              <div
                key={`lat-${i}`}
                style={{
                  position: 'absolute',
                  left: 0, right: 0,
                  top,
                  height: '1px',
                  background: 'rgba(255,255,255,0.052)',
                  animation: `gridLineIn 1.8s ease ${i * 0.20}s both`,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {LON_LINES.map((left, i) => (
              <div
                key={`lon-${i}`}
                style={{
                  position: 'absolute',
                  top: 0, bottom: 0,
                  left,
                  width: '1px',
                  background: 'rgba(255,255,255,0.038)',
                  animation: `gridLineIn 1.8s ease ${i * 0.24 + 0.28}s both`,
                  pointerEvents: 'none',
                }}
              />
            ))}
          </>
        )}

        {/* ── Constellation skeleton: night sky visible around the globe ── */}
        {showAtmosphere && !isError && (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            {/* Orion — upper left dark zone */}
            <g stroke="rgba(255,255,255,0.20)" strokeWidth="0.7" fill="none">
              {/* Belt */}
              <line x1="38%" y1="21%" x2="42%" y2="20%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.8s ease 0.4s both' }} />
              <line x1="42%" y1="20%" x2="46%" y2="21%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.8s ease 0.7s both' }} />
            </g>
            <g stroke="rgba(255,255,255,0.13)" strokeWidth="0.7" fill="none">
              {/* Shoulders to belt */}
              <line x1="35%" y1="16%" x2="38%" y2="21%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.6s ease 1.0s both' }} />
              <line x1="48%" y1="16%" x2="46%" y2="21%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.6s ease 1.2s both' }} />
              {/* Belt to feet */}
              <line x1="38%" y1="21%" x2="36%" y2="26%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.4s ease 1.5s both' }} />
              <line x1="46%" y1="21%" x2="48%" y2="26%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.4s ease 1.7s both' }} />
            </g>

            {/* Cassiopeia — upper right dark zone (W shape) */}
            <g stroke="rgba(255,255,255,0.16)" strokeWidth="0.7" fill="none">
              <line x1="63%" y1="14%" x2="66%" y2="19%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.5s ease 0.6s both' }} />
              <line x1="66%" y1="19%" x2="69%" y2="14%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.5s ease 0.9s both' }} />
              <line x1="69%" y1="14%" x2="72%" y2="19%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.5s ease 1.2s both' }} />
              <line x1="72%" y1="19%" x2="75%" y2="14%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.5s ease 1.5s both' }} />
            </g>

            {/* Big Dipper — lower left dark zone */}
            <g stroke="rgba(255,255,255,0.15)" strokeWidth="0.7" fill="none">
              {/* Cup */}
              <line x1="24%" y1="76%" x2="28%" y2="73%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.6s ease 0.5s both' }} />
              <line x1="28%" y1="73%" x2="32%" y2="75%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.6s ease 0.8s both' }} />
              <line x1="32%" y1="75%" x2="28%" y2="79%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.5s ease 1.1s both' }} />
              <line x1="28%" y1="79%" x2="24%" y2="76%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.5s ease 1.4s both' }} />
              {/* Handle */}
              <line x1="32%" y1="75%" x2="37%" y2="72%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.4s ease 1.7s both' }} />
              <line x1="37%" y1="72%" x2="42%" y2="70%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.4s ease 2.0s both' }} />
            </g>

            {/* Southern Cross — lower right dark zone */}
            <g stroke="rgba(255,255,255,0.17)" strokeWidth="0.7" fill="none">
              <line x1="70%" y1="72%" x2="70%" y2="80%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.4s ease 0.7s both' }} />
              <line x1="67%" y1="76%" x2="73%" y2="76%"
                strokeDasharray="1" strokeDashoffset="1"
                style={{ animation: 'constellationDraw 1.4s ease 1.0s both' }} />
            </g>
          </svg>
        )}

        {/* ── Coordinate whispers: ghost geo-data over the globe ── */}
        {showAtmosphere && !isError && COORD_WHISPERS.map((w, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              top: w.top,
              left: w.left,
              fontFamily: '"SF Mono","Fira Code",monospace',
              fontSize: '8px',
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.14)',
              whiteSpace: 'nowrap',
              animation: `coordWhisper ${w.dur}s ease-in-out ${w.delay}s infinite both`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {w.text}
          </span>
        ))}

        {/* ── Error state (replaces cinematic) ── */}
        {isError && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ animation: 'cinematicFadeUp 0.5s both', textAlign: 'center' }}>
              <p style={{
                margin: '0 0 8px',
                fontFamily: '"SF Mono","Fira Code",monospace',
                fontSize: '10px',
                letterSpacing: '0.28em',
                textTransform: 'uppercase',
                color: 'rgba(255,100,100,0.7)',
              }}>
                Prep failed
              </p>
              <p style={{
                maxWidth: 340,
                margin: '0 0 24px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.45)',
                letterSpacing: '0.06em',
                lineHeight: 1.6,
              }}>
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={onRetry}
                style={{
                  padding: '10px 20px',
                  borderRadius: 999,
                  border: `1px solid ${borderAlpha}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: accent,
                  fontFamily: '"SF Mono","Fira Code",monospace',
                  fontSize: '10px',
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  transition: 'border-color 0.2s ease',
                }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ── AYANA reveal (phase 'ayana') ── */}
        {!isError && phase === 'ayana' && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            zIndex: 1,
          }}>
            {/* Letter-by-letter staggered reveal */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 'clamp(4px, 1.2vw, 18px)',
            }}>
              {['A','Y','A','N','A'].map((letter, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    fontSize: 'clamp(64px, 10vw, 120px)',
                    fontWeight: 100,
                    letterSpacing: '0.04em',
                    color: 'rgba(255,255,255,0.95)',
                    textShadow: `0 0 60px ${accent}50, 0 0 120px ${accent}20, 0 2px 24px rgba(0,0,0,0.6)`,
                    opacity: 0,
                    animation: `ayanaLetterIn 0.9s cubic-bezier(0.22,1,0.36,1) ${0.05 + i * 0.1}s forwards`,
                    fontFamily: 'inherit',
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>

            {/* Thin accent rule beneath */}
            <div style={{
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${accent}88, transparent)`,
              opacity: 0,
              animation: 'ayanaLineExpand 0.8s cubic-bezier(0.22,1,0.36,1) 0.65s forwards',
            }} />

            {/* AI · Journey Engine tagline */}
            <p style={{
              margin: 0,
              fontFamily: '"SF Mono","Fira Code",monospace',
              fontSize: '9px',
              letterSpacing: '0.44em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
              opacity: 0,
              animation: 'ayanaSubIn 0.9s cubic-bezier(0.22,1,0.36,1) 0.75s forwards',
            }}>
              AI · Journey Engine
            </p>
          </div>
        )}

        {/* ── Poetic text zone (all phases except 'ayana') ── */}
        {!isError && phase !== 'ayana' && phaseText && (
          <div style={{
            position: 'absolute',
            bottom: '18%',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            zIndex: 1,
            padding: '0 24px',
          }}>
            <p style={{
              margin: 0,
              fontFamily: 'Inter, sans-serif',
              fontSize: isCallingPhase ? 'clamp(20px,2.4vw,30px)' : 'clamp(17px,2.1vw,26px)',
              fontWeight: 200,
              letterSpacing: '0.04em',
              color: isCallingPhase ? 'rgba(255,255,255,0.90)' : 'rgba(255,255,255,0.72)',
              textAlign: 'center',
              filter: 'drop-shadow(0 1px 8px rgba(0,0,0,0.98)) drop-shadow(0 0 24px rgba(0,0,0,0.85))',
              opacity: textVisible ? 1 : 0,
              transform: textVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1)',
            }}>
              {phaseText}
            </p>

            {/* Thin scan track below text */}
            <div style={{
              width: 'min(180px, 40vw)',
              height: '1px',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 1,
              overflow: 'hidden',
              position: 'relative',
              opacity: textVisible ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}>
              <div style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '40%', height: '100%',
                background: `linear-gradient(to right, transparent, ${accent}bb, transparent)`,
                animation: 'prepScan 2s ease-in-out infinite',
              }} />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
