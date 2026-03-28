'use client'
import { useState } from 'react'
import { MapCanvas } from '@/components/map/MapCanvas'
import { CameraWidget } from '@/components/map/CameraWidget'
import { GestureNotch } from '@/components/map/GestureNotch'
import { AgentStatusNotch } from '@/components/map/AgentStatusNotch'
import { useGestureEngine } from '@/hooks/useGestureEngine'
import { useAgentState } from '@/hooks/useAgentState'

export function JapanClient({ center }: { center: { lat: number; lng: number } }) {
  const [ready, setReady] = useState(false)
  const { videoRef, gestureState } = useGestureEngine()
  const agentState = useAgentState()

  return (
    <main className="relative w-full h-screen bg-black overflow-hidden">
      {/* 3D map — mounts at 22Mm, then flies in automatically */}
      <MapCanvas coords={center} onReady={() => setReady(true)} />

      {/* Gesture notch — top-center */}
      <div style={{ position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
        <GestureNotch state={gestureState} />
      </div>

      {/* Agent notch — bottom-center, always visible */}
      <div style={{ position: 'absolute', bottom: 32, left: '50%', transform: 'translateX(-50%)', zIndex: 50 }}>
        <AgentStatusNotch state={agentState} />
      </div>

      {/* Hidden video for gesture camera feed */}
      <video
        ref={videoRef}
        autoPlay playsInline muted
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
      />

      {/* Page title */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <h1 className="text-white/80 text-lg font-light tracking-[0.3em] uppercase">Japan</h1>
      </div>

      {/* Loading state — shown during fly-in */}
      {!ready && (
        <div className="absolute inset-0 z-20 flex items-end justify-center pb-24 pointer-events-none">
          <p className="text-white/40 text-xs tracking-widest uppercase animate-pulse">
            Flying to Japan…
          </p>
        </div>
      )}

      {/* Widget panel — shown only after fly-in completes */}
      {ready && <CameraWidget gestureState={gestureState} />}
    </main>
  )
}
