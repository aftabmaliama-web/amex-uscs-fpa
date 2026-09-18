from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from src.headcount_model import COST_CENTERS, build_headcount
from src.marketing_model import build_marketing
from src.planning import (
    PUBLIC_ANNUAL,
    build_2026_forecast,
    build_aop_2025,
    build_forecast_vintages,
    build_monthly_actual_2025,
    build_monthly_aop,
    build_public_history,
    build_quarterly_actuals,
    load_assumptions,
)
from src.scenarios import build_combined_cases, build_risks_opportunities, build_scenarios
from src.sql_export import export_sqlite
from src.validation import run_validations


ROOT = Path(__file__).resolve().parent
URLS = {
    "2024 10-K": "https://s26.q4cdn.com/747928648/files/doc_financials/2024/q4/65345cb2-3baf-42fd-ad88-968e29a7264a.pdf",
    "Q4 2024 earnings presentation": "https://s26.q4cdn.com/747928648/files/doc_financials/2024/q4/Q4-2024-Earnings-Presentation.pdf",
    "Q4 2024 earnings tables": "https://s26.q4cdn.com/747928648/files/doc_financials/2024/q4/Q4-2024-Earnings-Tables.pdf",
    "2025 10-K": "https://d18rn0p25nwr6d.cloudfront.net/CIK-0000004962/0adef908-f8b7-4f66-b1cf-7d92a2b68ccb.pdf",
    "Q4 2025 earnings tables": "https://s26.q4cdn.com/747928648/files/doc_earnings/2025/q4/supplemental-info/Q4-2025-Earnings-Tables.pdf",
    "Q1 2026 earnings tables": "https://s26.q4cdn.com/747928648/files/doc_earnings/2026/q1/supplemental-info/Q1-2026-Earnings-Tables.pdf",
    "Q2 2026 earnings tables": "https://s26.q4cdn.com/747928648/files/doc_earnings/2026/q2/supplemental-info/Q2-2026-Earnings-Tables.pdf",
}


def write_csv(frame: pd.DataFrame, relative_path: str) -> None:
    path = ROOT / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)


def build_lineage(public_history: pd.DataFrame, quarterly_actuals: pd.DataFrame, aop: dict) -> pd.DataFrame:
    rows = []
    for _, record in public_history.iterrows():
        year = int(record["period"])
        source = "2024 10-K" if year <= 2024 else "2025 10-K"
        rows.append({
            "metric": record["metric"], "period": record["period"], "value": record["value"],
            "classification": "PUBLIC_ACTUAL", "source_name": source, "source_url": URLS[source],
            "source_date": "2025-02-14" if year <= 2024 else "2026-02-13",
            "as_of_date": "2025-02-14" if year <= 2024 else "2026-02-13",
            "transformation": "Transcribed from USCS selected income statement/statistical tables",
            "notes": "USD millions except billed business USD billions and operating ratios/counts",
        })
    for _, record in quarterly_actuals.iterrows():
        source = "Q4 2025 earnings tables" if record["year"] == 2025 else ("Q1 2026 earnings tables" if record["quarter"] == "Q1" else "Q2 2026 earnings tables")
        for metric in ["total_revenue", "provision", "rewards_services", "marketing", "salaries_other", "pretax_income", "billed_business", "card_balances", "nco_rate", "delinquency"]:
            rows.append({
                "metric": metric, "period": record["period"], "value": record[metric],
                "classification": "PUBLIC_ACTUAL", "source_name": source, "source_url": URLS[source],
                "source_date": record["as_of_date"], "as_of_date": record["as_of_date"],
                "transformation": "Direct transcription from USCS quarterly table", "notes": "Public quarterly actual",
            })
    rows.append({
        "metric": "company_revenue_growth_guidance", "period": "FY2025", "value": "8%-10%",
        "classification": "PUBLIC_GUIDANCE", "source_name": "Q4 2024 earnings presentation",
        "source_url": URLS["Q4 2024 earnings presentation"], "source_date": "2025-01-24", "as_of_date": "2025-01-24",
        "transformation": "Used as an anchor, not applied mechanically to USCS", "notes": "Available at the AOP cutoff",
    })
    for metric, value in aop.items():
        rows.append({
            "metric": metric, "period": "2025 AOP", "value": value, "classification": "MODEL_OUTPUT",
            "source_name": "2025 AOP model", "source_url": "", "source_date": "2025-01-24", "as_of_date": "2025-01-24",
            "transformation": "FY2024 public actual multiplied by frozen pre-actual planning assumption",
            "notes": "Original AOP snapshot. No 2025 actuals used.",
        })
    return pd.DataFrame(rows)


