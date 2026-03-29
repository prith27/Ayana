"""Ayana orchestration transport helpers and in-memory session state."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict, dataclass, field
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)


ToolStatus = str
FrontendAckStatus = str


@dataclass
class AyanaSessionState:
    """Lightweight session-director state for orchestration phases."""

    persona: str | None = None
    generated_itineraries: list[dict[str, Any]] = field(default_factory=list)
    selected_itinerary_id: str | None = None
    current_city: dict[str, Any] | None = None
    current_landmark: dict[str, Any] | None = None
    nearby_places: list[dict[str, Any]] = field(default_factory=list)
    nearby_category: str | None = None
    sidebar_visible: bool = False
    street_view_visible: bool = False
    current_street_view_place: dict[str, Any] | None = None
    visited_landmark_names: list[str] = field(default_factory=list)
    visited_landmark_count: int = 0
    wrap_checkpoint_offered: bool = False
    session_ending: bool = False
    pending_jobs: dict[str, dict[str, Any]] = field(default_factory=dict)


_SESSION_STATE: dict[str, AyanaSessionState] = {}
_RESULT_QUEUES: dict[str, asyncio.Queue[dict[str, Any]]] = {}
_PREP_CONTEXTS: dict[str, dict[str, Any]] = {}


def get_or_create_session_state(session_id: str) -> AyanaSessionState:
    """Return the orchestration state for a session."""
    state = _SESSION_STATE.get(session_id)
    if state is None:
        state = AyanaSessionState()
        _SESSION_STATE[session_id] = state
    return state


def register_result_queue(
    session_id: str, result_queue: asyncio.Queue[dict[str, Any]]
) -> None:
    """Register the active result queue for a websocket session."""
    _RESULT_QUEUES[session_id] = result_queue


def unregister_result_queue(session_id: str) -> None:
    """Remove the active result queue for a websocket session."""
    _RESULT_QUEUES.pop(session_id, None)


async def publish_tool_result(session_id: str, result: dict[str, Any]) -> None:
    """Publish a tool result to the session-specific queue if available."""
    queue = _RESULT_QUEUES.get(session_id)
    if queue is None:
        logger.warning(
            "No result queue registered for session_id=%s; dropping tool result",
            session_id,
        )
        return
    await queue.put(result)


def build_tool_result(
    *,
    status: ToolStatus,
    tool: str,
    summary: str,
    job_id: str,
    payload: dict[str, Any] | None = None,
    frontend_action: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the shared internal tool result envelope."""
    result: dict[str, Any] = {
        "status": status,
        "tool": tool,
        "job": {"id": job_id},
        "summary": summary,
    }
    if payload is not None:
        result["payload"] = payload
    if frontend_action is not None:
        result["frontend_action"] = frontend_action
    return result


def build_tool_result_message(result: dict[str, Any]) -> dict[str, Any]:
    """Wrap a tool result in the websocket app-level message envelope."""
    return {"type": "tool_result", "result": result}


def build_frontend_action(
    action_type: str,
    source_tool: str,
    payload: dict[str, Any],
    *,
    job_id: str,
) -> dict[str, Any]:
    """Build the shared internal frontend action envelope."""
    return {
        "action_type": action_type,
        "source_tool": source_tool,
        "job_id": job_id,
        "payload": payload,
    }


def build_frontend_action_message(action: dict[str, Any]) -> dict[str, Any]:
    """Wrap a frontend action in the websocket app-level message envelope."""
    return {"type": "frontend_action", "action": action}


def extract_frontend_action(payload: dict[str, Any]) -> dict[str, Any] | None:
    """Extract an embedded frontend_action from a result envelope."""
    frontend_action = payload.get("frontend_action")
    if isinstance(frontend_action, dict):
        return frontend_action
    return None


def normalize_frontend_ack(raw_ack: Any) -> dict[str, Any] | None:
    """Validate and normalize frontend acknowledgement payloads."""
    if not isinstance(raw_ack, dict):
        return None

    status = raw_ack.get("status")
    action_type = raw_ack.get("action_type")
    source_tool = raw_ack.get("source_tool")
    job_id = raw_ack.get("job_id")
    summary = raw_ack.get("summary")
    payload = raw_ack.get("payload")

    if not all(isinstance(value, str) and value for value in (
        status,
        action_type,
        source_tool,
        job_id,
        summary,
    )):
        return None

    normalized: dict[str, Any] = {
        "status": status,
        "action_type": action_type,
        "source_tool": source_tool,
        "job_id": job_id,
        "summary": summary,
    }
    if isinstance(payload, dict):
        normalized["payload"] = payload
    return normalized


