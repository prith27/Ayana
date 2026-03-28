"""Thin Gemini client wrapper for Ayana prep generation."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

from google import genai
from google.genai import types

from .constants import DEFAULT_PREP_MODEL, DEFAULT_PREP_TEMPERATURE
from .errors import AyanaPrepConfigError, AyanaPrepGenerationError
from .models import AyanaPrepResponse


class AyanaPrepClient:
    """Small wrapper around the Gemini generate-content API."""

    def __init__(
        self,
        *,
        model: str,
        api_client: genai.Client,
        temperature: float | None = None,
    ) -> None:
        self._model = model
        self._api_client = api_client
        self._temperature = temperature

    @classmethod
    def from_env(cls) -> "AyanaPrepClient":
        """Build a configured client from environment variables."""

        model = os.getenv("AYANA_PREP_MODEL", DEFAULT_PREP_MODEL)
        raw_temperature = os.getenv("AYANA_PREP_TEMPERATURE", "").strip()
        temperature = (
            float(raw_temperature) if raw_temperature else DEFAULT_PREP_TEMPERATURE
        )

        use_vertex_ai = (
            os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "").strip().upper() == "TRUE"
        )
        if use_vertex_ai:
            project = os.getenv("GOOGLE_CLOUD_PROJECT", "").strip()
            location = os.getenv("GOOGLE_CLOUD_LOCATION", "").strip()
            if not project or not location:
                raise AyanaPrepConfigError(
                    "Vertex AI prep mode requires GOOGLE_CLOUD_PROJECT "
                    "and GOOGLE_CLOUD_LOCATION."
                )
            api_client = genai.Client(
                vertexai=True,
                project=project,
                location=location,
            )
        else:
            api_key = os.getenv("GOOGLE_API_KEY", "").strip()
            if not api_key:
                raise AyanaPrepConfigError(
                    "Ayana prep generation requires GOOGLE_API_KEY."
                )
            api_client = genai.Client(api_key=api_key)

        return cls(
            model=model,
            api_client=api_client,
            temperature=temperature,
        )

    async def generate_itineraries(self, prompt: str) -> dict[str, Any]:
        """Generate a JSON itinerary payload from the model."""

        response = await asyncio.to_thread(
            self._api_client.models.generate_content,
            model=self._model,
            contents=prompt,
            config=self._build_config(),
        )

        response_text = self._extract_response_text(response)
        try:
            payload = json.loads(response_text)
        except json.JSONDecodeError as exc:
            raise AyanaPrepGenerationError(
                "Prep model returned invalid JSON."
            ) from exc

        if not isinstance(payload, dict):
            raise AyanaPrepGenerationError(
                "Prep model returned a non-object JSON payload."
            )

        return payload

    def _build_config(self) -> types.GenerateContentConfig:
        """Create a strict JSON generation config."""

        return types.GenerateContentConfig(
            temperature=self._temperature,
            response_mime_type="application/json",
            response_schema=AyanaPrepResponse.model_json_schema(),
        )

    @staticmethod
    def _extract_response_text(response: Any) -> str:
        """Extract text content from a generate-content response."""

        response_text = getattr(response, "text", None)
        if response_text:
            return response_text

        candidates = getattr(response, "candidates", None) or []
        for candidate in candidates:
            content = getattr(candidate, "content", None)
            parts = getattr(content, "parts", None) or []
            for part in parts:
                text = getattr(part, "text", None)
                if text:
                    return text

        raise AyanaPrepGenerationError("Prep model returned an empty response.")
