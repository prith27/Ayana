# LLM Tool Mapping — Camera Controls + Street View

All 3D camera functions live in `frontend/lib/maps/cameraControls.ts`. Street View functions are exposed via the `StreetViewOverlayHandle` ref in `frontend/components/map/StreetViewOverlay.tsx`. Every function returns `{ ok: boolean }` — the shape expected by a tool result handler.

To wire them to an LLM agent: define the tool schemas, add a dispatch table, and call the matching function when the model returns a tool use block.

---

## Function Reference

### 3D Map Camera (`cameraControls.ts`)

| Function | Description | Key params |
|----------|-------------|-----------|
| `flyTo(lat, lng, opts)` | Fly camera to coordinates | `range`, `tilt`, `heading`, `durationMs` |
| `flyInWithOrbit(lat, lng)` | 3.5s swoop down + 5.5s single orbit | lat, lng |
| `flyToLocation(lat, lng)` | Clean 3s fly, no orbit | lat, lng |
| `orbit(opts)` | One 360° orbit at current position | `speed`: `'slow'`\|`'medium'`\|`'fast'` |
| `stopAnimation()` | Freeze camera mid-motion | — |
| `zoomIn()` | Halve current range (1.2s) | — |
| `zoomOut()` | Double current range (1.2s) | — |
| `groundLevel()` | Drop to 150m, tilt 78° | — |
| `cityView()` | Pull to 8km, tilt 45° | — |
| `overviewPullback()` | Pull to 60km, tilt 15° | — |
| `tiltUp()` | +10° tilt (clamped at 90°) | — |
| `tiltDown()` | −10° tilt (clamped at 0°) | — |

### Street View (`StreetViewOverlay` ref — `StreetViewOverlayHandle`)

| Method | Description | Key params |
|--------|-------------|-----------|
| `enter(lat, lng)` | Open Street View at coordinates. Checks coverage within 100m radius; shows error state if none found. Auto-orbits 360° on entry. | lat, lng |
| `exit()` | Close Street View and return to 3D map | — |
| `orbit()` | Spin the Street View panorama 360° once (~9 seconds) | — |

---

## Dispatch Table

Add this alongside your agent message loop. Each key is the `name` from the tool schema; the value calls the matching camera function.

The Street View tools require a ref to the mounted `StreetViewOverlay` component. Pass it in when building the dispatch table.

```ts
// backend/tools/cameraDispatch.ts
import {
  flyTo, flyInWithOrbit, flyToLocation,
  orbit, stopAnimation,
  zoomIn, zoomOut,
  groundLevel, cityView, overviewPullback,
  tiltUp, tiltDown,
} from '@/lib/maps/cameraControls'
import type { StreetViewOverlayHandle } from '@/components/map/StreetViewOverlay'

type ToolInput = Record<string, unknown>

export function buildDispatchTable(svRef: React.RefObject<StreetViewOverlayHandle>) {
  const TOOLS: Record<string, (input: ToolInput) => Promise<{ ok: boolean }>> = {
    // --- 3D camera ---
    fly_to: (i) =>
      flyTo(i.lat as number, i.lng as number, {
        range:      i.range      as number | undefined,
        tilt:       i.tilt       as number | undefined,
        heading:    i.heading    as number | undefined,
        durationMs: i.duration_ms as number | undefined,
      }),

    fly_in_with_orbit: (i) =>
      flyInWithOrbit(i.lat as number, i.lng as number),

    fly_to_location: (i) =>
      flyToLocation(i.lat as number, i.lng as number),

    orbit:     (i) => orbit({ speed: i.speed as 'slow' | 'medium' | 'fast' }),
    stop:      ()  => Promise.resolve(stopAnimation()),
    zoom_in:   ()  => zoomIn(),
    zoom_out:  ()  => zoomOut(),
    ground_level:      () => groundLevel(),
    city_view:         () => cityView(),
    overview_pullback: () => overviewPullback(),
    tilt_up:   ()  => tiltUp(),
    tilt_down: ()  => tiltDown(),

    // --- Street View ---
    street_view_enter: async (i) => {
      await svRef.current?.enter(i.lat as number, i.lng as number)
      return { ok: true }
    },
    street_view_exit: async () => {
      svRef.current?.exit()
      return { ok: true }
    },
    street_view_orbit: async () => {
      svRef.current?.orbit()
      return { ok: true }
    },
  }

  return async function dispatchTool(
    toolName: string,
    toolInput: ToolInput
  ): Promise<{ ok: boolean }> {
    const handler = TOOLS[toolName]
    if (!handler) return { ok: false }
    return handler(toolInput)
  }
}
```

---

