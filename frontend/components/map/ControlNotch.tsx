'use client'

import type { GestureEngineState } from '@/lib/gesture/types'

interface ControlNotchProps {
  gestureState: GestureEngineState
}

function resolveDisplay(s: GestureEngineState): { label: string; accent: string; pulse: boolean } {
  if (s.modelState === 'loading' || s.modelState === 'uninitialized') {
    return { label: 'CALIBRATING', accent: 'rgba(255,255,255,0.28)', pulse: true }
  }
  if (s.modelState === 'error' || s.cameraState === 'denied') {
    return { label: 'SENSOR UNAVAIL', accent: 'rgba(255,80,80,0.45)', pulse: false }
  }
  if (s.activeGesture === 'zoom-in')  return { label: 'ZOOM IN  \u2191',  accent: 'rgba(72,200,130,0.82)', pulse: false }
  if (s.activeGesture === 'zoom-out') return { label: 'ZOOM OUT  \u2193', accent: 'rgba(72,200,130,0.82)', pulse: false }
  if (s.activeGesture === 'orbit')    return { label: 'ORBIT  \u21ba',    accent: 'rgba(99,179,237,0.82)', pulse: false }
  if (s.stableGestureId === 0)        return { label: 'HOLD  \u2014',     accent: 'rgba(255,255,255,0.30)', pulse: false }
  // Idle — gestures live but nothing active
  return { label: 'GESTURES  \u00b7  LIVE', accent: 'rgba(72,200,130,0.38)', pulse: false }
}

const CSS = `
@keyframes controlNotchPulse {
  0%,100% { opacity: 0.4; }
  50%      { opacity: 1;   }
}
@keyframes controlNotchIn {
  from { opacity: 0; transform: translateY(-8px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
`

export function ControlNotch({ gestureState }: ControlNotchProps) {
  const { label, accent, pulse } = resolveDisplay(gestureState)

  return (
    <>
      <style>{CSS}</style>
      <div style={{
        background: 'rgba(4,5,12,0.62)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderRadius: 100,
        border: `0.5px solid ${accent}`,
        boxShadow: `inset 0 0 0 0.5px rgba(255,255,255,0.04), 0 2px 12px rgba(0,0,0,0.4)`,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        whiteSpace: 'nowrap',
        animation: pulse
          ? 'controlNotchPulse 1.4s ease-in-out infinite'
          : 'controlNotchIn 0.4s cubic-bezier(0.22,1,0.36,1) both',
        transition: 'border-color 0.3s ease',
      }}>
        <div style={{
          width: 6, height: 6,
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
