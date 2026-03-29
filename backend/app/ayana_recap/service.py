"""Recap service: Grok transcript extraction + Google Places photo enrichment."""

from __future__ import annotations

import asyncio
import json
import logging
import os

import httpx

from .models import (
    LocationEvent,
    RecapActivity,
    RecapData,
    RecapDNATrait,
    RecapFood,
    RecapStats,
    RecapStop,
    TranscriptTurn,
    VibeShift,
)

logger = logging.getLogger(__name__)

GROK_BASE_URL = "https://api.x.ai/v1"
GROK_MODEL = "grok-3-mini"
PLACES_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"


# ─── Prompt ───────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
You are a travel session analyst. You will receive a conversation transcript \
between a user and Ayana (an AI travel guide), along with a list of location \
events that record which cities and landmarks were actually navigated to during \
the session.

Your job is to extract structured recap data from this session. Follow these rules:

1. STOPS: Only include LANDMARK entries from location_events (these were actually visited).
   Do NOT include CITY events or the primary city name as a stop unless a distinct
   landmark/place is specified. For each stop, write a vivid one-sentence
   description in Ayana's cinematic style.

2. FOOD: Extract restaurants or food experiences Ayana specifically recommended \
   (mentioned positively, not just in passing). Estimate a rating (4.0–4.9) and \
   price level (¥ / ¥¥ / ¥¥¥ or $ / $$ / $$$ depending on city) based on context.

3. ACTIVITIES: Extract experiences or activities Ayana recommended. Mark highlight=true \
   for the most enthusiastically described one.

4. STATS: Estimate based on the places visited and conversation length:
   - distance_km: approximate travel distance between all stops (rough estimate ok)
   - neighborhoods: count of distinct areas visited
   - places_discovered: total stops + food + activities count
   - exploration_score: 70–99 based on how adventurous / thorough the session was

5. DNA: Generate 4 traveller personality traits as percentages (50–99) that reflect \
   what the user gravitated toward in conversation. Examples: "Cultural Explorer", \
   "Urban Adventurer", "Food Seeker", "Nature Chaser", "Hidden Gem Hunter", \
   "History Buff", "Nightlife Explorer", "Slow Traveller".

6. VIBE_SHIFTS: If the user said something like "scrap this", "I don't like this", \
   "let's change direction", "recommend something else", capture it as a short \
   description of what changed. If no vibe shift happened, return an empty array.

