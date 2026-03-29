'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import {
  type AyanaPrepItinerary,
  type Persona,
  PERSONA_META,
} from '@/lib/ayana/prep'

interface GeneratedItineraryOverlayProps {
  persona: Persona
  itineraries: AyanaPrepItinerary[]
  selectedItineraryId: string | null
  onSelect: (itineraryId: string) => void
  exiting?: boolean
}

function CornerBrackets({ color }: { color: string }) {
  const size = 14
  const thickness = 1
  const style: CSSProperties = {
    position: 'absolute',
    width: size,
    height: size,
    pointerEvents: 'none',
  }
  const line: CSSProperties = {
    position: 'absolute',
    background: color,
  }

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

export function GeneratedItineraryOverlay({
  persona,
  itineraries,
  selectedItineraryId,
  onSelect,
  exiting = false,
}: GeneratedItineraryOverlayProps) {
  const { label, accent, borderAlpha } = PERSONA_META[persona]
  const [visible, setVisible] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setVisible(true))
    )
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <>
      <style>{`
        @keyframes ayanaGeneratedOverlayIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ayanaGeneratedHeaderIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ayanaGeneratedWordmarkIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 33,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '30px',
          padding: '34px 20px 28px',
          background: 'radial-gradient(ellipse at center, rgba(2,3,8,0.28) 0%, rgba(2,3,8,0.72) 70%, rgba(2,3,8,0.92) 100%)',
          overflow: 'hidden',
          opacity: exiting ? 0 : visible ? 1 : 0,
          transform: exiting ? undefined : visible ? 'translateY(0)' : 'translateY(18px)',
          pointerEvents: exiting ? 'none' : 'auto',
          transition: exiting
            ? 'opacity 0.45s ease'
            : 'opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,0.014) 3px, rgba(0,0,0,0.014) 4px)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              animation: visible
                ? 'ayanaGeneratedWordmarkIn 0.42s cubic-bezier(0.22,1,0.36,1) both'
                : 'none',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(36px, 6vw, 64px)',
                fontWeight: 200,
                letterSpacing: '0.38em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.88)',
              }}
            >
              Ayana
            </h1>
          </div>

          <p
            style={{
              margin: 0,
              fontFamily: '"SF Mono", "Fira Code", monospace',
              fontSize: '10px',
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              color: accent,
              opacity: 0.72,
              animation: visible
                ? 'ayanaGeneratedHeaderIn 0.48s cubic-bezier(0.22,1,0.36,1) 0.06s both'
                : 'none',
            }}
          >
            {label} · Curated Journeys
          </p>

          <p
            style={{
              maxWidth: '520px',
              margin: 0,
              fontSize: '11px',
              lineHeight: 1.8,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.62)',
              animation: visible
                ? 'ayanaGeneratedHeaderIn 0.48s cubic-bezier(0.22,1,0.36,1) 0.12s both'
                : 'none',
            }}
          >
            Three city paths have been prepared. Choose one to continue.
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'stretch',
            gap: '14px',
            width: '100%',
            maxWidth: '960px',
            position: 'relative',
            zIndex: 1,
            alignContent: 'center',
          }}
        >
          {itineraries.map((itinerary, index) => {
            const isSelected = selectedItineraryId === itinerary.id
            const isDimmed =
              selectedItineraryId !== null && selectedItineraryId !== itinerary.id
            const isHovered = hoveredId === itinerary.id && !selectedItineraryId

            return (
              <button
                key={itinerary.id}
                type="button"
                onClick={() => onSelect(itinerary.id)}
                onMouseEnter={() => setHoveredId(itinerary.id)}
                onMouseLeave={() => setHoveredId(null)}
                aria-label={`Select ${itinerary.city_name}`}
                style={{
                  position: 'relative',
                  flex: '1 1 260px',
                  maxWidth: '300px',
                  minHeight: '280px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  gap: '14px',
                  padding: '28px 24px 24px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  background: isHovered
                    ? 'rgba(255,255,255,0.036)'
                    : 'rgba(255,255,255,0.016)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  border: `1px solid ${isHovered || isSelected ? accent : borderAlpha}`,
                  boxShadow: isSelected
                    ? `0 0 42px ${accent}2e, inset 0 0 28px ${accent}14, 0 24px 60px rgba(0,0,0,0.4)`
                    : isHovered
                    ? `0 0 24px ${accent}20, inset 0 0 22px ${accent}12, 0 16px 42px rgba(0,0,0,0.34)`
                    : `inset 0 0 20px rgba(255,255,255,0.015), 0 12px 32px rgba(0,0,0,0.26)`,
                  opacity: isDimmed ? 0.18 : 1,
                  transform: isSelected
                    ? 'scale(1.024)'
                    : isHovered
                    ? 'scale(1.01)'
                    : 'scale(1)',
                  transition:
                    'opacity 0.34s ease, transform 0.3s cubic-bezier(0.22,1,0.36,1), box-shadow 0.3s ease, background 0.24s ease, border-color 0.24s ease',
                  animation: visible
                    ? `ayanaGeneratedOverlayIn 0.54s cubic-bezier(0.22,1,0.36,1) ${0.2 + index * 0.09}s both`
                    : 'none',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(150deg, ${accent}10 0%, transparent 58%)`,
                    pointerEvents: 'none',
                  }}
                />

                <div
                  style={{
                    position: 'absolute',
                    right: '-8px',
                    bottom: '-12px',
                    fontFamily: '"Bodoni Moda", "Times New Roman", serif',
                    fontSize: '118px',
                    fontWeight: 900,
                    lineHeight: 1,
                    color: accent,
                    opacity: isHovered || isSelected ? 0.055 : 0.03,
                    letterSpacing: '-0.04em',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    transition: 'opacity 0.22s ease',
                  }}
                >
                  0{index + 1}
                </div>

                <CornerBrackets
                  color={
                    isHovered || isSelected
                      ? `${accent}99`
                      : 'rgba(255,255,255,0.12)'
                  }
                />

                <div
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"SF Mono", "Fira Code", monospace',
                      fontSize: '9px',
                      letterSpacing: '0.2em',
                      color: isHovered || isSelected ? accent : 'rgba(255,255,255,0.2)',
                      textTransform: 'uppercase',
                    }}
                  >
                    0{index + 1}
                  </span>

                  {isSelected && (
                    <span
                      style={{
                        fontFamily: '"SF Mono", "Fira Code", monospace',
                        fontSize: '9px',
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: accent,
                      }}
                    >
                      Journey Primed
                    </span>
                  )}
                </div>

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: '"SF Mono", "Fira Code", monospace',
                      fontSize: '10px',
                      letterSpacing: '0.22em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.34)',
                    }}
                  >
                    {itinerary.country_name}
                  </p>
                  <h3
                    style={{
                      margin: '8px 0 0',
                      fontSize: 'clamp(20px, 2.3vw, 30px)',
                      fontWeight: 200,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'rgba(255,255,255,0.86)',
                    }}
                  >
                    {itinerary.city_name}
                  </h3>
                </div>

                <div style={{ position: 'relative', zIndex: 1, marginTop: 'auto' }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '11px',
                      fontWeight: 300,
                      letterSpacing: '0.14em',
                      color: isHovered || isSelected ? accent : 'rgba(255,255,255,0.42)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {itinerary.title}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            animation: visible
              ? 'ayanaGeneratedHeaderIn 0.42s ease 0.46s both'
              : 'none',
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: '"SF Mono", "Fira Code", monospace',
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color:
                selectedItineraryId !== null
                  ? accent
                  : 'rgba(255,255,255,0.52)',
            }}
          >
            {selectedItineraryId !== null
              ? 'Journey selected for the next runtime phase'
              : 'Select one path to continue the journey setup'}
          </p>
        </div>
      </div>
    </>
  )
}
