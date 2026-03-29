"""Ayana orchestration tools exposed to the live agent."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from google.adk.tools import ToolContext

from ayana_orchestration import (
    build_frontend_action,
    build_tool_result,
    get_active_city_context,
    get_or_create_session_state,
    publish_tool_result,
    resolve_itinerary,
)


def _publish_result(session_id: str, result: dict[str, object]) -> None:
    """Fan tool results out to the app-level websocket channel."""
    publish_task = asyncio.create_task(publish_tool_result(session_id, result))
    publish_task.add_done_callback(lambda _: None)


def _is_first_landmark_move(session_id: str) -> bool:
    """Return True when this is the session's first landmark move."""
    session_state = get_or_create_session_state(session_id)
    return (
        session_state.visited_landmark_count == 0
        and session_state.current_landmark is None
    )


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
            "transition line about heading there, DO NOT describe the destination "
            "yet, and wait for the follow-up before continuing the experience. DO NOT USE WORDS LIKE WELCOME , JUST SOMETHING THATS TRANSITION IN NATURE LIKE LETS DIVE INTO"
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
    accepted_summary = (
        ""
        if _is_first_landmark_move(session_id)
        else (
            f"Ayana is guiding the journey toward {normalized_landmark_name} in "
            f"{city_name}, {country_name}. Say only one short transition line like "
            f"heading into {normalized_landmark_name}, do not describe the place "
            f"yet, and PLEASE wait for the follow-up for acutally describing {normalized_landmark_name}. DO NOT USE WORDS LIKE WELCOME , JUST SOMETHING THATS TRANSITION IN NATURE LIKE LETS DIVE INTO"
        )
    )
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
        summary=accepted_summary,
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


def show_nearby(
    category: str,
    tool_context: ToolContext,
) -> dict[str, object]:
    """Open nearby discovery for the active scene context."""
    session_id = tool_context.session.id
    active_city = get_active_city_context(session_id)
    session_state = get_or_create_session_state(session_id)
    job_id = str(uuid4())

    normalized_category = category.strip().lower()
    allowed_categories = {"food", "shopping", "activities"}
    if normalized_category not in allowed_categories:
        result = build_tool_result(
            status="failed",
            tool="show_nearby",
            summary=(
                "category must be one of: food, shopping, activities."
            ),
            job_id=job_id,
            payload={"category": category},
        )
        _publish_result(session_id, result)
        return result

    if active_city is None:
        result = build_tool_result(
            status="failed",
            tool="show_nearby",
            summary=(
                "No city is active yet. Choose an itinerary first, then open nearby "
                "discovery from the current city or landmark context."
            ),
            job_id=job_id,
            payload={"category": normalized_category},
        )
        _publish_result(session_id, result)
        return result

    current_landmark = session_state.current_landmark or {}
    landmark_name = str(current_landmark.get("landmark_name", "")).strip()
    city_name = str(active_city.get("city_name", "")).strip()
    country_name = str(active_city.get("country_name", "")).strip()
    anchor_label = landmark_name or city_name or "the current area"
    frontend_action = build_frontend_action(
        "ayana.show_nearby",
        "show_nearby",
        {
            "category": normalized_category,
            "city_name": city_name,
            "country_name": country_name,
            "landmark_name": landmark_name,
        },
        job_id=job_id,
    )

    result = build_tool_result(
        status="accepted",
        tool="show_nearby",
        summary=(
            f"Ayana is opening nearby {normalized_category} options around "
            f"{anchor_label}. Say only one short transition line about pulling up "
            "options nearby, do not name specific places yet, and wait for the "
            "follow-up before discussing the results."
        ),
        job_id=job_id,
        payload={
            "category": normalized_category,
            "city_name": city_name,
            "country_name": country_name,
            "landmark_name": landmark_name,
        },
        frontend_action=frontend_action,
    )
    _publish_result(session_id, result)
    return result


def _normalize_place_name_token(value: str) -> str:
    return value.strip().casefold()


def open_place_street_view(
    place_name: str,
    tool_context: ToolContext,
) -> dict[str, object]:
    """Open Google Street View for a place from the current nearby discovery set."""
    session_id = tool_context.session.id
    session_state = get_or_create_session_state(session_id)
    job_id = str(uuid4())

    normalized_query = place_name.strip()
    if not normalized_query:
        result = build_tool_result(
            status="failed",
            tool="open_place_street_view",
            summary="place_name must be a non-empty string.",
            job_id=job_id,
            payload={"place_name": place_name},
        )
        _publish_result(session_id, result)
        return result

    nearby = session_state.nearby_places
    if not nearby:
        result = build_tool_result(
            status="failed",
            tool="open_place_street_view",
            summary=(
                "No nearby discovery results are active. Call show_nearby first, "
                "then use an exact place name from that list."
            ),
            job_id=job_id,
            payload={"place_name": normalized_query},
        )
        _publish_result(session_id, result)
        return result

    token = _normalize_place_name_token(normalized_query)
    matched: dict[str, object] | None = None
    for entry in nearby:
        if not isinstance(entry, dict):
            continue
        raw_name = entry.get("name")
        if not isinstance(raw_name, str):
            continue
        if _normalize_place_name_token(raw_name) != token:
            continue
        matched = entry
        break

    if matched is None:
        result = build_tool_result(
            status="failed",
            tool="open_place_street_view",
            summary=(
                "That place name is not in the current nearby results. "
                "Use an exact name from the active nearby_places list "
                "(matching is case-insensitive after trimming)."
            ),
            job_id=job_id,
            payload={"place_name": normalized_query},
        )
        _publish_result(session_id, result)
        return result

    canonical_name = str(matched.get("name", "")).strip() or normalized_query
    frontend_action = build_frontend_action(
        "ayana.open_place_street_view",
        "open_place_street_view",
        {"place_name": canonical_name},
        job_id=job_id,
    )

    result = build_tool_result(
        status="accepted",
        tool="open_place_street_view",
        summary=(
            f"Ayana is opening Street View for {canonical_name}. Say only one short "
            "transition line about stepping into the street-level view, do not describe "
            "the scene yet, and wait for the follow-up before narrating what they see."
        ),
        job_id=job_id,
        payload={"place_name": canonical_name},
        frontend_action=frontend_action,
    )
    _publish_result(session_id, result)
    return result


def end_session(
    request_note: str = "",
    tool_context: ToolContext = None,
) -> dict[str, object]:
    """Start the frontend-driven recap transition and live session shutdown."""
    _ = request_note
    if tool_context is None:
        raise ValueError("tool_context is required for end_session.")
    session_id = tool_context.session.id
    job_id = str(uuid4())
    frontend_action = build_frontend_action(
        "ayana.end_session",
        "end_session",
        {},
        job_id=job_id,
    )

    result = build_tool_result(
        status="accepted",
        tool="end_session",
        summary=(
            "Ayana is wrapping the live journey. Say only one short closing transition "
            "line, do not keep guiding the trip, and wait for the follow-up before the "
            "session ends."
        ),
        job_id=job_id,
        frontend_action=frontend_action,
    )
    _publish_result(session_id, result)
    return result
