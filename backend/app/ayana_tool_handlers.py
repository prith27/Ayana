"""Tool-specific orchestration handlers for ACK-driven Ayana flows."""

from __future__ import annotations

from typing import Any

from ayana_orchestration import (
    get_active_city_context,
    get_pending_job,
    mark_current_landmark,
    mark_nearby_places,
    mark_selected_itinerary,
    mark_street_view_opened,
    resolve_itinerary,
    resolve_selected_itinerary,
)

DEFAULT_CITY_LABEL = "this city"


def build_post_ack_followup(
    session_id: str, ack: dict[str, Any]
) -> str | None:
    """Return semantic follow-up text after a frontend ACK, if applicable."""
    action_type = ack.get("action_type")
    if ack.get("status") != "applied":
        return None

    if action_type == "ayana.choose_itinerary":
        return _build_choose_itinerary_followup(session_id, ack)
    if action_type == "ayana.move_to_landmark":
        return _build_move_to_landmark_followup(session_id, ack)
    if action_type == "ayana.show_nearby":
        return _build_show_nearby_followup(session_id, ack)
    if action_type == "ayana.open_place_street_view":
        return _build_open_place_street_view_followup(session_id, ack)
    return None


def _build_choose_itinerary_followup(
    session_id: str, ack: dict[str, Any]
) -> str | None:
    """Build post-ACK semantic guidance for itinerary selection."""

    ack_payload = ack.get("payload")
    if not isinstance(ack_payload, dict):
        return None

    itinerary_id = ack_payload.get("itinerary_id")
    if not isinstance(itinerary_id, str) or not itinerary_id:
        return None

    itinerary = resolve_itinerary(session_id, itinerary_id)
    if itinerary is None:
        return None

    mark_selected_itinerary(session_id, itinerary=itinerary)

    city_name = itinerary.get("city_name", DEFAULT_CITY_LABEL)
    country_name = itinerary.get("country_name", "")
    title = itinerary.get("title", "")
    landmark_names = [
        landmark.get("name")
        for landmark in itinerary.get("landmarks", [])
        if isinstance(landmark, dict) and isinstance(landmark.get("name"), str)
    ]
    pending_job = get_pending_job(session_id, ack["job_id"]) or {}
    screenshot_note = (
        "You have received a fresh frontend image for grounding. "
        if pending_job.get("image_sent")
        else ""
    )
    landmark_grounding = (
        "Suggested landmarks for the next beats: "
        + ", ".join(landmark_names[:4])
        + "."
        if landmark_names
        else ""
    )

    return (
        f"{screenshot_note}The transition into {city_name}, {country_name} is now "
        f"visibly complete. Continue as Ayana with a grounded introduction to "
        f"the city, anchor the tone around '{title}', and naturally suggest the "
        f"user can continue with nearby landmarks or let you guide the journey. "
        f"{landmark_grounding}"
    ).strip()


def _build_move_to_landmark_followup(
    session_id: str, ack: dict[str, Any]
) -> str | None:
    """Build post-ACK semantic guidance for landmark movement."""
    ack_payload = ack.get("payload")
    if not isinstance(ack_payload, dict):
        return None

    landmark_name = ack_payload.get("landmark_name")
    if not isinstance(landmark_name, str) or not landmark_name:
        return None

    active_city = get_active_city_context(session_id)
    if active_city is None:
        return None

    city_name = _string_from_ack_or_context(
        ack_payload,
        active_city,
        "city_name",
        default=DEFAULT_CITY_LABEL,
    )
    country_name = _string_from_ack_or_context(
        ack_payload,
        active_city,
        "country_name",
        default="this country",
    )

    itinerary = resolve_selected_itinerary(session_id)
    matched_landmark = _find_matching_landmark(itinerary, landmark_name)

    mark_current_landmark(session_id, landmark=ack_payload)

    screenshot_note = _build_screenshot_note(session_id, ack)
    grounding_suffix = _build_landmark_grounding_suffix(matched_landmark)

    return (
        f"{screenshot_note}The arrival at {landmark_name} in {city_name}, "
        f"{country_name} is now visibly complete. Continue as Ayana with a "
        "grounded explanation of what the user is seeing, share one or two vivid "
        "details about this landmark, and naturally offer the next exploration beat "
        "within the same city context."
        f"{grounding_suffix}"
    ).strip()


