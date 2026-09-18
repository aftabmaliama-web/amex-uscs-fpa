import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = path.join(root, "outputs", "model_package.json");
const model = JSON.parse(await fs.readFile(packagePath, "utf8"));

const COLORS = {
  navy: "#00175A", blue: "#006FCF", lightBlue: "#D9ECFF", paleBlue: "#F3F8FD",
  green: "#107C41", red: "#C00000", yellow: "#FFF2CC", gray: "#E7E6E6", dark: "#1F2937", white: "#FFFFFF",
};
const metricLabels = {
  billed_business: "Billed Business ($B)", non_interest_revenue: "Non-interest revenue",
  net_interest_income: "Net interest income", total_revenue: "Total revenue net of interest expense",
  provision: "Provision for credit losses", rewards_services: "Rewards, business development & services",
  marketing: "Marketing", salaries_other: "Salaries, benefits & other OpEx",
  total_expenses: "Total expenses", pretax_income: "Pretax segment income",
};

function excelCol(n) {
  let s = "";
  while (n > 0) { n--; s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26); }
  return s;
}

function applyTitle(sheet, title, subtitle = "") {
  sheet.showGridLines = false;
  sheet.getRange("A1:N1").merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1:N1").format = { fill: COLORS.navy, font: { color: COLORS.white, bold: true, size: 16 }, rowHeight: 30, verticalAlignment: "center" };
  if (subtitle) {
    sheet.getRange("A2:N2").merge();
    sheet.getRange("A2").values = [[subtitle]];
    sheet.getRange("A2:N2").format = { fill: COLORS.paleBlue, font: { color: COLORS.dark, italic: true, size: 10 }, rowHeight: 24, wrapText: true };
  }
  sheet.freezePanes.freezeRows(3);
}

function formatHeader(range) {
  range.format = { fill: COLORS.blue, font: { color: COLORS.white, bold: true }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "all", style: "thin", color: "#B8C2CC" } };
}

function formatBody(range) {
  range.format = { borders: { preset: "all", style: "thin", color: "#D9E2F3" }, verticalAlignment: "center" };
}

function writeRecords(sheet, startRow, records, columns, numberFormats = {}) {
  const headers = columns.map(c => c.label);
  const headerRange = sheet.getRangeByIndexes(startRow - 1, 0, 1, columns.length);
  headerRange.values = [headers];
  formatHeader(headerRange);
  if (!records.length) return;
  const values = records.map(r => columns.map(c => {
    const v = r[c.key];
    if (c.date && v) return new Date(String(v).slice(0, 10) + "T00:00:00");
    return v ?? null;
  }));
  const body = sheet.getRangeByIndexes(startRow, 0, values.length, columns.length);
  body.values = values;
  formatBody(body);
  for (let i = 0; i < columns.length; i++) {
    const fmt = numberFormats[columns[i].key];
    if (fmt) sheet.getRangeByIndexes(startRow, i, values.length, 1).setNumberFormat(fmt);
  }
  sheet.getRangeByIndexes(startRow - 1, 0, values.length + 1, columns.length).format.autofitColumns();
  for (let i = 0; i < columns.length; i++) {
    const col = sheet.getRange(`${excelCol(i + 1)}:${excelCol(i + 1)}`);
    if (col.format.columnWidth > 28) col.format.columnWidth = 28;
  }
}

function addMonthlyPnlSheet(wb, name, title, records, classificationNote) {
  const sheet = wb.worksheets.add(name);
  applyTitle(sheet, title, classificationNote);
  const metrics = ["billed_business", "non_interest_revenue", "net_interest_income", "total_revenue", "provision", "rewards_services", "marketing", "salaries_other", "total_expenses", "pretax_income"];
  const headers = ["Metric", ...records.map(r => new Date(String(r.month).slice(0, 10) + "T00:00:00")), "FY"];
  sheet.getRangeByIndexes(3, 0, 1, headers.length).values = [headers];
  formatHeader(sheet.getRangeByIndexes(3, 0, 1, headers.length));
  sheet.getRange("B4:M4").setNumberFormat("mmm-yy");
  metrics.forEach((metric, idx) => {
    const row = 5 + idx;
    sheet.getRange(`A${row}`).values = [[metricLabels[metric]]];
    sheet.getRange(`B${row}:M${row}`).values = [records.map(r => Number(r[metric]))];
    sheet.getRange(`N${row}`).formulas = [[`=SUM(B${row}:M${row})`]];
  });
  formatBody(sheet.getRange("A5:N14"));
  sheet.getRange("B5:N14").setNumberFormat("#,##0.0;[Red](#,##0.0);-");
  sheet.getRange("A7:N7").format.font = { bold: true, color: COLORS.navy };
  sheet.getRange("A13:N14").format.font = { bold: true, color: COLORS.navy };
  sheet.getRange("A14:N14").format.borders = { bottom: { style: "double", color: COLORS.navy } };
  sheet.getRange("A:A").format.columnWidth = 38;
  sheet.getRange("B:N").format.columnWidth = 12;
  sheet.freezePanes.freezeColumns(1);
  return sheet;
}

