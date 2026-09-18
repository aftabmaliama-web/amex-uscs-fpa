from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .monthly_allocator import allocate_total, quarterly_to_monthly


MONTHS = pd.date_range("2025-01-01", "2026-12-01", freq="MS")
P_AND_L_LINES = [
    "non_interest_revenue",
    "net_interest_income",
    "total_revenue",
    "provision",
    "rewards_services",
    "marketing",
    "salaries_other",
    "total_expenses",
    "pretax_income",
]


PUBLIC_ANNUAL = {
    2022: dict(non_interest_revenue=16440, net_interest_income=7474, total_revenue=23914,
               provision=1021, rewards_services=10791, marketing=2744, salaries_other=3958,
               total_expenses=17493, pretax_income=5400, billed_business=553.0,
               cards_in_force=41.7, basic_cards=29.2, spend_per_basic=19514,
               loans_receivables=86.923, nco_rate=0.010, delinquency=0.011),
    2023: dict(non_interest_revenue=18464, net_interest_income=9652, total_revenue=28116,
               provision=2855, rewards_services=12808, marketing=2585, salaries_other=4435,
               total_expenses=19828, pretax_income=5433, billed_business=610.8,
               cards_in_force=43.8, basic_cards=30.7, spend_per_basic=20303,
               loans_receivables=97.996, nco_rate=0.020, delinquency=0.013),
    2024: dict(non_interest_revenue=20137, net_interest_income=11290, total_revenue=31427,
               provision=3029, rewards_services=14329, marketing=3051, salaries_other=4641,
               total_expenses=22021, pretax_income=6377, billed_business=654.8,
               cards_in_force=46.3, basic_cards=32.5, spend_per_basic=20707,
               loans_receivables=107.051, nco_rate=0.025, delinquency=0.013),
    2025: dict(non_interest_revenue=22307, net_interest_income=12507, total_revenue=34814,
               provision=2967, rewards_services=16557, marketing=3187, salaries_other=5293,
               total_expenses=25037, pretax_income=6810, billed_business=707.5,
               cards_in_force=48.3, basic_cards=34.1, spend_per_basic=21215,
               loans_receivables=114.368, nco_rate=0.025, delinquency=0.013),
}

PUBLIC_QUARTERLY_2024 = {
    "Q1": [4766, 2733, 7499, 727, 3356, 719, 1084, 5159, 1613, 153.4],
    "Q2": [5029, 2703, 7732, 706, 3587, 764, 1115, 5466, 1560, 165.1],
    "Q3": [5028, 2916, 7944, 812, 3570, 755, 1148, 5473, 1659, 162.3],
    "Q4": [5314, 2938, 8252, 784, 3816, 813, 1294, 5923, 1545, 174.0],
}

PUBLIC_QUARTERLY_2025 = {
    "Q1": [5243, 3006, 8249, 631, 3882, 765, 1239, 5886, 1732, 164.3, 102.896, .027, .013],
    "Q2": [5540, 3013, 8553, 829, 3967, 800, 1281, 6048, 1676, 176.5, 105.784, .024, .012],
    "Q3": [5620, 3236, 8856, 734, 4145, 825, 1300, 6270, 1852, 177.5, 106.969, .023, .013],
    "Q4": [5904, 3252, 9156, 773, 4563, 797, 1473, 6833, 1550, 189.2, 114.368, .026, .013],
}

PUBLIC_QUARTERLY_2026 = {
    "Q1": [5803, 3321, 9123, 631, 4605, 764, 1367, 6736, 1757, 180.2, 110.849, .024, .013],
    "Q2": [6229, 3295, 9524, 498, 4745, 813, 1403, 6961, 2065, 196.4, 113.796, .023, .011],
}


def load_assumptions(project_root: Path) -> dict:
    # Keep the human-readable YAML as the model control document. The runtime
    # uses the same values here so the pipeline has no non-standard dependency.
    return {
        "project": {"aop_cutoff_date": "2025-01-24"},
        "2025_aop": {
            "billed_business_growth": .085,
            "non_interest_revenue_growth": .095,
            "net_interest_income_growth": .100,
            "provision_millions": 3100,
            "rewards_services_growth": .115,
            "marketing_millions": 3180,
            "salaries_other_growth": .080,
        },
        "2026_aop": {
            "total_revenue_growth": .100,
            "provision_millions": 3100,
            "rewards_services_millions": 18250,
            "marketing_millions": 3450,
            "salaries_other_millions": 5650,
        },
        "2026_q2_latest_estimate": {
            "q3_revenue_growth": .095, "q4_revenue_growth": .095,
            "q3_provision_millions": 700, "q4_provision_millions": 740,
            "q3_rewards_services_millions": 4550, "q4_rewards_services_millions": 5000,
            "q3_marketing_millions": 860, "q4_marketing_millions": 850,
            "q3_salaries_other_millions": 1450, "q4_salaries_other_millions": 1500,
        },
    }


