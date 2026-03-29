'use client'

import { useState, useEffect } from 'react'

// ── Style presets ────────────────────────────────────────────────────────────

type OverlayPreset = 'urban-neon' | 'tropical' | 'heritage' | 'modern-minimal' | 'nature'

const PRESETS: Record<OverlayPreset, { glow: string; accent: string; tagline: string }> = {
  'urban-neon': {
    glow: 'radial-gradient(ellipse at 25% 60%, rgba(255,45,45,0.18) 0%, transparent 55%), radial-gradient(ellipse at 75% 40%, rgba(0,234,255,0.12) 0%, transparent 55%)',
    accent: 'rgba(0,234,255,0.7)',
    tagline: 'Where tradition meets neon chaos',
  },
  'tropical': {
    glow: 'radial-gradient(ellipse at 40% 60%, rgba(255,183,77,0.18) 0%, transparent 55%), radial-gradient(ellipse at 65% 35%, rgba(72,199,142,0.1) 0%, transparent 55%)',
    accent: 'rgba(255,183,77,0.8)',
    tagline: 'Where every moment is golden',
  },
  'heritage': {
    glow: 'radial-gradient(ellipse at 50% 50%, rgba(180,140,90,0.16) 0%, transparent 60%)',
    accent: 'rgba(180,140,90,0.8)',
    tagline: 'Centuries of stories beneath your feet',
  },
  'modern-minimal': {
    glow: 'radial-gradient(ellipse at 50% 50%, rgba(180,180,200,0.1) 0%, transparent 60%)',
    accent: 'rgba(200,200,220,0.7)',
    tagline: 'The city that never stops moving',
  },
  'nature': {
    glow: 'radial-gradient(ellipse at 40% 55%, rgba(72,199,142,0.16) 0%, transparent 55%), radial-gradient(ellipse at 60% 40%, rgba(99,179,237,0.1) 0%, transparent 55%)',
    accent: 'rgba(72,199,142,0.8)',
    tagline: 'Where the earth breathes',
  },
}

const CITY_PRESET_MAP: Record<string, OverlayPreset> = {
  // Cities
  tokyo: 'urban-neon', osaka: 'urban-neon', seoul: 'urban-neon',
  'new york': 'urban-neon', 'hong kong': 'urban-neon',
  bali: 'tropical', bangkok: 'tropical', hawaii: 'tropical', cancun: 'tropical', phuket: 'tropical',
  kyoto: 'heritage', rome: 'heritage', paris: 'heritage', istanbul: 'heritage', athens: 'heritage', cairo: 'heritage',
  dubai: 'modern-minimal', singapore: 'modern-minimal', london: 'modern-minimal', sydney: 'modern-minimal',
  'new zealand': 'nature', iceland: 'nature', 'costa rica': 'nature', patagonia: 'nature', alaska: 'nature',
  // Landmarks
  'senso-ji temple': 'heritage', 'sensoji temple': 'heritage', 'senso-ji': 'heritage',
  'shibuya crossing': 'urban-neon', shibuya: 'urban-neon',
  'tokyo tower': 'urban-neon',
  'fushimi inari': 'heritage', 'fushimi inari shrine': 'heritage',
  'mount fuji': 'nature', 'mt fuji': 'nature', 'fuji': 'nature',
  'shinjuku': 'urban-neon', 'akihabara': 'urban-neon',
  'arashiyama': 'nature', 'bamboo grove': 'nature',
  'golden pavilion': 'heritage', 'kinkaku-ji': 'heritage',
}

// ── Per-location taglines ─────────────────────────────────────────────────────

