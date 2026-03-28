"""
generate_cubemaps.py — Ayana Teleport Me Lens

Fetches Google Street View images for each Ayana city station and stitches
them into horizontal cross cubemap PNGs ready for import into Lens Studio.

Each location has 3 stations (viewpoints). Each station = one cubemap file.
Total: 9 cubemaps (3 cities × 3 stations).

USAGE:
    cd snap/scripts
    pip install Pillow
    GOOGLE_API_KEY=your_key python generate_cubemaps.py

    # Only specific city:
    GOOGLE_API_KEY=your_key python generate_cubemaps.py eiffeltower
    GOOGLE_API_KEY=your_key python generate_cubemaps.py cancunbeach
    GOOGLE_API_KEY=your_key python generate_cubemaps.py mountfuji

OUTPUT:
    ../assets/cubemaps/
        eiffeltower_s0.png   ← Trocadéro (iconic full-tower view)
        eiffeltower_s1.png   ← Champ de Mars (close, garden approach)
        eiffeltower_s2.png   ← Pont d'Iéna (under the tower)
        cancunbeach_s0.png   ← Hotel Zone beachfront (resort + sea)
        cancunbeach_s1.png   ← Playa Delfines (open beach, clear water)
        cancunbeach_s2.png   ← Lagoon-side (hotel strip + turquoise lagoon)
        mountfuji_s0.png     ← Lake Kawaguchi (lake + full Fuji reflection angle)
        mountfuji_s1.png     ← Fujiyoshida town (looking up at summit)
        mountfuji_s2.png     ← 5th Station (at the mountain, near summit)

CUBEMAP LAYOUT (horizontal cross, Lens Studio compatible):
         [  TOP  ]
  [LEFT][FRONT][RIGHT][BACK]
         [BOTTOM]

Each face: FACE_SIZE × FACE_SIZE px
Canvas:  (4 × FACE_SIZE) × (3 × FACE_SIZE)

GOOGLE CLOUD NOTE:
  This script uses the Street View *Static* API (server-side HTTP tile fetches).
  The Ayana frontend uses the Maps JavaScript API (browser StreetViewPanorama).
  These are DIFFERENT GCP products — you must enable:
    Street View Static API → https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com
  The key must have NO HTTP-referrer restriction (use None or IP allowlist).
"""

import io
import json
import os
import sys
import urllib.parse
import urllib.request
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

try:
    from PIL import Image, ImageEnhance, ImageFilter
except ImportError:
    print("Pillow not found.  Run:  pip install Pillow")
    sys.exit(1)

# ── Config ────────────────────────────────────────────────────────────────────

API_KEY = (
    os.environ.get("GOOGLE_API_KEY", "").strip()
    or os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
)
if not API_KEY:
    print("ERROR: Set GOOGLE_API_KEY environment variable.")
    print("  export GOOGLE_API_KEY=your_key_here")
    sys.exit(1)

# 640 = free-tier max per face. Increase to 2048 with billing enabled.
FACE_SIZE = 640

# Optional: set POST_PROCESS=1 to apply mild sharpening/contrast to faces.
POST_PROCESS = os.environ.get("POST_PROCESS", "").strip().lower() in {"1", "true", "yes", "on"}

# Metadata search radii (meters) for finding a nearby pano.
RADIUS_STEPS = [50, 100, 250, 500, 1000]

OUTPUT_DIR = Path(__file__).parent.parent / "assets" / "cubemaps"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SV_BASE = "https://maps.googleapis.com/maps/api/streetview"


# ── Location data ─────────────────────────────────────────────────────────────
#
# Each station:
#   id         → suffix for filename  (city_s{id}.png)
#   label      → shown in Lens Studio and TeleportLens UI
#   lat / lng  → Street View search origin (searches nearby pano within radius)
#   heading    → compass direction the FRONT face points (what you face first)
#   pitch      → vertical tilt of the front face (0 = horizon, positive = up)
#
# Viewpoint rationale is in the label so it's clear when importing in Lens Studio.

