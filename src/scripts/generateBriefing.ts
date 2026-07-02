import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';

const C = {
  ink: '#141918', paper: '#F5F3EE', surface: '#EDEAE3',
  rule: '#C7C2B8', accent: '#B8520A', slate: '#4A5750', white: '#FFFFFF',
  tier1: '#1A4731', tier2: '#7A4F1D', tier3: '#5C1F1F',
};

function hex(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

const PAGE_W = 595.28, PAGE_H = 841.89, ML = 64, MR = 64, MT = 64;
const COL_W = PAGE_W - ML - MR;

function hrule(doc: PDFKit.PDFDocument, y: number, color = C.rule, t = 0.5) {
  doc.save().strokeColor(hex(color)).lineWidth(t).moveTo(ML, y).lineTo(PAGE_W - MR, y).stroke().restore();
}

function pageHeader(doc: PDFKit.PDFDocument, section: string) {
  doc.save().font('Courier').fontSize(7).fillColor(hex(C.slate))
    .text('IMPACT INTELLIGENCE FRAMEWORK — CLIENT BRIEFING', ML, 28, { continued: true })
    .text(section, { align: 'right' }).restore();
  hrule(doc, 42, C.rule, 0.4);
}

function sectionHeading(doc: PDFKit.PDFDocument, num: string, title: string) {
  if (doc.y > PAGE_H - 160) { doc.addPage(); }
  doc.moveDown(0.8);
  const y = doc.y;
  doc.save().font('Courier').fontSize(8.5).fillColor(hex(C.accent)).text(num, ML, y).restore();
  doc.save().font('Times-Bold').fontSize(15).fillColor(hex(C.ink)).text(title, ML + 30, y).restore();
  doc.moveDown(0.3);
  hrule(doc, doc.y, C.ink, 1.5);
  doc.moveDown(0.6);
}

function subHeading(doc: PDFKit.PDFDocument, title: string) {
  doc.moveDown(0.4);
  doc.save().font('Helvetica-Bold').fontSize(10).fillColor(hex(C.ink)).text(title, ML).restore();
  doc.moveDown(0.2);
}

function label(doc: PDFKit.PDFDocument, text: string) {
  doc.save().font('Courier').fontSize(7).fillColor(hex(C.slate))
    .text(text.toUpperCase(), ML, doc.y, { characterSpacing: 0.7 }).restore();
  doc.moveDown(0.15);
}

function body(doc: PDFKit.PDFDocument, text: string, indent = 0) {
  doc.save().font('Helvetica').fontSize(9.5).fillColor(hex(C.ink))
    .text(text, ML + indent, doc.y, { width: COL_W - indent, lineGap: 2.5 }).restore();
  doc.moveDown(0.5);
}

function bullet(doc: PDFKit.PDFDocument, text: string, indent = 12) {
  const y = doc.y;
  doc.save().font('Helvetica').fontSize(9).fillColor(hex(C.accent)).text('—', ML + indent, y).restore();
  doc.save().font('Helvetica').fontSize(9).fillColor(hex(C.ink))
    .text(text, ML + indent + 16, y, { width: COL_W - indent - 16, lineGap: 2 }).restore();
  doc.moveDown(0.3);
}

function drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][], colWidths: number[]) {
  const PAD_X = 5, PAD_Y = 4, MIN_H = 18;
  let y = doc.y;
  doc.save().fillColor(hex(C.surface)).rect(ML, y, COL_W, MIN_H).fill().restore();
  hrule(doc, y, C.rule, 0.5);
  headers.forEach((h, i) => {
    const cx = ML + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.save().font('Courier').fontSize(7).fillColor(hex(C.slate))
      .text(h.toUpperCase(), cx + PAD_X, y + PAD_Y, { width: colWidths[i] - PAD_X * 2, lineBreak: false, characterSpacing: 0.5 }).restore();
  });
  y += MIN_H; hrule(doc, y, C.rule, 0.5);
  rows.forEach((row, ri) => {
    let rowH = MIN_H;
    row.forEach((cell, ci) => {
      const h = doc.heightOfString(String(cell ?? ''), { width: colWidths[ci] - PAD_X * 2 }) + PAD_Y * 2;
      if (h > rowH) rowH = h;
    });
    if (y + rowH > PAGE_H - MT) { doc.addPage(); y = MT; }
    doc.save().fillColor(ri % 2 === 0 ? hex(C.white) : hex(C.paper)).rect(ML, y, COL_W, rowH).fill().restore();
    row.forEach((cell, ci) => {
      const cx = ML + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);
      doc.save().font('Helvetica').fontSize(8.5).fillColor(hex(C.ink))
        .text(String(cell ?? ''), cx + PAD_X, y + PAD_Y, { width: colWidths[ci] - PAD_X * 2, lineGap: 1 }).restore();
    });
    y += rowH; hrule(doc, y, C.rule, 0.3);
  });
  doc.y = y; doc.moveDown(0.8);
}

