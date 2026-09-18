from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd


def export_sqlite(path: Path, tables: dict[str, pd.DataFrame]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as connection:
        for name, frame in tables.items():
            frame.to_sql(name, connection, if_exists="replace", index=False)
        connection.executescript("""
        DROP VIEW IF EXISTS vw_management_pnl;
        CREATE VIEW vw_management_pnl AS
        SELECT month, vintage, total_revenue, provision, rewards_services, marketing,
               salaries_other, total_expenses, pretax_income, classification
        FROM fact_budget
        UNION ALL
        SELECT month, vintage, total_revenue, provision, rewards_services, marketing,
               salaries_other, total_expenses, pretax_income, classification
        FROM fact_actual;

        DROP VIEW IF EXISTS vw_budget_vs_actual;
        CREATE VIEW vw_budget_vs_actual AS
        SELECT a.month,
               a.total_revenue AS actual_revenue,
               b.total_revenue AS plan_revenue,
               a.total_revenue - b.total_revenue AS revenue_variance,
               a.pretax_income AS actual_pti,
               b.pretax_income AS plan_pti,
               a.pretax_income - b.pretax_income AS pti_variance
        FROM fact_actual a JOIN fact_budget b USING(month);

        DROP VIEW IF EXISTS vw_forecast_waterfall;
        CREATE VIEW vw_forecast_waterfall AS
        SELECT vintage, as_of_date, total_revenue, provision, rewards_services, marketing,
               salaries_other, total_expenses, pretax_income FROM fact_forecast;

        DROP VIEW IF EXISTS vw_headcount_variance;
        CREATE VIEW vw_headcount_variance AS
        SELECT month, cost_center, job_family, SUM(beginning_headcount) beginning_headcount,
               SUM(hires) hires, SUM(attrition) attrition, SUM(ending_headcount) ending_headcount,
               SUM(personnel_expense) personnel_expense
        FROM fact_headcount GROUP BY month, cost_center, job_family;

        DROP VIEW IF EXISTS vw_marketing_roi;
        CREATE VIEW vw_marketing_roi AS
        SELECT month, channel, marketing_spend, new_accounts, cac, first_year_contribution,
               contribution_per_marketing_dollar, payback_months FROM fact_marketing;

        DROP VIEW IF EXISTS vw_credit_trends;
        CREATE VIEW vw_credit_trends AS
        SELECT period, card_balances, nco_rate, delinquency, provision FROM fact_operating_kpis
        WHERE card_balances IS NOT NULL;

        DROP VIEW IF EXISTS vw_scenario_summary;
        CREATE VIEW vw_scenario_summary AS
        SELECT scenario_id, scenario, "case", fy_revenue_impact, expense_or_provision_impact,
               pti_impact, resulting_pti FROM fact_scenarios;
        """)
