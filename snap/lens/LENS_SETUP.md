# Ayana Teleport Me — Lens Studio Setup Guide

## Prerequisites
- Lens Studio 5.x: https://ar.snap.com/download
- Snapchat account + Lens+ sign-up: https://airtable.com/appKgGaXGsgyxLO1P/pagpw0QIF503cLAb9/form
- Cubemap PNGs already generated (run `../scripts/generate_cubemaps.py` first)
- Google API key with **Street View Static API** enabled

Cubemap generation notes:
- The generator resolves a nearby pano via metadata (expanding radius) and uses a single `pano_id` for all 6 faces to reduce seams.
- If a station has no coverage at its primary coordinates, it tries curated fallbacks before skipping.
- Optional mild sharpening/contrast can be enabled with `POST_PROCESS=1` (off by default).
- You can lock a station to a known pano by adding `pano_id` in `generate_cubemaps.py`.

---

## How the multi-station system works

Each lens has **3 stations** (viewpoints). The user rotates their phone to look around each station, then taps the left or right side of the screen to walk to the next spot — with a smooth fade transition between them.

```
Station 0  ←  tap left/right  →  Station 1  ←  tap  →  Station 2  (wraps around)
```

This requires **3 cubemap PNGs per city** (named `{city}_s0.png`, `{city}_s1.png`, `{city}_s2.png`).

---

## Scene hierarchy to build

```
[Camera — Front]          ← default camera, shows user face
AyanaController           ← TeleportLens.ts script lives here
Stations                  ← parent empty object
  Station_0               ← Look Around sphere, cubemap s0, DeviceTracking
  Station_1               ← Look Around sphere, cubemap s1, DeviceTracking
  Station_2               ← Look Around sphere, cubemap s2, DeviceTracking
UI [ScreenCanvas]
  BrandingOverlay
    CityNameText           ← e.g. "EIFFEL TOWER"
    CountryText            ← e.g. "Paris, France"
    TaglineText            ← e.g. "The iron lady of Paris"
  NavOverlay
    TapLeft                ← invisible TouchComponent, left 30% of screen
    TapRight               ← invisible TouchComponent, right 30% of screen
    Dot_0                  ← location dot (active = 1.4× scale)
    Dot_1
    Dot_2
    StationLabelText       ← e.g. "Trocadéro · Classic full view"
  FadeOverlay              ← full-screen black quad, starts alpha=0
  ShareHintText            ← cycling hint messages
```

---

## Step 1 — Create the project

1. Lens Studio → **New Project** → **Blank Project**
2. Name it: `Ayana Teleport — [CityName]`

---

## Step 2 — Import the three cubemaps

For each of the 3 PNG files (e.g. `eiffeltower_s0.png`, `eiffeltower_s1.png`, `eiffeltower_s2.png`):

1. **Asset Browser** → `+` → **Texture** → select the PNG
2. Lens Studio auto-detects the horizontal cross layout → creates a Cubemap asset
3. Rename each asset clearly: `Cubemap_S0`, `Cubemap_S1`, `Cubemap_S2`

**Alternative — panorama sphere textures:** run `snap/scripts/cross_cubemap_to_equirectangular.py` to get PNGs in `snap/assets/equirect/` (default **2048×1536**, same `*_s0/_s1/_s2` names). Import as **2D Textures**, put each on a **large sphere** with a material that matches your aspect (equirect / 360° shader). For classic **2:1** output, run with `EQUIRECT_WIDTH=2048 EQUIRECT_HEIGHT=1024`.

---

## Step 3 — Build the Stations hierarchy

1. Right-click Scene Hierarchy → **Add Object** → **Empty Object** → rename `Stations`
2. Inside `Stations`, create 3 children: `Station_0`, `Station_1`, `Station_2`
3. For **each** station object:
   a. Add an **Asset Library** → search **Look Around** → Import (gives you the sphere + DeviceTracking)
   b. In that sphere's **Material**, swap the Environment/Base texture to the matching Cubemap asset
   c. Keep DeviceTracking in **Rotation** mode
   d. Leave only `Station_0` **enabled** at start — disable Station_1 and Station_2