function callout(doc: PDFKit.PDFDocument, text: string) {
  const y = doc.y;
  const h = doc.heightOfString(text, { width: COL_W - 24 }) + 20;
  doc.save().fillColor(hex(C.surface)).rect(ML, y, COL_W, h).fill().restore();
  doc.save().fillColor(hex(C.accent)).rect(ML, y, 3, h).fill().restore();
  doc.save().font('Helvetica').fontSize(9).fillColor(hex(C.ink))
    .text(text, ML + 14, y + 10, { width: COL_W - 24, lineGap: 2 }).restore();
  doc.y = y + h + 6;
}

async function build(): Promise<void> {
  const outPath = path.join(process.cwd(), 'IIF-Client-Briefing.pdf');
  const doc = new PDFDocument({ size: 'A4', margins: { top: MT, left: ML, right: MR, bottom: MT }, autoFirstPage: false });
  const out = fs.createWriteStream(outPath);
  doc.pipe(out);

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // ─── COVER ──────────────────────────────────────────────────────────────────
  doc.addPage();
  const coverH = PAGE_H * 0.52;
  doc.save().fillColor(hex(C.ink)).rect(0, 0, PAGE_W, coverH).fill().restore();
  doc.save().font('Helvetica').fontSize(7.5).fillColor(hex(C.white)).opacity(0.3)
    .text('CONFIDENTIAL — FOR AUTHORISED RECIPIENTS ONLY', ML, 32, { characterSpacing: 1.2 }).restore();
  doc.save().font('Helvetica').fontSize(7.5).fillColor(hex(C.accent)).opacity(1)
    .text('IMPACT DRIVER × UPTONVILLE NIGERIA LIMITED', ML, 46, { characterSpacing: 1.0 }).restore();
  hrule(doc, 62, '#FFFFFF', 0.25);
  doc.save().font('Courier').fontSize(9).fillColor(hex(C.accent))
    .text('CLIENT BRIEFING DOCUMENT', ML, 76, { characterSpacing: 1.0 }).restore();
  doc.save().font('Times-Bold').fontSize(32).fillColor(hex(C.white))
    .text('Impact Intelligence\nFramework (IIF)', ML, 96, { width: COL_W, lineGap: 4 }).restore();
  doc.save().font('Helvetica').fontSize(11).fillColor(hex(C.white)).opacity(0.55)
    .text('What we built, how it works, and how it delivers on the MoU', ML, 182).restore();

  const gridY = coverH - 88;
  hrule(doc, gridY, '#FFFFFF', 0.25);
  const meta = [
    ['Prepared by', 'Impact Driver'], ['Prepared for', 'Uptonville Nigeria Limited'],
    ['Date', today], ['Version', 'Phase 1 — Complete Build'],
  ];
  const cw2 = COL_W / 2;
  meta.forEach(([lbl, val], i) => {
    const col = i % 2, row = Math.floor(i / 2), gx = ML + col * (cw2 + 14), gy = gridY + 12 + row * 28;
    doc.save().font('Courier').fontSize(7).fillColor('#FFFFFF').opacity(0.3).text(lbl.toUpperCase(), gx, gy, { characterSpacing: 0.6 }).restore();
    doc.save().font('Helvetica').fontSize(9.5).fillColor('#FFFFFF').opacity(0.8).text(val, gx, gy + 11).restore();
  });

  const footerY = PAGE_H - 48;
  hrule(doc, footerY, C.rule, 0.5);
  doc.save().font('Helvetica').fontSize(8).fillColor(hex(C.slate))
    .text('This document summarises the Phase 1 deliverables of the Impact Intelligence Framework, built under the Strategic Collaboration Agreement between Impact Driver and Uptonville Nigeria Limited.', ML, footerY + 10, { width: COL_W, lineGap: 2 }).restore();

  // ─── RUNNING HEADER setup ───────────────────────────────────────────────────
  let currentSection = '';
  doc.on('pageAdded', () => {
    pageHeader(doc, currentSection);
    doc.y = 58;
  });

  // ─── PAGE 2: EXECUTIVE SUMMARY ──────────────────────────────────────────────
  doc.addPage(); currentSection = 'Executive Summary';
  sectionHeading(doc, '01', 'Executive Summary');

  callout(doc, 'The Impact Intelligence Framework (IIF) is a co-branded, full-stack web platform that digitises, structures, and analyses ESG and environmental impact data from Uptonville Nigeria Limited\'s historical project portfolio. It transforms unstructured project records into a live, queryable knowledge base that powers eight analytical engines — producing regulatory disclosures, benchmarking insights, and decision support intelligence for future projects.');

  doc.moveDown(0.3);
  subHeading(doc, 'What the partnership set out to achieve');
  body(doc, 'The Strategic Collaboration Agreement between Impact Driver and Uptonville Nigeria Limited established a mandate to build a digitised ESG and impact reporting platform tailored to the Nigerian oil and gas sector. The platform was to ingest data from 7–10 historical Uptonville projects, structure it against a standardised 12-section extraction template, and aggregate it into eight analytical engines covering regulatory compliance, stakeholder intelligence, decision support, benchmarking, and disclosure reporting.');

  subHeading(doc, 'What Phase 1 delivers');
  const deliverables = [
    'A complete full-stack web application — accessible from any device, secured behind role-based authentication',
    'A 12-section project template (Sections A–L) that captures every ESG data point the MoU specifies',
    'Eight live analytical engines that aggregate data across all projects as new templates are filled',
    'A disclosure reporting engine that generates co-branded PDF reports aligned to GRI, ISSB, IFC, TNFD, and NUPRC frameworks',
    'An admin panel for user management, CSV data exports, and system statistics',
    'Full deployment infrastructure for Vercel (frontend) and Render (backend) with MongoDB Atlas as the database',
  ];
  deliverables.forEach(d => bullet(doc, d));

  // ─── PAGE 3: PLATFORM ARCHITECTURE ──────────────────────────────────────────
  doc.addPage(); currentSection = 'Platform Architecture';
  sectionHeading(doc, '02', 'Platform Architecture');

  body(doc, 'The platform is built as a modern decoupled web application: a React/Next.js frontend served from Vercel communicates with a Node.js/Express API on Render, which reads and writes to a MongoDB Atlas database. The frontend and backend are maintained in separate GitHub repositories and deployed independently.');

  doc.moveDown(0.2);
  drawTable(doc,
    ['Layer', 'Technology', 'Deployment', 'Purpose'],
    [
      ['Frontend', 'Next.js 14, TypeScript, Tailwind CSS', 'Vercel (iad1 region)', 'All user-facing screens — project register, extraction workspace, engine dashboards, admin panel'],
      ['Backend API', 'Node.js, Express, TypeScript', 'Render (web service)', 'REST API serving all data operations, PDF generation, CSV export, auth'],
      ['Database', 'MongoDB Atlas', 'Cloud (dedicated cluster)', 'Stores all project records, templates, users, engine maps, sign-offs'],
      ['PDF Engine', 'pdfkit (pure Node.js)', 'Runs on Render', 'Server-side PDF generation — no Chromium dependency, no headless browser'],
      ['Auth', 'JWT (7-day tokens)', 'Stateless, backend-enforced', 'Role-based access control with section-level permission gates'],
    ],
    [60, 110, 110, COL_W - 280]
  );

  subHeading(doc, 'Security and access control');
  body(doc, 'Every API route is protected by JWT authentication middleware. Section-level write permissions are enforced on both the frontend (UI gating) and backend (controller-level role checks), ensuring that, for example, an Impact Driver Analyst cannot overwrite sections owned by the Uptonville Technical Reviewer.');

  drawTable(doc,
    ['Role', 'Sections (write)', 'Sections (read)', 'Additional access'],
    [
      ['uptonville_reviewer', 'A, D, G, H', 'All', 'Project creation, project register'],
      ['impact_driver_analyst', 'B, C, E, F, I, J', 'All', 'Engine dashboards, report generation'],
      ['steering_committee', 'L (sign-off only)', 'All', 'Can set status to signed-off'],
      ['admin', 'All', 'All', 'User management, CSV exports, system stats, backfill utilities'],
    ],
    [100, 80, 60, COL_W - 240]
  );

  // ─── PAGE 4: 12-SECTION TEMPLATE ─────────────────────────────────────────────
  doc.addPage(); currentSection = 'The 12-Section Template';
  sectionHeading(doc, '03', 'The 12-Section Project Template');

  body(doc, 'Every project on the platform is linked to a single structured extraction template containing twelve sections (A–L). Sections A–J correspond directly to the data capture framework defined in the MoU. Sections K and L handle engine mapping and formal sign-off. Each section tracks its own completion status (not started / in progress / complete) and is protected by role-based access.');

  doc.moveDown(0.2);
  drawTable(doc,
    ['Section', 'Title', 'Role (write)', 'Feeds engine(s)', 'Key data captured'],
    [
      ['A', 'Project Identification & Context', 'Uptonville Reviewer', 'Project Classification, Benchmarking', 'Name, reference code, type, location, environment, client, operator, duration, value, tier'],
      ['B', 'Indicator Library', 'Analyst', 'Indicator Library, Materiality, Benchmarking', 'ESG indicators (E/S/G), units, measurement methods, rationale'],
      ['C', 'Regulatory Rules', 'Analyst', 'Regulatory Rules Engine', 'Regulations applied, issuing body, application details (NUPRC, NESREA, NOSDRA, IFC, etc.)'],
      ['D', 'Stakeholder Registry', 'Uptonville Reviewer', 'Stakeholder Intelligence, Materiality', 'Stakeholder groups, interests, reporting format required, engagement outcomes'],
      ['E', 'Mitigation Measures (Decision Support)', 'Analyst', 'Decision Support Engine', 'Mitigation measures, effectiveness (high/medium/low), evidence, recommendations, expert reasoning'],
      ['F', 'Regulatory Evidence', 'Analyst', 'Regulatory Rules Engine, Reporting', 'Evidence submitted per regulation, format, frequency, accepted without dispute (Y/N)'],
      ['G', 'Environmental Outcomes', 'Uptonville Reviewer', 'Materiality, Benchmarking, Reporting', 'Outcomes achieved, measurement method, timeframe, outstanding issues'],
      ['H', 'Social Impacts', 'Uptonville Reviewer', 'Materiality, Stakeholder Intelligence', 'Positive/negative impacts, grievance mechanism, grievance outcomes'],
      ['I', 'Disclosure Alignment', 'Analyst', 'Reporting Engine', 'Disclosure topics mapped to GRI/ISSB/IFC/TNFD/NUPRC frameworks with value rationale'],
      ['J', 'Automation Opportunities', 'Analyst', 'Platform Backlog', 'Data collection pain points, manual processes, automation opportunities, priority ratings'],
      ['K', 'Engine Contribution Map', 'Both roles', 'All engines', 'Tick-box confirmation of which engines this project contributed to; most valuable insight per engine'],
      ['L', 'Validation & Sign-off', 'Steering Committee', 'Governance record', 'Three-signature sign-off: Uptonville Technical Reviewer, Impact Driver Analyst, Joint Steering Committee'],
    ],
    [36, 110, 74, 90, COL_W - 310]
  );

  // ─── PAGE 5: THE EIGHT ENGINES ───────────────────────────────────────────────
  doc.addPage(); currentSection = 'The Eight Engines';
  sectionHeading(doc, '04', 'The Eight Platform Engines');

  body(doc, 'The eight engines are the analytical core of the platform. Each engine is a MongoDB aggregation pipeline that runs across all completed project templates in real time — there is no separate data entry step. As analysts fill in templates, the engines automatically incorporate the new data. Engines are accessible from the main navigation and display live results with visualisations.');

  drawTable(doc,
    ['Engine', 'Data source', 'What it produces'],
    [
      ['01 — Project Classification Engine', 'Section A across all projects', 'Taxonomy of project types, operating environments, and statuses. Counts by category. Feeds the project register overview cards.'],
      ['02 — Regulatory Rules Engine', 'Sections C and F', 'A cross-project library of regulations, issuing bodies, and how each has been applied. Identifies which regulations are most common. Shows evidence acceptance rates.'],
      ['03 — Indicator Library', 'Section B', 'Aggregated ESG indicator catalogue with unit standardisation, measurement method comparison, and near-duplicate detection (Dice coefficient string similarity). Filterable by category and project type.'],
      ['04 — Materiality Engine', 'Sections B, D, G, H', 'Materiality matrix: maps project types and stakeholder groups to the ESG topics that matter most, informed by real outcomes rather than generic frameworks.'],
      ['05 — Stakeholder Intelligence Engine', 'Section D', 'Profiles of recurring stakeholder groups across projects — their concerns, reporting formats they need, and engagement outcomes. Supports planning for future projects.'],
      ['06 — Decision Support Engine', 'Section E', 'Cross-project library of mitigation measures with effectiveness ratings and expert reasoning. Filterable by effectiveness and keyword search. The most-queried engine.'],
      ['07 — Benchmarking Engine', 'Sections A, B, G, H', 'ESG coverage depth by project type (stacked bar chart) and unique indicator counts per type (horizontal bar chart). Enables like-for-like comparison across projects.'],
      ['08 — Reporting Engine', 'Section I + all sections', 'Generates co-branded PDF disclosure reports aligned to a selected framework (GRI, ISSB, IFC, TNFD, or NUPRC). Nine-section report including indicators, regulations, stakeholders, mitigation measures, evidence, outcomes, impacts, and disclosure topics.'],
    ],
    [120, 100, COL_W - 220]
  );

  // ─── PAGE 6: REPORTING ENGINE DETAIL ────────────────────────────────────────
  doc.addPage(); currentSection = 'Reporting & PDF Export';
  sectionHeading(doc, '05', 'Reporting Engine & PDF Export');

  body(doc, 'The Reporting Engine is the primary client-facing output of the platform. A user selects a project and a disclosure framework; the engine pulls data from all relevant sections and renders a live in-browser preview. The user can then export a print-quality PDF generated server-side using pdfkit — no Chromium, no headless browser dependency.');

  subHeading(doc, 'PDF report structure (9 sections)');
  const reportSections = [
    ['01', 'Project Overview', 'Operating environment, duration, prepared by'],
    ['02', 'ESG Indicators Tracked', 'All Section B indicators for this project'],
    ['03', 'Regulatory Compliance', 'All Section C regulations applied'],
    ['04', 'Stakeholder Engagement', 'All Section D stakeholder groups and outcomes'],
    ['05', 'Mitigation Measures & Decision Support', 'Section E — all measures with effectiveness and evidence'],
    ['06', 'Regulatory Evidence', 'Section F — evidence submitted per regulation, acceptance status'],
    ['07', 'Environmental Outcomes', 'Section G — outcomes, timeframe, measurement method, outstanding issues'],
    ['08', 'Social Impacts', 'Section H — positive/negative impacts, grievance mechanism and outcome'],
    ['09', 'Disclosure Topics', 'Section I filtered by selected framework (GRI/ISSB/IFC/TNFD/NUPRC)'],
  ];
  drawTable(doc, ['§', 'Section', 'Content'], reportSections, [22, 140, COL_W - 162]);

  subHeading(doc, 'Supported disclosure frameworks');
  const frameworks = [
    ['GRI', 'Global Reporting Initiative', 'Universal sustainability disclosure standards (GRI 200/300/400). Most widely adopted globally.'],
    ['ISSB', 'IFRS Sustainability Standards', 'IFRS S1 (general) and S2 (climate). Required for companies with listed parent companies or international investors.'],
    ['IFC', 'IFC Performance Standards', 'Eight performance standards covering E&S risk, labour, community, land, biodiversity. Equator Principles banks require these.'],
    ['TNFD', 'Nature-related Financial Disclosures', 'Nature, biodiversity, and ecosystem services risk disclosure. Emerging requirement for extractive sector.'],
    ['NUPRC', 'NUPRC Environmental Guidelines', 'Nigerian Upstream Petroleum Regulatory Commission statutory annual environmental performance reporting.'],
  ];
  drawTable(doc, ['Code', 'Full name', 'Relevance to Nigerian O&G sector'], frameworks, [40, 140, COL_W - 180]);

  // ─── PAGE 7: PROJECT REGISTER & WORKSPACE ───────────────────────────────────
  doc.addPage(); currentSection = 'Project Register & Workspace';
  sectionHeading(doc, '06', 'Project Register & Extraction Workspace');

  subHeading(doc, 'Project Register');
  body(doc, 'The project register is the platform\'s home screen. It displays all projects in a filterable table with search, tier, status, project type, and date filters. Each row shows the project name, reference code, type, location, data readiness tier, pipeline status, and document availability indicators (reports, monitoring data, GIS, photographs, drawings). A platform overview section above the table shows live statistics pulled from MongoDB.');

  subHeading(doc, 'Data Readiness Tiers');
  drawTable(doc,
    ['Tier', 'Definition', 'Platform treatment'],
    [
      ['Tier 1 — Complete', 'Full documentation available and digitisation-ready', 'Priority for extraction; engines incorporate immediately'],
      ['Tier 2 — Needs cleaning', 'Documentation exists but requires QA or gap-filling', 'Extractable with analyst review; flagged in register'],
      ['Tier 3 — Reconstruction', 'Physical records only; scanning/transcription required', 'Held in inventory pending digitisation mobilisation'],
    ],
    [90, 170, COL_W - 260]
  );

  subHeading(doc, 'Extraction Workspace');
  body(doc, 'Each project has a dedicated extraction workspace — a tabbed interface where analysts and reviewers fill in Sections A through L. The workspace shows a live completion progress bar, section-by-section status dots, and role-based access locks (a padlock icon on sections the current user cannot edit). All fields auto-save on blur. Sections with structured data (B, C, D, E, F, I) use repeatable row tables that grow as entries are added.');

  subHeading(doc, 'Guided data entry — helpers and quick-add panels');
  body(doc, 'Each section includes contextual guidance to support analysts who may be unfamiliar with certain fields:');
  bullet(doc, 'Section B — collapsible "Quick-add common indicator" panel with 15 pre-defined E/S/G indicators for Nigerian oil & gas (TPH, PAH, DO, employment, fishing access, grievance rate, etc.). Click to insert a pre-filled row.');
  bullet(doc, 'Section C — "Quick-add common regulation" panel with 8 common Nigerian and international standards (NUPRC, EGASPIN, EIA Act, NOSDRA, IFC PS1/PS5/PS3, TNFD). Issuing body field has autocomplete with 13 common regulators.');
  bullet(doc, 'Section D — Stakeholder Group and Reporting Format fields both have autocomplete lists with 14 and 8 common options respectively.');
  bullet(doc, 'Section F — Issuing Body, Evidence Type, and Format/Frequency fields all have autocomplete suggestions.');
  bullet(doc, 'Section I — Framework reference cards explaining each framework\'s scope, plus a "Quick-add common topics" panel that shows standard disclosure topics per framework (GRI, ISSB, IFC, TNFD, NUPRC).');

  // ─── PAGE 8: ADMIN & OPERATIONS ─────────────────────────────────────────────
  doc.addPage(); currentSection = 'Admin & Operations';
  sectionHeading(doc, '07', 'Administration & Platform Operations');

  subHeading(doc, 'Admin panel (admin role only)');
  body(doc, 'The admin panel provides full user lifecycle management and data export capabilities:');
  bullet(doc, 'User table with inline name and role editing');
  bullet(doc, 'Inline password reset (admin sets a new password for any user)');
  bullet(doc, 'Create new user modal with email, name, role, and password fields');
  bullet(doc, 'Self-removal guard — admins cannot delete their own account');
  bullet(doc, 'Role summary cards showing counts per role');
  bullet(doc, 'CSV export: full project register (all fields) and indicator library (all Section B entries across all projects)');
  bullet(doc, 'System statistics dashboard — total projects, status breakdown, tier breakdown, extraction counts');

  subHeading(doc, 'Pipeline status workflow');
  drawTable(doc,
    ['Status', 'Meaning', 'Who sets it'],
    [
      ['Inventoried', 'Project logged but not yet prioritised', 'Uptonville Reviewer on creation'],
      ['Prioritised', 'Selected for extraction in this phase', 'Uptonville Reviewer'],
      ['Digitising', 'Physical records being scanned/prepared', 'Uptonville Reviewer'],
      ['Extraction in progress', 'Template sections being filled', 'Set automatically when first section saved'],
      ['Engine-mapped', 'Section K completed — all engines mapped', 'Analyst'],
      ['Signed-off', 'All three parties signed Section L', 'Steering Committee'],
    ],
    [100, 160, COL_W - 260]
  );

  subHeading(doc, 'Data integrity utilities');
  bullet(doc, 'Backfill endpoint (POST /api/admin/backfill-section-a) — retroactively seeds Section A from the Project document for any existing projects where Section A was left empty at creation.');
  bullet(doc, 'Near-duplicate indicator detection — the Indicator Library engine uses Dice coefficient string similarity (>85% match threshold) to flag potentially duplicate indicator entries across projects.');

  // ─── PAGE 9: MoU CORRESPONDENCE ──────────────────────────────────────────────
  doc.addPage(); currentSection = 'MoU Correspondence';
  sectionHeading(doc, '08', 'Correspondence with the MoU Deliverables');

  body(doc, 'The following table maps each key deliverable from the Strategic Collaboration Agreement and IIF Template document to the built component that delivers it.');

  drawTable(doc,
    ['MoU requirement', 'Built component', 'Status'],
    [
      ['Digitised project template with 12 structured sections (A–L)', 'ExtractionWorkspace with 12 tabbed sections, each with validated form fields', '✓ Complete'],
      ['Section A: Project Identification & Context', 'SectionA.tsx — name, ref code, type, location, env, client, operator, duration, value, tier', '✓ Complete'],
      ['Section B: ESG Indicator Library', 'SectionB.tsx — repeatable rows: indicator, E/S/G, unit, method, why it mattered', '✓ Complete'],
      ['Section C: Regulatory Rules Engine input', 'SectionC.tsx — repeatable rows: category, regulation, issuing body, how applied', '✓ Complete'],
      ['Section D: Stakeholder Intelligence input', 'SectionD.tsx — repeatable rows: group, interest, reporting format, outcome', '✓ Complete'],
      ['Section E: Decision Support Engine input', 'SectionE.tsx — repeatable rows: measure, effectiveness, evidence, recommended?, reasoning', '✓ Complete'],
      ['Section F: Regulatory Evidence record', 'SectionF.tsx — repeatable rows: regulation, issuing body, evidence type, format, accepted?', '✓ Complete'],
      ['Section G: Environmental Outcomes', 'SectionG.tsx — outcomes achieved, timeframe, measurement method, outstanding issues', '✓ Complete'],
      ['Section H: Social Impacts', 'SectionH.tsx — positive/negative impacts, grievance mechanism and outcome', '✓ Complete'],
      ['Section I: Disclosure Alignment', 'SectionI.tsx — repeatable rows: topic, framework (GRI/ISSB/IFC/TNFD/NUPRC), why valuable', '✓ Complete'],
      ['Section J: Automation Opportunities backlog', 'SectionJ.tsx — data pain points, manual processes, automation opportunity, priority', '✓ Complete'],
      ['Section K: Engine Contribution Map', 'SectionK.tsx + EngineContributionMap model — tick per engine + most valuable insight', '✓ Complete'],
      ['Section L: Validation & Sign-off', 'SectionL.tsx + SignOff model — 3-party signature (Uptonville, Analyst, Steering Committee)', '✓ Complete'],
      ['Eight analytical engines aggregating across all projects', 'Eight aggregation pipelines in engines.controller.ts, eight engine screens in /engines', '✓ Complete'],
      ['Regulatory Rules Engine (C, F)', 'regulatoryRules() — cross-project regulation library with application context', '✓ Complete'],
      ['Indicator Library Engine (B)', 'indicatorLibrary() — with near-duplicate detection and filter by ESG/type', '✓ Complete'],
      ['Materiality Engine (B, D, G, H)', 'materiality() — stakeholder × project type × ESG category matrix', '✓ Complete'],
      ['Stakeholder Intelligence Engine (D)', 'stakeholderIntelligence() — recurring stakeholder profiles with format preferences', '✓ Complete'],
      ['Decision Support Engine (E)', 'decisionSupport() — searchable, filterable mitigation library with expert reasoning', '✓ Complete'],
      ['Benchmarking Engine (A, B)', 'benchmarking() — ESG coverage depth chart + unique indicators per project type', '✓ Complete'],
      ['Reporting Engine (I + all)', 'reportPreview() + generatePdf() — framework-filtered 9-section PDF report', '✓ Complete'],
      ['Co-branded outputs (Impact Driver × Uptonville)', 'All PDF headers, cover pages, and report footers carry both brand names', '✓ Complete'],
      ['GRI, ISSB, IFC, TNFD, NUPRC framework support', 'Framework selector in Reporting Engine; Section I aligned to all five', '✓ Complete'],
      ['Role-based access: Uptonville reviewer, Analyst, Steering Committee, Admin', 'Four roles with JWT auth, section-level write gates, middleware enforcement', '✓ Complete'],
      ['Data Readiness Tier 1/2/3 classification', 'Tier field on Project model; TierBadge UI component; filter in project register', '✓ Complete'],
      ['Admin user management', 'Admin panel: create, edit, reset password, delete users; CSV export', '✓ Complete'],
      ['Deployment-ready for production', 'render.yaml (backend) + vercel.json (frontend) + MongoDB Atlas', '✓ Complete'],
    ],
    [168, 190, COL_W - 358]
  );

  // ─── PAGE 10: WHAT IS NOT BUILT (PHASE 2) ────────────────────────────────────
  doc.addPage(); currentSection = 'Phase 2 Scope';
  sectionHeading(doc, '09', 'Phase 2 — Recommended Next Scope');

  body(doc, 'Phase 1 delivers the complete data ingestion, engine aggregation, and reporting infrastructure. The following capabilities are natural extensions for Phase 2, based on what emerged during the build and from patterns visible in the pilot data:');

  subHeading(doc, 'Data and content');
  bullet(doc, 'Ingest the remaining pilot projects (target: 7–10 total). The platform is live and ready — this is a data entry exercise, not a development one. With 3+ projects in the engines, the benchmarking and materiality matrices become meaningful.');
  bullet(doc, 'GIS integration — link Section A location data to a map view showing project sites across Nigeria, filterable by type and tier.');
  bullet(doc, 'Document attachment — allow PDF reports and monitoring data files to be attached directly to project records rather than referenced externally.');

  subHeading(doc, 'Platform capability');
  bullet(doc, 'Automated regulatory report generation — use Section C/F data to auto-populate NUPRC e-portal submission templates.');
  bullet(doc, 'IoT sensor integration pathway — Section J consistently identifies real-time monitoring as the highest-priority automation. A data ingestion API for continuous monitoring data (TPH proxy, DO, turbidity) would close this gap.');
  bullet(doc, 'Multi-language support — community-facing reporting in local languages (Ibibio, Ijaw, Yoruba, Hausa) was flagged in Section D stakeholder entries as a recurring need.');
  bullet(doc, 'Carbon accounting module — scope 1/2/3 emissions tracking linked to Section B GHG indicators, feeding ISSB S2 disclosure automatically.');

  subHeading(doc, 'Commercial');
  bullet(doc, 'White-label packaging for other Nigerian IOC contractors — the platform architecture is generic enough to onboard additional operators with their own project portfolios.');
  bullet(doc, 'API access tier — allow client organisations to query the Indicator Library and Regulatory Rules Engine programmatically, enabling integration with their own project management systems.');

  // ─── BACK COVER ──────────────────────────────────────────────────────────────
  doc.addPage();
  doc.save().fillColor(hex(C.ink)).rect(0, 0, PAGE_W, PAGE_H).fill().restore();
  doc.save().font('Helvetica').fontSize(7.5).fillColor(hex(C.white)).opacity(0.25)
    .text('IMPACT DRIVER × UPTONVILLE NIGERIA LIMITED', ML, 40, { characterSpacing: 1.2 }).restore();
  hrule(doc, 58, '#FFFFFF', 0.25);

  const midY = PAGE_H / 2 - 60;
  doc.save().font('Courier').fontSize(8).fillColor(hex(C.accent))
    .text('BUILT ON', ML, midY, { characterSpacing: 1.4 }).restore();
  doc.save().font('Times-Bold').fontSize(26).fillColor(hex(C.white))
    .text('Impact Intelligence\nFramework', ML, midY + 18, { lineGap: 4 }).restore();
  doc.save().font('Helvetica').fontSize(10).fillColor(hex(C.white)).opacity(0.45)
    .text('A co-branded platform by Impact Driver and Uptonville Nigeria Limited\nfor ESG intelligence in the Nigerian upstream petroleum sector.', ML, midY + 86, { lineGap: 3 }).restore();

  hrule(doc, PAGE_H - 90, '#FFFFFF', 0.25);
  doc.save().font('Helvetica').fontSize(8.5).fillColor(hex(C.white)).opacity(0.4)
    .text('This document is confidential and intended solely for the named recipient.\nPhase 1 build completed ' + today + '.', ML, PAGE_H - 80, { lineGap: 2 }).restore();

  doc.end();

  await new Promise<void>((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });

  console.log(`\n[briefing] PDF written to: ${outPath}\n`);
}

build().catch((err) => {
  console.error('[briefing] Error:', err.message);
  process.exit(1);
});
