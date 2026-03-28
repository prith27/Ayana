"""Prompt construction for Ayana prep generation."""

from __future__ import annotations

import json

from .constants import (
    ITINERARY_OPTION_COUNT,
    LANDMARK_FACET_VALUES,
)


def build_ayana_prep_prompt(persona: str) -> str:
    """Build the prompt for itinerary generation."""

    schema_example = {
        "persona": persona,
        "itineraries": [
            {
                "id": "tokyo_adventure_01",
                "city_name": "Tokyo",
                "country_name": "Japan",
                "title": "Tokyo After Dark",
                "pitch": (
                    "A fast, sensory itinerary through neon streets, "
                    "hidden alleys, and iconic city energy."
                ),
                "why_it_fits_persona": (
                    "Fits an adventure traveler through high-energy "
                    "streets, contrast, and movement."
                ),
                "city_facts": [
                    "Tokyo blends hypermodern districts with centuries-old traditions.",
                    "Its rail network makes each district feel like a different world.",
                ],
                "landmarks": [
                    {
                        "id": "shibuya_crossing",
                        "name": "Shibuya Crossing",
                        "short_label": "Shibuya",
                        "order_index": 1,
                        "why_this_stop": (
                            "This stop captures the kinetic energy of Tokyo immediately."
                        ),
                        "facts": [
                            "It is one of the world's best-known pedestrian crossings.",
                            "The surrounding district symbolizes Tokyo street culture.",
                        ],
                        "facets": ["sightseeing", "food", "shopping"],
                    }
                ],
            }
        ],
    }

    return f"""
You are generating structured itinerary options for Ayana, a multimodal travel
experience platform.

Return JSON only. Do not include markdown, comments, or prose outside JSON.

The selected persona is "{persona}".

You must return exactly {ITINERARY_OPTION_COUNT} itinerary options.

Each itinerary must:
- represent one city-level experience candidate
- use clear, canonical, geocoding-friendly city and landmark names
- include short, factual content the voice agent can later narrate
- include at least 3 landmarks in a suggested exploration order
- avoid coordinates, map ids, overlay metadata, and tool-call payloads

Each landmark facet must come only from:
{json.dumps(LANDMARK_FACET_VALUES)}

Required JSON shape:
{json.dumps(schema_example, indent=2)}

Rules:
- top-level persona must match "{persona}"
- itinerary ids must be stable slug-like identifiers
- landmark ids must be stable slug-like identifiers
- `city_facts` and landmark `facts` should be concise and grounded
- `order_index` must start at 1 and increase by 1 within each itinerary
- `short_label` is optional
- do not repeat the same city more than once
- do not return placeholder text such as TBD or Example
""".strip()
