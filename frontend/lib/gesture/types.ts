export type CameraState   = 'idle' | 'requesting' | 'ready' | 'denied' | 'error'
export type TrackingState = 'no-hand' | 'tracking' | 'lost'
export type ModelState    = 'uninitialized' | 'loading' | 'ready' | 'error'
export type GestureMode   = 'off' | 'on'
export type ActiveGesture = 'none' | 'zoom-in' | 'zoom-out' | 'orbit'

export interface GestureEngineState {
  cameraState:        CameraState
  trackingState:      TrackingState
  modelState:         ModelState
  gestureMode:        GestureMode
  activeGesture:      ActiveGesture
  stableGestureId:    number | null
  stableGestureLabel: string | null
}