def _build_show_nearby_followup(
    session_id: str, ack: dict[str, Any]
) -> str | None:
    """Build post-ACK semantic guidance for nearby discovery."""
    ack_payload = ack.get("payload")
    if not isinstance(ack_payload, dict):
        return None

    category = ack_payload.get("category")
    if not isinstance(category, str) or not category.strip():
        return None

    raw_places = ack_payload.get("places", [])
    if not isinstance(raw_places, list):
        return None

    places = [place for place in raw_places if isinstance(place, dict)]
    mark_nearby_places(
        session_id,
        category=category.strip(),
        places=places,
    )

    active_city = get_active_city_context(session_id)
    city_name = _string_from_ack_or_context(
        ack_payload,
        active_city or {},
        "city_name",
        default=DEFAULT_CITY_LABEL,
    )
    landmark_name = str(ack_payload.get("landmark_name", "")).strip()
    screenshot_note = _build_screenshot_note(session_id, ack)

    if not places:
        return (
            f"{screenshot_note}The nearby {category.strip()} sidebar is now visibly "
            f"open around {landmark_name or city_name}, but no strong options were "
            "returned. Continue as Ayana by acknowledging that nothing compelling is "
            "showing right here and ask whether the user wants a different category "
            "or a different nearby area."
        ).strip()

    place_names = _extract_place_names(places)
    place_summary = ", ".join(place_names[:3])
    return (
        f"{screenshot_note}The nearby {category.strip()} sidebar is now visibly open "
        f"around {landmark_name or city_name}. The returned options include "
        f"{place_summary}. Continue as Ayana by briefly grounding the user in these "
        "visible options, mention concrete details like rating, reviews, type, or "
        "address when helpful, and ask which of these places they would like to "
        "explore next."
    ).strip()


def _build_open_place_street_view_followup(
    session_id: str, ack: dict[str, Any]
) -> str | None:
    """Build post-ACK guidance after Street View opens successfully."""
    ack_payload = ack.get("payload")
    if not isinstance(ack_payload, dict):
        return None

    place_name = ack_payload.get("place_name")
    if not isinstance(place_name, str) or not place_name.strip():
        return None

    lat = ack_payload.get("lat")
    lng = ack_payload.get("lng")
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return None

    mark_street_view_opened(
        session_id,
        place=dict(ack_payload),
    )

    screenshot_note = _build_screenshot_note(session_id, ack)
    category = str(ack_payload.get("category", "")).strip()
    address = str(ack_payload.get("address", "")).strip()

    detail_bits: list[str] = []
    if category:
        detail_bits.append(f"Category context: {category}.")
    if address:
        detail_bits.append(f"Address on record: {address}.")
    detail_suffix = f" {' '.join(detail_bits)}" if detail_bits else ""

    return (
        f"{screenshot_note}Street View for {place_name.strip()} is now visibly open. "
        f"Continue as Ayana with a grounded, immersive reaction to what the user sees "
        f"in this panorama—reference the scene naturally and offer a sensible next beat "
        f"(nearby stop, different angle, or back to the map) without inventing coverage "
        f"that is not there.{detail_suffix}"
    ).strip()


def _string_from_ack_or_context(
    ack_payload: dict[str, Any],
    active_city: dict[str, Any],
    field_name: str,
    *,
    default: str,
) -> str:
    """Resolve a string from ACK payload first, then active city context."""
    raw_value = ack_payload.get(field_name)
    if isinstance(raw_value, str) and raw_value.strip():
        return raw_value.strip()
    return str(active_city.get(field_name, "")).strip() or default


def _find_matching_landmark(
    itinerary: dict[str, Any] | None,
    landmark_name: str,
) -> dict[str, Any] | None:
    """Return the matched itinerary landmark when the name aligns."""
    if itinerary is None:
        return None

    normalized_name = landmark_name.strip().lower()
    for landmark in itinerary.get("landmarks", []):
        if not isinstance(landmark, dict):
            continue
        candidate_name = landmark.get("name")
        if (
            isinstance(candidate_name, str)
            and candidate_name.strip().lower() == normalized_name
        ):
            return landmark
    return None


def _build_screenshot_note(
    session_id: str, ack: dict[str, Any]
) -> str:
    """Return the image-grounding note when a screenshot arrived."""
    pending_job = get_pending_job(session_id, ack["job_id"]) or {}
    if pending_job.get("image_sent"):
        return "You have received a fresh frontend image for grounding. "
    return ""


def _build_landmark_grounding_suffix(
    matched_landmark: dict[str, Any] | None,
) -> str:
    """Return optional itinerary-grounded context for landmark narration."""
    if not isinstance(matched_landmark, dict):
        return ""

    why_this_stop = str(matched_landmark.get("why_this_stop", "")).strip()
    landmark_facts = [
        fact.strip()
        for fact in matched_landmark.get("facts", [])
        if isinstance(fact, str) and fact.strip()
    ]

    grounding_bits: list[str] = []
    if why_this_stop:
        grounding_bits.append(f"Why this stop matters: {why_this_stop}.")
    if landmark_facts:
        grounding_bits.append("Useful grounding: " + " ".join(landmark_facts[:2]))
    if not grounding_bits:
        return ""
    return f" {' '.join(grounding_bits)}"


def _extract_place_names(places: list[dict[str, Any]]) -> list[str]:
    """Return displayable nearby place names from ACK payload data."""
    names: list[str] = []
    for place in places:
        place_name = place.get("name")
        if isinstance(place_name, str) and place_name.strip():
            names.append(place_name.strip())
    return names
