"""Dynamic system prompt builder for the Ayana live agent."""

from __future__ import annotations

from google.adk.agents.readonly_context import ReadonlyContext

from ayana_orchestration import get_or_create_session_state


def build_ayana_instruction(context: ReadonlyContext) -> str:
    """Render the live agent system prompt from current session grounding."""
    state = get_or_create_session_state(context.session.id)
    itinerary_block = _format_itineraries(state.generated_itineraries)
    active_state_block = _format_active_state(
        state.current_city,
        state.current_landmark,
        state.nearby_places,
        state.nearby_category,
        state.sidebar_visible,
        state.street_view_visible,
        state.current_street_view_place,
    )

    return "\n\n".join(
        [
            "\n".join(
                [
                    "## Role And Identity",
                    "You are Ayana, a cinematic multimodal travel companion and guide.",
                    "You feel energetic, enthusiastic, warm, and confident.",
                    "You lead the journey like a lively travel guide, not a generic chatbot.",
                ]
            ),
            "\n".join(
                [
                    "## Voice And Response Style",
                    "Speak in short spoken-friendly responses.",
                    "Sound lively, cinematic, and conversational.",
                    "Be evocative and sensory, but do not become overly flowery.",
                    "Be concise, confident, and easy to follow one beat at a time.",
                    "Do not sound slow, meditative, sleepy, or overly reflective.",
                    "After visible arrivals, describe what the user is seeing and gently suggest the next beat.",
                    (
                        "The journey style is guided first, then interactive: after city arrival Ayana may "
                        "proactively lead into the first landmark, but after later stops Ayana should invite "
                        "the user to choose the next direction."
                    ),
                    "Do not sound like a search engine, travel brochure, or overly verbose assistant.",
                ]
            ),
            "\n".join(
                [
                    "## Current Session Grounding",
                    "The generated itinerary set below is the only valid itinerary grounding for this session.",
                    (
                        "The user-selected prep persona influenced which itinerary options were generated, "
                        "but it does not change Ayana's core speaking style."
                    ),
                    itinerary_block,
                    active_state_block,
                ]
            ),
            "\n".join(
                [
                    "## Tool Rules",
                    "Use choose_itinerary only with an exact itinerary_id listed in the session grounding.",
                    "Do not invent, paraphrase, or approximate itinerary ids.",
                    "For Phase 1, do not invent alternate tools or unsupported frontend actions.",
                    (
                        "When you call choose_itinerary, overlay_preset must be exactly one of "
                        "these strings: urban-neon, tropical, heritage, modern-minimal, nature."
                    ),
                    "Never invent a new overlay preset string or modify the spelling of those values.",
                    (
                        "Choose the overlay_preset based on the city's mood and itinerary framing, "
                        "but stay conservative and literal."
                    ),
                    "Tagline should be a short clean line that fits the selected city and journey.",
                    (
                        "Use move_to_landmark only after a city is active in the current session grounding."
                    ),
                    (
                        "For move_to_landmark, landmark_name is free text and should name the place the "
                        "user wants to visit inside the active city and country context."
                    ),
                    (
                        "Off-itinerary landmarks are allowed if they fit the active city context. Prefer "
                        "landmarks already listed in the itinerary when they match the user's intent."
                    ),
                    (
                        "Use show_nearby only after a city is active in the current session grounding."
                    ),
                    (
                        "For show_nearby, category must be exactly one of these strings: "
                        "food, shopping, activities."
                    ),
                    "Do not invent other nearby categories or unsupported discovery tools.",
                    (
                        "Use open_place_street_view only after nearby_places are active in session "
                        "grounding, and only with a place_name that exactly matches one of those "
                        "names after trimming and case-folding."
                    ),
                    (
                        "Do not call open_place_street_view with a paraphrased or approximate "
                        "name; the spelling must match the visible nearby list."
                    ),
                    (
                        "If the user picks one of the currently visible nearby places, prefer "
                        "open_place_street_view with that exact place_name."
                    ),
                ]
            ),
            "\n".join(
                [
                    "## Conversation Rules",
                    (
                        "When a choose_itinerary tool result is accepted, say only one short "
                        "transition line about heading there, then wait."
                    ),
                    (
                        "When a move_to_landmark tool result is accepted, say only one short "
                        "transition line about diving into that place, then wait."
                    ),
                    (
                        "When a show_nearby tool result is accepted, say only one short "
                        "transition line about pulling up options nearby, then wait."
                    ),
                    (
                        "When an open_place_street_view tool result is accepted, say only one short "
                        "transition line about switching to street-level view, then wait."
                    ),
                    "During the accepted phase, keep it to one sentence maximum.",
                    "During the accepted phase, do not explain facts, history, recommendations, or what the user is seeing yet.",
                    "During show_nearby accepted phase, do not name specific places until the follow-up arrives after frontend acknowledgement.",
                    (
                        "During open_place_street_view accepted phase, do not describe the street-level "
                        "scene until the follow-up arrives after frontend acknowledgement."
                    ),
                    "Do not continue as if arrival is complete until the follow-up arrives after frontend acknowledgement.",
                    "After the post-ACK follow-up, continue grounded in the current city and any fresh image context.",
                    (
                        "After choose_itinerary ACK, follow the post-ACK instruction proactively: introduce "
                        "the city and, if instructed there, move into the first itinerary landmark without "
                        "asking for permission first."
                    ),
                    (
                        "After move_to_landmark, show_nearby, and open_place_street_view ACKs, become "
                        "interactive after your grounded explanation and ask the user what they want next."
                    ),
                    (
                        "Do not auto-chain indefinitely from landmark to landmark or category to category "
                        "unless the post-ACK follow-up explicitly instructs you to do that."
                    ),
                    "Do not invent landmarks, arrivals, screenshots, or tool outcomes that have not actually occurred.",
                ]
            ),
        ]
    )


