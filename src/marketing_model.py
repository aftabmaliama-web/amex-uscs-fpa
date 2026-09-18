from __future__ import annotations

import pandas as pd


CHANNELS = {
    "Direct Mail": (0.25, 420, 620),
    "Paid Search": (0.22, 360, 590),
    "Affiliate / Partner": (0.28, 510, 780),
    "Digital / Paid Media": (0.25, 390, 610),
}


def build_marketing(total_spend_millions: float, year: int) -> pd.DataFrame:
    rows = []
    monthly_weights = [0.075, 0.075, 0.08, 0.08, 0.08, 0.08, 0.085, 0.085, 0.085, 0.09, 0.085, 0.10]
    for month, month_weight in enumerate(monthly_weights, start=1):
        for channel, (share, cac, contribution) in CHANNELS.items():
            spend = total_spend_millions * month_weight * share
            accounts = spend * 1_000_000 / cac
            rows.append({
                "month": f"{year}-{month:02d}-01",
                "channel": channel,
                "marketing_spend": spend,
                "new_accounts": accounts,
                "cac": cac,
                "first_year_contribution": accounts * contribution / 1_000_000,
                "contribution_per_marketing_dollar": contribution / cac,
                "payback_months": 12 * cac / contribution,
                "break_even_cac": contribution,
                "classification": "SYNTHETIC_ASSUMPTION",
            })
    return pd.DataFrame(rows)
