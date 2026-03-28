"""Typed request and response models for Ayana prep."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .constants import ITINERARY_OPTION_COUNT, LandmarkFacet


class AyanaPrepRequest(BaseModel):
    """Incoming request payload for itinerary generation."""

    model_config = ConfigDict(str_strip_whitespace=True)

    persona: str = Field(min_length=1)


class Landmark(BaseModel):
    """One landmark in an itinerary option."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    short_label: str | None = Field(default=None, min_length=1)
    order_index: int = Field(ge=1)
    why_this_stop: str = Field(min_length=1)
    facts: list[str] = Field(min_length=1)
    facets: list[LandmarkFacet] = Field(min_length=1)


class ItineraryOption(BaseModel):
    """One itinerary option returned for the selected persona."""

    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(min_length=1)
    city_name: str = Field(min_length=1)
    country_name: str = Field(min_length=1)
    title: str = Field(min_length=1)
    pitch: str = Field(min_length=1)
    why_it_fits_persona: str = Field(min_length=1)
    city_facts: list[str] = Field(min_length=1)
    landmarks: list[Landmark] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_landmarks(self) -> "ItineraryOption":
        """Ensure landmark ids and order indexes are unique."""

        landmark_ids = [landmark.id for landmark in self.landmarks]
        if len(set(landmark_ids)) != len(landmark_ids):
            raise ValueError("landmark ids must be unique within an itinerary")

        order_indexes = [landmark.order_index for landmark in self.landmarks]
        if len(set(order_indexes)) != len(order_indexes):
            raise ValueError("landmark order_index values must be unique")

        return self


class AyanaPrepPayload(BaseModel):
    """Validated prep payload before transport-specific fields are added."""

    model_config = ConfigDict(str_strip_whitespace=True)

    persona: str = Field(min_length=1)
    itineraries: list[ItineraryOption] = Field(
        min_length=ITINERARY_OPTION_COUNT,
        max_length=ITINERARY_OPTION_COUNT,
    )

    @model_validator(mode="after")
    def validate_itinerary_ids(self) -> "AyanaPrepPayload":
        """Ensure itinerary ids are unique."""

        itinerary_ids = [itinerary.id for itinerary in self.itineraries]
        if len(set(itinerary_ids)) != len(itinerary_ids):
            raise ValueError("itinerary ids must be unique")

        return self


class AyanaPrepResponse(AyanaPrepPayload):
    """Top-level prep response returned to the frontend."""

    prep_id: str = Field(min_length=1)
