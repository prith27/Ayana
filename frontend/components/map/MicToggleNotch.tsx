'use client'

import { useEffect, useRef } from 'react'
import type { GestureEngineState } from '@/lib/gesture/types'
import { MIC_TOGGLE_GESTURE_ID } from '@/lib/gesture/config'

interface MicToggleNotchProps {
  gestureState: GestureEngineState
  micMuted: boolean
  onToggle: () => void
}

const CSS = `
@keyframes micToggleFlash {
  0%   { transform: scale(1);    }
  35%  { transform: scale(1.10); }
  100% { transform: scale(1);    }
}
@keyframes micNotchIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0);    }
}
`

export function MicToggleNotch({ gestureState, micMuted, onToggle }: MicToggleNotchProps) {
  const lastToggleRef = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Fire toggle when thumbs-up gesture becomes stable
  useEffect(() => {
    if (gestureState.stableGestureId !== MIC_TOGGLE_GESTURE_ID) return
    const now = Date.now()
    if (now - lastToggleRef.current < 1500) return
    lastToggleRef.current = now
    if (wrapRef.current) {
      wrapRef.current.style.animation = 'none'
      void wrapRef.current.offsetWidth
      wrapRef.current.style.animation = 'micToggleFlash 0.30s ease-out both'
    }
    onToggle()
  }, [gestureState.stableGestureId, onToggle])

  const accent = micMuted
    ? 'rgba(255,100,72,0.85)'
    : 'rgba(72,200,130,0.75)'

  const label = micMuted ? 'VOICE  \u00b7  MUTED' : 'VOICE  \u00b7  LIVE'

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={wrapRef}
        style={{
          background: 'rgba(4,5,12,0.62)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderRadius: 100,
          border: `0.5px solid ${accent}`,
          boxShadow: `inset 0 0 0 0.5px rgba(255,255,255,0.04), 0 2px 12px rgba(0,0,0,0.4)`,
          padding: '8px 14px',
          minWidth: 138,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          whiteSpace: 'nowrap',
          animation: 'micNotchIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
          transition: 'border-color 0.3s ease',
        }}
      >
        {/* Status dot with glow */}
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: accent,
          boxShadow: `0 0 6px ${accent}`,
          flexShrink: 0,
          transition: 'background 0.3s ease, box-shadow 0.3s ease',
        }} />

        <span style={{
          fontFamily: '"SF Mono","Fira Code",monospace',
          fontSize: '10px',
          letterSpacing: '0.20em',
          color: accent,
          transition: 'color 0.3s ease',
        }}>
          {label}
        </span>
      </div>
    </>
  )
}
