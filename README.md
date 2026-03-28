# Ayana — 3D Travel Map

A Next.js prototype for Google Maps Photorealistic 3D camera transitions, cinematic city overlays, and AI-agent-driven itineraries. Every camera function is designed to be called directly as an LLM agent tool — the function signatures, parameters, and return shapes are ready to wire up with zero rework.

---

## Repo Structure

```
/
├── frontend/          ← Next.js app (React + Tailwind + Google Maps 3D)
├── backend/           ← Agent layer (to be added)
└── docs/
    ├── BACKEND_INTEGRATION.md   ← Full backend integration guide (start here)
    └── llm-tool-mapping.md      ← How to wire camera functions to LLM tools
```

A `backend/` directory is expected to be added alongside `frontend/` when the agent layer is built.

> **Backend team:** read [`docs/BACKEND_INTEGRATION.md`](docs/BACKEND_INTEGRATION.md) first — it covers the WebSocket protocol, all tool calls, itinerary JSON schema, and overlay style presets.

---

## What It Does Right Now

### Landing page
- Full-screen slowly rotating Earth globe (`Map3DElement` at 22,000 km altitude)
- Search input overlaid on top
- On submit: logo and input fade out, camera flies to **Tokyo city view** in one smooth 4.5s transition — no page navigation, one persistent map

### Cinematic city overlay
- On arrival at any city or landmark, a full-screen dark overlay fades in with a typewriter city name, preset-coloured accent line, and unique tagline
- Fades and blurs out after ~2s so the map comes back into focus
- 5 visual presets: `urban-neon`, `tropical`, `heritage`, `modern-minimal`, `nature` — auto-resolved from location name

### Japan destination (city view → stops)
- After the city view fly-in completes, a floating **camera control widget** appears
- Widget starts at "Tokyo Overview" (city-level, no specific stop selected)
- **Next →** flies to the first of 5 hardcoded Japan stops with zoom-out → swoop → auto-orbit

### 5 test locations
| # | Name | Preset | Notes |
|---|------|--------|-------|
| 1 | Senso-ji Temple | heritage | Great 3D tiles + Street View |
| 2 | Shibuya Crossing | urban-neon | Best ground tiles in the set |
| 3 | Tokyo Tower | urban-neon | Good 3D tiles + Street View |
| 4 | Fushimi Inari | heritage | ⚠ Ground tiles may degrade |
| 5 | Mount Fuji | nature | ⚠ Ground tiles likely blank at summit |

### Sidebar
- Food / Shopping / Activities panels with hero images, ratings, and Street View entry per place
- Powered by Google Places Nearby Search
- Smooth fade transition when switching categories

### Camera controls (all agent-callable)
- **Navigate:** Prev / Next (locked during animation to prevent interruption)
- **View presets:** Ground (150m), City (8km), Overview (60km)
- **Camera:** Zoom In/Out, Tilt ±10°, Orbit (one 360°), Stop
- **Street View:** real 360° panoramas overlaid on the 3D map; exits cleanly back to 3D

### Agent status notch
- Animated waveform at the bottom-center of the screen
- Three states: speaking (green animated bars), listening (blue bars), idle (green flat)
- Driven by backend via WebSocket `agent_state` message

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Required: Google Cloud setup

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Maps JavaScript API**
3. Enable **Map Tiles API** (Photorealistic 3D Maps) — separate toggle, easy to miss
4. Link a billing account (required even for free-tier usage)
5. Copy your API key into `frontend/.env.local`:

```
NEXT_PUBLIC_MAPS_API_KEY=your_key_here
```

> `.env.local` is gitignored — never commit it.

---

## Key Files for Backend Integration

| File | Purpose |
|------|---------|
| `docs/BACKEND_INTEGRATION.md` | Full guide — WebSocket protocol, tool calls, JSON schemas |
| `frontend/lib/backend/connection.ts` | WebSocket client (activate via `NEXT_PUBLIC_WS_URL`) |
| `frontend/lib/maps/cameraControls.ts` | All camera functions — these become LLM tools |
| `frontend/lib/maps/sidebarControls.ts` | Sidebar + agent state setters (callable from anywhere) |
| `frontend/components/map/CityOverlay.tsx` | Overlay presets + taglines per city/landmark |
| `frontend/lib/locations/japan.ts` | Hardcoded test stops (replaced by backend itinerary at runtime) |
| `docs/llm-tool-mapping.md` | Tool definitions + dispatch table pattern |

---

## Tech Stack

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS v4**
- **Google Maps JavaScript API** `v=alpha` — Photorealistic 3D Maps + Street View
- No additional dependencies — Maps loads via CDN script tag
# Ayana