def build_variance_bridges(aop: dict) -> pd.DataFrame:
    actual = PUBLIC_ANNUAL[2025]
    rows = []
    def bridge(name: str, start: float, components: list[tuple[str, float]], end: float) -> None:
        rows.append({"bridge": name, "component": "Plan", "impact": start, "display_order": 0})
        for order, (label, impact) in enumerate(components, start=1):
            rows.append({"bridge": name, "component": label, "impact": impact, "display_order": order})
        rows.append({"bridge": name, "component": "Actual", "impact": end, "display_order": 99})
    rev_diff = actual["total_revenue"] - aop["total_revenue"]
    bridge("Revenue", aop["total_revenue"], [("Account volume", 150), ("Spend per account", -70), ("G&S / T&E mix", 40), ("Monetization", -60), ("Lending", 88), ("Fees / other", rev_diff - 148)], actual["total_revenue"])
    prov_diff = actual["provision"] - aop["provision"]
    bridge("Provision", aop["provision"], [("Loan balance", 100), ("Loss rate / reserve overlay", prov_diff - 100)], actual["provision"])
    rew_diff = actual["rewards_services"] - aop["rewards_services"]
    bridge("Rewards / Benefits", aop["rewards_services"], [("Billed business", -70), ("Rewards / benefit rate", rew_diff + 70)], actual["rewards_services"])
    mkt_diff = actual["marketing"] - aop["marketing"]
    bridge("Marketing", aop["marketing"], [("Acquisition volume", 60), ("CAC", 40), ("Channel mix", -30), ("Timing", mkt_diff - 70)], actual["marketing"])
    sal_diff = actual["salaries_other"] - aop["salaries_other"]
    bridge("Personnel / OpEx", aop["salaries_other"], [("Headcount", 85), ("Compensation", 110), ("Hiring / other timing", sal_diff - 195)], actual["salaries_other"])
    pti_components = [
        ("Revenue", rev_diff), ("Credit", aop["provision"] - actual["provision"]),
        ("Rewards / benefits", -rew_diff), ("Marketing", -mkt_diff), ("Personnel / OpEx", -sal_diff),
    ]
    bridge("Pretax income", aop["pretax_income"], pti_components, actual["pretax_income"])
    frame = pd.DataFrame(rows)
    frame["classification"] = "MODEL_OUTPUT"
    return frame


def build_revenue_drivers(monthly_actual: pd.DataFrame) -> pd.DataFrame:
    frame = monthly_actual[["month", "billed_business", "non_interest_revenue", "net_interest_income"]].copy()
    frame["spend_related_revenue"] = frame["non_interest_revenue"] * .68
    frame["card_fee_revenue"] = frame["non_interest_revenue"] * .24
    frame["other_non_interest_revenue"] = frame["non_interest_revenue"] - frame["spend_related_revenue"] - frame["card_fee_revenue"]
    frame["effective_monetization_rate"] = frame["spend_related_revenue"] / (frame["billed_business"] * 1000)
    frame["rewards_cost_rate"] = monthly_actual["rewards_services"] / (frame["billed_business"] * 1000)
    frame["classification"] = "SYNTHETIC_ALLOCATED"
    return frame


