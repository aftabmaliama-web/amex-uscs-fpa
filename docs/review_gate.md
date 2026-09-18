# Review gate

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

Revenue beat AOP by $345.0M. Pretax income missed by $389.9M because rewards, benefits, allocated service costs and compensation grew faster than planned.

## 6. Major variance bridges

The model includes revenue, provision, rewards, marketing, personnel/OpEx and pretax-income bridges. Each bridge reconciles from plan to actual.

## 7. 2026 latest estimate

The Q2 2026 latest estimate projects revenue of $38,370.1M and pretax income of $7,894.1M. Lower provision offsets higher rewards and operating expense.

## 8. Headcount assumptions

Synthetic 2025 opening headcount is 9,050 across four job families and eight illustrative cost centers. Loaded compensation includes a 28% benefit load. The schedule does not represent actual USCS employment.

## 9. Acquisition economics

Affiliate / Partner has the highest modeled first-year contribution per account. Paid Search has the shortest modeled payback. Funding should follow contribution and payback thresholds rather than volume alone.

## 10. Scenario outcomes

Largest modeled downside: Consumer Spend Slowdown & Mix Shift, $830M PTI impact. Largest modeled upside: Automation & Cost Transformation, $350M PTI impact.

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