const LOCATION_TAGLINES: Record<string, string> = {
  // Cities
  tokyo:           'Twelve million stories, one neon skyline',
  osaka:           'Japan\'s kitchen — and its loudest heartbeat',
  kyoto:           'A thousand years of silence and ceremony',
  seoul:           'Ancient palaces beneath a digital horizon',
  'hong kong':     'East meets west at the edge of the harbour',
  'new york':      'Every block a universe, every light a dream',
  paris:           'Every corner a painting, every breath a memory',
  rome:            'All roads lead here — and always will',
  istanbul:        'Two continents, one soul, zero boundaries',
  athens:          'Birthplace of thought, still asking questions',
  cairo:           'Four thousand years of wonder in every grain',
  dubai:           'The future, engineered overnight',
  singapore:       'Precision elevated to an art form',
  london:          'History and reinvention, forever in dialogue',
  sydney:          'Where the harbour is just the beginning',
  bali:            'Island of the gods, haven for the restless',
  bangkok:         'Chaos and serenity, a breath apart',
  hawaii:          'Where the Pacific pauses to catch its breath',
  cancun:          'Turquoise waters, timeless shores',
  phuket:          'Sunsets that make you forget the return flight',
  iceland:         'Fire, ice, and the silence between',
  'new zealand':   'The edge of the earth — worth every mile',
  'costa rica':    'Where the rainforest meets the sea',
  patagonia:       'Wind, stone, and the end of the world',
  alaska:          'Wilderness without limit, beauty without end',
  // Landmarks
  'senso-ji temple':       'Ancient prayers still rising through incense smoke',
  'sensoji temple':        'Ancient prayers still rising through incense smoke',
  'senso-ji':              'Ancient prayers still rising through incense smoke',
  'shibuya crossing':      'Five streets converge — and somehow it works',
  'shibuya':               'Where the city\'s pulse beats loudest',
  'tokyo tower':           'Standing watch over a city that never sleeps',
  'fushimi inari':         'Ten thousand gates, one path inward',
  'fushimi inari shrine':  'Ten thousand gates, one path inward',
  'mount fuji':            'Sacred summit above the clouds',
  'mt fuji':               'Sacred summit above the clouds',
  'fuji':                  'Sacred summit above the clouds',
  'shinjuku':              'Neon dreams stacked forty stories high',
  'akihabara':             'Where the future is already on the shelf',
  'arashiyama':            'The wind speaks here, through a thousand stems',
  'bamboo grove':          'The wind speaks here, through a thousand stems',
  'golden pavilion':       'Gold reflected in still water, still in time',
  'kinkaku-ji':            'Gold reflected in still water, still in time',
}

function resolvePreset(cityName: string): OverlayPreset {
  return CITY_PRESET_MAP[cityName.toLowerCase()] ?? 'modern-minimal'
}

function resolveTagline(cityName: string, fallback: string): string {
  return LOCATION_TAGLINES[cityName.toLowerCase()] ?? fallback
}

// ── Animation timings ────────────────────────────────────────────────────────

export const LETTER_MS        = 90
export const TAGLINE_DELAY_MS = 200
export const HOLD_MS          = 2_000
export const EXIT_MS          = 900   // longer for smooth dissolve

const OVERLAY_CSS = `
@keyframes ayanaOverlayIn {
  from { opacity: 0; filter: blur(8px); }
  to   { opacity: 1; filter: blur(0px); }
}
@keyframes ayanaOverlayOut {
  from { opacity: 1; filter: blur(0px); }
  to   { opacity: 0; filter: blur(14px); }
}
@keyframes ayanaLetterBloom {
  0%   { color: rgba(255,255,255,1); text-shadow: 0 0 24px rgba(255,255,255,0.9); }
  100% { color: rgba(255,255,255,0.88); text-shadow: 0 0 0px rgba(255,255,255,0); }
}
`

// ── Component ────────────────────────────────────────────────────────────────

interface CityOverlayProps {
  cityName: string
  preset?: OverlayPreset
  tagline?: string
}

function getTitleLayout(name: string): {
  fontSize: string
  letterSpacing: string
  lineHeight: number
  maxWidth: string
} {
  const length = name.trim().length

  if (length >= 28) {
    return {
      fontSize: 'clamp(24px, 3vw, 42px)',
      letterSpacing: '0.12em',
      lineHeight: 1.18,
      maxWidth: 'min(88vw, 780px)',
    }
  }

  if (length >= 20) {
    return {
      fontSize: 'clamp(26px, 3.5vw, 48px)',
      letterSpacing: '0.18em',
      lineHeight: 1.16,
      maxWidth: 'min(88vw, 840px)',
    }
  }

  return {
    fontSize: 'clamp(28px, 4vw, 56px)',
    letterSpacing: '0.32em',
    lineHeight: 1.12,
    maxWidth: 'min(86vw, 960px)',
  }
}

