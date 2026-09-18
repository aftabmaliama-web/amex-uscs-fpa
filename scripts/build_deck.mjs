import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_DIR = "C:\\Users\\Aftab\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.909.11814\\skills\\presentations";
const RUNTIME_PYTHON = "C:\\Users\\Aftab\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";
const buildDir = path.join(root, "tmp", "deck");
const FINAL_PPTX = path.join(root, "presentation", "Amex_USCS_Management_Review_Final.pptx");
await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });

const model = JSON.parse(await fs.readFile(path.join(root, "outputs", "model_package.json"), "utf8"));
const { resolvePresentationFont, applyPresentationChartFont, makeNativeBulletParagraphs, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href,
);
// PowerPoint tables default to Calibri in the export runtime; preserving that
// installed family keeps native tables, charts, and slide text typographically consistent.
const family = resolvePresentationFont({ sourceFont: "Calibri" });
const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = { navy: "#00175A", blue: "#006FCF", sky: "#D9ECFF", pale: "#F5F9FD", ink: "#172033", gray: "#5B667A", line: "#CCD7E5", green: "#107C41", red: "#C00000", amber: "#A15C00", white: "#FFFFFF" };
const chartNumber = (value, decimals = 4) => Number(Number(value).toFixed(decimals));
const SRC = {
  tenK2025: "https://d18rn0p25nwr6d.cloudfront.net/CIK-0000004962/0adef908-f8b7-4f66-b1cf-7d92a2b68ccb.pdf",
  q425: "https://s26.q4cdn.com/747928648/files/doc_earnings/2025/q4/supplemental-info/Q4-2025-Earnings-Tables.pdf",
  q126: "https://s26.q4cdn.com/747928648/files/doc_earnings/2026/q1/supplemental-info/Q1-2026-Earnings-Tables.pdf",
  q226: "https://s26.q4cdn.com/747928648/files/doc_earnings/2026/q2/supplemental-info/Q2-2026-Earnings-Tables.pdf",
};

function addText(slide, text, left, top, width, height, style = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", position: { left, top, width, height }, fill: style.fill ?? "none", line: style.line ?? { fill: "none", width: 0 } });
  shape.text = text;
  shape.text.style = { typeface: family, fontSize: style.fontSize ?? 22, color: style.color ?? C.ink, bold: style.bold ?? false, italic: style.italic ?? false, autoFit: "shrinkText", alignment: style.alignment ?? "left", verticalAlignment: style.verticalAlignment ?? "top" };
  return shape;
}

function baseSlide(title, subtitle, number) {
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addText(slide, title, 60, 38, 1160, 56, { fontSize: 34, bold: true, color: C.navy });
  addText(slide, subtitle, 60, 96, 1120, 34, { fontSize: 15, italic: true, color: C.gray });
  const rule = slide.shapes.add({ geometry: "rect", position: { left: 60, top: 132, width: 1160, height: 4 }, fill: C.blue, line: { fill: "none", width: 0 } });
  addText(slide, `American Express USCS FP&A     ${number}`, 60, 684, 1160, 20, { fontSize: 11, color: C.gray, alignment: "right" });
  return slide;
}

function styleTable(table, headerRows = 1, headerFontSize = 15, bodyFontSize = 14) {
  table.borders.assign({ style: "solid", fill: C.line, width: 1 });
  const header = table.cells.block({ row: 0, column: 0, rowCount: headerRows, columnCount: table.columns.length });
  header.fill = C.navy;
  header.textStyle.bold = true;
  header.textStyle.color = C.white;
  header.textStyle.fontSize = headerFontSize;
  if (table.rows.length > headerRows) {
    const body = table.cells.block({ row: headerRows, column: 0, rowCount: table.rows.length - headerRows, columnCount: table.columns.length });
    body.fill = C.white;
    body.textStyle.color = C.ink;
    body.textStyle.fontSize = bodyFontSize;
  }
}

