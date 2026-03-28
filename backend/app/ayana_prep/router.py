"""FastAPI router for Ayana prep endpoints."""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from ayana_orchestration import register_prep_context

from .client import AyanaPrepClient
from .errors import AyanaPrepConfigError, AyanaPrepGenerationError
from .models import AyanaPrepRequest, AyanaPrepResponse
from .service import AyanaPrepService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ayana", tags=["ayana"])


@lru_cache
def get_ayana_prep_service() -> AyanaPrepService:
    """Build the cached prep service dependency."""

    return AyanaPrepService(client=AyanaPrepClient.from_env())


@router.post(
    "/prep",
    responses={
        500: {"description": "Ayana prep backend is misconfigured."},
        502: {"description": "Ayana prep generation failed."},
    },
)
async def create_ayana_prep(
    request: AyanaPrepRequest,
    service: Annotated[AyanaPrepService, Depends(get_ayana_prep_service)],
) -> AyanaPrepResponse:
    """Generate itinerary options for a selected persona."""

    try:
        response = await service.prepare(request)
        prep_id = register_prep_context(
            persona=response.persona,
            generated_itineraries=[
                itinerary.model_dump(mode="json")
                for itinerary in response.itineraries
            ],
        )
        return AyanaPrepResponse(
            prep_id=prep_id,
            persona=response.persona,
            itineraries=response.itineraries,
        )
    except AyanaPrepConfigError as exc:
        logger.exception("Ayana prep configuration error")
        raise HTTPException(
            status_code=500,
            detail="Ayana prep backend is not configured correctly.",
        ) from exc
    except AyanaPrepGenerationError as exc:
        logger.exception("Ayana prep generation failed")
        raise HTTPException(
            status_code=502,
            detail="Ayana prep generation failed.",
        ) from exc
