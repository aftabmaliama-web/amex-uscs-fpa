# American Express U.S. Consumer Services FP&A

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