CITIES = [
    {
        "id": "eiffeltower",
        "name": "Eiffel Tower",
        "stations": [
            {
                "id": 0,
                "label": "Trocadero — full tower view",
                # Trocadero gardens: the most iconic long-range view of the tower.
                # You see the whole structure framed by the gardens.
                "lat": 48.8593522,
                "lng": 2.298224,
                "heading": 75.26188183085891,
                "pitch": -16.91259702575006,
                "pano_id": "W9xsinQhrv3GzqoFGeOVEw",
            },
            {
                "id": 1,
                "label": "Champ de Mars — garden approach",
                # South side, Champ de Mars park. Tower fills the sky ahead.
                # The park, fountain, and city skyline wrap 360° around you.
                "lat": 48.8578538,
                "lng": 2.2952747,
                "heading": 318.1422736755901,
                "pitch": -39.138901725846154,
                "pano_id": "U6mYhRRXwjrkwy0-8LETsA",
            },
            {
                "id": 2,
                "label": "Pont d Iena — under the tower",
                # On the Seine bridge directly beneath the tower.
                # Look up and the iron lattice towers above; river on both sides.
                "lat": 48.860285,
                "lng": 2.2908913,
                "heading": 132.21601177213222,
                "pitch": -11.43638893361323,
                "pano_id": "wL7gpoH7L-y2vCst82yszg",
            },
        ],
    },
    {
        "id": "cancunbeach",
        "name": "Cancun Beach",
        "stations": [
            {
                "id": 0,
                "label": "Hotel Zone — beachfront resort strip",
                # Hotel Zone north strip: luxury resorts on the left,
                # white sand + Caribbean Sea straight ahead, azure water to the right.
                "lat": 21.1366089,
                "lng": -86.7466735,
                "heading": 5.8806047741978205,
                "pitch": 1.6845586016245733,
                "pano_id": "T2Q1dsextBJM25bGo2QgKw",
            },
            {
                "id": 1,
                "label": "Playa Delfines — open public beach",
                # Playa Delfines: wide open beach, no buildings blocking the view.
                # Pure sand + sea + sky panorama. The famous Cancun sign is nearby.
                "lat": 21.1308498,
                "lng": -86.7607185,
                "heading": 344.2814116399045,
                "pitch": 3.59536542689834,
                "pano_id": "Z-xAZgUuKATZzImXR5XT6w",
            },
            {
                "id": 2,
                "label": "Lagoon side — turquoise lagoon view",
                # West side of the Hotel Zone strip: Nichupte Lagoon behind you,
                # resort towers and the lagoon's bright turquoise water visible.
                "lat": 21.1446546,
                "lng": -86.7760389,
                "heading": 331.08456390795266,
                "pitch": 6.12034144238946,
                "pano_id": "SAz0Y4n58NneZ2B5Gof9vQ",
            },
        ],
    },
    {
        "id": "mountfuji",
        "name": "Mount Fuji",
        "stations": [
            {
                "id": 0,
                "label": "Lake Kawaguchi — classic lake reflection",
                # North shore of Lake Kawaguchi: the postcard shot.
                # Full Fuji summit ahead, the lake in the foreground.
                "lat": 35.5012626,
                "lng": 138.8013852,
                "heading": 104.89866496508662,
                "pitch": 2.796199401799157,
                "pano_id": "pz7TgB-qXEIHhtYagTB5rA",
                "fallbacks": [
                    {"lat": 35.5158, "lng": 138.7459, "label": "Lake Kawaguchi east"},
                    {"lat": 35.5089, "lng": 138.7502, "label": "Lake Kawaguchi west"},
                ],
            },
            {
                "id": 1,
                "label": "Fujiyoshida — town at the mountain base",
                # Fujiyoshida city looking toward the summit.
                # Traditional town rooftops, torii gates, Fuji filling the sky.
                "lat": 35.3542497,
                "lng": 138.7330593,
                "heading": 328.20799313003073,
                "pitch": -5.777462107053594,
                "pano_id": "v5TLn-mGxjHhiHsR0bnF2w",
            },
            {
                "id": 2,
                "label": "5th Station — at the mountain",
                # Subaru Line 5th Station: you ARE on the mountain.
                # Look back down at the valley; look up toward the crater rim.
                "lat": 35.3606255,
                "lng": 138.7273634,
                "heading": 92.62111677224271,
                "pitch": -17.123977702663808,
                "pano_id": "C4mt_P-712GH1_PHY--dVA",
                "fallbacks": [
                    {"lat": 35.3778, "lng": 138.7278, "label": "5th Station west"},
                    {"lat": 35.3743, "lng": 138.7362, "label": "5th Station east"},
                ],
            },
        ],
    },
]


