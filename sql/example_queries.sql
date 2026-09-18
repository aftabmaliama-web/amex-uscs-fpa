-- Budget vs actual by month
SELECT * FROM vw_budget_vs_actual ORDER BY month;

-- Marketing channels with the strongest first-year economics
SELECT channel, SUM(marketing_spend) spend, SUM(first_year_contribution) contribution,
       SUM(first_year_contribution) / SUM(marketing_spend) contribution_per_dollar
FROM vw_marketing_roi GROUP BY channel ORDER BY contribution_per_dollar DESC;

-- Q2 2026 scenario range
SELECT scenario, case, pti_impact, resulting_pti
FROM vw_scenario_summary ORDER BY scenario_id, case;
