export const GESTURE_ASSETS = {
  mediapipeWasmPath:       '/vendor/mediapipe/wasm',
  handLandmarkerModelPath: '/models/mediapipe/hand_landmarker.task',
}

// Gesture IDs matching keypoint_classifier_label.csv
export const MIC_TOGGLE_GESTURE_ID = 4   // Horn → toggle mic mute/unmute
export const ZOOM_IN_GESTURE_ID    = 2   // Pointer (index only) → zoom in  / walk forward  (SV)
export const ZOOM_OUT_GESTURE_ID   = 6   // Victory (index+mid)  → zoom out / walk backward (SV)
// Open palm (ID 0) has no slot — natural dead/stop state, notch shows HOLD
export const ORBIT_GESTURE_ID      = 1   // Close/Fist → orbit / panorama spin (SV)
// Gestures are always active from city overview onwards — no mode toggle needed

export const THRESHOLDS = {
  micToggleCooldownMs:    1_500,
  micToggleStableFrames:  2,
  zoomInStableFrames:   2,
  zoomInMissFrames:     2,
  zoomOutStableFrames:  2,
  zoomOutMissFrames:    2,
  orbitStableFrames:    2,
  orbitMissFrames:      2,
  // Continuous zoom speed — fraction of range changed per rAF frame
  zoomInFactor:         0.982,   // multiply range by this each frame (zoom in)
  zoomOutFactor:        1.018,   // multiply range by this each frame (zoom out)
  // Street View walk cooldown
  svWalkCooldownMs:     900,
  cameraWidth:          960,
  cameraHeight:         540,
}

export const MAP_RANGE_MIN =     100   // metres
export const MAP_RANGE_MAX = 200_000   // metres
