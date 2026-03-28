"""Custom exceptions for Ayana prep generation."""

from __future__ import annotations


class AyanaPrepError(Exception):
    """Base exception for Ayana prep failures."""


class AyanaPrepConfigError(AyanaPrepError):
    """Raised when required prep configuration is missing or invalid."""


class AyanaPrepGenerationError(AyanaPrepError):
    """Raised when the model response cannot produce a valid prep payload."""
