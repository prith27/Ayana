# Ayana × Snap — Teleport Me Lens

## What this does

"Teleport Me" is a Snap AR lens series that places you inside 360° Street View panoramas of Ayana's travel destinations. Each city has its own lens:

- Point your phone at yourself
- Your face appears in the foreground via front camera
- The destination wraps around you as a full 360° environment
- Physically rotate your phone to look around
- Snap your moment and share it

## Quick Start

### 1. Generate the cubemap assets
```bash
cd snap/scripts
pip install requests Pillow
export GOOGLE_API_KEY=your_key
python generate_cubemaps.py
# Outputs PNG files to snap/assets/cubemaps/
```

The web app’s Street View (`StreetViewOverlay` + Maps JavaScript API) uses a **different** GCP product than this script. For cubemap generation you need **Street View Static API** enabled on the project (see `generate_cubemaps.py` error output if you get `REQUEST_DENIED`).

Quality + coverage notes:
- The script resolves a nearby pano via the metadata API (expanding radius) and uses a single `pano_id` for all 6 faces to reduce seams.
- If a station has no coverage at its primary coordinates, it tries curated fallbacks before skipping.
- Optional mild sharpening/contrast can be enabled with `POST_PROCESS=1` (off by default).
- To hard-pin a station to a known pano, set `pano_id` on that station in `generate_cubemaps.py`.

To generate only specific cities:
```bash
python generate_cubemaps.py sensoji shibuya
```

### 1b. Optional — equirectangular panoramas (sphere-friendly)

If horizontal-cross cubemaps are awkward in Lens Studio, convert all nine PNGs to panorama textures (same filenames, `snap/assets/equirect/`):

```bash
cd snap/scripts
pip install Pillow numpy
python cross_cubemap_to_equirectangular.py
# default output: 2048×1536
```

Override size (any aspect is allowed if you set **both**):

```bash
EQUIRECT_WIDTH=2048 EQUIRECT_HEIGHT=1536 python cross_cubemap_to_equirectangular.py
# classic 2:1 equirect (e.g. for shaders that expect it):
EQUIRECT_WIDTH=2048 EQUIRECT_HEIGHT=1024 python cross_cubemap_to_equirectangular.py
```

If you only set `EQUIRECT_WIDTH`, height defaults to **width×3/4** (same ratio as 2048×1536).

In Lens Studio: import the PNG as a **2D Texture**, use a **large sphere** with a material that matches your texture’s aspect (equirect / 360 preset). See `lens/LENS_SETUP.md` for the sphere workflow.

### 2. Build the lenses in Lens Studio
See `lens/LENS_SETUP.md` for the full step-by-step guide.

One lens per city:
| City | Config ID | Cubemap |
|------|-----------|---------|
| Eiffel Tower | `eiffeltower` | `eiffeltower_cubemap.png` |
| Cancun Beach | `cancunbeach` | `cancunbeach_cubemap.png` |
| Mount Fuji | `mountfuji` | `mountfuji_cubemap.png` |

### 3. Publish and wire up the frontend
After publishing each lens, copy its lens link and update:
```
frontend/lib/snap/lensConfig.ts
```

## File structure
```
snap/
  README.md               ← you are here
  scripts/
    generate_cubemaps.py  ← asset generation script
  assets/
    cubemaps/             ← generated PNG output (gitignored)
  lens/
    LENS_SETUP.md         ← step-by-step Lens Studio guide
    scripts/
      CityConfig.ts       ← city definitions + ACTIVE_CITY_ID
      TeleportLens.ts     ← main lens behavior script
      RemoteCubemapLoader.ts ← optional: load cubemap from remote URL
```

## The user flow

```
Ayana web app
  → User explores city on 3D map
  → Clicks "Teleport Me" button
  → Opens Snapchat (mobile) with this city's lens
  → Sees themselves in the city's Street View
  → Looks around with gyroscope
  → Snaps selfie and shares
  → "Explore this city on Ayana" CTA shown
```

## Snap track requirements

- [x] Lens+ sign-up required: https://airtable.com/appKgGaXGsgyxLO1P/pagpw0QIF503cLAb9/form
- [x] Multiple lenses as a themed series (one per city)
- [x] Entertaining: immersive teleportation AR experience
- [x] Shareable: selfie mode built in