# ── Cubemap face layout ───────────────────────────────────────────────────────
#
# Horizontal cross layout for Lens Studio:
#
#   col →  0       1       2       3
# row ↓
#   0              [TOP]
#   1     [LEFT] [FRONT] [RIGHT]  [BACK]
#   2            [BOTTOM]
#
# Each tuple: (face_name, heading_offset_from_base, pitch_override_or_None, col, row)
# pitch_override: if None, uses the station's pitch for front, 0 for sides, ±90 for top/bottom

FACES = [
    # name      hdg_offset  pitch     col  row
    ("front",   0,          None,     1,   1),   # pitch = station pitch
    ("right",   90,         None,     2,   1),
    ("back",    180,        None,     3,   1),
    ("left",    270,        None,     0,   1),
    ("top",     0,          90,       1,   0),
    ("bottom",  0,         -90,       1,   2),
]


# ── Error helpers ─────────────────────────────────────────────────────────────

class StreetViewRequestDenied(RuntimeError):
    pass


def _api_error_hint(status: str) -> str:
    return (
        f"\n  Google returned status={status!r}. Fixes:\n"
        "  • Enable Street View Static API in GCP:\n"
        "    https://console.cloud.google.com/apis/library/street-view-image-backend.googleapis.com\n"
        "  • Ensure billing is active on the GCP project\n"
        "  • API key restriction: must be None or IP-based (not HTTP referrer)\n"
    )


# ── Fetch helpers ─────────────────────────────────────────────────────────────

def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))


def _fetch_metadata(lat: float, lng: float, radius: int) -> dict:
    params = urllib.parse.urlencode({
        "location": f"{lat},{lng}",
        "radius": radius,
        "source": "outdoor",
        "key": API_KEY,
    })
    with urllib.request.urlopen(f"{SV_BASE}/metadata?{params}", timeout=10) as r:
        return json.loads(r.read())


def resolve_pano(station: dict) -> dict | None:
    """Resolve a pano_id + location by searching nearby with radius steps."""
    if station.get("pano_id"):
        return {
            "pano_id": station["pano_id"],
            "lat": station["lat"],
            "lng": station["lng"],
            "radius": 0,
            "source_label": "pano_id",
            "distance_m": 0.0,
        }

    candidates = [{"lat": station["lat"], "lng": station["lng"], "label": "primary"}]
    for fb in station.get("fallbacks", []):
        candidates.append({
            "lat": fb["lat"],
            "lng": fb["lng"],
            "label": fb.get("label", "fallback"),
        })

    for candidate in candidates:
        lat = candidate["lat"]
        lng = candidate["lng"]
        for radius in RADIUS_STEPS:
            try:
                data = _fetch_metadata(lat, lng, radius)
            except Exception as exc:
                print(f"    metadata check failed ({exc}) — continuing")
                continue

            status = data.get("status", "UNKNOWN")
            err = data.get("error_message", "")

            if status == "OK":
                pano_id = data.get("pano_id") or data.get("pano") or ""
                location = data.get("location", {})
                resolved_lat = location.get("lat", lat)
                resolved_lng = location.get("lng", lng)
                distance_m = _haversine_m(lat, lng, resolved_lat, resolved_lng)
                return {
                    "pano_id": pano_id,
                    "lat": resolved_lat,
                    "lng": resolved_lng,
                    "radius": radius,
                    "source_label": candidate["label"],
                    "distance_m": distance_m,
                }

            if status in ("REQUEST_DENIED", "OVER_QUERY_LIMIT", "INVALID_REQUEST"):
                print(f"    {status}: {err or status}")
                print(_api_error_hint(status))
                raise StreetViewRequestDenied(status)

    return None


def fetch_face(lat: float, lng: float, heading: float, pitch: float, pano_id: str | None) -> Image.Image:
    """Fetch one cubemap face. Returns a black placeholder on failure."""
    params_dict = {
        "size": f"{FACE_SIZE}x{FACE_SIZE}",
        "heading": heading % 360,
        "pitch": pitch,
        "fov": 90,
        "source": "outdoor",
        "key": API_KEY,
    }
    if pano_id:
        params_dict["pano"] = pano_id
    else:
        params_dict["location"] = f"{lat},{lng}"

    params = urllib.parse.urlencode(params_dict)
    try:
        with urllib.request.urlopen(f"{SV_BASE}?{params}", timeout=15) as r:
            if r.status != 200:
                raise RuntimeError(f"HTTP {r.status}")
            img = Image.open(io.BytesIO(r.read()))
            img.load()
            face = img.convert("RGB").resize((FACE_SIZE, FACE_SIZE), Image.LANCZOS)
            return apply_post_process(face) if POST_PROCESS else face
    except Exception as exc:
        print(f"FAILED ({exc})")
        return Image.new("RGB", (FACE_SIZE, FACE_SIZE), color=(10, 10, 20))


