# Ayana Gesture Guide

Ayana supports hand gesture control for navigating the 3D map and Street View without touching the screen. Gestures are detected via your device camera using MediaPipe hand tracking.

---

## Quick Reference

| Gesture | Hand Shape | Action (3D Map) | Action (Street View) |
|---------|-----------|-----------------|----------------------|
| **Horn** ☞ | Index + pinky extended, others curled | Toggle gesture mode ON / OFF | Toggle gesture mode ON / OFF |
| **Pointer** ☝️ | Index only extended, others curled | Zoom in (continuous) | Walk forward |
| **Victory / Peace** ✌️ | Index + middle extended, others curled | Zoom out (continuous) | Walk backward |
| **Open Palm** 🖐 | All five fingers fully extended | **HOLD** — no action, neutral stop | **HOLD** — no action |
| **Fist** ✊ | All fingers curled closed | Orbit current location | Spin panorama heading |
| **Thumbs Up** 👍 | Thumb extended upward, others curled | Toggle mic mute / unmute | Toggle mic mute / unmute |

> Zoom-in and Zoom-out only apply while **gesture mode is ON**.
> Horn always works (even when mode is OFF) — it just toggles.
> Thumbs Up (mic toggle) works independently of gesture mode — always active from the itinerary selection screen onward.

---

## Gesture Details

### Horn — Toggle Map Control Mode
```
Fingers: index ↑  pinky ↑  |  middle ✗  ring ✗  thumb across palm
```
- Hold for ~2 frames to activate
- 1.5 second cooldown prevents accidental double-fire
- Notch at top-center of screen shows **MAP CTRL · OFF** → **MAP CTRL · ON**

### Pointer — Zoom In (3D) / Walk Forward (SV)
```
Fingers: index ↑  |  middle ✗  ring ✗  pinky ✗  thumb across palm
```
- **3D Map**: continuously decreases camera range (~1.8% per frame) while held
- **Street View**: walks to the next linked panorama every ~900ms while held
- Notch shows **ZOOM IN ↑**

### Victory / Peace — Zoom Out (3D) / Walk Backward (SV)
```
Fingers: index ↑  middle ↑  |  ring ✗  pinky ✗  thumb across palm
```
- **3D Map**: continuously increases camera range (~1.8% per frame) while held
- **Street View**: walks to the panorama in the opposite direction every ~900ms
- Notch shows **ZOOM OUT ↓**

### Open Palm — HOLD (dead/stop state)
```
Fingers: all five fully extended and spread
```
- No camera action in any mode
- Acts as a neutral transition state — use it to deliberately "pause" between gestures
- Notch shows **HOLD —** while held

### Fist — Orbit (3D) / Spin (SV)
```
Fingers: all curled closed into a fist
```
- **3D Map**: starts a 60-second `flyCameraAround` orbit from your **current** camera position and altitude — re-entering the gesture after dropping it continues from where you left off
- **Street View**: rotates the panorama heading +2° every 50ms (slow spin)
- Drop the gesture (open hand, switch gesture) to stop

### Thumbs Up — Mic Toggle
```
Fingers: thumb ↑  |  index ✗  middle ✗  ring ✗  pinky ✗
```
- Toggles the microphone between **LIVE** and **MUTED** states
- Works independently of gesture mode (no need to enable MAP CTRL first)
- 1.5 second cooldown prevents accidental double-fire
- Only active from the itinerary selection screen onward (voice agent screens)
- Top-left **VOICE** notch shows **VOICE · LIVE** (green) or **VOICE · MUTED** (red-orange)
- Brief scale flash on the notch confirms the toggle fired

---

## Status Notch

A single **split-pill notch** at the top-center of the screen shows both map control and voice state simultaneously:

```
[ ● MAP CTRL · ON   │   ● VOICE · LIVE ]
```

The pill's border takes the color of the most urgent state — if the mic is muted, the border turns warm red as a warning signal; otherwise it follows the map control accent color.

### Left segment — Map Control

| Notch text | Meaning |
|------------|---------|
| `CALIBRATING` | MediaPipe model is initialising |
| `MAP CTRL · OFF` | Mode inactive — only Horn fires |
| `MAP CTRL · ON` | Mode active — all map gestures live |
| `ZOOM IN ↑` | Pointer gesture detected and held |
| `ZOOM OUT ↓` | Victory gesture detected and held |
| `ORBIT ↺` | Fist detected — orbit/spin active |
| `HOLD —` | Open palm held — neutral stop state |
| `SENSOR UNAVAIL` | Camera permission denied or model error |

### Right segment — Voice (Live Agent mode only)

The voice segment appears from the itinerary selection screen onward:

| Notch text | Meaning |
|------------|---------|
| `VOICE · LIVE` | Microphone active — agent can hear you |
| `VOICE · MUTED` | Microphone muted — agent cannot hear you |

---

## Camera Permission

Permission is requested **on first page load** (during itinerary selection), before any map interaction begins. This avoids interrupting the fly-in or landmark reveal sequences.

Deny the permission prompt → gesture features are unavailable for that session (notch shows `SENSOR UNAVAIL`).

---

## Reliability Tips

1. **Lighting** — face a light source; avoid backlight from a bright window
2. **Distance** — keep hand ~40–70cm from camera (roughly arm-length)
3. **Contrast** — plain or dark background helps the detector
4. **Steady hold** — the stability filter requires 2 consistent frames before a gesture fires; rapid flicking won't trigger actions
5. **One hand at a time** — only the first detected hand is used

---

## Gesture ID Reference (classifier labels)

These IDs map to the `keypoint_classifier_label.csv` bundled at `public/models/gesture/`.

| ID | Label | Used For |
|----|-------|---------|
| 0 | Open | HOLD — neutral stop, no action |
| 1 | Close | Orbit / panorama spin |
| 2 | Pointer | Zoom in / walk forward |
| 3 | OK | — (unused) |
| 4 | Horn | Toggle gesture mode (MAP CTRL) |
| 5 | Thumbs Up | Mic toggle (VOICE · LIVE / MUTED) |
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
5. Update `GestureNotch.tsx` `resolveDisplay()` to show the right label

To add a new independent toggle (like mic):

1. Add a new `GESTURE_ID` constant and threshold values in `config.ts`
2. Add a slot + cooldown tracking in `engine.ts`, include in `resetSlots()`
3. Add the gesture ID to the `stableId` resolution chain in `engine.ts`
4. Handle the toggle in `ControlNotch.tsx` — the unified notch at top-center handles both map control and voice state
