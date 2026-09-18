from __future__ import annotations

from typing import Iterable


def allocate_total(total: float, weights: Iterable[float], precision: int = 6) -> list[float]:
    """Allocate a total while forcing the rounded values to reconcile exactly."""
    weights = list(weights)
    if not weights or sum(weights) == 0:
        raise ValueError("Allocation weights must sum to a non-zero value")
    normalized = [w / sum(weights) for w in weights]
    values = [round(total * w, precision) for w in normalized]
    values[-1] = round(total - sum(values[:-1]), precision)
    return values


def quarterly_to_monthly(quarter_totals: dict[str, float], month_weights: dict[str, list[float]]) -> list[float]:
    values: list[float] = []
    for quarter in ("Q1", "Q2", "Q3", "Q4"):
        values.extend(allocate_total(quarter_totals[quarter], month_weights[quarter]))
    return values
