'use client'

import { useEffect, useRef } from 'react'
import type { GestureEngineState } from '@/lib/gesture/types'
import { MIC_TOGGLE_GESTURE_ID } from '@/lib/gesture/config'

interface MicNotchProps {
  gestureState: GestureEngineState
  micMuted: boolean
  onToggle: () => void
}

function MicIcon({ muted }: { muted: boolean }) {
  const color = muted ? 'rgba(255,100,72,0.90)' : 'rgba(72,200,130,0.90)'
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none" aria-hidden="true">
      {/* Mic body */}
      <rect x="5.5" y="1" width="7" height="10" rx="3.5"
        stroke={color} strokeWidth="1.3" fill="none" />
      {/* Arc arms */}
      <path d="M2.5 9.5 C2.5 14 15.5 14 15.5 9.5"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      {/* Stand */}
      <line x1="9" y1="14" x2="9" y2="18"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      {/* Base */}
      <line x1="6" y1="18" x2="12" y2="18"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      {/* Muted slash */}
      {muted && (
        <line x1="2" y1="2" x2="16" y2="18"
          stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  )
}

const CSS = `
@keyframes micNotchIn {
  from { opacity: 0; transform: translateY(-6px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
@keyframes micNotchFlash {
  0%   { transform: scale(1);    }
  35%  { transform: scale(1.14); }
  100% { transform: scale(1);    }
}
`

export function MicNotch({ gestureState, micMuted, onToggle }: MicNotchProps) {
  const lastToggleRef = useRef(0)
  const pillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (gestureState.stableGestureId !== MIC_TOGGLE_GESTURE_ID) return
    const now = Date.now()
    if (now - lastToggleRef.current < 1500) return
    lastToggleRef.current = now
    if (pillRef.current) {
      pillRef.current.style.animation = 'none'
      void pillRef.current.offsetWidth
      pillRef.current.style.animation = 'micNotchFlash 0.28s ease-out both'
    }
    onToggle()
  }, [gestureState.stableGestureId, onToggle])

  const accent = micMuted ? 'rgba(255,100,72,0.80)' : 'rgba(72,200,130,0.70)'

  return (
    <>
      <style>{CSS}</style>
      <div
        ref={pillRef}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: 'rgba(4,5,12,0.62)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: `0.5px solid ${accent}`,
          boxShadow: `inset 0 0 0 0.5px rgba(255,255,255,0.04), 0 0 12px ${accent}55, 0 2px 12px rgba(0,0,0,0.4)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'micNotchIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
          cursor: 'default',
        }}
      >
        <MicIcon muted={micMuted} />
      </div>
    </>
  )
}
