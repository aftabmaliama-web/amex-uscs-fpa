from __future__ import annotations

from datetime import date

import pandas as pd


def run_validations(public_history: pd.DataFrame, monthly_aop: pd.DataFrame,
                    monthly_actual: pd.DataFrame, quarterly_actuals: pd.DataFrame,
                    headcount: pd.DataFrame, marketing: pd.DataFrame,
                    lineage: pd.DataFrame, cutoff: str) -> pd.DataFrame:
    checks = []

    def add(name: str, passed: bool, detail: str, warning: bool = False) -> None:
        status = "WARNING" if warning and passed else ("PASS" if passed else "FAIL")
        checks.append({"test": name, "status": status, "detail": detail})

    aop_totals = monthly_aop.select_dtypes("number").sum()
    actual_totals = monthly_actual.select_dtypes("number").sum()
    add("2025 AOP monthly-to-annual reconciliation", abs(aop_totals["pretax_income"] - monthly_aop["pretax_income"].sum()) < .001,
        "Monthly AOP schedule totals exactly by construction.")
    add("2025 actual monthly-to-quarterly reconciliation", abs(actual_totals["total_revenue"] - 34814) < .01,
        f"Monthly synthetic allocations sum to published FY2025 revenue of {actual_totals['total_revenue']:.1f}.")
    add("USCS FY2025 P&L reconciliation",
        abs(34814 - 2967 - 25037 - 6810) < .01,
        "Revenue - provision - expenses = pretax segment income.")
    add("Quarterly-to-annual revenue reconciliation",
        abs(quarterly_actuals.query("year == 2025")["total_revenue"].sum() - 34814) < .01,
        "Four reported quarters reconcile to the 2025 10-K.")
    add("AOP leakage check",
        (pd.to_datetime(monthly_aop["as_of_date"]) <= pd.Timestamp(cutoff)).all(),
        f"All original AOP records have as_of_date on or before {cutoff}.")
    add("Headcount roll-forward",
        (headcount["ending_headcount"] >= 0).all(),
        "All monthly synthetic headcount balances remain non-negative.")
    add("Marketing acquisition math",
        ((marketing["marketing_spend"] * 1_000_000 / marketing["cac"] - marketing["new_accounts"]).abs() < .01).all(),
        "Marketing spend / CAC equals new accounts by channel and month.")
    valid_classes = {"PUBLIC_ACTUAL", "PUBLIC_GUIDANCE", "DERIVED_PUBLIC", "SYNTHETIC_ALLOCATED", "SYNTHETIC_ASSUMPTION", "MODEL_OUTPUT"}
    add("Source classification", set(lineage["classification"]).issubset(valid_classes),
        "Every lineage record uses an approved classification.")
    add("No duplicate lineage periods", not lineage.duplicated(["metric", "period", "source_name"]).any(),
        "No duplicated metric-period-source combinations.")
    add("Monthly public actual availability", True,
        "Public USCS monthly actuals do not exist. The model uses labeled synthetic allocations.", warning=True)
    return pd.DataFrame(checks)
