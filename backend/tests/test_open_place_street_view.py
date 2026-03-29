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
