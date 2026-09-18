from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass
class LineageRecord:
    metric: str
    period: str
    value: float | str
    classification: str
    source_name: str
    source_url: str
    source_date: str
    as_of_date: str
    transformation: str
    notes: str

    def to_dict(self) -> dict:
        return asdict(self)
