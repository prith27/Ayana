"""Service layer for Ayana prep generation."""

from __future__ import annotations

import re
from typing import Any, Protocol

from pydantic import ValidationError

from .errors import AyanaPrepGenerationError
from .models import AyanaPrepPayload, AyanaPrepRequest
from .prompt_builder import build_ayana_prep_prompt

_SLUG_RE = re.compile(r"[^a-z0-9]+")


class AyanaPrepGenerator(Protocol):
    """Protocol for the prep-generation client."""

    async def generate_itineraries(self, prompt: str) -> dict[str, Any]:
        """Generate a JSON payload for the Ayana prep response."""


class AyanaPrepService:
    """Orchestrates prompt building, model calling, and validation."""

    def __init__(self, client: AyanaPrepGenerator) -> None:
        self._client = client

    async def prepare(self, request: AyanaPrepRequest) -> AyanaPrepPayload:
        """Generate and validate Ayana itinerary options."""

        prompt = build_ayana_prep_prompt(request.persona)
        raw_payload = await self._client.generate_itineraries(prompt)
        normalized_payload = self._normalize_payload(
            raw_payload=raw_payload,
            persona=request.persona,
        )

        try:
            return AyanaPrepPayload.model_validate(normalized_payload)
        except ValidationError as exc:
            raise AyanaPrepGenerationError(
                "Prep model response failed schema validation."
            ) from exc

    def _normalize_payload(
        self,
        *,
        raw_payload: dict[str, Any],
        persona: str,
    ) -> dict[str, Any]:
        """Normalize model output before validating it."""

        if not isinstance(raw_payload, dict):
            raise AyanaPrepGenerationError("Prep model returned an invalid payload.")

        itineraries = raw_payload.get("itineraries")
        if not isinstance(itineraries, list):
            raise AyanaPrepGenerationError(
                "Prep model response is missing an itineraries array."
            )

        normalized_itineraries = [
            self._normalize_itinerary(
                raw_itinerary=raw_itinerary,
                persona=persona,
                fallback_index=index,
            )
            for index, raw_itinerary in enumerate(itineraries, start=1)
        ]
        self._ensure_unique_ids(normalized_itineraries)

        return {
            "persona": persona,
            "itineraries": normalized_itineraries,
        }

    def _normalize_itinerary(
        self,
        *,
        raw_itinerary: Any,
        persona: str,
        fallback_index: int,
    ) -> dict[str, Any]:
        """Normalize a single itinerary object."""

        if not isinstance(raw_itinerary, dict):
            raise AyanaPrepGenerationError("Each itinerary must be a JSON object.")

        itinerary = self._strip_values(raw_itinerary)
        city_name = self._string_value(itinerary.get("city_name"))
        title = self._string_value(itinerary.get("title"))
        itinerary_id_seed = (
            itinerary.get("id")
            or city_name
            or title
            or f"{persona}_itinerary_{fallback_index}"
        )

        landmarks = itinerary.get("landmarks")
        if not isinstance(landmarks, list):
            raise AyanaPrepGenerationError(
                "Each itinerary must include a landmarks array."
            )

        normalized_landmarks = [
            self._normalize_landmark(
                raw_landmark=raw_landmark,
                itinerary_id_seed=itinerary_id_seed,
                fallback_index=index,
            )
            for index, raw_landmark in enumerate(landmarks, start=1)
        ]
        normalized_landmarks.sort(key=lambda landmark: landmark["order_index"])
        self._ensure_unique_ids(normalized_landmarks)

        return {
            "id": self._slugify_identifier(itinerary_id_seed),
            "city_name": city_name,
            "country_name": self._string_value(itinerary.get("country_name")),
            "title": title,
            "pitch": self._string_value(itinerary.get("pitch")),
            "why_it_fits_persona": self._string_value(
                itinerary.get("why_it_fits_persona")
            ),
            "city_facts": self._normalize_string_list(itinerary.get("city_facts")),
            "landmarks": normalized_landmarks,
        }

    def _normalize_landmark(
        self,
        *,
        raw_landmark: Any,
        itinerary_id_seed: str,
        fallback_index: int,
    ) -> dict[str, Any]:
        """Normalize one landmark object."""

        if not isinstance(raw_landmark, dict):
            raise AyanaPrepGenerationError("Each landmark must be a JSON object.")

        landmark = self._strip_values(raw_landmark)
        name = self._string_value(landmark.get("name"))
        landmark_id_seed = (
            landmark.get("id")
            or name
            or f"{itinerary_id_seed}_landmark_{fallback_index}"
        )

        return {
            "id": self._slugify_identifier(landmark_id_seed),
            "name": name,
            "short_label": self._optional_string_value(landmark.get("short_label")),
            "order_index": self._normalize_order_index(
                landmark.get("order_index"),
                fallback_index=fallback_index,
            ),
            "why_this_stop": self._string_value(landmark.get("why_this_stop")),
            "facts": self._normalize_string_list(landmark.get("facts")),
            "facets": self._normalize_string_list(landmark.get("facets")),
        }

    def _ensure_unique_ids(self, items: list[dict[str, Any]]) -> None:
        """Deduplicate ids by appending a stable numeric suffix."""

        seen: dict[str, int] = {}
        for item in items:
            base_id = item["id"]
            count = seen.get(base_id, 0)
            if count:
                item["id"] = f"{base_id}_{count + 1}"
            seen[base_id] = count + 1

    @staticmethod
    def _normalize_order_index(value: Any, *, fallback_index: int) -> int:
        """Convert order indexes into positive integers."""

        if isinstance(value, int) and value >= 1:
            return value
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.isdigit() and int(stripped) >= 1:
                return int(stripped)
        return fallback_index

    @staticmethod
    def _normalize_string_list(value: Any) -> list[str]:
        """Normalize lists of strings and drop blank entries."""

        if not isinstance(value, list):
            return []

        normalized: list[str] = []
        for item in value:
            if isinstance(item, str):
                stripped = item.strip()
                if stripped:
                    normalized.append(stripped)
        return normalized

    @staticmethod
    def _strip_values(value: Any) -> Any:
        """Recursively trim whitespace from nested dict/list structures."""

        if isinstance(value, str):
            return value.strip()
        if isinstance(value, list):
            return [AyanaPrepService._strip_values(item) for item in value]
        if isinstance(value, dict):
            return {
                key: AyanaPrepService._strip_values(item)
                for key, item in value.items()
            }
        return value

    @staticmethod
    def _string_value(value: Any) -> str:
        """Normalize a required string field."""

        return value.strip() if isinstance(value, str) else ""

    @staticmethod
    def _optional_string_value(value: Any) -> str | None:
        """Normalize an optional string field."""

        normalized = value.strip() if isinstance(value, str) else ""
        return normalized or None

    @staticmethod
    def _slugify_identifier(value: Any) -> str:
        """Create a stable snake-style identifier."""

        normalized = value.strip().lower() if isinstance(value, str) else ""
        slug = _SLUG_RE.sub("_", normalized).strip("_")
        return slug or "item"