def apply_post_process(img: Image.Image) -> Image.Image:
    """Mild sharpen/contrast boost to reduce softness at 640px faces."""
    sharpened = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=130, threshold=3))
    return ImageEnhance.Contrast(sharpened).enhance(1.05)


# ── Cubemap builder ───────────────────────────────────────────────────────────

def build_cubemap(city_id: str, station: dict) -> Path | None:
    sid = station["id"]
    label = station["label"]
    lat = station["lat"]
    lng = station["lng"]
    base_heading = station["heading"]
    base_pitch = station["pitch"]

    out_path = OUTPUT_DIR / f"{city_id}_s{sid}.png"

    print(f"\n  Station {sid} — {label}")
    print(f"  {lat}, {lng}  |  heading {base_heading}°  pitch {base_pitch}°")
    print("  Coverage search ...", end=" ", flush=True)
    resolved = resolve_pano(station)

    if not resolved:
        print(f"  Skipping station {sid} — no Street View coverage here.")
        return None
    distance_m = resolved["distance_m"]
    pano_id = resolved["pano_id"] or None
    fetch_lat = resolved["lat"]
    fetch_lng = resolved["lng"]
    source_label = resolved["source_label"]
    if source_label != "primary":
        print(f"OK (fallback={source_label}, {distance_m:.0f} m)")
    else:
        print(f"OK ({distance_m:.0f} m)")

    canvas = Image.new("RGB", (FACE_SIZE * 4, FACE_SIZE * 3), color=(10, 10, 20))

    for face_name, hdg_offset, pitch_override, col, row in FACES:
        heading = (base_heading + hdg_offset) % 360
        pitch = base_pitch if pitch_override is None else pitch_override
        print(f"    {face_name:8s}  hdg={heading:5.1f}°  pitch={pitch:+6.2f}°  ...", end=" ", flush=True)
        face = fetch_face(fetch_lat, fetch_lng, heading, pitch, pano_id)
        canvas.paste(face, (col * FACE_SIZE, row * FACE_SIZE))
        print("OK")

    canvas.save(out_path, "PNG", optimize=False)
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"  → Saved {out_path.name}  ({size_mb:.1f} MB)")
    return out_path


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    target_cities = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    print("\nAyana Teleport Me — Cubemap Generator")
    print(f"Face size : {FACE_SIZE}×{FACE_SIZE} px")
    print(f"Canvas    : {FACE_SIZE*4}×{FACE_SIZE*3} px  (horizontal cross)")
    print(f"Output    : {OUTPUT_DIR}")
    print(f"Cities    : {', '.join(c['id'] for c in CITIES)}")

    all_results: list[tuple[str, int, Path | None]] = []

    for city in CITIES:
        cid = city["id"]
        if target_cities and cid not in target_cities:
            continue

        print(f"\n{'='*60}")
        print(f"  {city['name']}  ({cid})")
        print(f"{'='*60}")

        for station in city["stations"]:
            try:
                path = build_cubemap(cid, station)
            except StreetViewRequestDenied as exc:
                print(f"\nStopped: {exc}")
                sys.exit(1)
            all_results.append((cid, station["id"], path))

    print(f"\n\n{'─'*60}")
    print("Summary")
    print(f"{'─'*60}")
    for cid, sid, path in all_results:
        mark = "✓" if path else "✗"
        name = path.name if path else "SKIPPED"
        print(f"  {mark}  {cid}_s{sid}  →  {name}")

    print("\nNext steps:")
    print("  1. Open Lens Studio")
    print("  2. For each PNG: Asset Browser → + → Texture → select file")
    print("     (Lens Studio detects the horizontal-cross layout automatically)")
    print("  3. Create one sphere per station inside a 'Stations' parent object")
    print("  4. Apply each cubemap to its sphere's material")
    print("  5. Add TeleportLens.ts to AyanaController — wire the Stations parent")
    print("  See snap/lens/LENS_SETUP.md for the full guide\n")


if __name__ == "__main__":
    main()
