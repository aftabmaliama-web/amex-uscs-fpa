# Validation report

| Test | Status | Detail |
|---|---|---|
| 2025 AOP monthly-to-annual reconciliation | PASS | Monthly AOP schedule totals exactly by construction. |
| 2025 actual monthly-to-quarterly reconciliation | PASS | Monthly synthetic allocations sum to published FY2025 revenue of 34814.0. |
| USCS FY2025 P&L reconciliation | PASS | Revenue - provision - expenses = pretax segment income. |
| Quarterly-to-annual revenue reconciliation | PASS | Four reported quarters reconcile to the 2025 10-K. |
| AOP leakage check | PASS | All original AOP records have as_of_date on or before 2025-01-24. |
| Headcount roll-forward | PASS | All monthly synthetic headcount balances remain non-negative. |
| Marketing acquisition math | PASS | Marketing spend / CAC equals new accounts by channel and month. |
| Source classification | PASS | Every lineage record uses an approved classification. |
| No duplicate lineage periods | PASS | No duplicated metric-period-source combinations. |
| Monthly public actual availability | WARNING | Public USCS monthly actuals do not exist. The model uses labeled synthetic allocations. |
