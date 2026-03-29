'use client'

import { useState, useEffect, useRef } from 'react'
import type { SidebarData } from '@/lib/maps/sidebarControls'
import { fetchNearbyPlacesOrThrow, formatPriceLevel } from '@/lib/places/nearbySearch'
import type { NearbyPlace, PlaceCategory } from '@/lib/places/nearbySearch'

interface SidebarProps {
  visible: boolean
  requestId: number
  data: SidebarData | null
  category: PlaceCategory
  onClose: () => void
  onPlaceStreetView: (lat: number, lng: number) => void
  onPlacesReady?: (
    requestId: number,
    category: PlaceCategory,
    data: SidebarData,
    places: NearbyPlace[]
  ) => void
  onPlacesError?: (requestId: number, errorMessage: string) => void
}

const SHIMMER_CSS = `
@keyframes ayanaShimmer {
  0%   { opacity: 0.4; }
  50%  { opacity: 0.8; }
  100% { opacity: 0.4; }
}
`

export function Sidebar({
  visible,
  requestId,
  data,
  category,
  onClose,
  onPlacesReady,
  onPlacesError,
}: SidebarProps) {
  // Internal category lags behind prop — swaps after fade-out completes
  const [activeCategory, setActiveCategory] = useState<PlaceCategory>(category)
  const [fading, setFading] = useState(false)
  const [places, setPlaces] = useState<NearbyPlace[]>([])
  const [loading, setLoading] = useState(false)
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestFetchIdRef = useRef(0)

  // Fade out → swap category → fade in
  useEffect(() => {
    if (category === activeCategory) return
    if (fadeTimer.current) clearTimeout(fadeTimer.current)
    setFading(true)
    fadeTimer.current = setTimeout(() => {
      setActiveCategory(category)
      setFading(false)
    }, 200)
    return () => { if (fadeTimer.current) clearTimeout(fadeTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  // Fetch whenever location or active category changes
  useEffect(() => {
    if (!visible || !data?.lat || !data?.lng) return
    const { lat, lng } = data
    let cancelled = false
    const fetchId = ++latestFetchIdRef.current
    setLoading(true)
    setPlaces([])
    void fetchNearbyPlacesOrThrow(lat, lng, activeCategory).then(results => {
      if (cancelled || fetchId !== latestFetchIdRef.current) {
        return
      }
      setPlaces(results)
      setLoading(false)
      if (visible && requestId > 0 && data) {
        onPlacesReady?.(requestId, activeCategory, data, results)
      }
    }).catch((error) => {
      if (cancelled || fetchId !== latestFetchIdRef.current) {
        return
      }
      setPlaces([])
      setLoading(false)
      const message = error instanceof Error
        ? error.message
        : 'Unable to fetch nearby places right now.'
      if (visible && requestId > 0) {
        onPlacesError?.(requestId, message)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    data,
    data?.lat,
    data?.lng,
    activeCategory,
    onPlacesError,
    onPlacesReady,
    requestId,
    visible,
  ])

  const glass: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    right: 0,
    width: 320,
    height: '100vh',
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(12,12,22,0.60)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    borderLeft: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.35)',
    transform: visible ? 'translateX(0%)' : 'translateX(105%)',
    transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
    pointerEvents: visible ? 'auto' : 'none',
    overflow: 'hidden',
  }

  return (
    <>
      <style href="ayana-shimmer" precedence="default">{SHIMMER_CSS}</style>

      <aside style={glass}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 500, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data?.locationName ?? ''}
              </p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '2px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {data?.locationSub ?? ''}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 16, cursor: 'pointer', padding: '0 0 0 12px', flexShrink: 0, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Scene pips */}
          {data && data.sceneTotal > 1 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
              {Array.from({ length: data.sceneTotal }).map((_, i) => (
                <div key={i} style={{
                  height: 5, width: i === data.sceneIndex ? 16 : 5, borderRadius: 3,
                  background: i === data.sceneIndex ? 'rgba(99,179,237,0.9)' : 'rgba(255,255,255,0.2)',
                  transition: 'width 0.3s ease, background 0.3s ease',
                }} />
              ))}
            </div>
          )}
        </div>

        {/* Cards — flex column so cards share all available height equally */}
        <div style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
          padding: '6px 0 0',
          opacity: fading ? 0 : 1,
          transition: 'opacity 0.18s ease',
        }}>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
            : places.length === 0
              ? (
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, textAlign: 'center', marginTop: 32 }}>
                  No results nearby
                </p>
              )
              : places.map(place => (
                <PlaceCard
                  key={place.placeId}
                  place={place}
                />
              ))
          }
        </div>
      </aside>
    </>
  )
}

function formatTypes(types: string[]): string {
  return types
    .filter(t => t !== 'point_of_interest' && t !== 'establishment')
    .slice(0, 2)
    .map(t => t.replace(/_/g, ' '))
    .map(t => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' · ')
}

function PlaceCard({ place }: { place: NearbyPlace }) {
  const price = formatPriceLevel(place.priceLevel)
  const typeLabel = formatTypes(place.types)

  return (
    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Hero image — grows to fill available card space */}
      <div style={{
        width: '100%', flex: 1, minHeight: 80, overflow: 'hidden',
        background: 'rgba(255,255,255,0.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {place.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.photoUrl} alt={place.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '8px 14px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <p style={{
            color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: 500, margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {place.name}
          </p>
          {place.rating !== null && (
            <span style={{ color: 'rgba(251,191,36,0.9)', fontSize: 12, flexShrink: 0 }}>
              ★ {place.rating.toFixed(1)}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
          <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11 }}>{typeLabel}</span>
          {place.userRatingCount !== null && (
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, flexShrink: 0 }}>
              {place.userRatingCount.toLocaleString()} reviews
            </span>
          )}
        </div>

        {price && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: '2px 0 0' }}>{price}</p>
        )}
      </div>

    </div>
  )
}

function SkeletonCard() {
  const shimmer: React.CSSProperties = {
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    animation: 'ayanaShimmer 1.4s ease-in-out infinite',
  }
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ ...shimmer, width: '100%', flex: 1, minHeight: 80, borderRadius: 0 }} />
      <div style={{ padding: '8px 14px 10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <div style={{ ...shimmer, height: 13, width: '60%' }} />
          <div style={{ ...shimmer, height: 13, width: '18%' }} />
        </div>
        <div style={{ ...shimmer, height: 11, width: '40%', marginBottom: 8 }} />
        <div style={{ ...shimmer, height: 28, borderRadius: 6 }} />
      </div>
    </div>
  )
}