function notes(slide, lines) { slide.speakerNotes.textFrame.setText(lines.join("\n")); }

const aop = model.data_processed_2025_aop_monthly.reduce((s,r)=>{for(const k of ["total_revenue","provision","total_expenses","pretax_income","rewards_services","marketing","salaries_other"])s[k]=(s[k]||0)+Number(r[k]);return s;},{});
const act = model.data_processed_2025_actual_monthly_allocated.reduce((s,r)=>{for(const k of ["total_revenue","provision","total_expenses","pretax_income","rewards_services","marketing","salaries_other"])s[k]=(s[k]||0)+Number(r[k]);return s;},{});
const f26 = model.data_processed_2026_forecast;

// 1. Executive Summary
{
  const s = baseSlide("Executive Summary", "FY2025 backtest and Q2 2026 forecast", 1);
  const t = s.tables.add({ rows: 2, columns: 4, left: 60, top: 160, width: 1160, height: 110, columnWidths: [290,290,290,290], values: [
    ["FY2025 revenue vs AOP", "FY2025 PTI vs AOP", "FY2026 Q2 LE revenue", "FY2026 Q2 LE PTI"],
    [`+$${(act.total_revenue-aop.total_revenue).toFixed(0)}M`, `($${Math.abs(act.pretax_income-aop.pretax_income).toFixed(0)}M)`, `$${(Number(f26[1].total_revenue)/1000).toFixed(1)}B`, `$${(Number(f26[1].pretax_income)/1000).toFixed(1)}B`],
  ]}); styleTable(t); t.cells.block({row:1,column:0,rowCount:1,columnCount:4}).textStyle.fontSize=25; t.getCell(1,0).text.color=C.green; t.getCell(1,1).text.color=C.red;
  addText(s,"Performance",60,300,520,34,{fontSize:23,bold:true,color:C.navy});
  const perf=addText(s,"",60,340,520,245,{fontSize:18}); perf.text=makeNativeBulletParagraphs([
    "Revenue beat plan, but rewards and allocated operating expense drove a pretax miss.",
    "Credit performed better than planned and partly masked controllable cost pressure.",
    "H1 2026 revenue and pretax income grew 11% and 12% year over year, respectively."
  ],{marginLeftPoints:18,hangingPoints:9,spaceAfterPoints:10}); perf.text.style={typeface:family,fontSize:18,color:C.ink,autoFit:"shrinkText"};
  addText(s,"Decisions",650,300,520,34,{fontSize:23,bold:true,color:C.navy});
  const dec=addText(s,"",650,340,520,245,{fontSize:18}); dec.text=makeNativeBulletParagraphs([
    "Direct incremental acquisition spend to channels that clear contribution and payback hurdles.",
    "Delay benefit expansion until engagement supports the higher rewards and service cost.",
    "Pause lower-priority hiring while maintaining servicing and technology capacity."
  ],{marginLeftPoints:18,hangingPoints:9,spaceAfterPoints:10}); dec.text.style={typeface:family,fontSize:18,color:C.ink,autoFit:"shrinkText"};
  notes(s,[`Sources: American Express 2025 10-K ${SRC.tenK2025}`,`Q2 2026 Earnings Tables ${SRC.q226}`,"AOP values and recommendations are model outputs. They are not American Express guidance."]);
}