def build_public_history() -> pd.DataFrame:
    rows = []
    for year, values in PUBLIC_ANNUAL.items():
        for metric, value in values.items():
            rows.append({
                "period": str(year), "period_type": "FY", "metric": metric, "value": value,
                "classification": "PUBLIC_ACTUAL", "reporting_level": "USCS",
            })
    return pd.DataFrame(rows)


def build_aop_2025(assumptions: dict) -> dict[str, float]:
    base = PUBLIC_ANNUAL[2024]
    a = assumptions["2025_aop"]
    non_interest = round(base["non_interest_revenue"] * (1 + a["non_interest_revenue_growth"]), 1)
    nii = round(base["net_interest_income"] * (1 + a["net_interest_income_growth"]), 1)
    rewards = round(base["rewards_services"] * (1 + a["rewards_services_growth"]), 1)
    sal_other = round(base["salaries_other"] * (1 + a["salaries_other_growth"]), 1)
    total_revenue = non_interest + nii
    total_expenses = rewards + a["marketing_millions"] + sal_other
    pti = total_revenue - a["provision_millions"] - total_expenses
    return {
        "non_interest_revenue": non_interest,
        "net_interest_income": nii,
        "total_revenue": total_revenue,
        "provision": a["provision_millions"],
        "rewards_services": rewards,
        "marketing": a["marketing_millions"],
        "salaries_other": sal_other,
        "total_expenses": total_expenses,
        "pretax_income": pti,
        "billed_business": round(base["billed_business"] * (1 + a["billed_business_growth"]), 1),
    }


def _quarter_shares(metric_index: int) -> list[float]:
    values = [PUBLIC_QUARTERLY_2024[q][metric_index] for q in ("Q1", "Q2", "Q3", "Q4")]
    return [v / sum(values) for v in values]


def build_monthly_aop(aop: dict[str, float]) -> pd.DataFrame:
    metric_indexes = {
        "non_interest_revenue": 0, "net_interest_income": 1, "total_revenue": 2,
        "provision": 3, "rewards_services": 4, "marketing": 5,
        "salaries_other": 6, "total_expenses": 7, "pretax_income": 8, "billed_business": 9,
    }
    month_weights = {
        "Q1": [.32, .31, .37], "Q2": [.33, .33, .34],
        "Q3": [.32, .33, .35], "Q4": [.30, .31, .39],
    }
    data = {"month": pd.date_range("2025-01-01", "2025-12-01", freq="MS")}
    for metric, total in aop.items():
        q_values = allocate_total(total, _quarter_shares(metric_indexes[metric]))
        q_dict = dict(zip(("Q1", "Q2", "Q3", "Q4"), q_values))
        data[metric] = quarterly_to_monthly(q_dict, month_weights)
    frame = pd.DataFrame(data)
    frame["vintage"] = "2025 AOP"
    frame["classification"] = "MODEL_OUTPUT"
    frame["as_of_date"] = "2025-01-24"
    return frame


def build_monthly_actual_2025() -> pd.DataFrame:
    month_weights = {
        "Q1": [.32, .31, .37], "Q2": [.33, .33, .34],
        "Q3": [.32, .33, .35], "Q4": [.30, .31, .39],
    }
    metric_indexes = {
        "non_interest_revenue": 0, "net_interest_income": 1, "total_revenue": 2,
        "provision": 3, "rewards_services": 4, "marketing": 5,
        "salaries_other": 6, "total_expenses": 7, "pretax_income": 8, "billed_business": 9,
    }
    data = {"month": pd.date_range("2025-01-01", "2025-12-01", freq="MS")}
    for metric, idx in metric_indexes.items():
        q_dict = {q: PUBLIC_QUARTERLY_2025[q][idx] for q in ("Q1", "Q2", "Q3", "Q4")}
        data[metric] = quarterly_to_monthly(q_dict, month_weights)
    frame = pd.DataFrame(data)
    frame["vintage"] = "FY2025 Actual"
    frame["classification"] = "SYNTHETIC_ALLOCATED"
    frame["as_of_date"] = "2026-01-30"
    return frame


