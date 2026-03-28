'use client'
import { useState, useEffect } from 'react'
import type { Persona } from '@/lib/ayana/prep'

interface Props {
  onSelect: (type: Persona) => void
}

// ── SVG Icons ──────────────────────────────────────────────────────────────

function AdventureIcon({ color }: { color: string }) {
  return (
    <svg width="52" height="52" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <path d="M28 6L50 46H6L28 6Z" stroke={color} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M28 6L38 46" stroke={color} strokeWidth="1.1" strokeOpacity="0.3" />
      <path d="M17 34H39" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10 46H46" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  )
}

function RomanticIcon({ color }: { color: string }) {
  return (
    <svg width="52" height="52" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <path d="M28 14 C28 14 22 10 18 14 C14 18 18 24 28 28 C38 24 42 18 38 14 C34 10 28 14 28 14Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeOpacity="0.85" />
      <path d="M28 42 C28 42 22 46 18 42 C14 38 18 32 28 28 C38 32 42 38 38 42 C34 46 28 42 28 42Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeOpacity="0.85" />
      <path d="M14 28 C14 28 10 22 14 18 C18 14 24 18 28 28 C24 38 18 42 14 38 C10 34 14 28 14 28Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeOpacity="0.85" />
      <path d="M42 28 C42 28 46 22 42 18 C38 14 32 18 28 28 C32 38 38 42 42 38 C46 34 42 28 42 28Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeOpacity="0.85" />
      <circle cx="28" cy="28" r="3.5" stroke={color} strokeWidth="1.2" />
      <circle cx="28" cy="28" r="1.2" fill={color} opacity="0.5" />
    </svg>
  )
}

function PeacefulIcon({ color }: { color: string }) {
  return (
    <svg width="52" height="52" viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="5" stroke={color} strokeWidth="1.3" />
      <circle cx="28" cy="28" r="12" stroke={color} strokeWidth="1.1" strokeOpacity="0.55" />
      <circle cx="28" cy="28" r="20" stroke={color} strokeWidth="0.9" strokeOpacity="0.25" />
      <line x1="28" y1="6"  x2="28" y2="10" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="28" y1="46" x2="28" y2="50" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="6"  y1="28" x2="10" y2="28" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="46" y1="28" x2="50" y2="28" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

// ── Corner bracket decoration ───────────────────────────────────────────────

function CornerBrackets({ color }: { color: string }) {
  const size = 14
  const thickness = 1
  const style: React.CSSProperties = { position: 'absolute', width: size, height: size, pointerEvents: 'none' }
  const line: React.CSSProperties = { position: 'absolute', background: color }
  return (
    <>
      <div style={{ ...style, top: 12, left: 12 }}>
        <div style={{ ...line, top: 0, left: 0, width: thickness, height: size }} />
        <div style={{ ...line, top: 0, left: 0, width: size, height: thickness }} />
      </div>
      <div style={{ ...style, top: 12, right: 12 }}>
        <div style={{ ...line, top: 0, right: 0, width: thickness, height: size }} />
        <div style={{ ...line, top: 0, right: 0, width: size, height: thickness }} />
      </div>
      <div style={{ ...style, bottom: 12, left: 12 }}>
        <div style={{ ...line, bottom: 0, left: 0, width: thickness, height: size }} />
        <div style={{ ...line, bottom: 0, left: 0, width: size, height: thickness }} />
      </div>
      <div style={{ ...style, bottom: 12, right: 12 }}>
        <div style={{ ...line, bottom: 0, right: 0, width: thickness, height: size }} />
        <div style={{ ...line, bottom: 0, right: 0, width: size, height: thickness }} />
      </div>
    </>
  )
}

// ── Atmospheric data ─────────────────────────────────────────────────────────

// Ghost lat/lon grid
const LAT_LINES = ['18%', '30%', '50%', '70%', '82%']
const LON_LINES = ['14%', '28%', '50%', '72%', '86%']

// Coordinate whispers — city coords scattered around edges, away from cards
const COORD_WHISPERS = [
  { top: '9%',  left: '12%',  text: '27.9°N · 86.9°E',  dur: 7.2, delay: 0.4 },   // Everest
  { top: '11%', left: '62%',  text: '48.8°N · 2.3°E',   dur: 6.5, delay: 2.1 },   // Paris
  { top: '88%', left: '22%',  text: '35.0°N · 135.7°E', dur: 7.8, delay: 1.3 },   // Kyoto
  { top: '86%', left: '70%',  text: '36.8°S · 174.7°E', dur: 6.2, delay: 3.0 },   // Auckland
  { top: '7%',  left: '38%',  text: '51.5°N · 0.1°W',   dur: 8.0, delay: 1.8 },   // London
  { top: '91%', left: '48%',  text: '1.3°S · 36.8°E',   dur: 6.8, delay: 0.9 },   // Nairobi
]

// Constellation skeleton — two small ones in top corners, away from cards
const CONSTELLATION_PATHS = [
  // Top-left — abstract Orion-like
  'M 60,52 L 82,44 L 100,58 L 92,80 M 82,44 L 76,26 M 60,52 L 48,64',
  // Top-right — abstract Southern Cross
  'M 340,38 L 360,58 L 340,78 M 360,58 L 320,58 M 350,44 L 372,72',
]

// Reactive color washes — per persona, originates from card direction
const ACCENT_WASH: Record<Persona, string> = {
  adventure: 'radial-gradient(ellipse 55% 75% at 14% 58%, rgba(212,105,42,0.10) 0%, transparent 65%)',
  romantic:  'radial-gradient(ellipse 55% 75% at 50% 58%, rgba(196,92,114,0.10) 0%, transparent 65%)',
  peaceful:  'radial-gradient(ellipse 55% 75% at 86% 58%, rgba(34,168,152,0.10) 0%, transparent 65%)',
}

const ACCENT_TITLE_GLOW: Record<Persona, string> = {
  adventure: '0 0 80px rgba(212,105,42,0.28), 0 0 40px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.6)',
  romantic:  '0 0 80px rgba(196,92,114,0.28), 0 0 40px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.6)',
  peaceful:  '0 0 80px rgba(34,168,152,0.28),  0 0 40px rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.6)',
}

// ── Card data ──────────────────────────────────────────────────────────────

const ITINERARIES = [
  {
    type: 'adventure' as Persona,
    id: '01',
    title: 'Adventure',
    sigil: 'A',
    subtitle: 'Thrill & Discovery',
    lines: ['Neon-lit alleyways,', 'rooftop crossings,', 'electric energy.'],
    accent: '#D4692A',
    accentDim: 'rgba(212,105,42,0.55)',
    accentMid: 'rgba(212,105,42,0.14)',
    accentBorder: 'rgba(212,105,42,0.22)',
    accentBorderHover: 'rgba(212,105,42,0.44)',
    accentGlow: 'rgba(212,105,42,0.08)',
    accentHoverGlow: 'rgba(212,105,42,0.18)',
    bgArt: 'linear-gradient(150deg, rgba(212,105,42,0.09) 0%, transparent 55%)',
    blob: 'rgba(212,105,42,0.11)',
    Icon: AdventureIcon,
  },
  {
    type: 'romantic' as Persona,
    id: '02',
    title: 'Romantic',
    sigil: 'R',
    subtitle: 'Love & Serenity',
    lines: ['Cherry blossoms,', 'lantern-lit paths,', 'moments for two.'],
    accent: '#C45C72',
    accentDim: 'rgba(196,92,114,0.55)',
    accentMid: 'rgba(196,92,114,0.13)',
    accentBorder: 'rgba(196,92,114,0.20)',
    accentBorderHover: 'rgba(196,92,114,0.42)',
    accentGlow: 'rgba(196,92,114,0.07)',
    accentHoverGlow: 'rgba(196,92,114,0.17)',
    bgArt: 'linear-gradient(150deg, rgba(196,92,114,0.09) 0%, transparent 55%)',
    blob: 'rgba(196,92,114,0.10)',
    Icon: RomanticIcon,
  },
  {
    type: 'peaceful' as Persona,
    id: '03',
    title: 'Peaceful',
    sigil: 'P',
    subtitle: 'Calm & Renewal',
    lines: ['Zen gardens,', 'ancient temples,', 'still water.'],
    accent: '#22A898',
    accentDim: 'rgba(34,168,152,0.55)',
    accentMid: 'rgba(34,168,152,0.12)',
    accentBorder: 'rgba(34,168,152,0.20)',
    accentBorderHover: 'rgba(34,168,152,0.40)',
    accentGlow: 'rgba(34,168,152,0.06)',
    accentHoverGlow: 'rgba(34,168,152,0.16)',
    bgArt: 'linear-gradient(150deg, rgba(34,168,152,0.08) 0%, transparent 55%)',
    blob: 'rgba(34,168,152,0.09)',
    Icon: PeacefulIcon,
  },
]

// ── Component ──────────────────────────────────────────────────────────────

export function ItinerarySelection({ onSelect }: Props) {
  const [visible, setVisible] = useState(false)
  const [chosen, setChosen] = useState<Persona | null>(null)
  const [exiting, setExiting] = useState(false)
  const [hoveredType, setHoveredType] = useState<Persona | null>(null)

  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    return () => cancelAnimationFrame(t)
  }, [])

  const handleSelect = (type: Persona) => {
    if (chosen || exiting) return
    setChosen(type)
    setTimeout(() => {
      setExiting(true)
      setTimeout(() => onSelect(type), 520)
    }, 360)
  }

  const overlayOpacity = exiting ? 0 : visible ? 1 : 0

  const titleShadow = hoveredType
    ? ACCENT_TITLE_GLOW[hoveredType]
    : '0 0 40px rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.6)'

  const accentWash = hoveredType ? ACCENT_WASH[hoveredType] : 'none'

  return (
    <>
      <style>{`
        @keyframes itinFadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes itinTitleIn {
          from { opacity: 0; letter-spacing: 0.52em; filter: blur(8px); }
          to   { opacity: 1; letter-spacing: 0.24em; filter: blur(0); }
        }
        @keyframes itinSubIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes itinShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes itinFooterShimmer {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
        }
        @keyframes itinGlowPop {
          0%   { opacity: 0; transform: scale(0.75); }
          60%  { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes itinBlobPulse {
          0%,100% { transform: translate(-50%,-50%) scale(1);    opacity: 0.6; }
          50%     { transform: translate(-50%,-50%) scale(1.12); opacity: 1;   }
        }
        @keyframes cardScan {
          0%   { top: 108%; }
          100% { top: -8%;  }
        }
        @keyframes landingGridIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes landingCoordWhisper {
          0%   { opacity: 0;    }
          15%  { opacity: 0.13; }
          75%  { opacity: 0.13; }
          100% { opacity: 0;    }
        }
        @keyframes landingVignette {
          0%,100% { opacity: 0.0; }
          50%     { opacity: 0.7; }
        }
        @keyframes landingConstellationDraw {
          from { stroke-dashoffset: 300; opacity: 0;    }
          20%  { opacity: 0.22; }
          to   { stroke-dashoffset: 0;   opacity: 0.14; }
        }
        @keyframes ruleShimmer {
          0%   { background-position: -400% center; }
          100% { background-position: 400% center;  }
        }
      `}</style>

      {/* ── Full-screen overlay — globe shows through ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(2,3,8,0.62) 0%, rgba(2,3,8,0.88) 100%)',
          backdropFilter: exiting ? 'blur(0px)' : 'blur(5px)',
          WebkitBackdropFilter: exiting ? 'blur(0px)' : 'blur(5px)',
          opacity: overlayOpacity,
          transition: exiting
            ? 'opacity 0.52s ease-in, backdrop-filter 0.52s ease-in'
            : 'opacity 0.48s ease-out',
          zIndex: 30,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 20px',
          gap: '32px',
          overflow: 'hidden',
        }}
      >
        {/* ── Breathing vignette (edges pulse slowly) ── */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 30%, rgba(2,3,8,0.65) 100%)',
          animation: 'landingVignette 6s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* ── Ghost lat/lon grid ── */}
        {LAT_LINES.map((top, i) => (
          <div key={`lat-${i}`} style={{
            position: 'absolute', left: 0, right: 0, top,
            height: '1px',
            background: 'rgba(255,255,255,0.028)',
            animation: `landingGridIn 0.8s ease ${0.1 + i * 0.12}s both`,
            pointerEvents: 'none',
          }} />
        ))}
        {LON_LINES.map((left, i) => (
          <div key={`lon-${i}`} style={{
            position: 'absolute', top: 0, bottom: 0, left,
            width: '1px',
            background: 'rgba(255,255,255,0.028)',
            animation: `landingGridIn 0.8s ease ${0.1 + i * 0.12}s both`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* ── Coordinate whispers ── */}
        {COORD_WHISPERS.map((c, i) => (
          <span key={i} style={{
            position: 'absolute',
            top: c.top, left: c.left,
            fontFamily: '"SF Mono","Fira Code",monospace',
            fontSize: '9px',
            letterSpacing: '0.18em',
            color: 'rgba(255,255,255,0.9)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: `landingCoordWhisper ${c.dur}s ease-in-out ${c.delay}s infinite`,
          }}>
            {c.text}
          </span>
        ))}

        {/* ── Constellation skeleton SVG ── */}
        <svg
          viewBox="0 0 420 110"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            width: '100%', height: '110px',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
          aria-hidden="true"
        >
          {CONSTELLATION_PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="0.6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="300"
              style={{
                animation: `landingConstellationDraw 4s cubic-bezier(0.22,1,0.36,1) ${0.6 + i * 1.2}s both`,
              }}
            />
          ))}
        </svg>

        {/* ── Reactive color wash — responds to hovered card ── */}
        <div style={{
          position: 'absolute', inset: 0,
          background: accentWash,
          transition: 'background 0.7s ease',
          pointerEvents: 'none',
        }} />

        {/* ── Header ── */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          {/* AYANA wordmark */}
          <h1 style={{
            margin: '0 0 14px',
            fontSize: 'clamp(32px, 4.5vw, 58px)',
            fontWeight: 100,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.92)',
            textShadow: titleShadow,
            transition: 'text-shadow 0.6s ease',
            animation: visible
              ? 'itinTitleIn 1.0s cubic-bezier(0.22,1,0.36,1) 0.05s both'
              : 'none',
          }}>
            Ayana
          </h1>

          {/* Subtitle */}
          <p style={{
            margin: '0 0 16px',
            fontFamily: '"SF Mono","Fira Code",monospace',
            fontSize: '10px',
            letterSpacing: '0.42em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.58)',
            animation: visible
              ? 'itinSubIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.38s both'
              : 'none',
          }}>
            Choose your experience
          </p>

          {/* Flanked rule — shimmer sweep */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            animation: visible ? 'itinSubIn 0.5s ease 0.48s both' : 'none',
          }}>
            <div style={{
              width: '48px', height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28) 40%, rgba(255,255,255,0.52) 60%, rgba(255,255,255,0.28) 80%, transparent)',
              backgroundSize: '400% auto',
              animation: 'ruleShimmer 4s linear infinite',
            }} />
            <div style={{ width: '3px', height: '3px', background: 'rgba(255,255,255,0.22)', transform: 'rotate(45deg)' }} />
            <div style={{
              width: '48px', height: '1px',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28) 40%, rgba(255,255,255,0.52) 60%, rgba(255,255,255,0.28) 80%, transparent)',
              backgroundSize: '400% auto',
              animation: 'ruleShimmer 4s linear infinite 0.5s',
            }} />
          </div>
        </div>

        {/* ── Cards row ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px',
          justifyContent: 'center',
          alignItems: 'stretch',
          width: '100%',
          maxWidth: '960px',
          position: 'relative',
          zIndex: 1,
        }}>
          {ITINERARIES.map((card, i) => {
            const isChosen = chosen === card.type
            const isDimmed = chosen !== null && chosen !== card.type
            const isHovered = hoveredType === card.type && !chosen

            return (
              <button
                key={card.type}
                aria-label={`Select ${card.title} itinerary`}
                onClick={() => handleSelect(card.type)}
                onMouseEnter={() => setHoveredType(card.type)}
                onMouseLeave={() => setHoveredType(null)}
                style={{
                  flex: '1 1 260px',
                  maxWidth: '300px',
                  minHeight: '440px',
                  padding: '36px 26px 32px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0,
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',

                  background: isHovered
                    ? 'rgba(255,255,255,0.038)'
                    : 'rgba(255,255,255,0.016)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  borderRadius: '4px',
                  border: `1px solid ${isHovered || isChosen ? card.accentBorderHover : card.accentBorder}`,

                  boxShadow: isChosen
                    ? `0 0 60px ${card.accentHoverGlow}, inset 0 0 40px ${card.accentMid}, 0 32px 80px rgba(0,0,0,0.5)`
                    : isHovered
                    ? `0 0 40px ${card.accentHoverGlow}, inset 0 0 30px ${card.accentGlow}, 0 24px 60px rgba(0,0,0,0.42)`
                    : `inset 0 0 24px ${card.accentGlow}, 0 16px 40px rgba(0,0,0,0.32)`,

                  opacity: isDimmed ? 0.10 : 1,
                  transform: isChosen
                    ? 'scale(1.035)'
                    : isHovered
                    ? 'scale(1.016)'
                    : 'scale(1)',

                  transition: exiting
                    ? 'opacity 0.36s ease, transform 0.36s ease'
                    : 'opacity 0.3s ease, transform 0.26s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.26s ease, background 0.2s ease, border-color 0.2s ease',

                  animation: visible
                    ? `itinFadeUp 0.65s cubic-bezier(0.22,1,0.36,1) ${0.14 + i * 0.10}s both`
                    : 'none',

                  cursor: chosen ? 'default' : 'pointer',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              >
                {/* Background gradient art */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: card.bgArt,
                  borderRadius: '4px',
                  pointerEvents: 'none',
                }} />

                {/* Ambient color blob */}
                <div style={{
                  position: 'absolute',
                  top: '30%', left: '50%',
                  width: 200, height: 200,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${card.blob} 0%, transparent 70%)`,
                  pointerEvents: 'none',
                  animation: isHovered || isChosen
                    ? 'itinBlobPulse 2.4s ease-in-out infinite'
                    : 'none',
                  opacity: isHovered || isChosen ? 1 : 0.7,
                  transition: 'opacity 0.3s ease',
                }} />

                {/* Ghost sigil */}
                <div style={{
                  position: 'absolute',
                  bottom: '-12px',
                  right: '-6px',
                  fontFamily: '"Bodoni Moda", "Times New Roman", serif',
                  fontSize: '110px',
                  fontWeight: 900,
                  color: card.accent,
                  opacity: isHovered ? 0.06 : 0.032,
                  lineHeight: 1,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  transition: 'opacity 0.3s ease',
                  letterSpacing: '-0.05em',
                }}>
                  {card.sigil}
                </div>

                {/* Vertical scan line on hover — sensor pass */}
                {isHovered && !chosen && (
                  <div style={{
                    position: 'absolute',
                    left: 0, right: 0,
                    height: '1.5px',
                    background: `linear-gradient(90deg, transparent 5%, ${card.accentDim} 30%, ${card.accent}88 50%, ${card.accentDim} 70%, transparent 95%)`,
                    animation: 'cardScan 1.8s linear infinite',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Shimmer sweep on hover */}
                {isHovered && !chosen && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(108deg, transparent 28%, ${card.accentMid} 50%, transparent 72%)`,
                    backgroundSize: '200% 100%',
                    animation: 'itinShimmer 1.6s linear infinite',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                  }} />
                )}

                {/* Corner brackets */}
                <CornerBrackets color={isHovered || isChosen ? card.accentDim : 'rgba(255,255,255,0.12)'} />

                {/* ID — top left */}
                <span style={{
                  position: 'absolute',
                  top: '18px', left: '22px',
                  fontFamily: '"SF Mono","Fira Code",monospace',
                  fontSize: '9px',
                  letterSpacing: '0.2em',
                  color: isHovered || isChosen ? card.accentDim : 'rgba(255,255,255,0.18)',
                  transition: 'color 0.2s ease',
                }}>
                  {card.id}
                </span>

                {/* Icon */}
                <div style={{
                  position: 'relative',
                  width: '90px', height: '90px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, ${card.accentMid} 0%, transparent 68%)`,
                    opacity: isHovered || isChosen ? 1.4 : 0.9,
                    transition: 'opacity 0.28s ease',
                  }} />
                  <card.Icon color={isHovered || isChosen ? card.accent : card.accentDim} />
                </div>

                {/* Title */}
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '18px',
                  fontWeight: 300,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: isHovered || isChosen ? card.accent : 'rgba(255,255,255,0.86)',
                  margin: '0 0 6px',
                  transition: 'color 0.22s ease',
                }}>
                  {card.title}
                </p>

                {/* Subtitle */}
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '10px',
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.36)',
                  margin: '0 0 18px',
                }}>
                  {card.subtitle}
                </p>

                {/* Separator */}
                <div style={{
                  width: '24px', height: '1px',
                  background: isHovered ? card.accentBorderHover : card.accentBorder,
                  margin: '0 0 18px',
                  transition: 'background 0.2s ease',
                }} />

                {/* Description */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                  {card.lines.map((line) => (
                    <p key={line} style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '12px',
                      fontWeight: 300,
                      letterSpacing: '0.04em',
                      lineHeight: 1.65,
                      color: 'rgba(255,255,255,0.50)',
                      margin: 0,
                    }}>
                      {line}
                    </p>
                  ))}
                </div>

                {/* CTA */}
                <div style={{
                  marginTop: '26px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isHovered && !chosen ? 0.88 : isChosen ? 0 : 0.22,
                  transition: 'opacity 0.22s ease',
                }}>
                  <span style={{
                    fontFamily: '"SF Mono","Fira Code",monospace',
                    fontSize: '9px',
                    letterSpacing: '0.28em',
                    textTransform: 'uppercase',
                    color: card.accent,
                  }}>
                    [ Select ]
                  </span>
                </div>

                {/* Chosen check */}
                {isChosen && (
                  <div style={{
                    position: 'absolute',
                    top: '14px', right: '16px',
                    width: '20px', height: '20px',
                    border: `1px solid ${card.accentBorderHover}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'itinGlowPop 0.32s ease-out both',
                  }}>
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                      <path d="M1 3.5L3.8 6.5L9 1" stroke={card.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Footer ── */}
        <div style={{
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
          animation: visible ? 'itinSubIn 0.55s ease 0.56s both' : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
        }}>
          <p style={{
            margin: 0,
            fontFamily: '"SF Mono","Fira Code",monospace',
            fontSize: '10px',
            letterSpacing: '0.22em',
            background: 'linear-gradient(90deg, rgba(255,255,255,0.62) 0%, rgba(255,255,255,0.62) 30%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.62) 70%, rgba(255,255,255,0.62) 100%)',
            backgroundSize: '300% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 1px 8px rgba(0,0,0,0.98)) drop-shadow(0 0 20px rgba(0,0,0,0.85))',
            animation: 'itinFooterShimmer 5s ease-in-out infinite',
          }}>
            Your persona shapes the journeys ahead.
          </p>
          {/* System label */}
          <p style={{
            margin: 0,
            fontFamily: '"SF Mono","Fira Code",monospace',
            fontSize: '8px',
            letterSpacing: '0.30em',
            color: 'rgba(255,255,255,0.14)',
          }}>
            A I  ·  J O U R N E Y  E N G I N E  ·  V 1
          </p>
        </div>
      </div>
    </>
  )
}
