# Ayana — Backend Integration Guide

This document covers everything the backend team needs to drive the Ayana 3D map frontend: WebSocket protocol, tool call reference, itinerary stop schema, and overlay/style definitions.

---

## 1. WebSocket Connection

The frontend connects to a WebSocket server at the URL set in `NEXT_PUBLIC_WS_URL` (`.env.local`).

```
NEXT_PUBLIC_WS_URL=ws://your-backend-host:8080
```

The frontend auto-reconnects with exponential backoff (up to 5 retries, max 30s delay). All messages are JSON.

**Activate the connection** — in `frontend/lib/backend/connection.ts`, the connect call is scaffolded. Wire it in `app/page.tsx` once the backend is ready:

```ts
import { connect, disconnect } from '@/lib/backend/connection'

useEffect(() => {
  if (stage !== 'ready') return
  connect({ onOpen: () => console.log('[ws] connected') })
  return () => disconnect()
}, [stage])
```

---

## 2. Messages: Frontend → Backend

### `user_destination`
Sent when the user submits a destination on the landing page.

```json
{ "type": "user_destination", "query": "Tokyo" }
```

### `persona_selected`
Sent when the user selects a travel persona (future UI).

```json
{ "type": "persona_selected", "persona": "adventure" }
```

### `tool_result`
Sent in response to every `tool_call` from the backend. The `id` echoes the call.

```json
{ "type": "tool_result", "id": "call_abc123", "result": { "ok": true } }
```

---

## 3. Messages: Backend → Frontend

### `agent_state`
Controls the animated status notch at the bottom of the screen.

```json
{ "type": "agent_state", "state": "speaking" }
{ "type": "agent_state", "state": "listening" }
{ "type": "agent_state", "state": "idle" }
```

### `set_destination`
Tells the frontend to fly the camera to a city. The frontend handles the camera animation and cinematic overlay automatically.

```json
{
  "type": "set_destination",
  "cityName": "Tokyo",
  "lat": 35.6762,
  "lng": 139.6503
}
```

### `tool_call`
The primary way the backend drives the map. The frontend dispatches the named tool and returns a `tool_result`.

```json
{
  "type": "tool_call",
  "id": "call_abc123",
  "name": "navigate_to",
  "args": { "lat": 35.7148, "lng": 139.7967, "name": "Senso-ji Temple" }
}
```