// 2. P&L vs AOP
{
  const s=baseSlide("USCS P&L vs AOP","USD millions. Positive revenue and PTI variance are favorable. Expense increases are unfavorable.",2);
  const rows=[
    ["Total revenue",aop.total_revenue.toFixed(0),act.total_revenue.toFixed(0),(act.total_revenue-aop.total_revenue).toFixed(0)],
    ["Provision",aop.provision.toFixed(0),act.provision.toFixed(0),(act.provision-aop.provision).toFixed(0)],
    ["Rewards & services",aop.rewards_services.toFixed(0),act.rewards_services.toFixed(0),(act.rewards_services-aop.rewards_services).toFixed(0)],
    ["Marketing",aop.marketing.toFixed(0),act.marketing.toFixed(0),(act.marketing-aop.marketing).toFixed(0)],
    ["Salaries & other",aop.salaries_other.toFixed(0),act.salaries_other.toFixed(0),(act.salaries_other-aop.salaries_other).toFixed(0)],
    ["Pretax income",aop.pretax_income.toFixed(0),act.pretax_income.toFixed(0),(act.pretax_income-aop.pretax_income).toFixed(0)],
  ];
  const t=s.tables.add({rows:7,columns:4,left:60,top:165,width:615,height:365,columnWidths:[245,120,120,130],values:[["Metric","AOP","Actual","Variance"],...rows]}); styleTable(t);
  const impacts=[345,133,-580,-7,-281,-390];
  const chart=s.charts.add("bar",{position:{left:720,top:175,width:480,height:330},title:"Pretax bridge drivers",categories:["Revenue","Credit","Rewards","Marketing","Other OpEx","Net PTI"],series:[{name:"PTI impact",values:impacts.map(v=>chartNumber(v,1)),fill:C.blue,points:[{idx:1,fill:C.green},{idx:2,fill:C.red},{idx:3,fill:C.red},{idx:4,fill:C.red},{idx:5,fill:C.red}]}],barOptions:{direction:"column",grouping:"clustered"},hasLegend:false,yAxis:{numberFormatCode:"$#,##0M"},dataLabels:{showValue:true,position:"outEnd",textStyle:{fontSize:11,fill:C.ink}}}); applyPresentationChartFont(chart,{fontFamily:family});
  addText(s,"Rewards and operating expense more than offset revenue and credit favorability.",720,530,480,60,{fontSize:18,bold:true,color:C.navy});
  notes(s,[`Source: American Express 2025 10-K, USCS Table 8. ${SRC.tenK2025}`,"AOP and variance attribution are model outputs based on assumptions available at January 24, 2025."]);
}

// 3. Revenue, billed business and mix
{
  const s=baseSlide("Revenue, Billed Business & Mix Drivers","Public quarterly USCS billed business through Q2 2026",3);
  const q=model.data_processed_quarterly_actuals;
  const chart=s.charts.add("bar",{position:{left:60,top:170,width:730,height:380},title:"Quarterly billed business ($B)",categories:q.map(r=>r.period),series:[{name:"Billed business ($B)",values:q.map(r=>chartNumber(r.billed_business,1)),fill:C.blue}],barOptions:{direction:"column",grouping:"clustered"},hasLegend:false,yAxis:{numberFormatCode:"0.0",min:140,max:210},dataLabels:{showValue:true,position:"outEnd",textStyle:{fontSize:12,fill:C.ink}}}); applyPresentationChartFont(chart,{fontFamily:family});
  const t=s.tables.add({rows:6,columns:2,left:835,top:175,width:365,height:320,columnWidths:[200,165],values:[
    ["Driver","Management read"],["H1 2026 billed business","+11% YoY"],["Cards in force","49.2M at Q2 2026"],["Spend per basic card","+5% H1 YoY"],["2025 revenue","+11% YoY"],["Mix","Premium fee + T&E"],
  ]}); styleTable(t,1,14,13);
  addText(s,"Maintain premium engagement. Add acquisition capacity only if spend per account remains on plan.",60,570,1140,48,{fontSize:17,bold:true,color:C.navy});
  notes(s,[`Sources: Q4 2025 Earnings Tables ${SRC.q425}`,`Q2 2026 Earnings Tables ${SRC.q226}`]);
}

