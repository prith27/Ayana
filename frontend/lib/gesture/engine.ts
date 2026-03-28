/**
 * GestureEngine — browser gesture pipeline
 *
 * Gesture mapping:
 *   4 Horn       → toggle mic mute/unmute (1.5s cooldown)
 *   2 Pointer    → zoom in  / walk forward  in Street View
 *   6 Victory    → zoom out / walk backward in Street View
 *   0 Open Palm  → neutral HOLD state
 *   1 Fist       → orbit (3D map) / panorama spin (Street View)
 *
 * Gestures are always active once the engine is running — no on/off toggle.
 */

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { classifyGesture, type Landmark } from './classifier'
import type { GestureEngineState, CameraState, TrackingState, ModelState } from './types'
import {
  GESTURE_ASSETS,
  MIC_TOGGLE_GESTURE_ID,
  ZOOM_IN_GESTURE_ID,
  ZOOM_OUT_GESTURE_ID,
  ORBIT_GESTURE_ID,
  THRESHOLDS,
} from './config'

// ── Stability slot ────────────────────────────────────────────────────────────

interface StabilitySlot {
  targetId:     number
  stableFrames: number
  missFrames:   number
  hitCount:     number
  missCount:    number
  stable:       boolean
}

function makeSlot(targetId: number, stableFrames: number, missFrames: number): StabilitySlot {
  return { targetId, stableFrames, missFrames, hitCount: 0, missCount: 0, stable: false }
}

