"""Ayana orchestration tools exposed to the live agent."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from google.adk.tools import ToolContext

from ayana_orchestration import (
    build_frontend_action,
    build_tool_result,
    get_active_city_context,
    publish_tool_result,
    resolve_itinerary,
)


def _publish_result(session_id: str, result: dict[str, object]) -> None:
    """Fan tool results out to the app-level websocket channel."""
    publish_task = asyncio.create_task(publish_tool_result(session_id, result))
    publish_task.add_done_callback(lambda _: None)


def choose_itinerary(
    itinerary_id: str,
    overlay_preset: str,
    tagline: str,
    tool_context: ToolContext,
) -> dict[str, object]:
    """Start the visible transition into one of the generated itinerary cities."""
    session_id = tool_context.session.id
    itinerary = resolve_itinerary(session_id, itinerary_id)
    job_id = str(uuid4())

    if itinerary is None:
        result = build_tool_result(
            status="failed",
            tool="choose_itinerary",
            summary=(
                f"Unknown itinerary_id '{itinerary_id}'. Use one of the generated "
                "itinerary ids already provided in this session."
            ),
            job_id=job_id,
            payload={"itinerary_id": itinerary_id},
        )
        _publish_result(session_id, result)
        return result

    city_name = str(itinerary.get("city_name", "")).strip()
    country_name = str(itinerary.get("country_name", "")).strip()
    frontend_action = build_frontend_action(
        "ayana.choose_itinerary",
        "choose_itinerary",
        {
            "itinerary_id": itinerary_id,
            "city_name": city_name,
            "country_name": country_name,
            "overlay_preset": overlay_preset,
            "tagline": tagline,
        },
        job_id=job_id,
    )

    result = build_tool_result(
        status="accepted",
        tool="choose_itinerary",
        summary=(
            f"Ayana is moving into {city_name}, {country_name}. Say only one short "
            "transition line about heading there, do not describe the destination "
            "yet, and wait for the follow-up before continuing the experience. DONT SAY ANYTHING LIKE WELCOME , JUST SOMETHING THATS TRANSITION IN NATURE LIKE LETS DIVE INTO"
        ),
        job_id=job_id,
        payload={
            "itinerary_id": itinerary_id,
            "city_name": city_name,
            "country_name": country_name,
            "overlay_preset": overlay_preset,
            "tagline": tagline,
        },
        frontend_action=frontend_action,
    )
    _publish_result(session_id, result)
    return result


def move_to_landmark(
    landmark_name: str,
    overlay_preset: str,
    tagline: str,
    tool_context: ToolContext,
) -> dict[str, object]:
    """Start the visible transition into a landmark within the active city context."""
    session_id = tool_context.session.id
    active_city = get_active_city_context(session_id)
    job_id = str(uuid4())

    normalized_landmark_name = landmark_name.strip()
    if not normalized_landmark_name:
        result = build_tool_result(
            status="failed",
            tool="move_to_landmark",
            summary="landmark_name must be a non-empty string.",
            job_id=job_id,
            payload={"landmark_name": landmark_name},
        )
        _publish_result(session_id, result)
        return result

    if active_city is None:
        result = build_tool_result(
            status="failed",
            tool="move_to_landmark",
            summary=(
                "No city is active yet. Choose an itinerary first, then move to a "
                "landmark inside that city context."
            ),
            job_id=job_id,
            payload={"landmark_name": normalized_landmark_name},
        )
        _publish_result(session_id, result)
        return result

    itinerary_id = str(active_city.get("itinerary_id", "")).strip()
    city_name = str(active_city.get("city_name", "")).strip()
    country_name = str(active_city.get("country_name", "")).strip()
    frontend_action = build_frontend_action(
        "ayana.move_to_landmark",
        "move_to_landmark",
        {
            "itinerary_id": itinerary_id,
            "city_name": city_name,
            "country_name": country_name,
            "landmark_name": normalized_landmark_name,
            "overlay_preset": overlay_preset,
            "tagline": tagline,
        },
        job_id=job_id,
    )

    result = build_tool_result(
        status="accepted",
        tool="move_to_landmark",
        summary=(
            f"Ayana is guiding the journey toward {normalized_landmark_name} in "
            f"{city_name}, {country_name}. Say only one short transition line like "
            f"heading into {normalized_landmark_name}, do not describe the place "
            "yet, and wait for the follow-up before describing arrival. DONT SAY ANYTHING LIKE WELCOME , JUST SOMETHING THATS TRANSITION IN NATURE LIKE LETS DIVE INTO"
        ),
        job_id=job_id,
        payload={
            "itinerary_id": itinerary_id,
            "city_name": city_name,
            "country_name": country_name,
            "landmark_name": normalized_landmark_name,
            "overlay_preset": overlay_preset,
            "tagline": tagline,
        },
        frontend_action=frontend_action,
    )
    _publish_result(session_id, result)
    return result