// 4. Customer acquisition and marketing
{
  const s=baseSlide("Customer Acquisition & Marketing Efficiency","Illustrative channel economics. Channel spend is synthetic and does not represent reported American Express data.",4);
  const mk=model.data_synthetic_marketing_acquisition; const agg={}; for(const r of mk){if(!agg[r.channel])agg[r.channel]={spend:0,accounts:0,contrib:0,cac:Number(r.cac),payback:Number(r.payback_months)};agg[r.channel].spend+=Number(r.marketing_spend);agg[r.channel].accounts+=Number(r.new_accounts);agg[r.channel].contrib+=Number(r.first_year_contribution);} const rows=Object.entries(agg).map(([k,v])=>[k,v.spend.toFixed(0),v.cac.toFixed(0),(v.contrib/v.spend).toFixed(2),v.payback.toFixed(1)]);
  const t=s.tables.add({rows:5,columns:5,left:60,top:165,width:690,height:330,columnWidths:[210,120,110,130,120],values:[["Channel","Spend ($M)","CAC ($)","Contribution / $","Payback (mo.)"],...rows]}); styleTable(t);
  const chart=s.charts.add("bar",{position:{left:790,top:175,width:410,height:300},title:"First-year contribution per marketing dollar",categories:rows.map(r=>r[0]),series:[{name:"Contribution / $",values:rows.map(r=>chartNumber(r[3],2)),fill:C.blue}],barOptions:{direction:"bar",grouping:"clustered"},hasLegend:false,xAxis:{numberFormatCode:"0.0x",min:1.2,max:1.8},dataLabels:{showValue:true,position:"outEnd",textStyle:{fontSize:12,fill:C.ink}}}); applyPresentationChartFont(chart,{fontFamily:family});
  addText(s,"Recommendation",60,530,210,30,{fontSize:21,bold:true,color:C.navy}); addText(s,"Reallocate incremental budget toward Paid Search and Digital while keeping Affiliate / Partner funding tied to higher expected contribution.",275,528,925,70,{fontSize:18,color:C.ink});
  notes(s,[`Source for total USCS marketing: American Express 2025 10-K ${SRC.tenK2025}`,"Channel allocation, CAC, contribution and payback are model assumptions and outputs."]);
}

// 5. Rewards and membership economics
{
  const s=baseSlide("Rewards & Membership Economics","Public rewards, business development and Card Member services divided by billed business",5);
  const q=model.data_processed_quarterly_actuals;
  const rates=q.map(r=>100*Number(r.rewards_services)/(Number(r.billed_business)*1000));
  const chart=s.charts.add("line",{position:{left:60,top:170,width:760,height:360},title:"Customer engagement expense / billed business (%)",categories:q.map(r=>r.period),series:[{name:"Cost rate",values:rates.map(v=>chartNumber(v,3)),line:{fill:C.blue,width:3},marker:{symbol:"circle",size:8}}],lineOptions:{smooth:false},hasLegend:false,yAxis:{numberFormatCode:"0.0",min:2,max:2.7},dataLabels:{showValue:true,position:"outEnd",textStyle:{fontSize:12,fill:C.ink}}}); applyPresentationChartFont(chart,{fontFamily:family});
  const t=s.tables.add({rows:5,columns:2,left:860,top:180,width:340,height:270,columnWidths:[170,170],values:[
    ["Question","Management threshold"],["Benefit inflation","Require engagement lift"],["Partner offsets","Track separately"],["Redemption cost","Update quarterly"],["New benefits","Stage against activation"],
  ]}); styleTable(t);
  addText(s,"The cost rate rose in Q1 2026 and eased in Q2. The forecast retains the higher run rate and tracks partner funding separately.",860,565,340,72,{fontSize:16,bold:true,color:C.navy});
  notes(s,[`Sources: Q4 2025 Earnings Tables ${SRC.q425}`,`Q1 2026 Earnings Tables ${SRC.q126}`,`Q2 2026 Earnings Tables ${SRC.q226}`]);
}