export function CityOverlay({ cityName, preset: presetProp, tagline: taglineProp }: CityOverlayProps) {
  const preset  = PRESETS[presetProp ?? resolvePreset(cityName)]
  const tagline = taglineProp ?? resolveTagline(cityName, preset.tagline)
  const titleLayout = getTitleLayout(cityName)

  const [visibleCount, setVisibleCount] = useState(0)
  const [showTagline, setShowTagline]   = useState(false)
  const [exiting, setExiting]           = useState(false)
  const [gone, setGone]                 = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const nameLen = cityName.length
    const typeDone = nameLen * LETTER_MS

    for (let i = 1; i <= nameLen; i++) {
      timers.push(setTimeout(() => setVisibleCount(i), i * LETTER_MS))
    }
    timers.push(setTimeout(() => setShowTagline(true), typeDone + TAGLINE_DELAY_MS))
    timers.push(setTimeout(() => setExiting(true),     typeDone + TAGLINE_DELAY_MS + HOLD_MS))
    timers.push(setTimeout(() => setGone(true),        typeDone + TAGLINE_DELAY_MS + HOLD_MS + EXIT_MS))

    return () => timers.forEach(clearTimeout)
  }, [cityName])

  if (gone) return null

  return (
    <>
      <style href="ayana-city-overlay" precedence="default">{OVERLAY_CSS}</style>

      {/* Full-screen cinematic overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 35,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.82)',
          backgroundImage: preset.glow,
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: exiting
            ? `ayanaOverlayOut ${EXIT_MS}ms cubic-bezier(0.4,0,0.6,1) forwards`
            : 'ayanaOverlayIn 0.4s ease forwards',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 'min(92vw, 1080px)',
            padding: '0 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box',
          }}
        >
          {/* City / landmark title — wraps instead of clipping */}
          <h2
            style={{
              margin: 0,
              maxWidth: titleLayout.maxWidth,
              overflow: 'hidden',
              fontWeight: 200,
              fontSize: titleLayout.fontSize,
              lineHeight: titleLayout.lineHeight,
              maxHeight: `${titleLayout.lineHeight * 2}em`,
              letterSpacing: titleLayout.letterSpacing,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.92)',
              userSelect: 'none',
              whiteSpace: 'normal',
              textAlign: 'center',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              textWrap: 'balance',
            }}
          >
            {cityName.split('').map((char, i) => (
              <span
                key={i}
                style={
                  i < visibleCount
                    ? {
                        display: char === ' ' ? 'inline' : 'inline-block',
                        animation: 'ayanaLetterBloom 0.6s ease forwards',
                      }
                    : {
                        display: char === ' ' ? 'inline' : 'inline-block',
                        opacity: 0,
                      }
                }
              >
                {char}
              </span>
            ))}
          </h2>

          {/* Accent line */}
          <div
            style={{
              height: 1,
              background: preset.accent,
              margin: '18px 0',
              width: showTagline ? 'min(480px, 60vw)' : '0px',
              transition: 'width 0.6s ease',
              opacity: 0.7,
            }}
          />

          {/* Tagline */}
          <p
            style={{
              margin: 0,
              maxWidth: 'min(76vw, 760px)',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              fontSize: 13,
              lineHeight: 1.45,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '0.18em',
              fontStyle: 'italic',
              fontWeight: 300,
              textAlign: 'center',
              overflowWrap: 'anywhere',
              opacity: showTagline ? 1 : 0,
              transform: showTagline ? 'translateY(0)' : 'translateY(10px)',
              transition: showTagline
                ? 'opacity 0.5s ease, transform 0.5s ease'
                : 'none',
            }}
          >
            {tagline}
          </p>
        </div>
      </div>
    </>
  )
}
