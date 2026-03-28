# Ayana — Complete Tool Reference

All functions callable via `window.__ayanaDispatch(toolName, args)` (once wired in a future sprint) or directly from the frontend dispatch table.

---

## Camera Tools

| Tool | Args | Effect |
|------|------|--------|
| `fly_to` | `lat, lng, range?, tilt?, heading?, duration_ms?` | Fly camera to coordinates |
| `fly_in_with_orbit` | `lat, lng` | 3.5s swoop + 5.5s single orbit |
| `navigate_to` | `lat, lng, arrival_range?` | Pull back → swoosh sound → swoop in |
| `fly_to_location` | `lat, lng` | Clean 3s fly, no orbit |
| `orbit` | `speed?: 'slow'\|'medium'\|'fast'` | One 360° orbit at current position |
| `stop` | — | Freeze camera mid-motion |
| `zoom_in` | — | Halve current range (1.2s) |
| `zoom_out` | — | Double current range (1.2s) |
| `ground_level` | — | Drop to 150m, tilt 78° |
| `city_view` | — | Pull to 8km, tilt 45° |
| `overview_pullback` | — | Pull to 60km, tilt 15° |
| `tilt_up` | — | +10° tilt (clamped at 90°) |
| `tilt_down` | — | −10° tilt (clamped at 0°) |

---

## Street View Tools

| Tool | Args | Effect |
|------|------|--------|
| `street_view_enter` | `lat, lng` | Open Street View (coverage-checked, auto-orbits on entry) |
| `street_view_exit` | — | Close Street View, return to 3D map |
| `street_view_orbit` | — | Spin panorama 360° once (~14s) |
| `fly_to_place_street_view` | `lat, lng` | navigate to POI (400m range) → orbit → open Street View |

---

## Sidebar & UI Tools

### `fetchNearbyAndShow`
Show the sidebar for a location. The frontend fetches nearby places from the Places API automatically — backend sends only the scene metadata.

```json
{
  "name": "fetchNearbyAndShow",
  "args": {
    "locationName": "Senso-ji Temple",
    "locationSub": "Asakusa, Tokyo · Temple",
    "tags": ["historic", "spiritual", "photography"],
    "sceneIndex": 0,
    "sceneTotal": 5,
    "lat": 35.7148,
    "lng": 139.7967
  }
}
```

### `hideSidebar`
```json
{ "name": "hideSidebar", "args": {} }
```

### `setAgentSpeaking` / `setAgentListening` / `setAgentIdle`
Update the agent status notch (docked below camera widget) and the sidebar footer.
```json
{ "name": "setAgentSpeaking", "args": {} }
{ "name": "setAgentListening", "args": {} }
{ "name": "setAgentIdle", "args": {} }
```

### `setPlaceImage` *(scaffolded — backend implements)*
Set a real photo on a specific place card. The image slot in every card renders a placeholder until this is called.
```json
{
  "name": "setPlaceImage",
  "args": { "placeId": "ChIJ...", "imageUrl": "https://..." }
}
```

---

## Agent State Indicators

Two UI elements both react to `setAgentSpeaking` / `setAgentListening` / `setAgentIdle`:

- **AgentStatusNotch** — pill docked below the camera widget on the left. Visible only when `speaking` or `listening`. Shows green dot + waveform animation when speaking, blue dot + "Listening…" when listening.
- **Sidebar footer** — same states reflected at the bottom of the sidebar panel when it is open.

---

## Smart Arrival Range

When `navigate_to` or Prev/Next navigation is triggered, the frontend automatically calls `resolveArrivalRange(lat, lng)` via the Google Geocoder to compute the ideal camera distance from the Places API viewport. No hardcoded distances required per location.

Type presets (fallback when viewport is unavailable):

| Location type | Range |
|---|---|
| natural_feature / mountain | 25,000m |
| park / national_park | 8,000m |
| locality (city) | 15,000m |
| neighborhood | 5,000m |
| tourist_attraction / museum | 1,200m |
| restaurant / store | 400m |
| shopping_mall | 800m |
| default | 900m |

---

## Notes for Backend

- `fetchNearbyAndShow` triggers a Places API call from the **frontend** — the backend only sends scene metadata. This keeps Places API traffic client-side and avoids proxying photo URLs.
- `flyToPlaceStreetView` chains `navigateToLocation(400m)` → `orbit` → `StreetViewOverlay.enter()` sequentially. Each step awaits the previous, so the total sequence takes ~30s. Consider this when designing agent turn timing.
- Agent state tools are fire-and-forget (synchronous state updates) — tool result is always `{ ok: true }`.
