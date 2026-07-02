import 'dotenv/config';
import mongoose from 'mongoose';
import { Project } from '../models/Project';
import { ProjectTemplate } from '../models/ProjectTemplate';
import { EngineContributionMap, ENGINE_NAMES } from '../models/EngineContributionMap';
import { SignOff } from '../models/SignOff';

const MONGODB_URI = process.env.MONGODB_URI;
const REF = 'UNL-2023-HC-001';

async function main() {
  if (!MONGODB_URI) throw new Error('MONGODB_URI is not set in .env');
  await mongoose.connect(MONGODB_URI);
  console.log('[seed] Connected to MongoDB');

  // Idempotent: clean up existing test project first
  const existing = await Project.findOne({ referenceCode: REF });
  if (existing) {
    await Promise.all([
      ProjectTemplate.deleteOne({ project: existing._id }),
      EngineContributionMap.deleteOne({ project: existing._id }),
      SignOff.deleteOne({ project: existing._id }),
      Project.deleteOne({ _id: existing._id }),
    ]);
    console.log('[seed] Removed existing test project');
  }

  const project = await Project.create({
    name: 'Iko Creek Hydrocarbon Remediation Project',
    referenceCode: REF,
    projectType: 'oil spill remediation',
    location: 'Iko Creek, Esit Eket LGA, Akwa Ibom State',
    operatingEnvironment: 'swamp',
    client: 'Shell Petroleum Development Company',
    operator: 'Uptonville Nigeria Limited',
    duration: { start: new Date('2022-03-01'), end: new Date('2023-09-30') },
    valueScale: 'large',
    valueAmount: 1_800_000_000,
    description:
      'Comprehensive bioremediation of hydrocarbon-contaminated soils and surface water across a 76,000 m² footprint in the Iko Creek estuary, Esit Eket LGA, resulting from a legacy crude oil spill. Work included in-situ biodegradation using indigenous petroleum-degrading microorganism consortia, phytoremediation along creek banks, targeted waste excavation at hotspot locations, and an 18-month monitoring programme to verify cleanup to NUPRC statutory standards (≤50 mg/kg TPH).',
    dataReadinessTier: 1,
    status: 'engine-mapped',
    availableDocs: {
      reports: true,
      monitoringData: true,
      gis: true,
      photographs: true,
      drawings: false,
    },
  });

  await ProjectTemplate.create({
    project: project._id,

    sectionA: {
      name: project.name,
      referenceCode: project.referenceCode,
      projectType: project.projectType,
      location: project.location,
      operatingEnvironment: project.operatingEnvironment,
      client: project.client,
      operator: project.operator,
      duration: project.duration,
      valueScale: project.valueScale,
      valueAmount: project.valueAmount,
      description: project.description,
      dataReadinessTier: project.dataReadinessTier,
    },

    sectionB: [
      {
        indicatorName: 'Total Petroleum Hydrocarbons (TPH) in soil',
        category: 'E',
        unit: 'mg/kg',
        measurementMethod: 'Quarterly soil sampling at 14 pre-defined grid points; GC-MS laboratory analysis by SGS Nigeria Limited (NAFDAC-accredited)',
        whyItMattered: 'Primary cleanup standard set by NUPRC: ≤50 mg/kg TPH required for site sign-off. Tracked from initial 4,800 mg/kg baseline to confirm remediation success',
      },
      {
        indicatorName: 'Polycyclic Aromatic Hydrocarbons (PAH) in soil',
        category: 'E',
        unit: 'μg/kg',
        measurementMethod: 'Laboratory analysis of soil cores at certified facility using EPA Method 8270D',
        whyItMattered: 'PAH compounds are carcinogenic; EGASPIN specifies separate PAH threshold in addition to bulk TPH. Required for full NUPRC sign-off',
      },
      {
        indicatorName: 'Dissolved oxygen (DO) in Iko Creek surface water',
        category: 'E',
        unit: 'mg/L',
        measurementMethod: 'Monthly DO meter readings at 3 fixed creek monitoring stations upstream, midstream, and downstream of impacted zone',
        whyItMattered: 'DO is primary indicator of aquatic ecosystem recovery. Baseline DO was 1.8 mg/L (near-anoxic); target >5 mg/L for fish habitat viability. Required by IFC PS3',
      },
      {
        indicatorName: 'Community members employed from host villages',
        category: 'S',
        unit: 'headcount',
        measurementMethod: 'Monthly HR records cross-referenced with community census lists maintained by Community Liaison Officer',
        whyItMattered: 'Required disclosure under IFC PS1 Social Management Plan commitment; also critical for community acceptance and dispute prevention',
      },
      {
        indicatorName: 'Fishing access area restored to pre-spill baseline',
        category: 'S',
        unit: '% of baseline area',
        measurementMethod: 'Annual community survey and GIS mapping of accessible fishing zones, validated by community consensus at open forum',
        whyItMattered: 'Fishing is the primary livelihood for 80% of Iko Creek village. Restoration of fishing access is the single most important social outcome indicator for this project',
      },
      {
        indicatorName: 'Stakeholder grievances resolved within agreed SLA',
        category: 'G',
        unit: '% resolved on time',
        measurementMethod: 'Monthly audit of complaint register by CLO; SLA = 30 days for standard grievances, 7 days for safety-related',
        whyItMattered: 'Governance KPI required under IFC PS1 and GRI 413. Demonstrates functioning grievance mechanism; poor performance is early warning of community breakdown',
      },
      {
        indicatorName: 'NUPRC site inspections passed without corrective action',
        category: 'G',
        unit: 'count',
        measurementMethod: 'Inspection sign-off sheets countersigned by NUPRC field officer; recorded in regulatory compliance log',
        whyItMattered: 'Direct measure of regulatory compliance quality. Failures trigger enforcement action and delay project close-out and payment milestones',
      },
    ],

    sectionC: [
      {
        category: 'Environmental',
        regulationStandard: 'NUPRC Environmental Guidelines and Standards for Remediation of Hydrocarbon-Impacted Sites, 2021',
        issuingBody: 'NUPRC',
        howItApplied: 'Governed all site assessment, cleanup standard (≤50 mg/kg TPH in soil, ≤0.01 mg/L TPH in groundwater), sampling methodology, lab accreditation requirements, and post-remediation sign-off certification process',
      },
      {
        category: 'Environmental',
        regulationStandard: 'Environmental Guidelines and Standards for the Petroleum Industry in Nigeria (EGASPIN) 2018 Edition',
        issuingBody: 'NUPRC (formerly DPR)',
        howItApplied: 'Specified sampling grid density, analytical methods, PAH threshold values, waste manifest requirements, and documentation standards for all environmental monitoring deliverables',
      },
      {
        category: 'Environmental',
        regulationStandard: 'Environmental Impact Assessment Act Cap E12 LFN 2004',
        issuingBody: 'NESREA / FMEnv',
        howItApplied: 'Framework for assessing and mitigating project-level environmental impacts; required Environmental and Social Impact Assessment (ESIA) submitted and approved by Akwa Ibom State Environmental Management Authority prior to commencement',
      },
      {
        category: 'Social',
        regulationStandard: 'IFC Performance Standard 5: Land Acquisition and Involuntary Resettlement',
        issuingBody: 'IFC',
        howItApplied: 'Applied to temporary disruption of farmland access routes during site preparation; governed compensation procedures, eligibility criteria, and required grievance mechanism. Triggered because client (SPDC) had active IFC-linked financing',
      },
    ],

    sectionD: [
      {
        stakeholderGroup: 'Iko Creek fishing community',
        interestConcern: 'Loss of fishing livelihood, contamination of creek fish stock, temporary land access restrictions, long-term ecological recovery of waterway',
        reportingFormatNeeded: 'Plain-language community report (English and Ibibio), visual progress photos at monthly community forum, verbal briefings by Community Liaison Officer',
        engagementOutcome: 'Partial fishing access restored at 3 of 5 original sites from August 2023. 2 formal community meetings held. Livelihood support package (₦2.4m) distributed to 34 directly affected households. Community rated project 78% satisfactory at close-out survey',
      },
      {
        stakeholderGroup: 'Shell Petroleum Development Company (Client)',
        interestConcern: 'Contractor performance against KPIs, regulatory compliance milestones, site safety (TRIF), cost-to-complete tracking, reputational risk management',
        reportingFormatNeeded: 'Monthly technical progress report (Excel/PDF) with GIS status maps, photographic evidence log, TRIF and cost summary',
        engagementOutcome: 'All milestone reports accepted without dispute. Monthly progress meetings attended by SPDC HSE and project management teams. Final sign-off received October 2023',
      },
      {
        stakeholderGroup: 'NUPRC (Regulatory Authority)',
        interestConcern: 'Cleanup to statutory TPH standard, waste manifest compliance, systematic monitoring documentation, regulatory fee payments',
        reportingFormatNeeded: 'Quarterly environmental monitoring report submitted via NUPRC e-portal (standard template), laboratory certificates appended',
        engagementOutcome: 'Two unannounced site inspections conducted (June 2022, February 2023); both passed with no corrective actions issued. NUPRC field officer commended documentation quality in February 2023 inspection report',
      },
      {
        stakeholderGroup: 'Akwa Ibom State Ministry of Environment',
        interestConcern: 'Ecosystem restoration, community health impacts, state compliance record, coordination with ESIA approval conditions',
        reportingFormatNeeded: 'Monthly status brief (2-page summary), post-remediation ecological assessment report at project close',
        engagementOutcome: 'Positive engagement throughout. Ministry requested inclusion in Q4 2024 follow-up monitoring exercise to support state environmental baseline data programme',
      },
    ],

    sectionE: [
      {
        mitigationMeasure: 'In-situ bioremediation using petroleum-degrading microorganism consortia (indigenous bacteria)',
        effectiveness: 'high',
        evidenceForRating: 'TPH reduced from 4,800 mg/kg (baseline) to 142 mg/kg across 94% of remediated footprint in 9 months. Exceeded 70% reduction target. Laboratory confirmation at all 13 compliant grid points',
        recommendedFuture: 'Yes — strongly recommended as primary first-response technique for onshore and swamp crude oil spills ≤100,000 m² in the Niger Delta. Cost-effective, no secondary waste, uses locally sourced materials',
        expertReasoning: 'Indigenous bacteria in Niger Delta soils have co-evolved with crude oil substrate over decades of petroleum activity. Co-developing the consortium with University of Port Harcourt produced a strain tolerant of local salinity and pH conditions. No need for imported inoculants',
      },
      {
        mitigationMeasure: 'Phytoremediation with mangrove seedlings along creek bank (Rhizophora racemosa)',
        effectiveness: 'medium',
        evidenceForRating: '78% seedling survival rate at 12 months. Partial TPH uptake confirmed in root zone samples (22% reduction in rhizosphere vs. control plots). Bank stabilisation confirmed by quarterly survey',
        recommendedFuture: 'Yes for bank stabilisation and riparian buffer zone — not recommended as standalone remediation technique. Deploy in combination with bioremediation for best outcomes',
        expertReasoning: 'Mangrove root systems physically stabilise soft swamp sediment and create an expanded rhizosphere for secondary microbial activity. Ecological co-benefit (habitat creation) justifies deployment even where direct TPH uptake is modest',
      },
      {
        mitigationMeasure: 'Ex-situ soil washing trial at hotspot G-07 (pilot — 200 m² area)',
        effectiveness: 'low',
        evidenceForRating: '45% contaminant removal after two treatment cycles. Programme abandoned after cost overrun (3× budget) and excessive secondary waste volumes (hydrocarbon-contaminated washwater requiring further treatment)',
        recommendedFuture: 'No — not cost-effective or logistically viable for typical Niger Delta site conditions. Capital cost, water demand, and secondary waste burden make it unsuitable except for very small, highly accessible hotspots near water treatment infrastructure',
        expertReasoning: 'High water consumption (120 m³ per tonne of soil treated) and the absence of nearby washwater treatment facilities made this technique impractical. The primary bioremediation technique achieved better results at hotspot G-07 after ex-situ trial was abandoned',
      },
    ],

    sectionF: [
      {
        regulationStandard: 'NUPRC Environmental Guidelines 2021',
        issuingBody: 'NUPRC',
        evidenceType: 'Soil sampling logs, certified lab analysis certificates (GC-MS TPH and PAH), quarterly monitoring reports, sampling grid maps',
        formatFrequency: 'Quarterly PDF submission via NUPRC e-portal with appended lab certificates',
        acceptedWithoutDispute: true,
        disputeNotes: '',
      },
      {
        regulationStandard: 'EGASPIN 2018',
        issuingBody: 'NUPRC (formerly DPR)',
        evidenceType: 'Field inspection certificate, waste disposal manifests (A-series), sampling methodology report, analytical QA/QC documentation',
        formatFrequency: 'Monthly field report plus annual consolidated summary',
        acceptedWithoutDispute: true,
        disputeNotes: '',
      },
      {
        regulationStandard: 'IFC Performance Standard 5: Land Acquisition and Involuntary Resettlement',
        issuingBody: 'IFC',
        evidenceType: 'Land access compensation register, signed acknowledgement receipts, grievance log, community consultation records and attendance sheets',
        formatFrequency: 'Annual E&S report (IFC template) with supporting annexures',
        acceptedWithoutDispute: false,
        disputeNotes: 'IFC compliance auditor (October 2022) requested additional evidence of compensation payment for Q3 2022 crop damage grievance. Supplementary documentation (payment receipts and signed acknowledgement from affected farmer) submitted and accepted 28 October 2022',
      },
    ],

    sectionG: {
      outcomesAchieved:
        'TPH levels reduced below the NUPRC threshold of 50 mg/kg across 94% of the remediated area (71,400 m² of the 76,000 m² total site). Mangrove recovery confirmed at all 3 creek bank monitoring stations. No further hydrocarbon seepage detected at site perimeter for six consecutive monitoring months. Dissolved oxygen in Iko Creek returned to >5 mg/L (baseline at peak contamination: 1.8 mg/L). Creek fish population index increased 34% between January 2023 and September 2023 baseline comparison.',
      timeframe:
        'Total project duration: 18 months (March 2022 – September 2023). Active bioremediation phase: March 2022 – December 2022 (10 months). Monitoring and verification phase: January 2023 – September 2023 (9 months). NUPRC sign-off certification received: October 2023.',
      measurementMethod:
        'Quarterly soil and groundwater sampling at 14 pre-defined grid points; GC-MS laboratory analysis by SGS Nigeria Limited (NAFDAC-accredited). Creek water quality sampled monthly at 3 stations using YSI Pro DO meter and turbidity probe. Results cross-checked against NUPRC baseline data (2019 site characterisation) and EGASPIN reference standards.',
      outstandingIssues:
        'Hotspot at grid point G-07 (200 m² area) remains at 68 mg/kg TPH — 36% above the NUPRC 50 mg/kg threshold. Follow-up targeted bioremediation treatment scheduled Q4 2024 under a separate mobilisation. All other 13 grid points compliant. Fisheries stock full recovery study commissioned for Q1 2025 to establish long-term ecological baseline.',
    },

    sectionH: {
      positiveImpacts:
        '47 community members employed during remediation phase (65% from Iko Creek village, 35% from neighbouring Mkpanak). Local suppliers engaged for 28% of materials procurement (aggregates, PPE, fuel). Fishing access partially restored at 3 of 5 original creek sites from August 2023, enabling partial resumption of livelihood activities. Dissolved oxygen recovery in creek measurably improved water quality for remaining fish stock. Creek vegetation (mangrove and reed) showing recovery at 3 bank monitoring stations.',
      negativeImpacts:
        'Temporary disruption of access routes to farmland during site preparation (6 weeks, February–March 2022). Noise and odour nuisance from bioremediation equipment reported by 12 households within 200 m of primary treatment zone; mitigated by restricting operations to 07:00–18:00 from March 2022. One incident of heavy vehicle track damage to community road (repaired at contractor expense within 10 days of report).',
      grievanceMechanism:
        'Dedicated Community Liaison Officer (CLO) resident in Iko Creek village throughout project. Weekly open community forum at town hall (every Thursday, 17:00). Written complaint register at site office and CLO base with numbered log entries. Anonymous grievance tip line (mobile number) posted at community notice board and health centre. Escalation pathway: CLO (24 hrs) → Site Manager (48 hrs) → Project Director (72 hrs) based on severity classification.',
      grievanceOutcome:
        'Three formal grievances received and closed during project: (1) Noise complaint, February 2022 — resolved 7 days, operating hours restricted; (2) Road damage, March 2022 — resolved 10 days, road repaired and goodwill payment of ₦50,000 made; (3) Crop damage compensation, September 2022 — resolved 28 days, ₦380,000 agreed and paid to affected farmer with signed receipt. Zero unresolved complaints at project close. Community satisfaction survey at close: 78% positive overall rating.',
    },

    sectionI: [
      {
        disclosureTopic: 'GRI 306: Waste — hazardous waste generation, treatment, and disposal',
        alignedFramework: 'GRI',
        whyValuable: 'Provides evidence of regulated hazardous waste management and EGASPIN waste manifest compliance. Demonstrates platform ability to capture waste-related regulatory data for future projects',
      },
      {
        disclosureTopic: 'GRI 413: Local Communities — community engagement, grievance mechanism, and social impact management',
        alignedFramework: 'GRI',
        whyValuable: 'Documents community engagement depth, grievance mechanism operation, and social impact outcomes aligned with GRI social standards. Directly demonstrates Stakeholder Intelligence Engine output quality',
      },
      {
        disclosureTopic: 'ISSB S1 General Requirements for Disclosure of Sustainability-related Financial Information',
        alignedFramework: 'ISSB',
        whyValuable: 'Baseline sustainability disclosure framework for future climate and nature-related financial risk reporting. Establishes IIF as capable of structuring data to ISSB standards for clients with listed parent companies',
      },
      {
        disclosureTopic: 'IFC PS 1: Assessment and Management of Environmental and Social Risks and Impacts',
        alignedFramework: 'IFC',
        whyValuable: 'Full E&S assessment documented and structurally accessible for IFC audit. Demonstrates platform\'s ability to organise E&S data to IFC template requirements, critical for DFI-financed projects',
      },
      {
        disclosureTopic: 'IFC PS 5: Land Acquisition and Involuntary Resettlement — compensation register and grievance outcome',
        alignedFramework: 'IFC',
        whyValuable: 'Compensation register and grievance evidence aligned with PS5 disclosure requirements. Platform demonstrated ability to track and audit compensation transactions to IFC audit standard',
      },
      {
        disclosureTopic: 'NUPRC Annual Environmental Performance Report — hydrocarbon remediation section',
        alignedFramework: 'NUPRC',
        whyValuable: 'Primary statutory disclosure required by the Nigerian Upstream Petroleum Regulatory Commission. IIF data directly populates all required fields, showing platform can fully automate regulatory reporting preparation',
      },
    ],

    sectionJ: {
      dataDifficultToCollect:
        'TPH sampling data — collected quarterly via physical lab visits with a 3-week analysis turnaround that slowed real-time decision-making. Community employment data — cross-referencing HR records with community census lists required 2–3 days of manual effort per reporting cycle. Compensation payment evidence — original paper receipts required scanning, transcription, and manual filing for each of 34 beneficiary households.',
      manualProcesses:
        'Regulatory reporting — four separate report formats prepared manually for NUPRC, EGASPIN, NESREA, and IFC on different schedules (quarterly, monthly, annual). Grievance register — paper-based complaint forms scanned and transcribed to Excel with no audit trail. Sampling grid status — 14 grid points tracked in a shared Excel workbook with no version control (concurrent edits caused two data conflicts during the project).',
      automationOpportunity:
        'Real-time IoT sensors at the 14 monitoring grid points for continuous TPH proxy measurement (soil resistivity + temperature), eliminating the 3-week lab turnaround for interim trend analysis while retaining quarterly certified lab sampling for regulatory purposes. Digital grievance portal with timestamped records, automatic escalation routing, and built-in acknowledgement receipts. Unified regulatory submission module that generates all four regulatory report formats from a single IIF data entry.',
      priority: 'High',
    },

    extractionStatus: {
      a: 'complete',
      b: 'complete',
      c: 'complete',
      d: 'complete',
      e: 'complete',
      f: 'complete',
      g: 'complete',
      h: 'complete',
      i: 'complete',
      j: 'complete',
    },
  });

  await Promise.all([
    EngineContributionMap.create({
      project: project._id,
      contributions: ENGINE_NAMES.map((engine) => ({
        engine,
        contributed: true,
        mostValuableInsight:
          engine === 'Decision Support Engine'
            ? 'In-situ bioremediation with indigenous microorganism consortia achieved 97% TPH reduction in 9 months — far exceeding the 70% target. Should become the default first-response intervention for onshore/swamp crude oil spills ≤100,000 m² in the Niger Delta.'
            : engine === 'Regulatory Rules Engine'
            ? 'NUPRC and EGASPIN standards collectively specify 14 distinct documentation requirements across soil, water, waste, and community domains. No single project team member had awareness of all 14 at project start — IIF could provide this as a project-initiation checklist.'
            : engine === 'Indicator Library'
            ? 'TPH and DO are the two highest-value indicators for remediation projects: TPH drives regulatory sign-off; DO drives community acceptance. Both should be mandatory defaults in the Indicator Library for this project type.'
            : engine === 'Stakeholder Intelligence Engine'
            ? 'Fishing communities require visual, vernacular-language reporting — not the technical PDF reports standard in oil & gas. Tailored communication format was the single biggest factor in avoiding escalation to formal dispute.'
            : engine === 'Materiality Engine'
            ? 'TPH cleanup (E) and fishing livelihood restoration (S) are equally material for swamp remediation projects — unlike offshore projects where E dominates. The materiality matrix should differentiate by operating environment.'
            : engine === 'Benchmarking Engine'
            ? 'In-situ bioremediation at ₦24,000/m² was 40% cheaper than the industry average of ₦40,000/m² for comparable Niger Delta sites in 2022. This benchmarking finding should inform cost estimation for future projects.'
            : engine === 'Reporting Engine'
            ? 'NUPRC and IFC reporting requirements overlapped by ~60% on this project — a unified data model could generate both reports from a single extraction, saving approximately 3 working days per reporting cycle.'
            : 'Swamp remediation projects (hydrocarbon) are the most common project type in the Nigerian upstream portfolio. Platform classification logic should weight swamp/onshore separately when benchmarking timelines and costs.',
      })),
    }),
    SignOff.create({
      project: project._id,
      signatures: [
        { role: 'Uptonville Technical Reviewer', name: 'Emeka Okafor', signed: true, date: new Date('2023-10-15') },
        { role: 'Impact Driver Analyst', name: 'Adaeze Nwosu', signed: true, date: new Date('2023-10-18') },
        { role: 'Joint Steering Committee', name: '', signed: false },
      ],
    }),
  ]);

  console.log(`\n[seed] ✓ Test project created: ${REF}`);
  console.log('[seed]   Name       : Iko Creek Hydrocarbon Remediation Project');
  console.log('[seed]   Sections   : A–J all complete, Engine Map contributed, 2 of 3 sign-offs');
  console.log('[seed]   Frameworks : GRI (2), ISSB (1), IFC (2), NUPRC (1) in Section I');
  console.log('[seed]   To export a PDF, go to the Reporting Engine and select this project.\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[seed] Error:', err.message);
  process.exit(1);
});