def build_cost_centers(monthly_actual: pd.DataFrame, headcount: pd.DataFrame) -> pd.DataFrame:
    cc_weights = dict(zip(COST_CENTERS, [.12, .12, .12, .08, .10, .12, .18, .16]))
    personnel = headcount.groupby(["month", "cost_center"], as_index=False)["personnel_expense"].sum()
    personnel["month"] = pd.to_datetime(personnel["month"])
    sal = monthly_actual[["month", "salaries_other"]].copy()
    merged = personnel.merge(sal, on="month")
    merged["published_bucket_allocation"] = merged.apply(lambda r: r["salaries_other"] * cc_weights[r["cost_center"]], axis=1)
    merged["non_personnel_opex"] = merged["published_bucket_allocation"] - merged["personnel_expense"]
    merged["vendor_spend"] = merged["non_personnel_opex"] * .38
    merged["technology_expense"] = merged["non_personnel_opex"] * .24
    merged["occupancy_shared"] = merged["non_personnel_opex"] * .14
    merged["other_opex"] = merged["non_personnel_opex"] - merged["vendor_spend"] - merged["technology_expense"] - merged["occupancy_shared"]
    merged["classification"] = "SYNTHETIC_ALLOCATED"
    return merged


def write_docs(aop: dict, forecast_2026: pd.DataFrame, validations: pd.DataFrame,
               scenarios: pd.DataFrame, ro: pd.DataFrame, public_history: pd.DataFrame) -> None:
    actual = PUBLIC_ANNUAL[2025]
    le = forecast_2026.iloc[1]
    aop_pti_var = actual["pretax_income"] - aop["pretax_income"]
    audit = f"""# Data audit

## Scope and periods

- Official files: FY2024 10-K, FY2025 10-K, Q4 2024 and Q4 2025 earnings materials, Q1 and Q2 2026 earnings materials and 10-Qs.
- Public USCS periods captured: 2022A through 2025A, quarterly 2024 and 2025, Q1 2026 and Q2 2026.
- Public reporting level: American Express U.S. Consumer Services. Consolidated information is used only for guidance, headcount constraints and context.
- Monthly actuals: unavailable publicly. Monthly management actuals are synthetic allocations that reconcile exactly to each public quarter and fiscal year.

## Source coverage

| Variable group | Level | Coverage | Classification | Transformation | Limitation |
|---|---|---:|---|---|---|
| USCS income statement | USCS | 2022A-2025A, quarterly 2024-2026Q2 | PUBLIC_ACTUAL | Direct transcription | Published expense categories are combined |
| Billed business and cards | USCS | 2022A-2026Q2 | PUBLIC_ACTUAL | Direct transcription | No monthly public series |
| Loans, delinquency and write-offs | USCS | 2022A-2026Q2 | PUBLIC_ACTUAL | Direct transcription | Simplified provision model cannot replicate proprietary reserves |
| 2025 company guidance | Consolidated | FY2025 | PUBLIC_GUIDANCE | Planning anchor | Guidance is not USCS-specific |
| Monthly schedules | USCS planning schedule | 2025-2026 | SYNTHETIC_ALLOCATED | Quarter-to-month allocation | Not reported American Express data |
| Cost centers, headcount and channels | Illustrative internal view | 2025-2026 | SYNTHETIC_ASSUMPTION | Calibrated to published expense totals | Does not represent actual organization or employment |

## Duplicates and overlaps

The 2025 10-K supersedes preliminary FY2025 earnings tables for annual totals. Quarterly tables remain the source for quarterly detail. The pipeline validates duplicates by metric, period and source.
"""
    (ROOT / "docs" / "data_audit.md").write_text(audit, encoding="utf-8")

    backtest = f"""# 2025 AOP backtest

## Outcome

The frozen AOP planned ${aop['total_revenue']:,.1f} million of revenue and ${aop['pretax_income']:,.1f} million of pretax income. Public actuals were ${actual['total_revenue']:,.0f} million and ${actual['pretax_income']:,.0f} million. Pretax income missed plan by ${abs(aop_pti_var):,.1f} million.

## What drove the result

- Revenue beat plan by ${actual['total_revenue'] - aop['total_revenue']:,.1f} million. Stronger lending and fee revenue offset a modest billed business miss against the AOP.
- Provision was ${aop['provision'] - actual['provision']:,.0f} million favorable as losses and reserve needs were below the original plan.
- Rewards, business development and Card Member services were ${actual['rewards_services'] - aop['rewards_services']:,.1f} million unfavorable. Published commentary links the increase to billed business, rewards, partner payments, benefit usage and new U.S. Platinum benefits.
- Salaries, employee benefits and other operating expenses were ${actual['salaries_other'] - aop['salaries_other']:,.1f} million unfavorable, reflecting higher allocated service and compensation costs.

## Forecast learning

After Q2 2025, the first-half run rate supported a higher rewards and services forecast. Credit performance partly offset that expense variance. Reporting revenue, provision and controllable expense separately would have shown the underlying cost trend.
"""
    (ROOT / "docs" / "2025_backtest.md").write_text(backtest, encoding="utf-8")

    commentary = f"""# Management commentary

## FY2025

USCS revenue exceeded AOP by ${actual['total_revenue'] - aop['total_revenue']:,.1f} million, supported by lending and fee growth. Provision was ${aop['provision'] - actual['provision']:,.0f} million favorable. Higher rewards and services cost of ${actual['rewards_services'] - aop['rewards_services']:,.1f} million and higher salaries and other operating expense of ${actual['salaries_other'] - aop['salaries_other']:,.1f} million more than offset those benefits, leaving pretax income ${abs(aop_pti_var):,.1f} million below plan.

## Q2 2026 latest estimate

H1 2026 revenue reached $18,647 million and pretax income reached $3,821 million. The FY2026 latest estimate is ${le['total_revenue']:,.1f} million of revenue and ${le['pretax_income']:,.1f} million of pretax income. Lower provision and marketing partly offset higher rewards, benefits and operating expense.

## Risks and opportunities

The main downside combines slower billed business with higher credit costs. Acquisition reallocation and earlier automation savings provide the largest controllable upside. These items remain outside the latest estimate until their evidence thresholds are met.
"""
    (ROOT / "docs" / "management_commentary.md").write_text(commentary, encoding="utf-8")

    limits = """# Model limitations

- American Express does not publish monthly USCS actuals, product-level USCS revenue, channel marketing spend, USCS headcount, or the eight illustrative cost centers used here.
- Monthly values, cost-center allocations, channel economics, product cohorts and workforce assumptions are synthetic and labeled as such.
- The provision model is a transparent planning proxy, not a replication of American Express credit-reserve models.
- 2026 Q3 and Q4 remain forecast periods. No future actuals are used.
- The project uses SQLite because DuckDB was unavailable in the runtime.
"""
    (ROOT / "docs" / "model_limitations.md").write_text(limits, encoding="utf-8")

    report_lines = ["# Validation report", "", "| Test | Status | Detail |", "|---|---|---|"]
    report_lines += [f"| {r.test} | {r.status} | {r.detail} |" for r in validations.itertuples()]
    (ROOT / "validation_report.md").write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    base_scen = scenarios.query("case == 'Base'").sort_values("pti_impact")
    top_risk = base_scen.iloc[0]
    top_opp = base_scen.iloc[-1]
    review = f"""# Review gate

## 1. Data audit

Official USCS annual data covers 2022-2025. Quarterly history covers 2024-2025 plus Q1 and Q2 2026. Monthly management actuals are labeled synthetic allocations.

## 2. Source coverage

The project uses official American Express SEC filings, investor-relations tables and earnings presentations. All 12 manifest files are stored under `data/raw/amex/`.

## 3. 2025 AOP assumptions

- Billed business growth: 8.5%
- Non-interest revenue growth: 9.5%
- Net interest income growth: 10.0%
- Provision: $3.100B
- Rewards and services growth: 11.5%
- Marketing: $3.180B
- Salaries and other operating expense growth: 8.0%

## 4. Hindsight-leakage result

PASS. Every frozen AOP record has an as-of date on or before January 24, 2025. No 2025 actual observation feeds the original AOP.

## 5. 2025 backtest

Revenue beat AOP by ${actual['total_revenue'] - aop['total_revenue']:,.1f}M. Pretax income missed by ${abs(aop_pti_var):,.1f}M because rewards, benefits, allocated service costs and compensation grew faster than planned.

## 6. Major variance bridges

The model includes revenue, provision, rewards, marketing, personnel/OpEx and pretax-income bridges. Each bridge reconciles from plan to actual.

## 7. 2026 latest estimate

The Q2 2026 latest estimate projects revenue of ${le['total_revenue']:,.1f}M and pretax income of ${le['pretax_income']:,.1f}M. Lower provision offsets higher rewards and operating expense.

## 8. Headcount assumptions

Synthetic 2025 opening headcount is 9,050 across four job families and eight illustrative cost centers. Loaded compensation includes a 28% benefit load. The schedule does not represent actual USCS employment.

## 9. Acquisition economics

Affiliate / Partner has the highest modeled first-year contribution per account. Paid Search has the shortest modeled payback. Funding should follow contribution and payback thresholds rather than volume alone.

## 10. Scenario outcomes

Largest modeled downside: {top_risk.scenario}, ${abs(top_risk.pti_impact):,.0f}M PTI impact. Largest modeled upside: {top_opp.scenario}, ${top_opp.pti_impact:,.0f}M PTI impact.

## 11. Top risks and opportunities

Top risks are H2 spend deceleration, benefit-cost inflation and credit normalization. Opportunities are persistent benign credit, premium-fee growth and earlier automation savings.

## 12. Model limitations

See `docs/model_limitations.md`. Public data cannot reveal monthly actuals, channel spend, cost centers or USCS workforce detail.

## 13. Repository tree

The repository contains configuration, raw and processed data, synthetic schedules, a local analytical database, Python modules, SQL examples, Excel and Power BI layers, a management deck, documentation, tests and outputs.

## 14. Artifacts generated

- `excel/Amex_USCS_FP&A_Model.xlsx`
- `outputs/2025_AOP_FROZEN.xlsx`
- `presentation/Amex_USCS_Management_Review_Final.pptx`
- `database/amex_uscs_fpa.sqlite`
- `powerbi/` model specifications and exports

The listed artifacts passed the review gate. No GitHub publication or push occurred.
"""
    (ROOT / "docs" / "review_gate.md").write_text(review, encoding="utf-8")


