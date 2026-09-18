from __future__ import annotations

import pandas as pd


SCENARIOS = [
    ("S01", "Consumer Spend Slowdown & Mix Shift", -1350, -520, -830, "Slow acquisition if spend per account weakens for two quarters."),
    ("S02", "Customer Acquisition Investment", 420, 520, -100, "Fund only channels with contribution per marketing dollar above 1.4x."),
    ("S03", "Credit Deterioration", 0, 650, -650, "Tighten marginal lending where provision-adjusted contribution falls below hurdle."),
    ("S04", "Rewards & Card Member Benefit Inflation", 180, 540, -360, "Require measurable engagement lift before expanding benefits."),
    ("S05", "Headcount & OpEx Productivity", -90, -420, 330, "Protect service capacity while pausing lower-priority hiring and reducing vendors."),
    ("S06", "Lending Growth & Interest Rate / Yield", 520, 210, 310, "Favor risk-adjusted loan growth over pure balance growth."),
    ("S07", "Cobrand / Partnership Economics", 260, 210, 50, "Renew only if partner funding offsets benefit and acquisition inflation."),
    ("S08", "Retention & Card Member Attrition", 310, 190, 120, "Target offers to high-contribution accounts and cap cost at preserved contribution."),
    ("S09", "New Card / Membership Benefit Launch", 380, 470, -90, "Stage launch spending against account and spend milestones."),
    ("S10", "Automation & Cost Transformation", 40, -310, 350, "Release funding by phase after adoption and service metrics hold."),
]


def build_scenarios(base_pti: float) -> pd.DataFrame:
    rows = []
    for scenario_id, name, revenue, expense, pti, recommendation in SCENARIOS:
        for case, multiplier in (("Low", 0.55), ("Base", 1.0), ("High / Stress", 1.45)):
            rev = round(revenue * multiplier, 1)
            exp = round(expense * multiplier, 1)
            pti_impact = round(pti * multiplier, 1)
            rows.append({
                "scenario_id": scenario_id,
                "scenario": name,
                "case": case,
                "fy_revenue_impact": rev,
                "expense_or_provision_impact": exp,
                "pti_impact": pti_impact,
                "resulting_pti": round(base_pti + pti_impact, 1),
                "management_recommendation": recommendation,
                "classification": "MODEL_OUTPUT",
            })
    return pd.DataFrame(rows)


def build_combined_cases(base_pti: float) -> pd.DataFrame:
    cases = [
        ("Base", 0, "Current Q2 latest estimate"),
        ("Growth Investment", -90, "Acquisition and product investment subject to channel return thresholds"),
        ("Consumer Stress", -1350, "Spend slowdown plus credit and attrition pressure"),
        ("Efficiency / Productivity", 520, "Vendor reductions and automation savings with service capacity maintained"),
    ]
    return pd.DataFrame([
        {"combined_case": name, "pti_impact": impact, "resulting_pti": base_pti + impact,
         "description": description, "classification": "MODEL_OUTPUT"}
        for name, impact, description in cases
    ])


def build_risks_opportunities() -> pd.DataFrame:
    rows = [
        ("R01", "Spend", "Affluent spend decelerates in H2", "Risk", .35, -600, -350, -150, "H2 2026", "Revenue FP&A", "Revenue", "Open", "Gate acquisition growth to spend quality"),
        ("R02", "Rewards", "Benefit and redemption costs exceed forecast", "Risk", .45, -420, -250, -100, "H2 2026", "Membership Finance", "Rewards", "Open", "Renegotiate partner offsets and pace benefit rollout"),
        ("R03", "Credit", "Loss rates rise from the Q2 2026 level", "Risk", .30, -500, -280, -120, "H2 2026", "Credit Finance", "Provision", "Monitoring", "Tighten marginal growth and update economic overlay"),
        ("O01", "Credit", "Lower losses persist", "Opportunity", .55, 120, 260, 420, "H2 2026", "Credit Finance", "Provision", "Monitoring", "Keep outside booked forecast until Q3 evidence"),
        ("O02", "Fees", "Premium refresh lifts fee-paying accounts", "Opportunity", .45, 90, 190, 320, "H2 2026", "Portfolio Finance", "Revenue", "Open", "Track activation, retention and first-year contribution"),
        ("O03", "Productivity", "Automation benefits arrive earlier", "Opportunity", .35, 80, 180, 300, "Q4 2026", "Technology Finance", "OpEx", "Open", "Release savings only after service metrics hold"),
    ]
    cols = ["id", "business_driver", "description", "risk_or_opportunity", "probability", "low_impact",
            "expected_impact", "high_impact", "timing", "owner", "p_and_l_line", "status", "management_action"]
    frame = pd.DataFrame(rows, columns=cols)
    frame["classification"] = "SYNTHETIC_ASSUMPTION"
    return frame
