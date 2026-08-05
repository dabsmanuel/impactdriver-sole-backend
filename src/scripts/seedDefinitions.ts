import { RegulatoryDefinition } from '../models/RegulatoryDefinition';

const DEFINITIONS = [
  // GRI
  {
    framework: 'GRI' as const,
    code: 'GRI-301',
    title: 'Materials',
    description: 'Requires disclosure of materials used by weight or volume, and the percentage of recycled input materials used.',
    category: 'Environment',
    mandatory: false,
    applicableProjectTypes: [],
    requiredSections: ['b', 'g'],
  },
  {
    framework: 'GRI' as const,
    code: 'GRI-302',
    title: 'Energy',
    description: 'Covers energy consumption within and outside of the organisation, energy intensity, and reductions in energy consumption.',
    category: 'Environment',
    mandatory: false,
    applicableProjectTypes: [],
    requiredSections: ['b', 'g'],
  },
  {
    framework: 'GRI' as const,
    code: 'GRI-305',
    title: 'Emissions',
    description: 'Addresses direct (Scope 1), indirect (Scope 2), and other indirect (Scope 3) GHG emissions, intensity, and reduction targets.',
    category: 'Climate',
    mandatory: false,
    applicableProjectTypes: ['oil spill remediation', 'pipeline integrity', 'flare-out'],
    requiredSections: ['b', 'g'],
  },
  {
    framework: 'GRI' as const,
    code: 'GRI-306',
    title: 'Waste',
    description: 'Covers waste generation, waste diversion from disposal, and waste directed to disposal by treatment method.',
    category: 'Environment',
    mandatory: false,
    applicableProjectTypes: ['waste management', 'decommissioning'],
    requiredSections: ['b', 'e', 'g'],
  },
  {
    framework: 'GRI' as const,
    code: 'GRI-413',
    title: 'Local Communities',
    description: 'Requires disclosure of operations with local community engagement and grievance mechanisms.',
    category: 'Social',
    mandatory: false,
    applicableProjectTypes: ['community development', 'training/capacity building'],
    requiredSections: ['d', 'h'],
  },
  // ISSB
  {
    framework: 'ISSB' as const,
    code: 'ISSB-S1',
    title: 'General Sustainability Disclosures',
    description: 'Requires companies to disclose material information about their sustainability-related risks and opportunities.',
    category: 'Sustainability',
    mandatory: true,
    applicableProjectTypes: [],
    requiredSections: ['b', 'c', 'd'],
  },
  {
    framework: 'ISSB' as const,
    code: 'ISSB-S2',
    title: 'Climate-related Disclosures',
    description: 'Requires disclosure of information about climate-related risks and opportunities across governance, strategy, risk management, and metrics.',
    category: 'Climate',
    mandatory: true,
    applicableProjectTypes: ['oil spill remediation', 'pipeline integrity', 'flare-out', 'EIA'],
    requiredSections: ['b', 'c', 'g'],
  },
  // IFC
  {
    framework: 'IFC' as const,
    code: 'IFC-PS1',
    title: 'Assessment and Management of Environmental and Social Risks',
    description: 'Requires a systematic assessment of environmental and social risks and impacts over the project life cycle.',
    category: 'Social',
    mandatory: true,
    applicableProjectTypes: [],
    requiredSections: ['c', 'd', 'e'],
  },
  {
    framework: 'IFC' as const,
    code: 'IFC-PS3',
    title: 'Resource Efficiency and Pollution Prevention',
    description: 'Requires efficient production, delivery, and use of energy and water and reduction of pollution.',
    category: 'Environment',
    mandatory: true,
    applicableProjectTypes: ['oil spill remediation', 'waste management', 'infrastructure build'],
    requiredSections: ['b', 'e', 'g'],
  },
  {
    framework: 'IFC' as const,
    code: 'IFC-PS6',
    title: 'Biodiversity Conservation and Sustainable Management of Living Natural Resources',
    description: 'Protects and conserves biodiversity, and promotes the sustainable management and use of natural resources.',
    category: 'Biodiversity',
    mandatory: true,
    applicableProjectTypes: ['EIA', 'environmental audit', 'soil/groundwater remediation'],
    requiredSections: ['b', 'g', 'h'],
  },
  // TNFD
  {
    framework: 'TNFD' as const,
    code: 'TNFD-CORE',
    title: 'Nature Dependencies and Impacts',
    description: 'Requires disclosure of nature-related dependencies, impacts, risks, and opportunities across the value chain.',
    category: 'Biodiversity',
    mandatory: false,
    applicableProjectTypes: ['EIA', 'environmental audit', 'flood management', 'geotechnical survey'],
    requiredSections: ['b', 'g'],
  },
  {
    framework: 'TNFD' as const,
    code: 'TNFD-METRICS',
    title: 'Nature Metrics and Targets',
    description: 'Covers metrics used to assess and manage nature-related risks, opportunities, and impacts, and associated targets.',
    category: 'Biodiversity',
    mandatory: false,
    applicableProjectTypes: ['EIA', 'environmental audit'],
    requiredSections: ['b', 'g'],
  },
  // NUPRC
  {
    framework: 'NUPRC' as const,
    code: 'NUPRC-ENV-01',
    title: 'Environmental Impact Assessment Requirement',
    description: 'Mandates Environmental Impact Assessment (EIA) before commencement of upstream petroleum operations in Nigeria.',
    category: 'Environment',
    mandatory: true,
    applicableProjectTypes: ['EIA', 'oil spill remediation', 'pipeline integrity', 'decommissioning'],
    requiredSections: ['c', 'e', 'f'],
  },
  {
    framework: 'NUPRC' as const,
    code: 'NUPRC-ENV-02',
    title: 'Remediation Standard',
    description: 'Sets standards for soil and water remediation following oil spills or contamination incidents.',
    category: 'Environment',
    mandatory: true,
    applicableProjectTypes: ['oil spill remediation', 'soil/groundwater remediation'],
    requiredSections: ['c', 'e', 'f', 'g'],
  },
  {
    framework: 'NUPRC' as const,
    code: 'NUPRC-ENV-03',
    title: 'Waste Management Requirements',
    description: 'Covers handling, treatment, and disposal of drilling waste, produced water, and other operational waste streams.',
    category: 'Environment',
    mandatory: true,
    applicableProjectTypes: ['waste management', 'decommissioning', 'oil spill remediation'],
    requiredSections: ['c', 'e', 'f'],
  },
  {
    framework: 'NUPRC' as const,
    code: 'NUPRC-ENV-04',
    title: 'Community Engagement and Grievance',
    description: 'Requires operators to engage host communities, establish grievance mechanisms, and document outcomes.',
    category: 'Social',
    mandatory: true,
    applicableProjectTypes: ['community development', 'oil spill remediation', 'pipeline integrity'],
    requiredSections: ['d', 'h'],
  },
  {
    framework: 'NUPRC' as const,
    code: 'NUPRC-ENV-05',
    title: 'Environmental Monitoring and Reporting',
    description: 'Mandates periodic environmental monitoring, data collection, and submission of reports to NUPRC.',
    category: 'Environment',
    mandatory: true,
    applicableProjectTypes: [],
    requiredSections: ['b', 'c', 'f', 'g'],
  },
];

export async function seedRegulatoryDefinitions(): Promise<void> {
  let seeded = 0;
  for (const def of DEFINITIONS) {
    const exists = await RegulatoryDefinition.findOne({ code: def.code });
    if (!exists) {
      await RegulatoryDefinition.create(def);
      seeded++;
    }
  }
  if (seeded > 0) {
    console.log(`[seed] Seeded ${seeded} regulatory definitions`);
  }
}