def build_quarterly_actuals() -> pd.DataFrame:
    columns = ["non_interest_revenue", "net_interest_income", "total_revenue", "provision",
               "rewards_services", "marketing", "salaries_other", "total_expenses", "pretax_income",
               "billed_business", "card_balances", "nco_rate", "delinquency"]
    rows = []
    for year, source in ((2025, PUBLIC_QUARTERLY_2025), (2026, PUBLIC_QUARTERLY_2026)):
        for quarter, values in source.items():
            if year == 2026:
                as_of_date = "2026-04-17" if quarter == "Q1" else "2026-07-17"
            else:
                as_of_date = "2026-01-30"
            row = {"period": f"{year}{quarter}", "year": year, "quarter": quarter,
                   "classification": "PUBLIC_ACTUAL", "as_of_date": as_of_date}
            row.update(dict(zip(columns, values)))
            rows.append(row)
    return pd.DataFrame(rows)


def build_forecast_vintages(aop: dict[str, float]) -> pd.DataFrame:
    actual = PUBLIC_ANNUAL[2025]
    snapshots = [
        ("2025 AOP", "2025-01-24", aop),
        ("Q1 2025 LE", "2025-04-17", dict(total_revenue=34650, provision=3050, rewards_services=16100, marketing=3200, salaries_other=5150)),
        ("Q2 2025 LE", "2025-07-18", dict(total_revenue=34800, provision=3000, rewards_services=16300, marketing=3200, salaries_other=5200)),
        ("Q3 2025 LE", "2025-10-17", dict(total_revenue=34850, provision=2980, rewards_services=16500, marketing=3200, salaries_other=5270)),
        ("FY2025 Actual", "2026-01-30", actual),
    ]
    rows = []
    for vintage, as_of, values in snapshots:
        total_expenses = values.get("total_expenses", values["rewards_services"] + values["marketing"] + values["salaries_other"])
        pti = values.get("pretax_income", values["total_revenue"] - values["provision"] - total_expenses)
        rows.append({"vintage": vintage, "as_of_date": as_of, "total_revenue": values["total_revenue"],
                     "provision": values["provision"], "rewards_services": values["rewards_services"],
                     "marketing": values["marketing"], "salaries_other": values["salaries_other"],
                     "total_expenses": total_expenses, "pretax_income": pti,
                     "classification": "PUBLIC_ACTUAL" if "Actual" in vintage else "MODEL_OUTPUT"})
    return pd.DataFrame(rows)


def build_2026_forecast(assumptions: dict) -> pd.DataFrame:
    a = assumptions["2026_aop"]
    aop_revenue = round(PUBLIC_ANNUAL[2025]["total_revenue"] * (1 + a["total_revenue_growth"]), 1)
    aop = dict(total_revenue=aop_revenue, provision=a["provision_millions"],
               rewards_services=a["rewards_services_millions"], marketing=a["marketing_millions"],
               salaries_other=a["salaries_other_millions"])
    aop["total_expenses"] = aop["rewards_services"] + aop["marketing"] + aop["salaries_other"]
    aop["pretax_income"] = aop["total_revenue"] - aop["provision"] - aop["total_expenses"]

    le = assumptions["2026_q2_latest_estimate"]
    q1, q2 = PUBLIC_QUARTERLY_2026["Q1"], PUBLIC_QUARTERLY_2026["Q2"]
    q3_revenue = PUBLIC_QUARTERLY_2025["Q3"][2] * (1 + le["q3_revenue_growth"])
    q4_revenue = PUBLIC_QUARTERLY_2025["Q4"][2] * (1 + le["q4_revenue_growth"])
    latest = {
        "total_revenue": q1[2] + q2[2] + q3_revenue + q4_revenue,
        "provision": q1[3] + q2[3] + le["q3_provision_millions"] + le["q4_provision_millions"],
        "rewards_services": q1[4] + q2[4] + le["q3_rewards_services_millions"] + le["q4_rewards_services_millions"],
        "marketing": q1[5] + q2[5] + le["q3_marketing_millions"] + le["q4_marketing_millions"],
        "salaries_other": q1[6] + q2[6] + le["q3_salaries_other_millions"] + le["q4_salaries_other_millions"],
    }
    latest["total_expenses"] = latest["rewards_services"] + latest["marketing"] + latest["salaries_other"]
    latest["pretax_income"] = latest["total_revenue"] - latest["provision"] - latest["total_expenses"]
    rows = []
    for vintage, date, values in (("2026 AOP", "2026-01-30", aop), ("Q2 2026 LE", "2026-07-17", latest)):
        rows.append({"vintage": vintage, "as_of_date": date, **{k: round(v, 1) for k, v in values.items()},
                     "classification": "MODEL_OUTPUT"})
    return pd.DataFrame(rows)
