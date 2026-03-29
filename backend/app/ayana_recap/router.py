"""FastAPI router for the /api/ayana/recap endpoint."""

import logging

from fastapi import APIRouter, HTTPException

from .models import RecapRequest, RecapResponse
from .service import build_recap

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/api/ayana/recap", response_model=RecapResponse)
async def create_recap(request: RecapRequest) -> RecapResponse:
    """
    Convert a session transcript into structured recap data using Grok,
    and enrich each stop with a Google Places photo.
    """
    if not request.turns and not request.location_events:
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    try:
        recap_data = await build_recap(
            persona=request.persona,
            turns=request.turns,
            location_events=request.location_events,
        )
        return RecapResponse(recap=recap_data)
    except ValueError as exc:
        logger.error("Recap config error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Recap generation failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="Failed to generate recap. Please try again.",
        ) from exc