function tickSlot(slot: StabilitySlot, rawId: number): void {
  if (rawId === slot.targetId) {
    slot.hitCount++
    slot.missCount = 0
    if (slot.hitCount >= slot.stableFrames) slot.stable = true
  } else {
    slot.missCount++
    slot.hitCount = 0
    if (slot.missCount >= slot.missFrames) slot.stable = false
  }
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class GestureEngine {
  private state: GestureEngineState = {
    cameraState:        'idle',
    trackingState:      'no-hand',
    modelState:         'uninitialized',
    gestureMode:        'on',   // always on — no toggle
    activeGesture:      'none',
    stableGestureId:    null,
    stableGestureLabel: null,
  }

  private listeners: Array<(s: GestureEngineState) => void> = []
  private handLandmarker: HandLandmarker | null = null
  private stream:         MediaStream  | null = null
  private rafId:          number | null = null
  private videoEl:        HTMLVideoElement | null = null

  private zoomInSlot    = makeSlot(ZOOM_IN_GESTURE_ID,    THRESHOLDS.zoomInStableFrames,    THRESHOLDS.zoomInMissFrames)
  private zoomOutSlot   = makeSlot(ZOOM_OUT_GESTURE_ID,   THRESHOLDS.zoomOutStableFrames,   THRESHOLDS.zoomOutMissFrames)
  private orbitSlot     = makeSlot(ORBIT_GESTURE_ID,      THRESHOLDS.orbitStableFrames,     THRESHOLDS.orbitMissFrames)
  private micToggleSlot = makeSlot(MIC_TOGGLE_GESTURE_ID, THRESHOLDS.micToggleStableFrames, 3)

  private lastMicToggleMs = 0

  // ── Public API ─────────────────────────────────────────────────────────────

  getState(): GestureEngineState { return this.state }

  onStateChange(cb: (s: GestureEngineState) => void): () => void {
    this.listeners.push(cb)
    return () => { this.listeners = this.listeners.filter(l => l !== cb) }
  }

  async init(videoEl: HTMLVideoElement): Promise<void> {
    this.videoEl = videoEl
    await this.startCamera()
    await this.loadModel()
    this.startLoop()
  }

  destroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId)
    this.rafId = null
    this.stream?.getTracks().forEach(t => t.stop())
    this.stream = null
    this.handLandmarker?.close()
    this.handLandmarker = null
    this.videoEl = null
  }

  // ── Camera ─────────────────────────────────────────────────────────────────

  private async startCamera(): Promise<void> {
    this.patch({ cameraState: 'requesting' })
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: THRESHOLDS.cameraWidth, height: THRESHOLDS.cameraHeight, facingMode: 'user' },
        audio: false,
      })
      if (!this.videoEl) return
      this.videoEl.srcObject = this.stream
      await new Promise<void>(res => {
        const v = this.videoEl!
        if (v.readyState >= 2) { res(); return }
        v.onloadeddata = () => res()
      })
      this.patch({ cameraState: 'ready' })
    } catch {
      this.patch({ cameraState: 'denied' })
    }
  }

  // ── Model load ─────────────────────────────────────────────────────────────

  private async loadModel(): Promise<void> {
    this.patch({ modelState: 'loading' })
    try {
      const vision = await FilesetResolver.forVisionTasks(
        GESTURE_ASSETS.mediapipeWasmPath,
      )
      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: GESTURE_ASSETS.handLandmarkerModelPath,
          delegate: 'GPU',
        },
        runningMode:                    'VIDEO',
        numHands:                       1,
        minHandDetectionConfidence:     0.5,
        minHandPresenceConfidence:      0.5,
        minTrackingConfidence:          0.5,
      })
      this.patch({ modelState: 'ready' })
    } catch (e) {
      console.error('[GestureEngine] model load failed', e)
      this.patch({ modelState: 'error' })
    }
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────

  private startLoop(): void {
    const tick = (nowMs: number) => {
      this.rafId = requestAnimationFrame(tick)
      this.processFrame(nowMs)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private processFrame(nowMs: number): void {
    const v = this.videoEl
    if (!v || !this.handLandmarker || v.readyState < 2) return
    if (this.state.modelState !== 'ready') return

    const result = this.handLandmarker.detectForVideo(v, nowMs)
    const hand = result.landmarks?.[0]

    if (!hand || hand.length === 0) {
      if (this.state.trackingState !== 'no-hand') {
        this.patch({
          trackingState:      'no-hand',
          stableGestureId:    null,
          stableGestureLabel: null,
          activeGesture:      'none',
        })
        this.resetSlots()
      }
      return
    }

    const lm = hand as Landmark[]
    this.patch({ trackingState: 'tracking' })

    const rawId = classifyGesture(lm)

    // Tick all slots
    tickSlot(this.zoomInSlot,    rawId)
    tickSlot(this.zoomOutSlot,   rawId)
    tickSlot(this.orbitSlot,     rawId)
    tickSlot(this.micToggleSlot, rawId)

    // Mic toggle fires independently with cooldown
    if (this.micToggleSlot.stable) {
      const elapsed = nowMs - this.lastMicToggleMs
      if (elapsed >= THRESHOLDS.micToggleCooldownMs) {
        this.lastMicToggleMs = nowMs
        this.micToggleSlot.stable = false
        this.micToggleSlot.hitCount = 0
      }
    }

    // Zoom / Orbit — always active (no mode gate)
    const newActive: typeof this.state.activeGesture =
      this.orbitSlot.stable   ? 'orbit'   :
      this.zoomInSlot.stable  ? 'zoom-in' :
      this.zoomOutSlot.stable ? 'zoom-out': 'none'

    if (newActive !== this.state.activeGesture) {
      this.patch({ activeGesture: newActive })
    }

    // Resolve dominant stable gesture label
    const stableId =
      this.orbitSlot.stable      ? ORBIT_GESTURE_ID      :
      this.zoomInSlot.stable     ? ZOOM_IN_GESTURE_ID    :
      this.zoomOutSlot.stable    ? ZOOM_OUT_GESTURE_ID   :
      this.micToggleSlot.stable  ? MIC_TOGGLE_GESTURE_ID : null

    if (stableId !== this.state.stableGestureId) {
      this.patch({
        stableGestureId:    stableId,
        stableGestureLabel: stableId !== null ? labelFor(stableId) : null,
      })
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private resetSlots(): void {
    for (const slot of [this.zoomInSlot, this.zoomOutSlot, this.orbitSlot, this.micToggleSlot]) {
      slot.hitCount = slot.missCount = 0
      slot.stable = false
    }
  }

  private patch(partial: Partial<GestureEngineState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach(cb => cb(this.state))
  }
}

const LABELS: Record<number, string> = {
  0: 'Open', 1: 'Close', 2: 'Pointer', 3: 'OK', 4: 'Horn',
  5: 'Thumbs Up', 6: 'Victory', 7: 'Duck', 8: 'Drag',
}
function labelFor(id: number): string { return LABELS[id] ?? `Gesture ${id}` }
