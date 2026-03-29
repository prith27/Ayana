"""Ayana live agent definition for orchestration phases."""

import os

from google.adk.agents import Agent

from ayana_tools import (
    choose_itinerary,
    move_to_landmark,
    open_place_street_view,
    show_nearby,
)
from google_search_agent.prompt import build_ayana_instruction

# Default models for Live API with native audio support:
# - Gemini Live API: gemini-2.5-flash-native-audio-preview-12-2025
# - Vertex AI Live API: gemini-live-2.5-flash-native-audio
agent = Agent(
    name="ayana_live_agent",
    model=os.getenv(
        "DEMO_AGENT_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025"
    ),
    tools=[
        choose_itinerary,
        move_to_landmark,
        show_nearby,
        open_place_street_view,
    ],
    instruction=build_ayana_instruction,
)