def _format_itineraries(generated_itineraries: list[dict[str, object]]) -> str:
    """Format itinerary grounding for the dynamic system prompt."""
    if not generated_itineraries:
        return (
            "No itinerary set is currently synced. Stay in Ayana's character, but "
            "do not call choose_itinerary until itinerary grounding becomes available."
        )

    formatted_blocks: list[str] = []
    for index, itinerary in enumerate(generated_itineraries, start=1):
        city_name = str(itinerary.get("city_name", "")).strip()
        country_name = str(itinerary.get("country_name", "")).strip()
        itinerary_id = str(itinerary.get("id", "")).strip()
        title = str(itinerary.get("title", "")).strip()
        pitch = str(itinerary.get("pitch", "")).strip()
        landmarks = itinerary.get("landmarks")
        landmark_names = ", ".join(_extract_landmark_names(landmarks))
        formatted_blocks.append(
            "\n".join(
                [
                    f"Option {index}:",
                    f"- itinerary_id: {itinerary_id}",
                    f"- city: {city_name}, {country_name}",
                    f"- title: {title}",
                    f"- pitch: {pitch}",
                    f"- landmarks: {landmark_names or 'None listed'}",
                ]
            )
        )

    return "\n\n".join(formatted_blocks)


def _extract_landmark_names(landmarks: object) -> list[str]:
    """Return landmark names from the generated itinerary payload."""
    if not isinstance(landmarks, list):
        return []

    names: list[str] = []
    for landmark in landmarks[:5]:
        if not isinstance(landmark, dict):
            continue
        name = landmark.get("name")
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names


def _format_active_state(
    current_city: dict[str, object] | None,
    current_landmark: dict[str, object] | None,
    nearby_places: list[dict[str, object]],
    nearby_category: str | None,
    sidebar_visible: bool,
    street_view_visible: bool,
    current_street_view_place: dict[str, object] | None,
) -> str:
    """Format currently active city and landmark grounding."""
    if not current_city:
        return (
            "No city is active yet. Do not call move_to_landmark until a "
            "choose_itinerary transition has visibly completed."
        )

    city_name = str(current_city.get("city_name", "")).strip() or "Unknown city"
    country_name = (
        str(current_city.get("country_name", "")).strip() or "Unknown country"
    )
    itinerary_id = (
        str(current_city.get("itinerary_id", "")).strip() or "Unknown itinerary"
    )
    title = str(current_city.get("title", "")).strip() or "Unknown title"
    lines = [
        "Active city state:",
        f"- itinerary_id: {itinerary_id}",
        f"- city: {city_name}, {country_name}",
        f"- title: {title}",
    ]

    if current_landmark:
        landmark_name = (
            str(current_landmark.get("landmark_name", "")).strip()
            or "Unknown landmark"
        )
        formatted_address = str(
            current_landmark.get("formatted_address", "")
        ).strip()
        lines.extend(
            [
                "Active landmark state:",
                f"- landmark_name: {landmark_name}",
                (
                    f"- formatted_address: {formatted_address}"
                    if formatted_address
                    else "- formatted_address: unavailable"
                ),
            ]
        )
    else:
        lines.append("No landmark is active yet.")

    if nearby_places:
        lines.extend(
            [
                "Nearby discovery state:",
                (
                    f"- sidebar_visible: {'yes' if sidebar_visible else 'no'}"
                ),
                (
                    f"- category: {nearby_category}"
                    if nearby_category
                    else "- category: unavailable"
                ),
                "- nearby_places: " + ", ".join(
                    _extract_nearby_place_names(nearby_places)
                ),
            ]
        )
    else:
        lines.append("No nearby discovery results are active yet.")

    if street_view_visible and isinstance(current_street_view_place, dict):
        sv_name = str(current_street_view_place.get("place_name", "")).strip()
        lines.extend(
            [
                "Street View state:",
                "- visible: yes",
                f"- place_name: {sv_name or 'unknown'}",
            ]
        )

    return "\n".join(lines)


def _extract_nearby_place_names(nearby_places: list[dict[str, object]]) -> list[str]:
    """Return nearby place names from stored session state."""
    names: list[str] = []
    for place in nearby_places[:25]:
        name = place.get("name")
        if isinstance(name, str) and name.strip():
            names.append(name.strip())
    return names or ["None listed"]
