"""Tests for Street View orchestration state and post-ACK handling."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_APP_DIR = Path(__file__).resolve().parents[1] / "app"
if str(BACKEND_APP_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_APP_DIR))

from ayana_orchestration import (  # noqa: E402
    get_or_create_session_state,
    mark_nearby_places,
    mark_selected_itinerary,
    sync_prep_state,
)
from ayana_tool_handlers import build_post_ack_followup  # noqa: E402


def test_post_ack_street_view_marks_state_and_followup() -> None:
    sid = "test-session-sv-ack"
    mark_nearby_places(
        sid,
        category="food",
        places=[{"name": "Café Test", "lat": 10.0, "lng": 20.0}],
    )
    msg = build_post_ack_followup(
        sid,
        {
            "status": "applied",
            "action_type": "ayana.open_place_street_view",
            "job_id": "job-sv-1",
            "payload": {
                "category": "food",
                "location_name": "Kyoto",
                "location_sub": "Japan",
                "place_name": "Café Test",
                "address": "1 Main St",
                "rating": 4.2,
                "user_rating_count": 9,
                "types": ["cafe"],
                "lat": 10.0,
                "lng": 20.0,
            },
        },
    )
    assert msg is not None
    assert "Street View" in msg
    assert "Café Test" in msg
    state = get_or_create_session_state(sid)
    assert state.street_view_visible is True
    assert state.sidebar_visible is False
    assert state.nearby_places  # preserved from show_nearby


def test_post_ack_street_view_failed_does_not_mutate_visible_state() -> None:
    sid = "test-session-sv-fail"
    mark_nearby_places(
        sid,
        category="food",
        places=[{"name": "Café Test", "lat": 10.0, "lng": 20.0}],
    )
    state_before = get_or_create_session_state(sid)
    assert state_before.street_view_visible is False
    assert state_before.sidebar_visible is True

    msg = build_post_ack_followup(
        sid,
        {
            "status": "failed",
            "action_type": "ayana.open_place_street_view",
            "job_id": "job-sv-2",
            "summary": "No Street View coverage at this location",
        },
    )
    assert msg is None
    state_after = get_or_create_session_state(sid)
    assert state_after.street_view_visible is False
    assert state_after.sidebar_visible is True


def test_choose_itinerary_followup_guides_into_first_landmark() -> None:
    sid = "test-session-guided-city"
    itinerary = {
        "id": "kyoto_food_01",
        "city_name": "Kyoto",
        "country_name": "Japan",
        "title": "Lanterns and Late Bites",
        "landmarks": [
            {"name": "Fushimi Inari Shrine"},
            {"name": "Gion"},
        ],
    }
    sync_prep_state(
        sid,
        persona="foodie",
        generated_itineraries=[itinerary],
    )

    msg = build_post_ack_followup(
        sid,
        {
            "status": "applied",
            "action_type": "ayana.choose_itinerary",
            "job_id": "job-city-1",
            "payload": {
                "itinerary_id": "kyoto_food_01",
                "city_name": "Kyoto",
                "country_name": "Japan",
            },
        },
    )

    assert msg is not None
    assert "move_to_landmark" in msg
    assert "Fushimi Inari Shrine" in msg


def test_move_to_landmark_followup_becomes_interactive() -> None:
    sid = "test-session-guided-landmark"
    itinerary = {
        "id": "kyoto_food_01",
        "city_name": "Kyoto",
        "country_name": "Japan",
        "title": "Lanterns and Late Bites",
        "landmarks": [
            {
                "name": "Fushimi Inari Shrine",
                "why_this_stop": "It sets the tone for the city.",
                "facts": ["The torii path winds up the mountain."],
            },
            {"name": "Gion"},
        ],
    }
    sync_prep_state(
        sid,
        persona="foodie",
        generated_itineraries=[itinerary],
    )
    mark_selected_itinerary(sid, itinerary=itinerary)

    msg = build_post_ack_followup(
        sid,
        {
            "status": "applied",
            "action_type": "ayana.move_to_landmark",
            "job_id": "job-landmark-1",
            "payload": {
                "itinerary_id": "kyoto_food_01",
                "city_name": "Kyoto",
                "country_name": "Japan",
                "landmark_name": "Fushimi Inari Shrine",
                "formatted_address": "Kyoto, Japan",
                "lat": 35.0,
                "lng": 135.0,
                "overlay_preset": "heritage",
                "tagline": "A mountain of gates",
            },
        },
    )

    assert msg is not None
    assert "food, activities, shopping" in msg
    assert "Gion" in msg
    assert "Why this stop matters" in msg


def test_third_landmark_followup_offers_wrap_checkpoint_once() -> None:
    sid = "test-session-wrap-checkpoint"
    itinerary = {
        "id": "kyoto_wrap_01",
        "city_name": "Kyoto",
        "country_name": "Japan",
        "title": "Kyoto Highlights",
        "landmarks": [
            {"name": "Fushimi Inari Shrine"},
            {"name": "Gion"},
            {"name": "Kiyomizu-dera Temple"},
            {"name": "Arashiyama Bamboo Grove"},
        ],
    }
    sync_prep_state(
        sid,
        persona="peaceful",
        generated_itineraries=[itinerary],
    )
    mark_selected_itinerary(sid, itinerary=itinerary)

    for index, landmark_name in enumerate(
        ["Fushimi Inari Shrine", "Gion", "Kiyomizu-dera Temple"],
        start=1,
    ):
        msg = build_post_ack_followup(
            sid,
            {
                "status": "applied",
                "action_type": "ayana.move_to_landmark",
                "job_id": f"job-wrap-{index}",
                "payload": {
                    "itinerary_id": "kyoto_wrap_01",
                    "city_name": "Kyoto",
                    "country_name": "Japan",
                    "landmark_name": landmark_name,
                    "formatted_address": "Kyoto, Japan",
                    "lat": 35.0 + index,
                    "lng": 135.0 + index,
                    "overlay_preset": "heritage",
                    "tagline": landmark_name,
                },
            },
        )

    assert msg is not None
    assert "visited three landmarks" in msg
    assert "end here and see their recap" in msg
    state = get_or_create_session_state(sid)
    assert state.visited_landmark_count == 3
    assert state.wrap_checkpoint_offered is True

    msg_again = build_post_ack_followup(
        sid,
        {
            "status": "applied",
            "action_type": "ayana.move_to_landmark",
            "job_id": "job-wrap-4",
            "payload": {
                "itinerary_id": "kyoto_wrap_01",
                "city_name": "Kyoto",
                "country_name": "Japan",
                "landmark_name": "Arashiyama Bamboo Grove",
                "formatted_address": "Kyoto, Japan",
                "lat": 39.0,
                "lng": 139.0,
                "overlay_preset": "nature",
                "tagline": "Bamboo",
            },
        },
    )
    assert msg_again is not None
    assert "visited three landmarks" not in msg_again


def test_end_session_followup_marks_session_ending() -> None:
    sid = "test-session-end"
    msg = build_post_ack_followup(
        sid,
        {
            "status": "applied",
            "action_type": "ayana.end_session",
            "job_id": "job-end-1",
            "summary": "Ayana session ended and recap is opening.",
        },
    )
    assert msg is None
    state = get_or_create_session_state(sid)
    assert state.session_ending is True
