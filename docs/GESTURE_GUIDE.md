# Ayana Gesture Guide

Ayana supports hand gesture control for navigating the 3D map and Street View without touching the screen. Gestures are detected via your device camera using MediaPipe hand tracking.

---

## Quick Reference

| Gesture | Hand Shape | Action (3D Map) | Action (Street View) |
|---------|-----------|-----------------|----------------------|
| **Horn** ☞ | Index + pinky extended, others curled | Toggle mic mute / unmute | Toggle mic mute / unmute |
| **Pointer** ☝️ | Index only extended, others curled | Zoom in (continuous) | Walk forward |
| **Victory / Peace** ✌️ | Index + middle extended, others curled | Zoom out (continuous) | Walk backward |
| **Open Palm** 🖐 | All five fingers fully extended | **HOLD** — no action, neutral stop | **HOLD** — no action |
| **Fist** ✊ | All fingers curled closed | Orbit current location | Spin panorama heading |

> All map gestures (zoom, orbit) are automatically active from the city overview screen onwards — no toggle needed.
> Horn controls mic mute/unmute only.

---

## Gesture Details

### Horn — Mic Toggle
```
Fingers: index ↑  pinky ↑  |  middle ✗  ring ✗  thumb across palm
```
- Hold for ~2 frames to activate
- 1.5 second cooldown prevents accidental double-fire
- Top-left mic icon turns green (live) or shows a slash (muted)

### Pointer — Zoom In (3D) / Walk Forward (SV)
```
Fingers: index ↑  |  middle ✗  ring ✗  pinky ✗  thumb across palm
```
- **3D Map**: continuously decreases camera range (~1.8% per frame) while held
- **Street View**: walks to the next linked panorama every ~900ms while held
- Center notch shows **ZOOM IN ↑**

### Victory / Peace — Zoom Out (3D) / Walk Backward (SV)
```
Fingers: index ↑  middle ↑  |  ring ✗  pinky ✗  thumb across palm
```
- **3D Map**: continuously increases camera range (~1.8% per frame) while held
- **Street View**: walks to the panorama in the opposite direction every ~900ms
- Center notch shows **ZOOM OUT ↓**

### Open Palm — HOLD (dead/stop state)
```
Fingers: all five fully extended and spread
```
- No camera action
- Acts as a neutral transition state — use it to deliberately "pause" between gestures
- Center notch shows **HOLD —** while held

### Fist — Orbit (3D) / Spin (SV)
```
Fingers: all curled closed into a fist
```
- **3D Map**: starts a 60-second `flyCameraAround` orbit from your current camera position and altitude
- **Street View**: rotates the panorama heading +2° every 50ms (slow spin)
- Drop the gesture (open hand, switch gesture) to stop

---

## Status Notches

### Mic Notch (top-left, Live Agent mode only)

A circular icon-only pill. Appears from the itinerary selection screen onward.

| Icon | Meaning |
|------|---------|
| Mic outline (green border) | Microphone live — agent can hear you |
| Mic with slash (red border) | Microphone muted — agent cannot hear you |

Use the **Horn** gesture to toggle between live and muted.

### Gesture Notch (top-center)

Shows active map gesture state. Gestures are always on — no mode toggle.

| Notch text | Meaning |
|------------|---------|
| `CALIBRATING` | MediaPipe model is initialising |
| `GESTURES · LIVE` | Idle — ready, no gesture active |
| `ZOOM IN ↑` | Pointer gesture detected and held |
| `ZOOM OUT ↓` | Victory gesture detected and held |
| `ORBIT ↺` | Fist detected — orbit/spin active |
| `HOLD —` | Open palm held — neutral stop state |
| `SENSOR UNAVAIL` | Camera permission denied or model error |

---

## Camera Permission

Permission is requested on first page load (during itinerary selection). Denying it disables all gesture features for that session (notch shows `SENSOR UNAVAIL`).

---

## Reliability Tips

1. **Lighting** — face a light source; avoid backlight from a bright window
2. **Distance** — keep hand ~40–70cm from camera (roughly arm-length)
3. **Contrast** — plain or dark background helps the detector
4. **Steady hold** — the stability filter requires 2 consistent frames before a gesture fires
5. **One hand at a time** — only the first detected hand is used

---

## Gesture ID Reference (classifier labels)

| ID | Label | Used For |
|----|-------|---------|
| 0 | Open | HOLD — neutral stop, no action |
| 1 | Close | Orbit / panorama spin |
| 2 | Pointer | Zoom in / walk forward |
| 3 | OK | — (unused) |
| 4 | Horn | Mic toggle (mute / unmute) |
| 5 | Thumbs Up | — (unused) |
| 6 | Victory | Zoom out / walk backward |
| 7 | Duck | — (unused) |
| 8 | Drag | — (unused) |

---

## Adding Gestures (Developer Notes)

To map a new gesture to a map action:

1. Add a new `GESTURE_ID` constant in `frontend/lib/gesture/config.ts`
2. Add a new `StabilitySlot` in `frontend/lib/gesture/engine.ts` and tick it in `processFrame()`
3. Emit the new `activeGesture` value (extend the `ActiveGesture` type in `types.ts`)
4. Handle it in `GestureMapAdapter.tsx` — add a `useEffect` for the new active gesture
5. Update `ControlNotch.tsx` `resolveDisplay()` to show the right label

To add a new independent toggle:

1. Add a new `GESTURE_ID` constant and threshold values in `config.ts`
2. Add a slot + cooldown tracking in `engine.ts`, include in `resetSlots()`
3. Add the gesture ID to the `stableId` resolution chain in `engine.ts`
4. Create a dedicated notch component that watches `gestureState.stableGestureId`
5. Mount the notch conditionally in `page.tsx` based on the relevant stage