// 6. Lending and credit
{
  const s=baseSlide("Lending & Credit Performance","H1 2026 credit metrics improved. The forecast retains a normalization allowance.",6);
  const q=model.data_processed_quarterly_actuals;
  const chart=s.charts.add("line",{position:{left:60,top:170,width:720,height:350},title:"Net write-off and delinquency rates",categories:q.map(r=>r.period),series:[{name:"Net write-off rate",values:q.map(r=>chartNumber(r.nco_rate,6)),line:{fill:C.red,width:3},marker:{symbol:"circle",size:7}},{name:"30+ days past due",values:q.map(r=>chartNumber(r.delinquency,6)),line:{fill:C.blue,width:3},marker:{symbol:"diamond",size:7}}],hasLegend:true,legend:{position:"bottom",textStyle:{fontSize:12,fill:C.ink}},yAxis:{numberFormatCode:"0.0%",min:.005,max:.03},dataLabels:{showValue:false}}); applyPresentationChartFont(chart,{fontFamily:family});
  const t=s.tables.add({rows:7,columns:3,left:825,top:175,width:375,height:350,columnWidths:[115,130,130],values:[["Period","Provision ($M)","Card balances ($B)"],...q.map(r=>[r.period,Number(r.provision).toFixed(0),Number(r.card_balances).toFixed(1)])]}); styleTable(t);
  addText(s,"Q2 provision fell 40% year over year. A return toward 2025 loss rates would reduce the current provision benefit.",60,605,1140,48,{fontSize:17,bold:true,color:C.navy});
  notes(s,[`Sources: Q4 2025 Earnings Tables ${SRC.q425}`,`Q1 2026 Earnings Tables ${SRC.q126}`,`Q2 2026 Earnings Tables ${SRC.q226}`]);
}

// 7. Headcount and OpEx
{
  const s=baseSlide("Headcount & OpEx","Illustrative workforce schedule tied to the published USCS operating expense category",7);
  const hc=model.data_synthetic_headcount.filter(r=>String(r.month).startsWith("2025")); const months=[...new Set(hc.map(r=>String(r.month).slice(0,7)))];
  const monthSummary=months.map(m=>{const rs=hc.filter(r=>String(r.month).startsWith(m));return {m,hc:rs.reduce((x,r)=>x+Number(r.ending_headcount),0),pers:rs.reduce((x,r)=>x+Number(r.personnel_expense),0)};});
  const op=model.data_synthetic_cost_centers; const personnel=op.reduce((x,r)=>x+Number(r.personnel_expense),0), nonpersonnel=op.reduce((x,r)=>x+Number(r.non_personnel_opex),0);
  const chart=s.charts.add("line",{position:{left:60,top:170,width:700,height:340},title:"Illustrative ending headcount",categories:monthSummary.map(r=>r.m),series:[{name:"Headcount",values:monthSummary.map(r=>chartNumber(r.hc,0)),line:{fill:C.blue,width:3},marker:{symbol:"circle",size:6}}],hasLegend:false,yAxis:{numberFormatCode:"#,##0",min:9000,max:9350}}); applyPresentationChartFont(chart,{fontFamily:family});
  const t=s.tables.add({rows:5,columns:2,left:805,top:180,width:395,height:290,columnWidths:[245,150],values:[
    ["Planning metric","FY2025 model"],["Opening headcount","9,050"],["Ending headcount",monthSummary.at(-1).hc.toFixed(0)],["Personnel expense",`$${personnel.toFixed(0)}M`],["Non-personnel OpEx",`$${nonpersonnel.toFixed(0)}M`],
  ]}); styleTable(t);
  addText(s,"Pause lower-priority hiring and reduce vendor spend first. Maintain staffing for servicing, controls and technology.",60,545,1140,75,{fontSize:18,bold:true,color:C.navy});
  notes(s,[`Source for public expense bucket: American Express 2025 10-K ${SRC.tenK2025}`,"Headcount, job-family mix, compensation and cost-center allocation are SYNTHETIC_ASSUMPTION / SYNTHETIC_ALLOCATED."]);
}

