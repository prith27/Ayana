'use client'

import type { AgentState } from '@/lib/maps/sidebarControls'

const NOTCH_CSS = `
@keyframes ayanaWave {
  0%, 100% { transform: scaleY(0.55); opacity: 0.72; }
  50%      { transform: scaleY(1.6); opacity: 1; }
}
@keyframes ayanaPulse {
  0%, 100% { opacity: 0.45; transform: scale(1); }
  50%      { opacity: 0.95; transform: scale(1.08); }
}
`

interface AgentStatusNotchProps {
  state: AgentState
}

export function AgentStatusNotch({ state }: AgentStatusNotchProps) {
  const isSpeaking = state === 'speaking'
  const isConnecting = state === 'connecting'
  const isDisconnected = state === 'disconnected'

  const accent = isSpeaking
    ? 'rgba(72,199,142,1)'
    : isConnecting
      ? 'rgba(99,179,237,0.95)'
      : isDisconnected
        ? 'rgba(255,153,102,0.82)'
        : 'rgba(255,255,255,0.45)'

  const accentDim = isSpeaking
    ? 'rgba(72,199,142,0.72)'
    : isConnecting
      ? 'rgba(99,179,237,0.38)'
      : isDisconnected
        ? 'rgba(255,153,102,0.2)'
        : 'rgba(255,255,255,0.24)'

  const barHeights = isDisconnected ? [3, 2, 3] : [4, 6, 4]
  const borderColor = isDisconnected
    ? 'rgba(255,153,102,0.22)'
    : isConnecting
      ? 'rgba(99,179,237,0.18)'
      : 'rgba(255,255,255,0.1)'

  return (
    <>
      <style href="ayana-notch" precedence="default">{NOTCH_CSS}</style>
      <div
        style={{
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRadius: 100,
          border: `0.5px solid ${borderColor}`,
          padding: '8px 10px',
          minWidth: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: accent,
            flexShrink: 0,
            animation: isConnecting ? 'ayanaPulse 1.3s ease-in-out infinite' : 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {barHeights.map((height, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height,
                background: accentDim,
                borderRadius: 2,
                animationName: isSpeaking ? 'ayanaWave' : 'none',
                animationDuration: '0.8s',
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
                animationDelay: `${i * 0.1}s`,
                transformOrigin: 'center bottom',
              }}
            />
          ))}
        </div>
      </div>
    </>
  )
}
