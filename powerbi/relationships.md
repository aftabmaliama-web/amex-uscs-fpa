# Relationships

- dim_date[Date] 1:* fact_budget[month], fact_actual[month], fact_headcount[month], fact_marketing[month]
- dim_cost_center[cost_center] 1:* fact_headcount[cost_center]
- dim_job_family[job_family] 1:* fact_headcount[job_family]
- dim_marketing_channel[channel] 1:* fact_marketing[channel]