// 8. Rolling forecast
{
  const s=baseSlide("Rolling Forecast & Latest Estimate","Each vintage preserves the assumptions known at that update",8);
  const fv=model.data_processed_forecast_vintages;
  const chart=s.charts.add("line",{position:{left:60,top:170,width:700,height:350},title:"FY2025 pretax income by forecast vintage",categories:fv.map(r=>r.vintage),series:[{name:"Pretax income",values:fv.map(r=>chartNumber(r.pretax_income,1)),line:{fill:C.blue,width:3},marker:{symbol:"circle",size:8}}],hasLegend:false,yAxis:{numberFormatCode:"$#,##0M",min:6500,max:7300},dataLabels:{showValue:true,position:"outEnd",textStyle:{fontSize:12,fill:C.ink}}}); applyPresentationChartFont(chart,{fontFamily:family});
  const t=s.tables.add({rows:5,columns:3,left:805,top:175,width:395,height:320,columnWidths:[185,105,105],values:[
    ["FY2026 metric","AOP","Q2 LE"],["Revenue",Number(f26[0].total_revenue).toFixed(0),Number(f26[1].total_revenue).toFixed(0)],["Provision",Number(f26[0].provision).toFixed(0),Number(f26[1].provision).toFixed(0)],["Total expenses",Number(f26[0].total_expenses).toFixed(0),Number(f26[1].total_expenses).toFixed(0)],["Pretax income",Number(f26[0].pretax_income).toFixed(0),Number(f26[1].pretax_income).toFixed(0)],
  ]}); styleTable(t);
  addText(s,"The Q2 latest estimate is $49M above AOP. A $531M provision benefit and $163M marketing timing benefit offset higher rewards and operating expense.",60,555,1140,70,{fontSize:18,bold:true,color:C.navy});
  notes(s,[`Sources for Q1/Q2 actuals: ${SRC.q126} and ${SRC.q226}`,"2025 forecast vintages and 2026 Q3/Q4 forecasts are MODEL_OUTPUT."]);
}

// 9. Scenarios, risks and opportunities
{
  const s=baseSlide("Scenarios, Risks & Opportunities","Scenario impacts are not automatically booked into the latest estimate",9);
  const base=model.data_synthetic_scenarios.filter(r=>r.case==="Base").sort((a,b)=>Number(a.pti_impact)-Number(b.pti_impact));
  const selected=[base[0],base[1],base[2],base.at(-2),base.at(-1)];
  const scenarioLabel={"Consumer Spend Slowdown & Mix Shift":"Spend slowdown","Credit Deterioration":"Credit stress","Rewards & Card Member Benefit Inflation":"Rewards inflation","Headcount & OpEx Productivity":"OpEx productivity","Automation & Cost Transformation":"Automation"};
  const chart=s.charts.add("bar",{position:{left:60,top:170,width:720,height:360},title:"Base-case PTI impact by selected scenario",categories:selected.map(r=>scenarioLabel[r.scenario]??r.scenario),series:[{name:"PTI impact",values:selected.map(r=>chartNumber(r.pti_impact,1)),fill:C.blue,points:selected.map((r,i)=>({idx:i,fill:Number(r.pti_impact)<0?C.red:C.green}))}],barOptions:{direction:"column",grouping:"clustered"},hasLegend:false,yAxis:{numberFormatCode:"$#,##0M"},dataLabels:{showValue:true,position:"outEnd",textStyle:{fontSize:12,fill:C.ink}}}); applyPresentationChartFont(chart,{fontFamily:family});
  const ro=model.data_synthetic_risks_opportunities;
  const t=s.tables.add({rows:7,columns:3,left:820,top:170,width:380,height:390,columnWidths:[70,190,120],values:[["ID","Item","Expected impact"],...ro.map(r=>[r.id,r.business_driver,Number(r.expected_impact).toFixed(0)])]}); styleTable(t);
  addText(s,"Review billed business, rewards cost and credit indicators each month. Add R&O items to the forecast only after the evidence threshold is met.",60,560,1140,70,{fontSize:18,bold:true,color:C.navy});
  notes(s,["Scenario and R&O values are SYNTHETIC_ASSUMPTION / MODEL_OUTPUT. Public actual anchors come from official American Express materials listed in the project lineage."]);
}