async function buildMainWorkbook() {
  const wb = Workbook.create();
  const cover = wb.worksheets.add("Cover");
  cover.showGridLines = false;
  cover.getRange("A1:J3").merge();
  cover.getRange("A1").values = [["American Express U.S. Consumer Services FP&A"]];
  cover.getRange("A1:J3").format = { fill: COLORS.navy, font: { color: COLORS.white, bold: true, size: 26 }, verticalAlignment: "center", horizontalAlignment: "left" };
  cover.getRange("A5:J6").merge();
  cover.getRange("A5").values = [["Annual Operating Plan, Rolling Forecast & Performance Management"]];
  cover.getRange("A5:J6").format = { font: { color: COLORS.blue, bold: true, size: 18 }, wrapText: true };
  cover.getRange("A8:D13").values = [["Planning cutoff", "January 24, 2025", null, null], ["Current actuals", "Through Q2 2026", null, null], ["External scope", "American Express U.S. Consumer Services", null, null], ["Monthly actuals", "Model allocations reconciled to public quarters", null, null], ["Scenario selector", "Base", null, null], ["Status", "Functional review complete", null, null]];
  cover.getRange("A8:A13").format = { fill: COLORS.lightBlue, font: { bold: true, color: COLORS.navy } };
  cover.getRange("B8:D13").format = { borders: { preset: "all", style: "thin", color: "#D9E2F3" } };
  cover.getRange("A16:J18").merge();
  cover.getRange("A16").values = [["Independent analysis based on public information. Illustrative planning detail does not represent American Express forecasts, budgets, organization or methods."]];
  cover.getRange("A16:J18").format = { fill: COLORS.yellow, font: { color: COLORS.dark, italic: true }, wrapText: true, verticalAlignment: "center" };
  cover.getRange("A:J").format.columnWidth = 14;

  const exec = wb.worksheets.add("Executive Summary");
  applyTitle(exec, "Executive Summary", "FY2025 actual vs frozen AOP and Q2 2026 latest estimate. USD millions unless noted.");
  exec.getRange("A4:H4").values = [["Metric", "2025 AOP", "2025 Actual", "Variance", "Variance %", "2026 AOP", "Q2 2026 LE", "LE vs AOP"]];
  formatHeader(exec.getRange("A4:H4"));
  const execMetrics = ["Total revenue", "Provision", "Total expenses", "Pretax income", "Pretax margin"];
  exec.getRange("A5:A9").values = execMetrics.map(x => [x]);
  exec.getRange("B5:B8").formulas = [["='2025 AOP'!N8"], ["='2025 AOP'!N9"], ["='2025 AOP'!N13"], ["='2025 AOP'!N14"]];
  exec.getRange("C5:C8").formulas = [["='2025 Actual'!N8"], ["='2025 Actual'!N9"], ["='2025 Actual'!N13"], ["='2025 Actual'!N14"]];
  exec.getRange("D5:D8").formulasR1C1 = [["=RC[-1]-RC[-2]"], ["=RC[-1]-RC[-2]"], ["=RC[-1]-RC[-2]"], ["=RC[-1]-RC[-2]"]];
  exec.getRange("E5:E8").formulasR1C1 = [["=IFERROR(RC[-1]/RC[-3],0)"], ["=IFERROR(RC[-1]/RC[-3],0)"], ["=IFERROR(RC[-1]/RC[-3],0)"], ["=IFERROR(RC[-1]/RC[-3],0)"]];
  exec.getRange("B9").formulas = [["=B8/B5"]]; exec.getRange("C9").formulas = [["=C8/C5"]]; exec.getRange("D9").formulas = [["=C9-B9"]]; exec.getRange("E9").formulas = [["=D9"]];
  exec.getRange("F5:F8").formulas = [["='2026 Forecast'!B5"], ["='2026 Forecast'!B6"], ["='2026 Forecast'!B10"], ["='2026 Forecast'!B11"]];
  exec.getRange("G5:G8").formulas = [["='2026 Forecast'!C5"], ["='2026 Forecast'!C6"], ["='2026 Forecast'!C10"], ["='2026 Forecast'!C11"]];
  exec.getRange("H5:H8").formulasR1C1 = [["=RC[-1]-RC[-2]"], ["=RC[-1]-RC[-2]"], ["=RC[-1]-RC[-2]"], ["=RC[-1]-RC[-2]"]];
  exec.getRange("F9").formulas = [["=F8/F5"]]; exec.getRange("G9").formulas = [["=G8/G5"]]; exec.getRange("H9").formulas = [["=G9-F9"]];
  formatBody(exec.getRange("A5:H9"));
  exec.getRange("B5:D8").setNumberFormat("#,##0.0;[Red](#,##0.0);-"); exec.getRange("F5:H8").setNumberFormat("#,##0.0;[Red](#,##0.0);-");
  exec.getRange("E5:E9").setNumberFormat("0.0%;[Red](0.0%);-"); exec.getRange("B9:D9").setNumberFormat("0.0%;[Red](0.0%);-"); exec.getRange("F9:H9").setNumberFormat("0.0%;[Red](0.0%);-");
  exec.getRange("A12:H12").merge(); exec.getRange("A12").values = [["Management actions"]]; exec.getRange("A12:H12").format = { fill: COLORS.navy, font: { color: COLORS.white, bold: true, size: 14 } };
  exec.getRange("A13:H18").values = [
    ["2025 result", "Revenue beat plan, but rewards and allocated operating expense drove a pretax miss.", null, null, null, null, null, null],
    ["2026 outlook", "Lower provision offsets higher rewards and operating expense in the Q2 latest estimate.", null, null, null, null, null, null],
    ["Top risk", "Affluent spend slows while credit costs normalize.", null, null, null, null, null, null],
    ["Top opportunity", "Shift acquisition funding toward channels with stronger contribution and faster payback.", null, null, null, null, null, null],
    ["Decision required", "Protect high-return acquisition while pacing benefits and lower-priority hiring.", null, null, null, null, null, null],
    ["Forecast treatment", "Keep Risks & Opportunities outside the booked forecast until evidence meets the defined threshold.", null, null, null, null, null, null],
  ];
  [13,14,15,16,17,18].forEach(r => exec.getRange(`B${r}:H${r}`).merge());
  exec.getRange("A13:A18").format = { fill: COLORS.lightBlue, font: { bold: true, color: COLORS.navy } };
  exec.getRange("B13:H18").format = { wrapText: true, borders: { preset: "all", style: "thin", color: "#D9E2F3" } };
  exec.getRange("A:A").format.columnWidth = 24; exec.getRange("B:H").format.columnWidth = 16;

  const source = wb.worksheets.add("Source Map");
  applyTitle(source, "Source Map", "Official sources and field-level lineage. Model assumptions and allocations are labeled.");
  writeRecords(source, 4, model.data_reference_source_lineage, [
    {key:"metric",label:"Metric"},{key:"period",label:"Period"},{key:"value",label:"Value"},{key:"classification",label:"Classification"},{key:"source_name",label:"Source"},{key:"source_date",label:"Source date"},{key:"as_of_date",label:"As-of date"},{key:"transformation",label:"Transformation"},{key:"notes",label:"Notes"}
  ]);

  const ass = wb.worksheets.add("Assumptions");
  applyTitle(ass, "Assumptions", "Yellow cells are planning inputs. The frozen 2025 AOP uses no information dated after January 24, 2025.");
  const assumptionsRows = [
    ["Control", "Value", "Classification", "As-of date", "Planning rationale"],
    ["AOP cutoff date", new Date("2025-01-24T00:00:00"), "PUBLIC_GUIDANCE", new Date("2025-01-24T00:00:00"), "FY2024 results and 2025 company guidance available"],
    ["Active combined scenario", "Base", "SYNTHETIC_ASSUMPTION", new Date("2026-07-17T00:00:00"), "User-editable scenario selector"],
    ["2025 billed business growth", .085, "SYNTHETIC_ASSUMPTION", new Date("2025-01-24T00:00:00"), "FY2024 growth was 7%"],
    ["2025 non-interest revenue growth", .095, "SYNTHETIC_ASSUMPTION", new Date("2025-01-24T00:00:00"), "Discount revenue and premium fees"],
    ["2025 NII growth", .10, "SYNTHETIC_ASSUMPTION", new Date("2025-01-24T00:00:00"), "Loan growth partly offset by yield normalization"],
    ["2025 provision ($M)", 3100, "SYNTHETIC_ASSUMPTION", new Date("2025-01-24T00:00:00"), "Credit normalization planning case"],
    ["2025 rewards & services growth", .115, "SYNTHETIC_ASSUMPTION", new Date("2025-01-24T00:00:00"), "Spend and premium account growth"],
    ["2025 marketing ($M)", 3180, "SYNTHETIC_ASSUMPTION", new Date("2025-01-24T00:00:00"), "Disciplined growth investment"],
    ["2025 salaries & other growth", .08, "SYNTHETIC_ASSUMPTION", new Date("2025-01-24T00:00:00"), "Compensation plus allocated service costs"],
  ];
  ass.getRange("A4:E13").values = assumptionsRows;
  formatHeader(ass.getRange("A4:E4")); formatBody(ass.getRange("A5:E13"));
  ass.getRange("B5:B13").format.fill = COLORS.yellow;
  ass.getRange("B6").dataValidation = { rule: { type: "list", values: ["Base", "Growth Investment", "Consumer Stress", "Efficiency / Productivity"] } };
  ass.getRange("B7:B9").setNumberFormat("0.0%"); ass.getRange("B11").setNumberFormat("0.0%"); ass.getRange("B13").setNumberFormat("0.0%"); ass.getRange("B5").setNumberFormat("mm/dd/yy"); ass.getRange("D5:D13").setNumberFormat("mm/dd/yy");
  ass.getRange("A:A").format.columnWidth = 34; ass.getRange("B:B").format.columnWidth = 18; ass.getRange("C:C").format.columnWidth = 24; ass.getRange("D:D").format.columnWidth = 14; ass.getRange("E:E").format.columnWidth = 44;

  addMonthlyPnlSheet(wb, "2025 AOP", "2025 Annual Operating Plan", model.data_processed_2025_aop_monthly, "Frozen on January 24, 2025. FY2025 actual results are excluded.");
  addMonthlyPnlSheet(wb, "2025 Actual", "2025 Actual with Monthly Allocation", model.data_processed_2025_actual_monthly_allocated, "Monthly model allocations reconcile to reported quarterly and annual totals.");

  const bva = wb.worksheets.add("AOP vs Actual");
  applyTitle(bva, "2025 AOP vs Actual", "Variance convention: positive revenue and pretax variance are favorable. Positive expense variance is unfavorable.");
  bva.getRange("A4:E4").values = [["Metric", "AOP", "Actual", "Variance", "Variance %"]]; formatHeader(bva.getRange("A4:E4"));
  const bvaMetrics = ["Total revenue", "Provision", "Rewards & services", "Marketing", "Salaries & other OpEx", "Total expenses", "Pretax income"];
  bva.getRange("A5:A11").values = bvaMetrics.map(x => [x]);
  const refs = [[8,8],[9,9],[10,10],[11,11],[12,12],[13,13],[14,14]];
  refs.forEach((pair, i) => { const row=5+i; bva.getRange(`B${row}`).formulas=[[`='2025 AOP'!N${pair[0]}`]]; bva.getRange(`C${row}`).formulas=[[`='2025 Actual'!N${pair[1]}`]]; bva.getRange(`D${row}`).formulas=[[`=C${row}-B${row}`]]; bva.getRange(`E${row}`).formulas=[[`=IFERROR(D${row}/B${row},0)`]]; });
  formatBody(bva.getRange("A5:E11")); bva.getRange("B5:D11").setNumberFormat("#,##0.0;[Red](#,##0.0);-"); bva.getRange("E5:E11").setNumberFormat("0.0%;[Red](0.0%);-");
  bva.getRange("A:A").format.columnWidth = 32; bva.getRange("B:E").format.columnWidth = 16;

  const f26 = wb.worksheets.add("2026 Forecast");
  applyTitle(f26, "FY2026 Forecast", "2026 AOP vs Q2 latest estimate. Q1 and Q2 are public actuals; Q3 and Q4 remain forecast.");
  f26.getRange("A4:D4").values = [["Metric", "2026 AOP", "Q2 2026 LE", "LE vs AOP"]]; formatHeader(f26.getRange("A4:D4"));
  const f26Rows = ["total_revenue","provision","rewards_services","marketing","salaries_other","total_expenses","pretax_income"];
  f26.getRange("A5:A11").values = f26Rows.map(x => [metricLabels[x]]);
  const fdata = model.data_processed_2026_forecast;
  f26Rows.forEach((m,i)=>{ const row=5+i; f26.getRange(`B${row}`).values=[[Number(fdata[0][m])]]; f26.getRange(`C${row}`).values=[[Number(fdata[1][m])]]; f26.getRange(`D${row}`).formulas=[[`=C${row}-B${row}`]]; });
  formatBody(f26.getRange("A5:D11")); f26.getRange("B5:D11").setNumberFormat("#,##0.0;[Red](#,##0.0);-"); f26.getRange("A:A").format.columnWidth=38; f26.getRange("B:D").format.columnWidth=18;

  const rev = wb.worksheets.add("Revenue Drivers"); applyTitle(rev,"Revenue Drivers","Spend, lending, fee and other revenue components. Product splits are synthetic allocations.");
  writeRecords(rev,4,model.data_processed_revenue_drivers,[{key:"month",label:"Month",date:true},{key:"billed_business",label:"Billed Business ($B)"},{key:"spend_related_revenue",label:"Spend-related revenue"},{key:"effective_monetization_rate",label:"Monetization rate"},{key:"net_interest_income",label:"NII"},{key:"card_fee_revenue",label:"Card fee revenue"},{key:"other_non_interest_revenue",label:"Other revenue"},{key:"classification",label:"Classification"}],{billed_business:"#,##0.0",spend_related_revenue:"#,##0.0",effective_monetization_rate:"0.00%",net_interest_income:"#,##0.0",card_fee_revenue:"#,##0.0",other_non_interest_revenue:"#,##0.0",month:"mmm-yy"});

  const bb = wb.worksheets.add("Billed Business"); applyTitle(bb,"Billed Business","Monthly plan and synthetic actual allocation in USD billions.");
  bb.getRange("A4:C4").values=[["Month","2025 AOP","2025 Actual allocation"]]; formatHeader(bb.getRange("A4:C4"));
  const aopM=model.data_processed_2025_aop_monthly, actM=model.data_processed_2025_actual_monthly_allocated;
  bb.getRange("A5:C16").values=aopM.map((r,i)=>[new Date(String(r.month).slice(0,10)+"T00:00:00"),Number(r.billed_business),Number(actM[i].billed_business)]); formatBody(bb.getRange("A5:C16")); bb.getRange("A5:A16").setNumberFormat("mmm-yy"); bb.getRange("B5:C16").setNumberFormat("#,##0.0");

  const lending=wb.worksheets.add("Lending & NII"); applyTitle(lending,"Lending & Net Interest Income","Quarterly public card balances and NII. 2026 Q3-Q4 remain forecast in the full-year view.");
  writeRecords(lending,4,model.data_processed_quarterly_actuals,[{key:"period",label:"Period"},{key:"card_balances",label:"Card balances"},{key:"net_interest_income",label:"NII"},{key:"nco_rate",label:"Net write-off rate"},{key:"delinquency",label:"30+ days past due"},{key:"classification",label:"Classification"}],{card_balances:"#,##0.0",net_interest_income:"#,##0.0",nco_rate:"0.0%",delinquency:"0.0%"});

  const credit=wb.worksheets.add("Credit"); applyTitle(credit,"Credit Performance","Public quarterly provision, balances, delinquency and net write-off rates.");
  writeRecords(credit,4,model.data_processed_quarterly_actuals,[{key:"period",label:"Period"},{key:"provision",label:"Provision"},{key:"card_balances",label:"Card balances"},{key:"nco_rate",label:"Net write-off rate"},{key:"delinquency",label:"30+ days past due"}],{provision:"#,##0.0",card_balances:"#,##0.0",nco_rate:"0.0%",delinquency:"0.0%"});

  const rew=wb.worksheets.add("Rewards & Benefits"); applyTitle(rew,"Rewards & Membership Economics","Rewards and benefit cost as a share of billed business and revenue.");
  rew.getRange("A4:E4").values=[["Month","Rewards & services","Billed Business ($B)","Cost / billed business","Cost / revenue"]]; formatHeader(rew.getRange("A4:E4"));
  rew.getRange("A5:E16").values=actM.map(r=>[new Date(String(r.month).slice(0,10)+"T00:00:00"),Number(r.rewards_services),Number(r.billed_business),Number(r.rewards_services)/(Number(r.billed_business)*1000),Number(r.rewards_services)/Number(r.total_revenue)]); formatBody(rew.getRange("A5:E16")); rew.getRange("A5:A16").setNumberFormat("mmm-yy"); rew.getRange("B5:C16").setNumberFormat("#,##0.0"); rew.getRange("D5:E16").setNumberFormat("0.0%");

  const mkt=wb.worksheets.add("Marketing"); applyTitle(mkt,"Marketing Investment","Total marketing vs AOP and acquisition-channel economics.");
  mkt.getRange("A4:D4").values=[["Month","AOP","Actual allocation","Variance"]]; formatHeader(mkt.getRange("A4:D4"));
  mkt.getRange("A5:C16").values=aopM.map((r,i)=>[new Date(String(r.month).slice(0,10)+"T00:00:00"),Number(r.marketing),Number(actM[i].marketing)]); mkt.getRange("D5").formulas=[["=C5-B5"]]; mkt.getRange("D5:D16").fillDown(); formatBody(mkt.getRange("A5:D16")); mkt.getRange("A5:A16").setNumberFormat("mmm-yy"); mkt.getRange("B5:D16").setNumberFormat("#,##0.0;[Red](#,##0.0);-");

  const acq=wb.worksheets.add("Acquisition ROI"); applyTitle(acq,"Customer Acquisition ROI","Illustrative channel economics. Values do not represent reported American Express channel spend.");
  const channelAgg={}; for(const r of model.data_synthetic_marketing_acquisition){const k=r.channel; if(!channelAgg[k])channelAgg[k]={channel:k,marketing_spend:0,new_accounts:0,first_year_contribution:0,cac:Number(r.cac),payback_months:Number(r.payback_months),break_even_cac:Number(r.break_even_cac)}; channelAgg[k].marketing_spend+=Number(r.marketing_spend); channelAgg[k].new_accounts+=Number(r.new_accounts); channelAgg[k].first_year_contribution+=Number(r.first_year_contribution);} const channelRows=Object.values(channelAgg).map(r=>({...r,contribution_per_marketing_dollar:r.first_year_contribution/r.marketing_spend}));
  writeRecords(acq,4,channelRows,[{key:"channel",label:"Channel"},{key:"marketing_spend",label:"Spend"},{key:"new_accounts",label:"New accounts"},{key:"cac",label:"CAC ($)"},{key:"first_year_contribution",label:"First-year contribution"},{key:"contribution_per_marketing_dollar",label:"Contribution / $"},{key:"payback_months",label:"Payback (months)"},{key:"break_even_cac",label:"Break-even CAC ($)"}],{marketing_spend:"#,##0.0",new_accounts:"#,##0",cac:"$#,##0",first_year_contribution:"#,##0.0",contribution_per_marketing_dollar:"0.00x",payback_months:"0.0",break_even_cac:"$#,##0"});
  acq.getRange("A:A").format.columnWidth=24; acq.getRange("B:H").format.columnWidth=18;

  const hc=wb.worksheets.add("Headcount"); applyTitle(hc,"Headcount Plan","Illustrative workforce roll-forward by month, cost center and job family.");
  const hcRows=model.data_synthetic_headcount.filter(r=>String(r.month).startsWith("2025"));
  writeRecords(hc,4,hcRows,[{key:"month",label:"Month",date:true},{key:"cost_center",label:"Cost center"},{key:"job_family",label:"Job family"},{key:"beginning_headcount",label:"Beginning HC"},{key:"hires",label:"Hires"},{key:"attrition",label:"Attrition"},{key:"ending_headcount",label:"Ending HC"},{key:"loaded_cost_per_employee",label:"Loaded cost / employee"},{key:"personnel_expense",label:"Personnel expense"},{key:"classification",label:"Classification"}],{beginning_headcount:"#,##0.0",hires:"#,##0.0",attrition:"#,##0.0",ending_headcount:"#,##0.0",loaded_cost_per_employee:"$#,##0",personnel_expense:"#,##0.0",month:"mmm-yy"});

  const opex=wb.worksheets.add("OpEx"); applyTitle(opex,"Operating Expense","Monthly expense allocation with an illustrative personnel and non-personnel split.");
  const ccRows=model.data_synthetic_cost_centers; const byMonth={}; for(const r of ccRows){const m=String(r.month).slice(0,10); if(!byMonth[m])byMonth[m]={month:m,personnel:0,nonpersonnel:0,published:0};byMonth[m].personnel+=Number(r.personnel_expense);byMonth[m].nonpersonnel+=Number(r.non_personnel_opex);byMonth[m].published+=Number(r.published_bucket_allocation);} const opexRows=Object.values(byMonth);
  writeRecords(opex,4,opexRows,[{key:"month",label:"Month",date:true},{key:"personnel",label:"Personnel expense"},{key:"nonpersonnel",label:"Non-personnel OpEx"},{key:"published",label:"Published reconciliation bucket"}],{month:"mmm-yy",personnel:"#,##0.0",nonpersonnel:"#,##0.0",published:"#,##0.0"});

  const cc=wb.worksheets.add("Cost Centers"); applyTitle(cc,"Illustrative Planning Cost Centers","Eight planning cost centers allocated to the published USCS operating expense category.");
  const ccAgg={}; for(const r of ccRows){const k=r.cost_center;if(!ccAgg[k])ccAgg[k]={cost_center:k,personnel_expense:0,vendor_spend:0,technology_expense:0,occupancy_shared:0,other_opex:0,published_bucket_allocation:0}; for(const f of ["personnel_expense","vendor_spend","technology_expense","occupancy_shared","other_opex","published_bucket_allocation"])ccAgg[k][f]+=Number(r[f]);}
  writeRecords(cc,4,Object.values(ccAgg),[{key:"cost_center",label:"Cost center"},{key:"personnel_expense",label:"Personnel"},{key:"vendor_spend",label:"Vendor"},{key:"technology_expense",label:"Technology"},{key:"occupancy_shared",label:"Occupancy / shared"},{key:"other_opex",label:"Other OpEx"},{key:"published_bucket_allocation",label:"Total allocation"}],{personnel_expense:"#,##0.0",vendor_spend:"#,##0.0",technology_expense:"#,##0.0",occupancy_shared:"#,##0.0",other_opex:"#,##0.0",published_bucket_allocation:"#,##0.0"});
  cc.getRange("A:A").format.columnWidth=46; cc.getRange("B:G").format.columnWidth=16;

  const bridges=wb.worksheets.add("Variance Bridges"); applyTitle(bridges,"Variance Bridges","Plan-to-actual decompositions for revenue, credit, customer engagement, marketing, OpEx and PTI.");
  writeRecords(bridges,4,model.data_processed_variance_bridges,[{key:"bridge",label:"Bridge"},{key:"component",label:"Component"},{key:"impact",label:"Impact / total"},{key:"display_order",label:"Order"},{key:"classification",label:"Classification"}],{impact:"#,##0.0;[Red](#,##0.0);-",display_order:"0"});

  const scen=wb.worksheets.add("Scenarios"); applyTitle(scen,"Management Scenarios","Ten independent scenarios with assumptions and calculated outcomes by case.");
  writeRecords(scen,4,model.data_synthetic_scenarios,[{key:"scenario_id",label:"ID"},{key:"scenario",label:"Scenario"},{key:"case",label:"Case"},{key:"fy_revenue_impact",label:"Revenue impact"},{key:"expense_or_provision_impact",label:"Expense / provision impact"},{key:"pti_impact",label:"PTI impact"},{key:"resulting_pti",label:"Resulting PTI"},{key:"management_recommendation",label:"Management recommendation"}],{fy_revenue_impact:"#,##0.0;[Red](#,##0.0);-",expense_or_provision_impact:"#,##0.0;[Red](#,##0.0);-",pti_impact:"#,##0.0;[Red](#,##0.0);-",resulting_pti:"#,##0.0"});

  const ro=wb.worksheets.add("Risks & Opportunities"); applyTitle(ro,"Risks & Opportunities","R&O items remain outside the booked forecast. Impacts are shown in USD millions.");
  writeRecords(ro,4,model.data_synthetic_risks_opportunities,[{key:"id",label:"ID"},{key:"business_driver",label:"Driver"},{key:"description",label:"Description"},{key:"risk_or_opportunity",label:"Type"},{key:"probability",label:"Probability"},{key:"low_impact",label:"Low"},{key:"expected_impact",label:"Expected"},{key:"high_impact",label:"High"},{key:"timing",label:"Timing"},{key:"owner",label:"Owner"},{key:"p_and_l_line",label:"P&L line"},{key:"status",label:"Status"},{key:"management_action",label:"Management action"}],{probability:"0%",low_impact:"#,##0.0;[Red](#,##0.0);-",expected_impact:"#,##0.0;[Red](#,##0.0);-",high_impact:"#,##0.0;[Red](#,##0.0);-"});
  ro.getRange("C:C").format.columnWidth=38; ro.getRange("J:J").format.columnWidth=24; ro.getRange("M:M").format.columnWidth=50;

  const kpi=wb.worksheets.add("KPIs"); applyTitle(kpi,"Management KPI Library","Financial, customer, lending, marketing, membership and workforce measures.");
  writeRecords(kpi,4,model.data_processed_kpi_library,[{key:"category",label:"Category"},{key:"kpi",label:"KPI"},{key:"classification",label:"Classification"}]);

  const val=wb.worksheets.add("Validation"); applyTitle(val,"Validation","Terminal checks. No planning output depends on this sheet.");
  val.getRange("A4:D4").values=[["Test","Calculated value","Control","Status"]]; formatHeader(val.getRange("A4:D4"));
  const valRows=[
    ["FY2025 revenue reconciliation","='2025 Actual'!N8",34814,"=IF(ABS(B5-C5)<0.01,\"PASS\",\"FAIL\")"],
    ["FY2025 PTI reconciliation","='2025 Actual'!N14",6810,"=IF(ABS(B6-C6)<0.01,\"PASS\",\"FAIL\")"],
    ["AOP leakage cutoff","=MAX('Assumptions'!D5,'Assumptions'!D7:D13)",new Date("2025-01-24T00:00:00"),"=IF(B7<=C7,\"PASS\",\"FAIL\")"],
    ["Monthly actual revenue tie","=SUM('2025 Actual'!B8:M8)","='2025 Actual'!N8","=IF(ABS(B8-C8)<0.01,\"PASS\",\"FAIL\")"],
    ["PTI bridge tie","=SUMIFS('Variance Bridges'!C:C,'Variance Bridges'!A:A,\"Pretax income\",'Variance Bridges'!B:B,\"Actual\")",6810,"=IF(ABS(B9-C9)<0.01,\"PASS\",\"FAIL\")"],
  ];
  val.getRange("A5:A9").values=valRows.map(r=>[r[0]]); val.getRange("B5:B9").formulas=valRows.map(r=>[r[1]]); val.getRange("C5:C9").values=valRows.map(r=>[r[2]]); val.getRange("D5:D9").formulas=valRows.map(r=>[r[3]]); formatBody(val.getRange("A5:D9")); val.getRange("B5:C6").setNumberFormat("#,##0.0"); val.getRange("B7:C7").setNumberFormat("mm/dd/yy"); val.getRange("A:A").format.columnWidth=36; val.getRange("B:D").format.columnWidth=18;

  wb.worksheets.getItem("Source Map").tabColor = COLORS.gray;
  wb.worksheets.getItem("Assumptions").tabColor = "#FFC000";
  wb.worksheets.getItem("Validation").tabColor = COLORS.gray;
  wb.recalculate();
  const inspect = await wb.inspect({kind:"table",range:"Executive Summary!A1:H18",include:"values,formulas",tableMaxRows:20,tableMaxCols:10,maxChars:12000});
  await fs.writeFile(path.join(root,"tmp","artifact","workbook_inspect.ndjson"),inspect.ndjson,"utf8");
  const errors = await wb.inspect({kind:"match",searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",options:{useRegex:true,maxResults:300},summary:"final formula error scan"});
  await fs.writeFile(path.join(root,"tmp","artifact","workbook_formula_errors.ndjson"),errors.ndjson,"utf8");
  for (const sheetName of wb.worksheets.items.map(s=>s.name)) {
    const preview = await wb.render({sheetName,autoCrop:"all",scale:1,format:"png"});
    await fs.writeFile(path.join(root,"tmp","artifact",`sheet-${sheetName.replace(/[^A-Za-z0-9]+/g,"-")}.png`),new Uint8Array(await preview.arrayBuffer()));
  }
  const out = await SpreadsheetFile.exportXlsx(wb);
  await out.save(path.join(root,"excel","Amex_USCS_FP&A_Model.xlsx"));
}

async function buildFrozenAop() {
  const wb = Workbook.create();
  const sheet = addMonthlyPnlSheet(wb,"2025 AOP FROZEN","2025 Annual Operating Plan: Frozen Snapshot",model.data_processed_2025_aop_monthly,"Frozen on January 24, 2025. FY2025 actual results are excluded.");
  sheet.getRange("A17:N19").merge(); sheet.getRange("A17").values=[["Monthly values allocate the annual plan using FY2024 seasonality and assumptions available on the cutoff date."]]; sheet.getRange("A17:N19").format={fill:COLORS.yellow,wrapText:true,font:{italic:true,color:COLORS.dark},verticalAlignment:"center"};
  wb.recalculate();
  const preview = await wb.render({sheetName:"2025 AOP FROZEN",autoCrop:"all",scale:1,format:"png"});
  await fs.writeFile(path.join(root,"tmp","artifact","2025-aop-frozen.png"),new Uint8Array(await preview.arrayBuffer()));
  const out = await SpreadsheetFile.exportXlsx(wb);
  await out.save(path.join(root,"outputs","2025_AOP_FROZEN.xlsx"));
}

await fs.mkdir(path.join(root,"tmp","artifact"),{recursive:true});
await buildMainWorkbook();
await buildFrozenAop();
