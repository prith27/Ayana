"""Pydantic models for the recap pipeline."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


# ─── Inbound (from frontend) ──────────────────────────────────────────────────

class TranscriptTurn(BaseModel):
    speaker: Literal["ai", "user"]
    text: str
    timestamp: int
    location: str | None = None


class LocationEvent(BaseModel):
    type: Literal["city", "landmark"]
    name: str
    city: str | None = None
    country: str | None = None
    timestamp: int


class RecapRequest(BaseModel):
    persona: str
    turns: list[TranscriptTurn]
    location_events: list[LocationEvent]


# ─── Structured recap data (produced by Grok) ─────────────────────────────────

class RecapStop(BaseModel):
    name: str
    area: str
    type: str
    desc: str
    image_url: str | None = None


class RecapFood(BaseModel):
    name: str
    cuisine: str
    rating: float
    price: str


class RecapActivity(BaseModel):
    name: str
    type: str
    rating: float
    highlight: bool


class RecapStats(BaseModel):
    distance_km: int
    neighborhoods: int
    places_discovered: int
    exploration_score: int


class RecapDNATrait(BaseModel):
    trait: str
    pct: int


class VibeShift(BaseModel):
    description: str


class RecapData(BaseModel):
    persona: str
    city: str
    country: str
    stops: list[RecapStop]
    food: list[RecapFood]
    activities: list[RecapActivity]
    stats: RecapStats
    dna: list[RecapDNATrait]
    vibe_shifts: list[VibeShift]


class RecapResponse(BaseModel):
    recap: RecapData
