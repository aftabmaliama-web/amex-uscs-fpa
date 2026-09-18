from __future__ import annotations

import pandas as pd


COST_CENTERS = [
    "Consumer Card Products & Portfolio",
    "Lending & U.S. Consumer Banking",
    "Membership Rewards & Card Member Benefits",
    "Travel, Lifestyle, Dining & Lounges",
    "Cobrand Partnerships & Business Development",
    "U.S. Consumer Marketing & Acquisition",
    "Product, Data & Technology",
    "Servicing, Operations & Business Support",
]

JOB_FAMILIES = {
    "Analyst / Associate": (0.46, 145_000),
    "Manager / Senior Manager": (0.31, 205_000),
    "Director": (0.17, 285_000),
    "VP+": (0.06, 430_000),
}


def build_headcount(opening: int, year: int, monthly_hires: list[int], monthly_attrition: list[int]) -> pd.DataFrame:
    rows = []
    begin = opening
    cc_weights = [0.12, 0.12, 0.12, 0.08, 0.10, 0.12, 0.18, 0.16]
    for month in range(1, 13):
        hires = monthly_hires[month - 1]
        exits = monthly_attrition[month - 1]
        ending = begin + hires - exits
        avg = (begin + ending) / 2
        for cc, cc_weight in zip(COST_CENTERS, cc_weights):
            for family, (family_weight, loaded_cost) in JOB_FAMILIES.items():
                avg_hc = avg * cc_weight * family_weight
                rows.append({
                    "month": f"{year}-{month:02d}-01",
                    "cost_center": cc,
                    "job_family": family,
                    "beginning_headcount": begin * cc_weight * family_weight,
                    "hires": hires * cc_weight * family_weight,
                    "attrition": exits * cc_weight * family_weight,
                    "ending_headcount": ending * cc_weight * family_weight,
                    "average_headcount": avg_hc,
                    "loaded_cost_per_employee": loaded_cost,
                    "personnel_expense": avg_hc * loaded_cost / 12 / 1_000_000,
                    "classification": "SYNTHETIC_ASSUMPTION",
                })
        begin = ending
    return pd.DataFrame(rows)
