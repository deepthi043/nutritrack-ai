from pydantic import BaseModel


class HistoryDayEntry(BaseModel):
    date: str
    steps: int
    distance_km: float
    active_minutes: int
    water_ml: int
