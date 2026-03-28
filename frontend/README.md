# Ayana — Frontend

Next.js app (App Router, React 19, Tailwind v4) powering the Ayana 3D travel map.

## Running locally

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Environment variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_MAPS_API_KEY=your_google_maps_key
NEXT_PUBLIC_PLACES_KEY=your_google_places_key
NEXT_PUBLIC_LIVE_AGENT_WS_URL=ws://localhost:8000/ws   # optional — backend live WebSocket
NEXT_PUBLIC_ENABLE_LIVE_AGENT=false      # default off until orchestration phase
AYANA_BACKEND_BASE_URL=http://127.0.0.1:8000          # optional — server-side proxy target
```

> `.env.local` is gitignored. Never commit it.

### Google Cloud setup

1. Enable **Maps JavaScript API** and **Map Tiles API** (Photorealistic 3D) in Google Cloud Console
2. Enable **Places API (New)** for nearby search
3. Attach a billing account (required even for free-tier usage)

## Project structure

```
frontend/
├── app/
│   ├── api/
│   │   └── ayana/prep/route.ts  # Same-origin proxy to backend prep endpoint
│   ├── page.tsx                 # Globe-first landing + prep overlay flow
│   └── layout.tsx
├── components/map/
│   ├── CameraWidget.tsx          # Current hardcoded runtime controls
│   ├── CityOverlay.tsx           # Cinematic full-screen title card
│   ├── GeneratedItineraryOverlay.tsx # Generated itinerary selection overlay
│   ├── PrepLoadingOverlay.tsx    # Minimal globe-centered prep loading state
│   ├── Sidebar.tsx               # Nearby places panel (Food/Shop/Activity)
│   ├── AgentStatusNotch.tsx      # Speaking/listening/idle waveform indicator
│   ├── StreetViewOverlay.tsx     # Street View layer
│   └── LocationReveal.tsx        # Per-stop typewriter (used inside CameraWidget)
└── lib/
    ├── ayana/
    │   └── prep.ts               # Persona types + prep endpoint client
    ├── maps/
    │   ├── cameraControls.ts     # All camera movement functions
    │   ├── sidebarControls.ts    # Imperative sidebar/agent state setters
    │   ├── mapRef.ts             # Singleton Map3DElement ref
    │   └── smartRange.ts         # Auto-computes arrival zoom range
    ├── locations/
    │   └── japan.ts              # Current hardcoded Tokyo runtime data
    └── places/
        └── nearbySearch.ts       # Google Places Nearby Search wrapper
```

## Backend integration

The frontend now uses a prep-first flow:

1. Persona selection triggers `POST /api/ayana/prep` through the Next.js route at `app/api/ayana/prep/route.ts`
2. The page shows a globe-centered `AYANA` loading state while the backend generates 3 itineraries
3. The generated itinerary UI fades in and allows clickable selection
4. The live session remains disabled until later orchestration phases

The proxy route forwards to `AYANA_BACKEND_BASE_URL` or defaults to `http://127.0.0.1:8000`.
