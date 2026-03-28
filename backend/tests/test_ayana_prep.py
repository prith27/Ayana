"""Tests for the Ayana prep backend feature."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

BACKEND_APP_DIR = Path(__file__).resolve().parents[1] / "app"
if str(BACKEND_APP_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_APP_DIR))

import main as backend_main  # noqa: E402
from ayana_prep.errors import AyanaPrepGenerationError  # noqa: E402
from ayana_prep.models import AyanaPrepRequest, AyanaPrepResponse  # noqa: E402
from ayana_prep.router import get_ayana_prep_service  # noqa: E402
from ayana_prep.service import AyanaPrepService  # noqa: E402


def build_valid_payload(persona: str = "adventure") -> dict:
    """Create a valid prep payload fixture."""

    return {
        "persona": persona,
        "itineraries": [
            {
                "id": "tokyo_adventure_01",
                "city_name": "Tokyo",
                "country_name": "Japan",
                "title": "Tokyo After Dark",
                "pitch": "A neon-forward city adventure.",
                "why_it_fits_persona": "It matches an adventurous traveler.",
                "city_facts": [
                    "Tokyo blends old and new.",
                    "Its districts change mood quickly.",
                ],
                "landmarks": [
                    {
                        "id": "shibuya_crossing",
                        "name": "Shibuya Crossing",
                        "short_label": "Shibuya",
                        "order_index": 1,
                        "why_this_stop": "It drops the traveler into the city's pulse.",
                        "facts": [
                            "It is one of the world's best-known crossings.",
                            "The district is a symbol of Tokyo street culture.",
                        ],
                        "facets": ["sightseeing", "shopping"],
                    },
                    {
                        "id": "senso_ji_temple",
                        "name": "Senso-ji Temple",
                        "short_label": "Senso-ji",
                        "order_index": 2,
                        "why_this_stop": "It adds a historic counterpoint.",
                        "facts": [
                            "It is Tokyo's oldest temple.",
                            "The approach is lined with historic stalls.",
                        ],
                        "facets": ["sightseeing", "food"],
                    },
                    {
                        "id": "tokyo_tower",
                        "name": "Tokyo Tower",
                        "short_label": "Tower",
                        "order_index": 3,
                        "why_this_stop": "It gives the itinerary a skyline finish.",
                        "facts": [
                            "It is inspired by the Eiffel Tower.",
                            "It remains one of the city's iconic silhouettes.",
                        ],
                        "facets": ["sightseeing", "activity"],
                    },
                ],
            },
            {
                "id": "lisbon_adventure_01",
                "city_name": "Lisbon",
                "country_name": "Portugal",
                "title": "Lisbon In Motion",
                "pitch": "A hilly city route full of viewpoints and rhythm.",
                "why_it_fits_persona": "It keeps movement and surprise high.",
                "city_facts": [
                    "Lisbon is built across steep hills.",
                    "Its neighborhoods reward wandering and viewpoints.",
                ],
                "landmarks": [
                    {
                        "id": "praca_do_comercio",
                        "name": "Praca do Comercio",
                        "short_label": "Commerce Square",
                        "order_index": 1,
                        "why_this_stop": "It opens the city at river scale.",
                        "facts": [
                            "It is one of Lisbon's grandest public squares.",
                            "It faces the Tagus River.",
                        ],
                        "facets": ["sightseeing", "activity"],
                    },
                    {
                        "id": "alfama",
                        "name": "Alfama",
                        "short_label": "Alfama",
                        "order_index": 2,
                        "why_this_stop": "It introduces old-lisbon texture.",
                        "facts": [
                            "Alfama is one of Lisbon's oldest districts.",
                            "Its lanes are known for fado and viewpoints.",
                        ],
                        "facets": ["sightseeing", "food"],
                    },
                    {
                        "id": "miradouro_da_senhora_do_monte",
                        "name": "Miradouro da Senhora do Monte",
                        "short_label": "Miradouro",
                        "order_index": 3,
                        "why_this_stop": "It lands on a dramatic city panorama.",
                        "facts": [
                            "It is a well-known hilltop viewpoint.",
                            "It offers a broad view across Lisbon.",
                        ],
                        "facets": ["sightseeing", "activity"],
                    },
                ],
            },
            {
                "id": "cape_town_adventure_01",
                "city_name": "Cape Town",
                "country_name": "South Africa",
                "title": "Cape Town By Contrast",
                "pitch": "Sea, mountain, and city in one dynamic route.",
                "why_it_fits_persona": "It packs contrast and big shifts of terrain.",
                "city_facts": [
                    "Cape Town sits between ocean and mountain.",
                    "Its natural setting shapes the city's identity.",
                ],
                "landmarks": [
                    {
                        "id": "v_and_a_waterfront",
                        "name": "V&A Waterfront",
                        "short_label": "Waterfront",
                        "order_index": 1,
                        "why_this_stop": "It starts with energy and access.",
                        "facts": [
                            "It is one of the city's busiest visitor districts.",
                            "It combines harbor views with retail and dining.",
                        ],
                        "facets": ["shopping", "food"],
                    },
                    {
                        "id": "table_mountain",
                        "name": "Table Mountain",
                        "short_label": "Table Mountain",
                        "order_index": 2,
                        "why_this_stop": "It creates a dramatic vertical shift.",
                        "facts": [
                            "It is one of Cape Town's defining landmarks.",
                            "Its flat summit is visible across the city.",
                        ],
                        "facets": ["sightseeing", "activity"],
                    },
                    {
                        "id": "bo_kaap",
                        "name": "Bo-Kaap",
                        "short_label": "Bo-Kaap",
                        "order_index": 3,
                        "why_this_stop": "It closes on color and neighborhood history.",
                        "facts": [
                            "It is known for its brightly painted houses.",
                            "It is deeply tied to Cape Malay heritage.",
                        ],
                        "facets": ["sightseeing", "food"],
                    },
                ],
            },
        ],
    }


class FakeClient:
    """Simple async fake for the prep client."""

    def __init__(self, payload: dict) -> None:
        self.payload = payload

    async def generate_itineraries(self, prompt: str) -> dict:
        assert "Return JSON only" in prompt
        await asyncio.sleep(0)
        return self.payload


@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """Keep FastAPI dependency overrides isolated per test."""

    backend_main.app.dependency_overrides.clear()
    yield
    backend_main.app.dependency_overrides.clear()


def test_response_model_rejects_duplicate_landmark_ids():
    """The public response model should reject duplicate landmark ids."""

    payload = build_valid_payload()
    payload["itineraries"][0]["landmarks"][1]["id"] = "shibuya_crossing"

    with pytest.raises(ValidationError):
        AyanaPrepResponse.model_validate(payload)


@pytest.mark.asyncio
async def test_service_normalizes_and_validates_payload():
    """Service normalization should trim, slugify, sort, and validate."""

    payload = build_valid_payload()
    first_itinerary = payload["itineraries"][0]
    first_itinerary["id"] = " Tokyo Adventure 01 "
    first_itinerary["landmarks"] = [
        {
            "id": "Tokyo Tower",
            "name": "Tokyo Tower",
            "short_label": " Tower ",
            "order_index": "3",
            "why_this_stop": " Skyline finish ",
            "facts": [" Iconic silhouette ", " Observation decks "],
            "facets": ["sightseeing", "activity"],
        },
        {
            "id": "Shibuya Crossing",
            "name": " Shibuya Crossing ",
            "short_label": " Shibuya ",
            "order_index": "1",
            "why_this_stop": " Kinetic start ",
            "facts": [" Famous crossing ", " Constant motion "],
            "facets": ["sightseeing", "shopping"],
        },
        {
            "id": "Shibuya Crossing",
            "name": " Senso-ji Temple ",
            "short_label": " Senso-ji ",
            "order_index": "2",
            "why_this_stop": " Historic contrast ",
            "facts": [" Old temple ", " Historic stalls "],
            "facets": ["sightseeing", "food"],
        },
    ]

    service = AyanaPrepService(client=FakeClient(payload))
    response = await service.prepare(AyanaPrepRequest(persona="adventure"))

    assert response.persona == "adventure"
    assert response.itineraries[0].id == "tokyo_adventure_01"
    assert [item.order_index for item in response.itineraries[0].landmarks] == [
        1,
        2,
        3,
    ]
    assert response.itineraries[0].landmarks[0].name == "Shibuya Crossing"
    assert response.itineraries[0].landmarks[1].id == "shibuya_crossing_2"


def test_prep_endpoint_returns_locked_shape():
    """Endpoint should return the typed prep response."""

    class FakeService:
        async def prepare(self, request: AyanaPrepRequest) -> AyanaPrepResponse:
            await asyncio.sleep(0)
            return AyanaPrepResponse.model_validate(build_valid_payload(request.persona))

    def override_service():
        return FakeService()

    backend_main.app.dependency_overrides[get_ayana_prep_service] = override_service
    client = TestClient(backend_main.app)

    response = client.post("/api/ayana/prep", json={"persona": "adventure"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["persona"] == "adventure"
    assert len(payload["itineraries"]) == 3
    assert payload["itineraries"][0]["city_name"] == "Tokyo"


def test_prep_endpoint_accepts_freeform_persona():
    """Endpoint should accept freeform persona strings."""

    class FakeService:
        async def prepare(self, request: AyanaPrepRequest) -> AyanaPrepResponse:
            await asyncio.sleep(0)
            return AyanaPrepResponse.model_validate(build_valid_payload(request.persona))

    def override_service():
        return FakeService()

    backend_main.app.dependency_overrides[get_ayana_prep_service] = override_service
    client = TestClient(backend_main.app)

    response = client.post("/api/ayana/prep", json={"persona": "party vibe"})

    assert response.status_code == 200
    assert response.json()["persona"] == "party vibe"


def test_prep_endpoint_maps_generation_failures_to_502():
    """Generation failures should surface as a gateway-style backend error."""

    class FailingService:
        async def prepare(self, _request: AyanaPrepRequest) -> AyanaPrepResponse:
            await asyncio.sleep(0)
            raise AyanaPrepGenerationError("bad payload")

    def override_service():
        return FailingService()

    backend_main.app.dependency_overrides[get_ayana_prep_service] = override_service
    client = TestClient(backend_main.app)

    response = client.post("/api/ayana/prep", json={"persona": "adventure"})

    assert response.status_code == 502
    assert response.json()["detail"] == "Ayana prep generation failed."


def test_live_routes_remain_registered():
    """Main app should still expose the existing root and websocket routes."""

    route_paths = {
        route.path
        for route in backend_main.app.routes
        if hasattr(route, "path")
    }

    assert "/" in route_paths
    assert "/ws/{user_id}/{session_id}" in route_paths