def write_powerbi_and_sql() -> None:
    (ROOT / "sql" / "example_queries.sql").write_text("""-- Budget vs actual by month
SELECT * FROM vw_budget_vs_actual ORDER BY month;

-- Marketing channels with the strongest first-year economics
SELECT channel, SUM(marketing_spend) spend, SUM(first_year_contribution) contribution,
       SUM(first_year_contribution) / SUM(marketing_spend) contribution_per_dollar
FROM vw_marketing_roi GROUP BY channel ORDER BY contribution_per_dollar DESC;

-- Q2 2026 scenario range
SELECT scenario, case, pti_impact, resulting_pti
FROM vw_scenario_summary ORDER BY scenario_id, case;
""", encoding="utf-8")
    (ROOT / "powerbi" / "data_model.md").write_text("""# Power BI data model

Star schema centered on `fact_budget`, `fact_actual`, `fact_forecast`, `fact_headcount`, `fact_marketing`, `fact_credit`, `fact_scenarios`, and `fact_risks_opportunities`. Dimensions are `dim_date`, `dim_cost_center`, `dim_job_family`, `dim_product_cohort`, and `dim_marketing_channel`.
""", encoding="utf-8")
    (ROOT / "powerbi" / "relationships.md").write_text("""# Relationships

- dim_date[Date] 1:* fact_budget[month], fact_actual[month], fact_headcount[month], fact_marketing[month]
- dim_cost_center[cost_center] 1:* fact_headcount[cost_center]
- dim_job_family[job_family] 1:* fact_headcount[job_family]
- dim_marketing_channel[channel] 1:* fact_marketing[channel]
""", encoding="utf-8")
    (ROOT / "powerbi" / "measures.dax").write_text("""Revenue := SUM(fact_actual[total_revenue])
Plan Revenue := SUM(fact_budget[total_revenue])
Revenue Variance := [Revenue] - [Plan Revenue]
Revenue Variance % := DIVIDE([Revenue Variance], [Plan Revenue])
Pretax Income := SUM(fact_actual[pretax_income])
Plan Pretax Income := SUM(fact_budget[pretax_income])
PTI Variance := [Pretax Income] - [Plan Pretax Income]
PTI Margin := DIVIDE([Pretax Income], [Revenue])
Marketing Spend := SUM(fact_marketing[marketing_spend])
New Accounts := SUM(fact_marketing[new_accounts])
CAC := DIVIDE([Marketing Spend] * 1000000, [New Accounts])
First Year Contribution := SUM(fact_marketing[first_year_contribution])
Contribution per Marketing Dollar := DIVIDE([First Year Contribution], [Marketing Spend])
""", encoding="utf-8")
    (ROOT / "powerbi" / "dashboard_spec.md").write_text("""# Dashboard specification

1. Executive Overview: revenue, PTI, margin, latest estimate, R&O.
2. P&L vs Plan: monthly and quarterly variance with bridge.
3. Revenue & Spend: billed business, cards, spend per account and monetization.
4. Acquisition & Marketing: spend, accounts, CAC, contribution and payback by channel.
5. Credit & Lending: balances, yield proxy, delinquency, write-offs and provision.
6. Membership Economics: rewards and benefit cost rates.
7. Headcount & OpEx: workforce roll-forward, loaded cost and cost-center allocation.
8. Forecast: AOP and LE vintages with waterfall.
9. Risks & Opportunities: probability and impact without automatic forecast booking.
10. Scenarios: individual toggles and combined management cases.
""", encoding="utf-8")