// 10. Recommendations and decisions
{
  const s=baseSlide("Management Recommendations & Decisions","Actions linked to measurable triggers and owners",10);
  const t=s.tables.add({rows:7,columns:5,left:60,top:165,width:1160,height:410,columnWidths:[210,390,180,170,210],values:[
    ["Decision","Recommended action","Owner","Timing","Trigger"],
    ["Acquisition budget","Shift spend to channels >1.4x first-year contribution / marketing $","Marketing Finance","Q3 2026","CAC and payback"],
    ["Benefits","Stage benefits. Require partner offsets or measured engagement lift","Membership Finance","Monthly","Rewards/services rate"],
    ["Hiring","Pause lower-priority roles. Protect service and technology","Business FP&A","Q3-Q4 2026","Vacancy + service"],
    ["Credit","Hold downside overlay outside forecast until loss indicators turn","Credit Finance","Quarterly","NCO + delinquency"],
    ["Automation","Fund by milestone. Release savings after sustained adoption","Technology Finance","2026-2027","Adoption + savings"],
    ["Forecast governance","Separate booked forecast from R&O. Refresh evidence each close","USCS Finance","Every close","Evidence threshold"],
  ]}); styleTable(t,1,11,10);
  addText(s,"Fund growth only where returns clear the hurdle. Retain the higher rewards cost rate and the credit downside allowance in the forecast.",60,642,1160,26,{fontSize:13,bold:true,color:C.navy});
  notes(s,["Recommendations are analyst conclusions from this model. They do not represent American Express management plans."]);
}

const stagingDir=path.join(root,"tmp","deck","finalizer");
await fs.mkdir(stagingDir,{recursive:true});
const candidatePath=path.join(stagingDir,"candidate.pptx");
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const requirements={
  explicitTotalSlideCount:10,
  requiredNativeTableOwnerSlides:[1,2,3,4,5,6,7,8,9,10],
  requiredNativeChartOwnerSlides:[2,3,4,5,6,7,8,9],
  materializeLiteralChartWorkbooks:true,
};
const result=await finalizePresentation({
  ...requirements,
  workspaceDir:root,
  candidatePath,
  finalPath:FINAL_PPTX,
  pythonExecutable:RUNTIME_PYTHON,
  integrityValidatorPath:path.join(SKILL_DIR,"container_tools","inspect_presentation_package_integrity.py"),
  layoutValidatorPath:path.join(SKILL_DIR,"container_tools","inspect_presentation_layout_geometry.py"),
  layoutArgs:["--expected-slide-size-emu","12192000,6858000","--validate-bullet-geometry","--validate-heading-fit",...requirements.requiredNativeTableOwnerSlides.flatMap(n=>["--require-native-table-slide",String(n)])],
  requiredNativeTableOwnerSlides:requirements.requiredNativeTableOwnerSlides,
  requiredNativeChartOwnerSlides:requirements.requiredNativeChartOwnerSlides,
  materializeLiteralChartWorkbooks:true,
  fontPolicy:{basis:"design",families:[family]},
  verifyArtifactToolImport:true,
  receiptPath:path.join(stagingDir,"Amex_USCS_Management_Review_Final.validation.json"),
});
await fs.writeFile(path.join(buildDir,"finalizer_result.json"),JSON.stringify(result,null,2),"utf8");
for(let i=0;i<p.slides.items.length;i++){
  const slide=p.slides.items[i];
  const png=await p.export({slide,format:"png",scale:1});
  await fs.writeFile(path.join(buildDir,`slide-${String(i+1).padStart(2,"0")}.png`),new Uint8Array(await png.arrayBuffer()));
  const layout=await slide.export({format:"layout"});
  await fs.writeFile(path.join(buildDir,`slide-${String(i+1).padStart(2,"0")}.layout.json`),await layout.text(),"utf8");
}