---

## Step 4 — Build the UI hierarchy

Inside a **Screen Canvas** object:

### BrandingOverlay (Screen Image container)
Add 3 Text children:
- `CityNameText` — top of branding block, large + uppercase
- `CountryText` — medium, muted
- `TaglineText` — small, italic

### NavOverlay
- `TapLeft` — Screen Image, left 30% of screen, **alpha = 0** (invisible), add **TouchComponent**
- `TapRight` — same, right 30% of screen
- `Dot_0`, `Dot_1`, `Dot_2` — three small circle images, centered bottom row
- `StationLabelText` — text just above the dots

### FadeOverlay
- Full-screen black Screen Image
- Start with material alpha = 0 (transparent)
- This is tweened during station transitions

### ShareHintText
- Centered bottom, small text

**Ayana design style:**
- Font: SF Mono or Fira Code (monospace feel)
- City name: 28–32pt, uppercase, white 92% opacity
- Country: 14pt, white 40% opacity
- Tagline: 12pt, white 55% opacity, slight italic
- Station label: 10pt, white 50% opacity, centered
- Hint: 10pt, white 28% opacity, centered bottom
- Dots: 8px circles, inactive = white 35%, active = white 90% at 1.4× scale

---

## Step 5 — Wire the AyanaController script

1. Right-click Scene Hierarchy → **Add Object** → **Empty Object** → rename `AyanaController`
2. Inspector → **Add Component** → **Script** → select `TeleportLens.ts`
3. Wire every `@input` field:

| Input field       | What to drag in             |
|-------------------|-----------------------------|
| `stationsParent`  | `Stations` object           |
| `fadeOverlay`     | `FadeOverlay`               |
| `brandingOverlay` | `BrandingOverlay`           |
| `cityNameText`    | `CityNameText`              |
| `countryText`     | `CountryText`               |
| `taglineText`     | `TaglineText`               |
| `stationLabelText`| `StationLabelText`          |
| `shareHintText`   | `ShareHintText`             |
| `tapLeft`         | `TapLeft`                   |
| `tapRight`        | `TapRight`                  |
| `dot0`            | `Dot_0`                     |
| `dot1`            | `Dot_1`                     |
| `dot2`            | `Dot_2`                     |

---

## Step 6 — Set the active city

Open `scripts/CityConfig.ts` and set the city for this lens:
```typescript
export const ACTIVE_CITY_ID = 'eiffeltower'  // or 'cancunbeach' or 'mountfuji'
```

---

## Step 7 — Preview

1. **Preview** in Lens Studio — webcam activates
2. You should see Station 0's 360° environment with your face in front
3. Drag with mouse to simulate gyroscope look-around
4. Click the TapLeft / TapRight areas to test station switching (fade should play)
5. Confirm the station label and dots update
6. **Send to Snapchat** on your phone to test real gyroscope + touch navigation

---

## Step 8 — Publish

1. **Project** → **Upload**
   - Name: `Ayana Teleport: [City Name]`
   - Description: `Step inside [city] in 360° AR. Walk between 3 iconic spots. Part of the Ayana travel experience.`
   - Tags: `travel`, `AR`, `teleport`, `[city name]`
2. Once published → copy the **Lens Link**: `https://lens.snapchat.com/XXXXXXXXXXXXXXXX`

---

## Step 9 — Update the Ayana frontend

Open `frontend/lib/snap/lensConfig.ts` and paste the real lens URL:
```typescript
'eiffel tower': { url: 'https://lens.snapchat.com/YOUR_ACTUAL_LENS_ID', label: 'Eiffel Tower' },
```

The "Teleport Me" button in Ayana activates immediately.

---

## Checklist — one lens per city

- [ ] `eiffeltower` → s0 (Trocadéro) · s1 (Champ de Mars) · s2 (Pont d'Iéna)
- [ ] `cancunbeach`  → s0 (Hotel Zone) · s1 (Playa Delfines) · s2 (Lagoon Side)
- [ ] `mountfuji`    → s0 (Lake Kawaguchi) · s1 (Fujiyoshida) · s2 (5th Station)