7. PRIMARY CITY/COUNTRY: Use the first city-type location_event as the primary \
   city and country. If the session jumped between cities, use the one with the \
   most landmark events.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "persona": "<string>",
  "city": "<string>",
  "country": "<string>",
  "stops": [{"name": "", "area": "", "type": "", "desc": ""}],
  "food": [{"name": "", "cuisine": "", "rating": 0.0, "price": ""}],
  "activities": [{"name": "", "type": "", "rating": 0.0, "highlight": false}],
  "stats": {"distance_km": 0, "neighborhoods": 0, "places_discovered": 0, "exploration_score": 0},
  "dna": [{"trait": "", "pct": 0}],
  "vibe_shifts": [{"description": ""}]
}
"""


def _build_user_message(
    persona: str,
    turns: list[TranscriptTurn],
    location_events: list[LocationEvent],
) -> str:
    lines: list[str] = [f"PERSONA: {persona}", "", "LOCATION EVENTS:"]
    for ev in location_events:
        if ev.type == "city":
            lines.append(f"  [CITY] {ev.name}, {ev.country or ''}")
        else:
            lines.append(f"  [LANDMARK] {ev.name} (in {ev.city or ''}, {ev.country or ''})")

    lines += ["", "TRANSCRIPT:"]
    for turn in turns:
        speaker = "AYANA" if turn.speaker == "ai" else "USER"
        loc = f" [{turn.location}]" if turn.location else ""
        lines.append(f"{speaker}{loc}: {turn.text}")

    return "\n".join(lines)


# ─── Grok extraction ──────────────────────────────────────────────────────────

async def _call_grok(
    persona: str,
    turns: list[TranscriptTurn],
    location_events: list[LocationEvent],
    api_key: str,
) -> dict:
    user_message = _build_user_message(persona, turns, location_events)
    payload = {
        "model": GROK_MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.3,
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{GROK_BASE_URL}/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    return json.loads(content)


# ─── Google Places photo lookup ───────────────────────────────────────────────

async def _fetch_place_photo_url(
    place_name: str,
    city: str,
    api_key: str,
) -> str | None:
    """Search for a place and return a photo URL, or None if unavailable."""
    query = f"{place_name}, {city}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            search_resp = await client.post(
                PLACES_SEARCH_URL,
                json={"textQuery": query, "maxResultCount": 1},
                headers={
                    "X-Goog-Api-Key": api_key,
                    "X-Goog-FieldMask": "places.displayName,places.photos",
                    "Content-Type": "application/json",
                },
            )
            search_resp.raise_for_status()
            search_data = search_resp.json()

        places = search_data.get("places", [])
        if not places:
            return None

        photos = places[0].get("photos", [])
        if not photos:
            return None

        photo_name = photos[0].get("name", "")
        if not photo_name:
            return None

        # Fetch photo media to get the redirect URI without following it
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=False) as client:
            media_resp = await client.get(
                f"https://places.googleapis.com/v1/{photo_name}/media",
                params={"maxWidthPx": 800, "key": api_key, "skipHttpRedirect": "true"},
            )
            if media_resp.status_code in (200, 302):
                if media_resp.status_code == 200:
                    media_data = media_resp.json()
                    return media_data.get("photoUri")
                return media_resp.headers.get("location")

    except Exception as exc:
        logger.warning("Places photo lookup failed for %r: %s", place_name, exc)

    return None


async def _enrich_stops_with_photos(
    stops: list[RecapStop],
    city: str,
    api_key: str,
) -> None:
    """Mutate stops in-place, adding image_url where possible."""
    tasks = [_fetch_place_photo_url(stop.name, city, api_key) for stop in stops]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for stop, result in zip(stops, results):
        if isinstance(result, str):
            stop.image_url = result


# ─── Main entry point ─────────────────────────────────────────────────────────

async def build_recap(
    persona: str,
    turns: list[TranscriptTurn],
    location_events: list[LocationEvent],
) -> RecapData:
    grok_api_key = os.getenv("GROQ_API_KEY", "") or os.getenv("GROK_API_KEY", "")
    google_api_key = os.getenv("GOOGLE_API_KEY", "")

    if not grok_api_key:
        raise ValueError("GROQ_API_KEY (xAI Grok) is not set in environment")

    raw = await _call_grok(persona, turns, location_events, grok_api_key)

    # Build typed model from Grok output
    stops = [RecapStop(**s) for s in raw.get("stops", [])]
    food = [RecapFood(**f) for f in raw.get("food", [])]
    activities = [RecapActivity(**a) for a in raw.get("activities", [])]
    stats_raw = raw.get("stats", {})
    stats = RecapStats(
        distance_km=stats_raw.get("distance_km", 0),
        neighborhoods=stats_raw.get("neighborhoods", 0),
        places_discovered=stats_raw.get("places_discovered", 0),
        exploration_score=stats_raw.get("exploration_score", 0),
    )
    dna = [RecapDNATrait(**d) for d in raw.get("dna", [])]
    vibe_shifts = [VibeShift(**v) for v in raw.get("vibe_shifts", [])]
    city = raw.get("city", "")
    country = raw.get("country", "")

    # Enrich stops with Google Places photos
    if google_api_key and stops:
        await _enrich_stops_with_photos(stops, city, google_api_key)

    return RecapData(
        persona=persona,
        city=city,
        country=country,
        stops=stops,
        food=food,
        activities=activities,
        stats=stats,
        dna=dna,
        vibe_shifts=vibe_shifts,
    )