See [Section 4](#4-tool-call-reference) for all supported tools.

---

## 4. Tool Call Reference

All tool calls follow the same envelope:

```json
{
  "type": "tool_call",
  "id": "<unique_id>",
  "name": "<tool_name>",
  "args": { ... }
}
```

---

### `navigate_to`
Flies the camera to a location with a cinematic zoom-out → swoop sequence, then auto-orbits once. Also triggers the `CityOverlay` title card.

```json
{
  "name": "navigate_to",
  "args": {
    "lat": 35.7148,
    "lng": 139.7967,
    "name": "Senso-ji Temple"
  }
}
```

| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| lat   | number | yes      | Destination latitude |
| lng   | number | yes      | Destination longitude |
| name  | string | yes      | Location name — used for the overlay title card and tagline lookup |

---

### `show_sidebar`
Opens the sidebar panel at the given location with a specific category.

```json
{
  "name": "show_sidebar",
  "args": {
    "category": "food",
    "locationName": "Senso-ji Temple",
    "locationSub": "Asakusa, Tokyo",
    "lat": 35.7148,
    "lng": 139.7967,
    "sceneIndex": 0,
    "sceneTotal": 5
  }
}
```

| Field         | Type   | Required | Description |
|---------------|--------|----------|-------------|
| category      | string | yes      | `"food"` \| `"shopping"` \| `"activities"` |
| locationName  | string | yes      | Primary label shown in sidebar header |
| locationSub   | string | yes      | Secondary label (e.g. district/city) |
| lat           | number | yes      | Used to fetch nearby places |
| lng           | number | yes      | Used to fetch nearby places |
| sceneIndex    | number | yes      | Current stop index (0-based) for progress pips |
| sceneTotal    | number | yes      | Total stops in itinerary for progress pips |

---

### `hide_sidebar` (legacy console/testing; not Ayana live)

Older docs used a `hide_sidebar` tool to collapse the nearby panel. The **Ayana live orchestration agent** does not expose this tool for now: the sidebar is dismissed **implicitly** when entering Street View (`open_place_street_view`).

```json
{ "name": "hide_sidebar", "args": {} }
```

---

### `open_place_street_view` (Ayana live orchestration)

Opens Street View for one place from the session’s latest nearby result set (populated after a successful `show_nearby` ACK).

```json
{ "name": "open_place_street_view", "args": { "place_name": "Kyoto Gogyo" } }
```

- `place_name` must **exactly** match a nearby listing after `strip()` and case-insensitive comparison (backend uses Unicode case-folding).
- Frontend resolves `lat`/`lng` from cached nearby results and calls `flyToPlaceStreetView`.
- If there is no Street View coverage, the frontend sends `frontend_ack` with `status: failed`.

---

### `set_agent_state`
Same effect as the `agent_state` message but via tool call (useful mid-itinerary).

```json
{
  "name": "set_agent_state",
  "args": { "state": "speaking" }
}
```

| state      | Effect |
|------------|--------|
| speaking   | Green animated waveform bars |
| listening  | Blue static bars |
| idle       | Green static bars |

---

## 5. Itinerary Stop Schema

A backend-generated itinerary is a list of stops. Each stop maps to a `navigate_to` + `show_sidebar` sequence.

### Stop Object

```json
{
  "id": 1,
  "name": "Senso-ji Temple",
  "locationSub": "Asakusa, Tokyo",
  "lat": 35.7148,
  "lng": 139.7967,
  "defaultCategory": "food",
  "range": 750,
  "tilt": 78,
  "overlay": {
    "preset": "heritage",
    "tagline": "Ancient prayers still rising through incense smoke"
  }
}
```

| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| range | number | no       | Camera arrival distance in metres. Omit to use smart auto-range. |
| tilt  | number | no       | Camera tilt on arrival (0=top-down, 90=ground-level). Omit for default (68°). |

**Smart range defaults (applied automatically when `range`/`tilt` omitted):**

| Landmark type | Keywords detected | Auto range | Auto tilt |
|---------------|-------------------|------------|-----------|
| Tall structures | tower, bridge, pagoda, spire, arch… | 750m | 62° |
| Geographic features | mountain, mount, peak, fuji, lake, canyon… | 18,000m | 50° |
| Everything else | — | Places API viewport or type preset | 68° |

### Full Itinerary Example

```json
{
  "destination": "Tokyo",
  "stops": [
    {
      "id": 1,
      "name": "Senso-ji Temple",
      "locationSub": "Asakusa, Tokyo",
      "lat": 35.7148,
      "lng": 139.7967,
      "defaultCategory": "food",
      "overlay": {
        "preset": "heritage",
        "tagline": "Ancient prayers still rising through incense smoke"
      }
    },
    {
      "id": 2,
      "name": "Shibuya Crossing",
      "locationSub": "Shibuya, Tokyo",
      "lat": 35.6595,
      "lng": 139.7004,
      "defaultCategory": "shopping",
      "overlay": {
        "preset": "urban-neon",
        "tagline": "Five streets converge — and somehow it works"
      }
    },
    {
      "id": 3,
      "name": "Tokyo Tower",
      "locationSub": "Minato, Tokyo",
      "lat": 35.6586,
      "lng": 139.7454,
      "defaultCategory": "activities",
      "overlay": {
        "preset": "urban-neon",
        "tagline": "Standing watch over a city that never sleeps"
      }
    }
  ]
}
```

---

## 6. Overlay Style Presets

The `CityOverlay` component resolves a visual style from the location name automatically. The backend can override this by passing `preset` explicitly in the stop definition.

### Preset Definitions

```json
{
  "urban-neon": {
    "preset": "urban-neon",
    "primaryColor": "#ff2d2d",
    "accent": "#00eaff",
    "glow": "red + cyan radial gradients",
    "tagline": "Where tradition meets neon chaos",
    "bestFor": ["Tokyo", "Osaka", "Seoul", "New York", "Hong Kong", "Shibuya", "Akihabara", "Shinjuku", "Tokyo Tower"]
  },
  "tropical": {
    "preset": "tropical",
    "primaryColor": "#ffb74d",
    "accent": "#ffb74d",
    "glow": "amber + green radial gradients",
    "tagline": "Where every moment is golden",
    "bestFor": ["Bali", "Bangkok", "Hawaii", "Cancun", "Phuket"]
  },
  "heritage": {
    "preset": "heritage",
    "primaryColor": "#b48c5a",
    "accent": "#b48c5a",
    "glow": "warm gold radial gradient",
    "tagline": "Centuries of stories beneath your feet",
    "bestFor": ["Kyoto", "Rome", "Paris", "Istanbul", "Athens", "Cairo", "Senso-ji Temple", "Fushimi Inari", "Golden Pavilion"]
  },
  "modern-minimal": {
    "preset": "modern-minimal",
    "primaryColor": "#b4b4c8",
    "accent": "#c8c8dc",
    "glow": "subtle silver radial gradient",
    "tagline": "The city that never stops moving",
    "bestFor": ["Dubai", "Singapore", "London", "Sydney"]
  },
  "nature": {
    "preset": "nature",
    "primaryColor": "#48c78e",
    "accent": "#48c78e",
    "glow": "green + blue radial gradients",
    "tagline": "Where the earth breathes",
    "bestFor": ["New Zealand", "Iceland", "Costa Rica", "Patagonia", "Alaska", "Mount Fuji", "Arashiyama"]
  }
}
```

### Per-Location Tagline Overrides

The frontend has built-in taglines for known locations. The backend can supply its own `tagline` in the stop definition to override them. If no tagline is provided, the frontend resolves it in this order:

1. `overlay.tagline` from the stop object (backend-supplied)
2. `LOCATION_TAGLINES` lookup in `CityOverlay.tsx` (hardcoded per landmark)
3. Preset default tagline

---

## 7. Driving a Full Itinerary — Sequence Example

For each stop in the itinerary, the backend should send this sequence:

```
1. set agent_state → speaking  (while narrating)
2. tool_call: navigate_to      (camera flies, overlay appears automatically)
3. wait for tool_result: ok
4. tool_call: show_sidebar     (reveal nearby places)
5. wait for tool_result: ok
6. set agent_state → idle
7. ... pause for user ...
8. repeat for next stop
```

### WebSocket message sequence (JSON, one per line):

```json
{ "type": "agent_state", "state": "speaking" }
{ "type": "tool_call", "id": "t1", "name": "navigate_to", "args": { "lat": 35.7148, "lng": 139.7967, "name": "Senso-ji Temple" } }
{ "type": "tool_call", "id": "t2", "name": "show_sidebar", "args": { "category": "food", "locationName": "Senso-ji Temple", "locationSub": "Asakusa, Tokyo", "lat": 35.7148, "lng": 139.7967, "sceneIndex": 0, "sceneTotal": 5 } }
{ "type": "agent_state", "state": "idle" }
```

> **Note:** Wait for `tool_result` before sending the next `tool_call` — the frontend awaits the camera animation completing before resolving.

---

## 8. Gemini Live Integration

### Tool schema format

Gemini Live uses a different schema format than the Anthropic API. Register tools using Google's `FunctionDeclaration` format:

```ts
{
  name: 'navigate_to',
  description: 'Fly the 3D map camera to a location cinematically.',
  parameters: {
    type: 'OBJECT',
    properties: {
      lat:   { type: 'NUMBER', description: 'Latitude' },
      lng:   { type: 'NUMBER', description: 'Longitude' },
      name:  { type: 'STRING', description: 'Location name — used for the title card overlay' },
      range: { type: 'NUMBER', description: 'Camera distance in metres on arrival. Omit to auto-calculate.' },
      tilt:  { type: 'NUMBER', description: 'Camera tilt on arrival (0=top-down, 90=horizon). Omit for smart default.' },
    },
    required: ['lat', 'lng', 'name'],
  },
}
```

### Suggested system prompt

```
You are Ayana, a cinematic AI travel guide. You narrate a structured journey
through a destination using voice, and control a live 3D map by calling tools
in sync with your narration.

Rules:
- Call set_agent_state(speaking) before every narration segment.
- Call set_agent_state(listening) after you finish speaking and expect a response.
- Call navigate_to before describing any location — let the animation start
  (5–6 seconds) then begin narrating as the camera arrives.
- Call show_sidebar after arriving at each stop to reveal nearby food,
  shopping, and activities.
- Keep narration segments 15–25 seconds, then advance to the next stop.
- On "skip" or "move on": immediately navigate_to the next stop.
- On "tell me more": stay at current stop and narrate additional detail.
```

### Animation timing guidance

All tool calls are sequential — the frontend awaits each animation before resolving `{ ok: true }`. The agent will naturally wait for the result before issuing the next call.

| Tool | Duration | Notes |
|------|----------|-------|
| `navigate_to` | 5–6s | 2s pullback + 3s swoop. Start narrating ~1s after calling. |
| `show_sidebar` | instant | Fires immediately after `navigate_to` resolves. |
| Orbit (auto) | ~25s | Fires automatically after overlay fades — no tool call needed. |
| `hide_sidebar` | instant | — |

---

## 9. Development Testing Checklist

Before connecting the backend, verify these work manually in the browser console:

```js
// Fly camera to Shibuya
window.__ayanaDispatch('navigate_to', { lat: 35.6595, lng: 139.7004, name: 'Shibuya Crossing' })

// Show sidebar
window.__ayanaDispatch('show_sidebar', {
  category: 'food',
  locationName: 'Shibuya Crossing',
  locationSub: 'Shibuya, Tokyo',
  lat: 35.6595, lng: 139.7004,
  sceneIndex: 0, sceneTotal: 5
})

// Agent states
window.__ayanaDispatch('set_agent_state', { state: 'speaking' })
window.__ayanaDispatch('set_agent_state', { state: 'listening' })
window.__ayanaDispatch('set_agent_state', { state: 'idle' })

// Street View
window.__ayanaDispatch('street_view_enter', { lat: 35.7148, lng: 139.7967 })
```

Then verify the WebSocket round-trip: backend sends `tool_call`, browser logs the dispatch, responds with `tool_result`.

---

## 11. Environment Variables

| Variable               | Default                  | Description |
|------------------------|--------------------------|-------------|
| `NEXT_PUBLIC_WS_URL`   | `ws://localhost:8080`    | WebSocket backend URL |
| `NEXT_PUBLIC_MAPS_KEY` | —                        | Google Maps JS API key (required) |
| `NEXT_PUBLIC_PLACES_KEY` | —                      | Google Places API key (required) |

---

## 12. Frontend File Map

```
frontend/
├── app/page.tsx                        # Landing page + camera init
├── components/map/
│   ├── CameraWidget.tsx                # Nav controls, sidebar wiring
│   ├── CityOverlay.tsx                 # Cinematic title card (presets + taglines here)
│   ├── Sidebar.tsx                     # Nearby places panel
│   ├── AgentStatusNotch.tsx            # Speaking/listening/idle indicator
│   ├── StreetViewOverlay.tsx           # Street View layer
│   └── LocationReveal.tsx              # Per-stop typewriter (used inside CameraWidget)
├── lib/
│   ├── backend/connection.ts           # WebSocket client (activate via env var)
│   ├── maps/
│   │   ├── cameraControls.ts           # All camera movement functions
│   │   ├── sidebarControls.ts          # Imperative sidebar/agent state setters
│   │   ├── mapRef.ts                   # Singleton Map3DElement ref
│   │   └── smartRange.ts              # Auto-computes arrival zoom range
│   ├── locations/japan.ts              # Hardcoded Tokyo stops (replaced by backend itinerary)
│   └── places/nearbySearch.ts          # Google Places nearby search
```

---

## 13. Adding a New City / Itinerary (Manual Override)

Until the backend is live, new itineraries can be added by duplicating and editing `frontend/lib/locations/japan.ts`:

```ts
export const CITY_CENTER = { lat: 48.8566, lng: 2.3522 }
export const CITY_NAME = 'Paris'

export const CITY_STOPS = [
  { id: 1, name: 'Eiffel Tower',    lat: 48.8584, lng: 2.2945 },
  { id: 2, name: 'Louvre Museum',   lat: 48.8606, lng: 2.3376 },
  { id: 3, name: 'Montmartre',      lat: 48.8867, lng: 2.3431 },
]
```

Then add the city and landmark names to `LOCATION_TAGLINES` and `CITY_PRESET_MAP` in `components/map/CityOverlay.tsx`.

---

## 14. Camera Angle Reference

### How the system works (priority order)

When the frontend navigates to a stop, the arrival camera angle is resolved in this order — first match wins:

1. **Explicit `range` + `tilt` on the stop object** — use exactly those values, skip all logic
2. **Keyword classifier** — checks the location `name` for scale keywords (sync, no network call)
3. **Places API geocoder** — reverse geocodes lat/lng to get a viewport bounding box and place types
4. **Type preset fallback** — maps place types (e.g. `tourist_attraction`) to a default range
5. **Hard default** — 900m range, 68° tilt

### Tilt reference

Tilt is the camera angle from vertical. 0° = looking straight down. 90° = looking at the horizon.

| Tilt | Look | Best for |
|------|------|----------|
| 0–30° | Top-down / satellite | Large areas, city overviews |
| 45–55° | Diagonal / isometric | Mountains, landscapes, geographic features |
| 62–68° | Standard cinematic | Temples, shrines, crossings, most landmarks |
| 72–78° | Low / looking up | Ground-level street scenes |
| 85–90° | Nearly horizontal | Street View style, close buildings |

### Range reference

Range is the camera distance from the focal point (centre of the location) in metres.

| Range | Zoom level | Best for |
|-------|------------|----------|
| 200–400m | Very close | Small shrines, crossings, street-level detail |
| 400–800m | Close | Temples, smaller landmarks, plazas |
| 800–1,500m | Medium | Towers, large buildings, city blocks |
| 5,000–20,000m | Far | Mountains, geographic features, national parks |
| 50,000m+ | City overview | Full city fly-in view |

### Keyword classifier — full keyword list

The classifier in `frontend/lib/maps/smartRange.ts` checks if the location name contains any of these words (case-insensitive):

**Geographic** (→ range: 18,000m, tilt: 50°):
`mountain`, `mount`, `mt.`, `mt `, `fuji`, `peak`, `summit`, `volcano`, `canyon`, `valley`, `lake`, `falls`, `waterfall`, `glacier`, `fjord`, `cape`, `island`, `bay`, `coast`, `cliff`

**Tall structure** (→ range: 750m, tilt: 62°):
`tower`, `bridge`, `arch`, `spire`, `obelisk`, `statue`, `needle`, `pagoda`, `minaret`, `steeple`, `lighthouse`, `column`

### Curated Japan stop values (for reference)

These are the tuned values for the current demo stops. Use as a guide when setting values for similar landmark types:

| Stop | Range | Tilt | Type |
|------|-------|------|------|
| Senso-ji Temple | 480m | 68° | Temple/shrine — medium close |
| Shibuya Crossing | 500m | 70° | Ground crossing — close, slightly steep |
| Tokyo Tower | 1,200m | 62° | Tall structure — back enough to see full height |
| Fushimi Inari | 320m | 68° | Shrine gate path — close for detail |
| Mount Fuji | 18,000m | 50° | Mountain — far back, low angle |

### When the default looks wrong — how to fix

**Problem: landmark is cut off (top missing)**
→ Increase `range` or decrease `tilt`. A lower tilt positions the camera higher so more vertical extent fits in frame.

**Problem: too far away, landmark is tiny**
→ Decrease `range`. For context: 500m is roughly one city block away.

**Problem: distorted / fisheye on large features**
→ Increase `range`. Mountains and geographic features need at least 10,000m+.

**Problem: looking at the wrong part of the landmark**
→ Adjust the `lat`/`lng` to point to the landmark's focal point (e.g. entrance gate, not the centre of the grounds).

To override, add `range` and `tilt` to the stop object:

```json
{ "name": "Eiffel Tower", "lat": 48.8584, "lng": 2.2945, "range": 1100, "tilt": 60 }
```

Or in `frontend/lib/locations/japan.ts` for hardcoded demo stops:

```ts
{ id: 1, name: 'Eiffel Tower', lat: 48.8584, lng: 2.2945, range: 1_100, tilt: 60 }
```
