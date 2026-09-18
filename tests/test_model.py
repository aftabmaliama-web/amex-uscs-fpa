import unittest

from src.headcount_model import build_headcount
from src.marketing_model import build_marketing
from src.monthly_allocator import allocate_total, quarterly_to_monthly
from src.scenarios import build_combined_cases, build_scenarios


class ModelTests(unittest.TestCase):
    def test_allocate_total_reconciles_after_rounding(self):
        values = allocate_total(100.0, [1, 1, 1], precision=2)
        self.assertEqual(sum(values), 100.0)
        self.assertEqual(values, [33.33, 33.33, 33.34])

    def test_quarterly_to_monthly_preserves_year_total(self):
        quarters = {"Q1": 30, "Q2": 60, "Q3": 90, "Q4": 120}
        weights = {quarter: [1, 1, 1] for quarter in quarters}
        monthly = quarterly_to_monthly(quarters, weights)
        self.assertEqual(len(monthly), 12)
        self.assertAlmostEqual(sum(monthly), 300.0, places=6)

    def test_marketing_math_and_spend_reconciliation(self):
        marketing = build_marketing(100.0, 2025)
        self.assertAlmostEqual(marketing["marketing_spend"].sum(), 100.0, places=6)
        implied_accounts = marketing["marketing_spend"] * 1_000_000 / marketing["cac"]
        self.assertTrue(((implied_accounts - marketing["new_accounts"]).abs() < 0.01).all())

    def test_headcount_roll_forward(self):
        hires = [20] * 12
        attrition = [10] * 12
        headcount = build_headcount(1_000, 2025, hires, attrition)
        december = headcount[headcount["month"] == "2025-12-01"]
        self.assertAlmostEqual(december["ending_headcount"].sum(), 1_120.0, places=6)
        self.assertTrue((headcount["ending_headcount"] >= 0).all())

    def test_scenario_outputs_reconcile_to_base(self):
        base_pti = 7_894.0
        scenarios = build_scenarios(base_pti)
        self.assertEqual(len(scenarios), 30)
        self.assertTrue(
            ((scenarios["resulting_pti"] - scenarios["pti_impact"] - base_pti).abs() < 0.01).all()
        )
        combined = build_combined_cases(base_pti)
        self.assertEqual(combined.loc[combined["combined_case"] == "Base", "resulting_pti"].iloc[0], base_pti)


if __name__ == "__main__":
    unittest.main()