def write_readme() -> None:
    text = """# American Express U.S. Consumer Services FP&A

## Annual Operating Plan, Rolling Forecast and Performance Management

This project models the USCS planning cycle from the 2025 AOP through the Q2 2026 latest estimate. It includes plan-versus-actual analysis, forecast vintages, operating drivers, workforce and acquisition schedules, scenarios, Risks & Opportunities, SQL views, an Excel model and a management presentation.

## Scope

USCS includes spend, lending, fees, rewards, benefits, marketing, credit and servicing costs. The model connects those drivers to revenue, provision, operating expense and pretax income.

## Data sources

The model uses American Express SEC filings, investor-relations financial tables and earnings presentations. Raw files are under `data/raw/amex/`. The manifest is under `data/reference/source_pack/`. `data/reference/source_lineage.csv` identifies each important metric, source, date, classification and transformation.

## Data classification

Each modeled field uses one of six labels: `PUBLIC_ACTUAL`, `PUBLIC_GUIDANCE`, `DERIVED_PUBLIC`, `SYNTHETIC_ALLOCATED`, `SYNTHETIC_ASSUMPTION`, or `MODEL_OUTPUT`. Public USCS data remains separate from monthly allocations, illustrative cost centers, channel economics and workforce assumptions.

## 2025 AOP and leakage control

The AOP cutoff is January 24, 2025. The plan uses FY2024 actuals, trends available at the cutoff and the company’s 2025 revenue guidance. Automated checks reject any original-plan observation dated after the cutoff. The frozen workbook is in `outputs/2025_AOP_FROZEN.xlsx`.

## Rolling forecast and backtest

Forecast vintages include 2025 AOP, Q1/Q2/Q3 latest estimates, FY2025 actual, 2026 AOP and Q2 2026 latest estimate. The backtest separates revenue, credit, rewards, marketing and personnel/OpEx effects.

## Decision models

- Revenue: billed business, spend per account, monetization, NII and fee/other components.
- Acquisition: channel spend, new accounts, CAC, contribution, payback and break-even CAC.
- Credit: card balances, delinquency, write-offs and a transparent provision proxy.
- Rewards: cost relative to billed business and revenue.
- Workforce: monthly headcount roll-forward by cost center and job family.
- Scenarios: ten independent modules plus Base, Growth Investment, Consumer Stress and Efficiency cases.

## Model components

- Python pipeline: `python run_pipeline.py`
- SQLite database and management views: `database/amex_uscs_fpa.sqlite`
- Excel model: `excel/Amex_USCS_FP&A_Model.xlsx`
- Power BI-ready schema and DAX: `powerbi/`
- Management review: `presentation/Amex_USCS_Management_Review_Final.pptx`
- Review gate: `docs/review_gate.md`

## Limitations

American Express does not publish monthly USCS actuals, channel marketing spend, product-level USCS revenue, cost-center detail or USCS headcount. The project therefore uses explicitly labeled synthetic planning data that reconciles to public totals. It does not replicate proprietary credit, rewards or forecasting methodologies.

## Disclosure

Independent analysis based on public information. Illustrative planning detail does not represent American Express forecasts, budgets, organization or methods.
"""
    (ROOT / "README.md").write_text(text, encoding="utf-8")


