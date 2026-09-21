"""Activity data provider abstraction.

NutriTrack AI's web app cannot read real phone/wearable sensors — a browser
has no access to a device's step counter or GPS-based distance tracking.
This module defines the interface future real providers must implement, so
the rest of the application (API routes, services) never needs to know
whether activity data came from a mock entry, a mobile health API, or a
wearable sync.

Only MockActivityProvider is implemented in Phase 2. It represents activity
a developer/user manually enters for testing and demo purposes — it is
never presented to the end user as real sensor tracking.

Future implementations (not built yet):
    AndroidHealthProvider   — reads Android Health Connect / Google Fit data
    iOSHealthProvider       — reads Apple HealthKit data
    WearableActivityProvider — syncs from a wearable vendor API

Each future provider would implement `ActivityProvider` and produce the same
`ActivityInput` shape, so `ActivityService` and the API layer require no
changes when real sensor integration is added.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class ActivityInput:
    """Normalized activity payload produced by any provider."""

    steps: int
    distance_km: float
    active_minutes: int
    activity_type: Optional[str] = None
    date: Optional[datetime] = None
    data_source: str = "mock"


class ActivityProvider(ABC):
    """Interface every activity data source must implement."""

    @abstractmethod
    def get_source_name(self) -> str:
        """Short identifier stored in `activity_records.data_source`."""
        raise NotImplementedError

    @abstractmethod
    def normalize(self, raw_input: dict) -> ActivityInput:
        """Convert provider-specific input into a normalized ActivityInput."""
        raise NotImplementedError


class MockActivityProvider(ActivityProvider):
    """Development/demo provider for manually entered activity data.

    This is NOT a simulation of real sensor data — it simply validates and
    passes through values a developer or demo user typed in, tagging them
    clearly as "mock" so the rest of the system (and the UI) can label them
    as development/demo data rather than real tracked activity.
    """

    def get_source_name(self) -> str:
        return "mock"

    def normalize(self, raw_input: dict) -> ActivityInput:
        return ActivityInput(
            steps=raw_input.get("steps", 0),
            distance_km=raw_input.get("distance_km", 0.0),
            active_minutes=raw_input.get("active_minutes", 0),
            activity_type=raw_input.get("activity_type"),
            date=raw_input.get("date"),
            data_source=self.get_source_name(),
        )


def get_default_activity_provider() -> ActivityProvider:
    """Return the active provider for this environment.

    Phase 2 always returns the mock provider. When real mobile/wearable
    integration is added, this factory is the single place that would
    switch providers based on request context (e.g. platform header).
    """
    return MockActivityProvider()