## Anthropic Tool Definitions (Claude API)

Pass these in the `tools` array of your `messages.create` call.

```ts
import Anthropic from '@anthropic-ai/sdk'

const cameraTools: Anthropic.Tool[] = [
  {
    name: 'fly_to',
    description: 'Fly the 3D map camera to specific coordinates. Use for precise navigation to a lat/lng.',
    input_schema: {
      type: 'object',
      properties: {
        lat:         { type: 'number', description: 'Latitude' },
        lng:         { type: 'number', description: 'Longitude' },
        range:       { type: 'number', description: 'Camera distance from ground in metres. Default 900.' },
        tilt:        { type: 'number', description: 'Camera tilt in degrees (0=top-down, 90=horizon). Default 68.' },
        heading:     { type: 'number', description: 'Compass heading in degrees. Default 0 (north).' },
        duration_ms: { type: 'number', description: 'Animation duration in milliseconds. Default 3000.' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'fly_in_with_orbit',
    description: 'Cinematic arrival: fly down to a location then do one full 360° orbit. Use when first visiting a place.',
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'fly_to_location',
    description: 'Quick 3-second fly to coordinates with no orbit. Use for navigating between stops.',
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'orbit',
    description: 'Orbit the camera 360° around the current position once.',
    input_schema: {
      type: 'object',
      properties: {
        speed: {
          type: 'string',
          enum: ['slow', 'medium', 'fast'],
          description: 'Orbit speed. slow=25s, medium=15s, fast=8s. Default slow.',
        },
      },
    },
  },
  {
    name: 'stop',
    description: 'Stop any in-progress camera animation immediately.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'zoom_in',
    description: 'Zoom in — halves the current camera range over 1.2 seconds.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'zoom_out',
    description: 'Zoom out — doubles the current camera range over 1.2 seconds.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'ground_level',
    description: 'Drop to street/ground level view (150m altitude, steep tilt).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'city_view',
    description: 'Pull back to city overview (8km altitude, 45° tilt).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'overview_pullback',
    description: 'Pull back to regional overview (60km altitude, shallow tilt).',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'tilt_up',
    description: 'Tilt camera up by 10° (toward horizon). Clamped at 90°.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'tilt_down',
    description: 'Tilt camera down by 10° (toward top-down). Clamped at 0°.',
    input_schema: { type: 'object', properties: {} },
  },

  // --- Street View ---
  {
    name: 'street_view_enter',
    description: 'Open Google Street View at the given coordinates. Checks for coverage — will show an error overlay if no imagery exists within 100m. Automatically does one 360° orbit on entry.',
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: 'Latitude' },
        lng: { type: 'number', description: 'Longitude' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'street_view_exit',
    description: 'Close Street View and return to the 3D map.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'street_view_orbit',
    description: 'Spin the Street View panorama 360° once (~9 seconds). Only works while Street View is open.',
    input_schema: { type: 'object', properties: {} },
  },
]
```

---

## Agent Loop Example

```ts
import Anthropic from '@anthropic-ai/sdk'
import { dispatchCameraTool } from './cameraDispatch'

const client = new Anthropic()

async function runMapAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage }
  ]

  while (true) {
    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      tools: cameraTools,
      messages,
    })

    // Append assistant response to history
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') break

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        console.log(`[agent] calling tool: ${block.name}`, block.input)
        const result = await dispatchCameraTool(block.name, block.input as Record<string, unknown>)
        console.log(`[agent] tool result:`, result)

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        })
      }

      // Feed tool results back for next turn
      messages.push({ role: 'user', content: toolResults })
    }
  }
}
```

---

## Notes for Backend Developer

- **`mapRef.current`** is the live `Map3DElement` instance. All camera functions read from it. It is set when the map mounts in the browser and is `null` server-side — all camera calls must originate client-side or be proxied via WebSocket/SSE from the backend.
- **Streaming tool calls** work well here: each camera function `await`s its animation before resolving, so the agent naturally waits for one move to finish before issuing the next.
- **Street View ref** — `svRef` is a `React.RefObject<StreetViewOverlayHandle>` created in `CameraWidget.tsx` and passed to `<StreetViewOverlay ref={svRef} />`. Your dispatch table needs a reference to this same ref object, so pass it down from the component that owns the agent connection.
- **Street View state** — the agent has no direct way to know if Street View is currently open. If needed, expose a `isInStreetView` boolean via a shared state or callback so the agent can decide whether `street_view_exit` is valid to call.
- **Locations** are hardcoded in `frontend/lib/locations/japan.ts`. When geocoding is added, the backend should resolve a destination name to `{ lat, lng }` and pass it to `fly_to` or `fly_in_with_orbit`.
