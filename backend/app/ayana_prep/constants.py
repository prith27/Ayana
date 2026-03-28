"""Constants for the Ayana prep feature."""

from __future__ import annotations

from enum import StrEnum

ITINERARY_OPTION_COUNT = 3
DEFAULT_PREP_MODEL = "gemini-2.5-flash"
DEFAULT_PREP_TEMPERATURE = 0.4


class LandmarkFacet(StrEnum):
    """Allowed landmark facet values."""

    SIGHTSEEING = "sightseeing"
    FOOD = "food"
    ACTIVITY = "activity"
    SHOPPING = "shopping"

LANDMARK_FACET_VALUES = tuple(facet.value for facet in LandmarkFacet)