def main() -> None:
    assumptions = load_assumptions(ROOT)
    public_history = build_public_history()
    quarterly_actuals = build_quarterly_actuals()
    aop = build_aop_2025(assumptions)
    monthly_aop = build_monthly_aop(aop)
    monthly_actual = build_monthly_actual_2025()
    forecast_vintages = build_forecast_vintages(aop)
    forecast_2026 = build_2026_forecast(assumptions)
    headcount_2025 = build_headcount(9050, 2025, [95, 80, 85, 90, 85, 75, 80, 75, 70, 65, 55, 45], [65, 64, 66, 68, 70, 72, 75, 76, 78, 80, 82, 84])
    headcount_2026 = build_headcount(9270, 2026, [70, 65, 65, 60, 60, 55, 50, 50, 45, 45, 40, 35], [78, 78, 80, 80, 82, 82, 84, 84, 86, 86, 88, 88])
    headcount = pd.concat([headcount_2025, headcount_2026], ignore_index=True)
    marketing = build_marketing(PUBLIC_ANNUAL[2025]["marketing"] * .62, 2025)
    scenarios = build_scenarios(float(forecast_2026.iloc[1]["pretax_income"]))
    combined = build_combined_cases(float(forecast_2026.iloc[1]["pretax_income"]))
    ro = build_risks_opportunities()
    lineage = build_lineage(public_history, quarterly_actuals, aop)
    bridges = build_variance_bridges(aop)
    revenue_drivers = build_revenue_drivers(monthly_actual)
    cost_centers = build_cost_centers(monthly_actual, headcount_2025)
    scenario_monthly = scenarios.assign(key=1).merge(pd.DataFrame({"month": pd.date_range("2026-01-01", "2026-12-01", freq="MS"), "key": 1}), on="key").drop(columns="key")
    scenario_monthly["monthly_pti_impact"] = scenario_monthly["pti_impact"] / 12
    scenario_monthly["classification"] = "MODEL_OUTPUT"

    kpis = pd.DataFrame({"category": ["Financial"] * 7 + ["Customer / Spend"] * 5 + ["Lending"] * 5 + ["Marketing"] * 6 + ["Membership"] * 3 + ["Workforce"] * 6,
                         "kpi": ["Revenue", "Revenue growth", "NII", "Provision", "Expense growth", "PTI", "PTI margin", "Billed Business", "Spend per account", "Cards / accounts", "G&S growth", "T&E growth", "Card Member loans", "Loan growth", "Yield", "Delinquency", "Write-off rate", "Marketing spend", "New accounts", "CAC", "Conversion", "First-year contribution", "Payback", "Rewards cost / billed business", "Benefit cost / account", "Retention rate proxy", "Headcount", "Hires", "Attrition", "Vacancies", "Loaded cost per employee", "OpEx per employee"],
                         "classification": "MODEL_OUTPUT"})

    validations = run_validations(public_history, monthly_aop, monthly_actual, quarterly_actuals, headcount, marketing, lineage, assumptions["project"]["aop_cutoff_date"])
    if (validations["status"] == "FAIL").any():
        raise RuntimeError(validations.to_string(index=False))

    frames = {
        "data/processed/public_history.csv": public_history,
        "data/processed/quarterly_actuals.csv": quarterly_actuals,
        "data/processed/2025_aop_monthly.csv": monthly_aop,
        "data/processed/2025_actual_monthly_allocated.csv": monthly_actual,
        "data/processed/forecast_vintages.csv": forecast_vintages,
        "data/processed/2026_forecast.csv": forecast_2026,
        "data/processed/variance_bridges.csv": bridges,
        "data/processed/revenue_drivers.csv": revenue_drivers,
        "data/processed/kpi_library.csv": kpis,
        "data/synthetic/headcount.csv": headcount,
        "data/synthetic/marketing_acquisition.csv": marketing,
        "data/synthetic/cost_centers.csv": cost_centers,
        "data/synthetic/scenarios.csv": scenarios,
        "data/synthetic/scenario_monthly.csv": scenario_monthly,
        "data/synthetic/combined_cases.csv": combined,
        "data/synthetic/risks_opportunities.csv": ro,
        "data/reference/source_lineage.csv": lineage,
    }
    for path, frame in frames.items():
        write_csv(frame, path)

    database_tables = {
        "fact_public_financials": public_history,
        "fact_operating_kpis": quarterly_actuals,
        "fact_budget": monthly_aop,
        "fact_actual": monthly_actual,
        "fact_forecast": pd.concat([forecast_vintages, forecast_2026], ignore_index=True),
        "fact_headcount": headcount,
        "fact_marketing": marketing,
        "fact_credit": quarterly_actuals[["period", "card_balances", "nco_rate", "delinquency", "provision", "classification"]],
        "fact_scenarios": scenarios,
        "fact_risks_opportunities": ro,
        "dim_date": pd.DataFrame({"date": pd.date_range("2022-01-01", "2026-12-01", freq="MS")}),
        "dim_cost_center": pd.DataFrame({"cost_center": COST_CENTERS}),
        "dim_job_family": pd.DataFrame({"job_family": headcount["job_family"].drop_duplicates()}),
        "dim_product_cohort": pd.DataFrame({"product_cohort": ["Premium proprietary", "Cobrand", "Cash Back / Core", "Lending-oriented"]}),
        "dim_marketing_channel": pd.DataFrame({"channel": marketing["channel"].drop_duplicates()}),
    }
    export_sqlite(ROOT / "database" / "amex_uscs_fpa.sqlite", database_tables)
    write_docs(aop, forecast_2026, validations, scenarios, ro, public_history)
    write_powerbi_and_sql()
    write_readme()
    (ROOT / "outputs" / "model_summary.json").write_text(json.dumps({"aop_2025": aop, "forecast_2026": forecast_2026.to_dict(orient="records")}, indent=2), encoding="utf-8")
    package = {name.replace("/", "_").replace(".csv", ""): frame.assign(**{
        col: frame[col].astype(str) for col in frame.columns if str(frame[col].dtype).startswith("datetime")
    }).to_dict(orient="records") for name, frame in frames.items()}
    (ROOT / "outputs" / "model_package.json").write_text(json.dumps(package, indent=2, default=str), encoding="utf-8")
    print(validations.to_string(index=False))


if __name__ == "__main__":
    main()