def apply_frontend_ack(session_id: str, ack: dict[str, Any]) -> None:
    """Persist the latest ACK outcome against the matching pending job."""
    state = get_or_create_session_state(session_id)
    pending_job = state.pending_jobs.setdefault(ack["job_id"], {})
    pending_job["ack"] = ack
    pending_job["status"] = ack["status"]
    pending_job["action_type"] = ack["action_type"]
    pending_job["source_tool"] = ack["source_tool"]
    pending_job["summary"] = ack["summary"]
    if "payload" in ack:
        previous_payload = pending_job.get("payload")
        if isinstance(previous_payload, dict) and isinstance(ack["payload"], dict):
            pending_job["payload"] = {
                **previous_payload,
                **ack["payload"],
            }
        else:
            pending_job["payload"] = ack["payload"]


def record_image_for_job(
    session_id: str,
    job_id: str,
    *,
    mime_type: str,
) -> None:
    """Mark that a correlated screenshot/image arrived for a pending job."""
    state = get_or_create_session_state(session_id)
    pending_job = state.pending_jobs.setdefault(job_id, {})
    pending_job["image_sent"] = True
    pending_job["image_mime_type"] = mime_type


def register_pending_job(
    session_id: str,
    *,
    job_id: str,
    tool: str,
    status: ToolStatus,
    action_type: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    """Create or update lightweight metadata for an in-flight tool job."""
    state = get_or_create_session_state(session_id)
    pending_job = state.pending_jobs.setdefault(job_id, {})
    pending_job["tool"] = tool
    pending_job["status"] = status
    if action_type is not None:
        pending_job["action_type"] = action_type
    if payload is not None:
        pending_job["payload"] = payload
    pending_job.setdefault("image_sent", False)


def serialize_session_state(session_id: str) -> dict[str, Any]:
    """Return the current session-director state as a plain dictionary."""
    return asdict(get_or_create_session_state(session_id))


def sync_prep_state(
    session_id: str,
    *,
    persona: str | None,
    generated_itineraries: list[dict[str, Any]],
) -> None:
    """Sync prep-generated itinerary state into the orchestration store."""
    state = get_or_create_session_state(session_id)
    state.persona = persona
    state.generated_itineraries = generated_itineraries


def register_prep_context(
    *,
    persona: str | None,
    generated_itineraries: list[dict[str, Any]],
) -> str:
    """Persist prep grounding and return a stable prep id."""
    prep_id = str(uuid4())
    _PREP_CONTEXTS[prep_id] = {
        "persona": persona,
        "generated_itineraries": generated_itineraries,
    }
    return prep_id


def hydrate_session_from_prep(
    session_id: str,
    prep_id: str,
) -> bool:
    """Seed a live session from a previously generated prep context."""
    prep_context = _PREP_CONTEXTS.get(prep_id)
    if prep_context is None:
        return False
    sync_prep_state(
        session_id,
        persona=prep_context.get("persona"),
        generated_itineraries=prep_context.get("generated_itineraries", []),
    )
    return True


def resolve_itinerary(
    session_id: str, itinerary_id: str
) -> dict[str, Any] | None:
    """Return a generated itinerary by id for the current session."""
    state = get_or_create_session_state(session_id)
    for itinerary in state.generated_itineraries:
        if itinerary.get("id") == itinerary_id:
            return itinerary
    return None


def resolve_selected_itinerary(session_id: str) -> dict[str, Any] | None:
    """Return the currently selected itinerary, if one has been ACK-confirmed."""
    state = get_or_create_session_state(session_id)
    selected_itinerary_id = state.selected_itinerary_id
    if not selected_itinerary_id:
        return None
    return resolve_itinerary(session_id, selected_itinerary_id)


def get_active_city_context(session_id: str) -> dict[str, Any] | None:
    """Return the current active city context after city arrival is confirmed."""
    state = get_or_create_session_state(session_id)
    if not state.current_city:
        return None
    return dict(state.current_city)


def mark_selected_itinerary(
    session_id: str,
    *,
    itinerary: dict[str, Any],
) -> None:
    """Persist the active itinerary and current city after visible completion."""
    state = get_or_create_session_state(session_id)
    state.selected_itinerary_id = itinerary.get("id")
    state.current_city = {
        "itinerary_id": itinerary.get("id"),
        "city_name": itinerary.get("city_name"),
        "country_name": itinerary.get("country_name"),
        "title": itinerary.get("title"),
    }
    state.current_landmark = None
    state.nearby_places = []
    state.nearby_category = None
    state.sidebar_visible = False
    state.street_view_visible = False
    state.current_street_view_place = None
    state.visited_landmark_names = []
    state.visited_landmark_count = 0
    state.wrap_checkpoint_offered = False
    state.session_ending = False


def mark_current_landmark(
    session_id: str,
    *,
    landmark: dict[str, Any],
) -> None:
    """Persist the active landmark after visible landmark arrival is confirmed."""
    state = get_or_create_session_state(session_id)
    itinerary_id = landmark.get("itinerary_id")
    if isinstance(itinerary_id, str) and itinerary_id:
        state.selected_itinerary_id = itinerary_id
    state.current_landmark = {
        "itinerary_id": itinerary_id,
        "city_name": landmark.get("city_name"),
        "country_name": landmark.get("country_name"),
        "landmark_name": landmark.get("landmark_name"),
        "formatted_address": landmark.get("formatted_address"),
        "lat": landmark.get("lat"),
        "lng": landmark.get("lng"),
        "overlay_preset": landmark.get("overlay_preset"),
        "tagline": landmark.get("tagline"),
    }
    state.nearby_places = []
    state.nearby_category = None
    state.sidebar_visible = False
    state.street_view_visible = False
    state.current_street_view_place = None
    state.session_ending = False

    landmark_name = str(landmark.get("landmark_name", "")).strip()
    landmark_token = _normalize_landmark_token(landmark_name)
    if landmark_token and all(
        _normalize_landmark_token(name) != landmark_token
        for name in state.visited_landmark_names
    ):
        state.visited_landmark_names.append(landmark_name)
        state.visited_landmark_count = len(state.visited_landmark_names)


def mark_nearby_places(
    session_id: str,
    *,
    category: str,
    places: list[dict[str, Any]],
) -> None:
    """Persist the current nearby discovery result set after visible completion."""
    state = get_or_create_session_state(session_id)
    state.nearby_category = category
    state.nearby_places = places
    state.sidebar_visible = True
    state.street_view_visible = False
    state.current_street_view_place = None


def mark_street_view_opened(
    session_id: str,
    *,
    place: dict[str, Any],
) -> None:
    """Persist Street View immersion after the frontend ACK confirms visible entry."""
    state = get_or_create_session_state(session_id)
    state.current_street_view_place = place
    state.street_view_visible = True
    state.sidebar_visible = False


def mark_wrap_checkpoint_offered(session_id: str) -> None:
    """Record that the post-third-landmark wrap checkpoint was surfaced."""
    state = get_or_create_session_state(session_id)
    state.wrap_checkpoint_offered = True


def should_offer_wrap_checkpoint(session_id: str) -> bool:
    """Return whether Ayana should offer the 3-landmark wrap checkpoint now."""
    state = get_or_create_session_state(session_id)
    return (
        state.visited_landmark_count >= 3
        and not state.wrap_checkpoint_offered
        and not state.session_ending
    )


def mark_session_ending(session_id: str) -> None:
    """Persist that the current session has entered an intentional ending flow."""
    state = get_or_create_session_state(session_id)
    state.session_ending = True


def get_pending_job(
    session_id: str, job_id: str
) -> dict[str, Any] | None:
    """Return pending job metadata if present."""
    state = get_or_create_session_state(session_id)
    return state.pending_jobs.get(job_id)


def _normalize_landmark_token(value: str) -> str:
    """Normalize landmark names for session-level visit tracking."""
    return value.strip().casefold()
