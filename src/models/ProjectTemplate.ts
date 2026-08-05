import mongoose, { Document, Schema, Types } from 'mongoose';

export type ExtractionStatus = 'not-started' | 'in-progress' | 'complete';
export type ESGCategory = 'E' | 'S' | 'G';
export type Effectiveness = 'high' | 'medium' | 'low';
export type DisclosureFramework = 'GRI' | 'ISSB' | 'IFC' | 'TNFD' | 'NUPRC';
export type AutomationPriority = 'High' | 'Medium' | 'Low';

export interface IndicatorEntry {
  _id?: Types.ObjectId;
  indicatorName: string;
  category: ESGCategory;
  unit: string;
  measurementMethod: string;
  whyItMattered: string;
  gapFlag: boolean;   // GAP 10a
  gapNote: string;    // GAP 10a
}

export interface RegulatoryRuleEntry {
  _id?: Types.ObjectId;
  category: string;
  regulationStandard: string;
  issuingBody: string;
  howItApplied: string;
  gapFlag: boolean;   // GAP 10a
  gapNote: string;    // GAP 10a
}

export interface StakeholderEntry {
  _id?: Types.ObjectId;
  stakeholderGroup: string;
  interestConcern: string;
  reportingFormatNeeded: string;
  engagementOutcome: string;
  gapFlag: boolean;   // GAP 10a
  gapNote: string;    // GAP 10a
}

export interface DecisionSupportEntry {
  _id?: Types.ObjectId;
  mitigationMeasure: string;
  effectiveness: Effectiveness;
  evidenceForRating: string;
  recommendedFuture: string;
  expertReasoning: string;
  gapFlag: boolean;   // GAP 10a
  gapNote: string;    // GAP 10a
}

export interface EvidenceEntry {
  _id?: Types.ObjectId;
  regulationStandard: string;
  issuingBody: string;
  evidenceType: string;
  formatFrequency: string;
  acceptedWithoutDispute: boolean;
  disputeNotes?: string;
  gapFlag: boolean;   // GAP 10a
  gapNote: string;    // GAP 10a
}

export interface SectionG {
  outcomesAchieved: string;
  measurementMethod: string;
  timeframe: string;
  outstandingIssues: string;
}

export interface SectionH {
  positiveImpacts: string;
  negativeImpacts: string;
  grievanceMechanism: string;
  grievanceOutcome: string;
}

export interface DisclosureEntry {
  _id?: Types.ObjectId;
  disclosureTopic: string;
  alignedFramework: DisclosureFramework;
  whyValuable: string;
  gapFlag: boolean;   // GAP 10a
  gapNote: string;    // GAP 10a
}

export interface SectionJ {
  dataDifficultToCollect: string;
  manualProcesses: string;
  automationOpportunity: string;
  priority: AutomationPriority;
}

export interface SectionA {
  name: string;
  referenceCode: string;
  projectType: string;
  location: string;
  operatingEnvironment: string;
  client: string;
  operator: string;
  duration: { start?: Date; end?: Date };
  valueScale: string;
  valueAmount?: number;
  description: string;
  dataReadinessTier: number;
}

export interface IProjectTemplate extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  sectionA: SectionA;
  sectionB: IndicatorEntry[];
  sectionC: RegulatoryRuleEntry[];
  sectionD: StakeholderEntry[];
  sectionE: DecisionSupportEntry[];
  sectionF: EvidenceEntry[];
  sectionG: Partial<SectionG>;
  sectionH: Partial<SectionH>;
  sectionI: DisclosureEntry[];
  sectionJ: Partial<SectionJ>;
  extractionStatus: Record<
    'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j',
    ExtractionStatus
  >;
  createdAt: Date;
  updatedAt: Date;
}

const extractionStatusDefault = (): Record<string, ExtractionStatus> => ({
  a: 'not-started',
  b: 'not-started',
  c: 'not-started',
  d: 'not-started',
  e: 'not-started',
  f: 'not-started',
  g: 'not-started',
  h: 'not-started',
  i: 'not-started',
  j: 'not-started',
});

const IndicatorEntrySchema = new Schema<IndicatorEntry>({
  indicatorName: { type: String, required: true },
  category: { type: String, required: true, enum: ['E', 'S', 'G'] },
  unit: { type: String, required: true },
  measurementMethod: { type: String, required: true },
  whyItMattered: { type: String, required: true },
  gapFlag: { type: Boolean, default: false }, // GAP 10a
  gapNote: { type: String, default: '' },     // GAP 10a
});

const RegulatoryRuleSchema = new Schema<RegulatoryRuleEntry>({
  category: { type: String, required: true },
  regulationStandard: { type: String, required: true },
  issuingBody: { type: String, required: true },
  howItApplied: { type: String, required: true },
  gapFlag: { type: Boolean, default: false }, // GAP 10a
  gapNote: { type: String, default: '' },     // GAP 10a
});

const StakeholderSchema = new Schema<StakeholderEntry>({
  stakeholderGroup: { type: String, required: true },
  interestConcern: { type: String, required: true },
  reportingFormatNeeded: { type: String, required: true },
  engagementOutcome: { type: String, required: true },
  gapFlag: { type: Boolean, default: false }, // GAP 10a
  gapNote: { type: String, default: '' },     // GAP 10a
});

const DecisionSupportSchema = new Schema<DecisionSupportEntry>({
  mitigationMeasure: { type: String, required: true },
  effectiveness: { type: String, required: true, enum: ['high', 'medium', 'low'] },
  evidenceForRating: { type: String, required: true },
  recommendedFuture: { type: String, required: true },
  expertReasoning: { type: String, required: true },
  gapFlag: { type: Boolean, default: false }, // GAP 10a
  gapNote: { type: String, default: '' },     // GAP 10a
});

const EvidenceSchema = new Schema<EvidenceEntry>({
  regulationStandard: { type: String, required: true },
  issuingBody: { type: String, required: true },
  evidenceType: { type: String, required: true },
  formatFrequency: { type: String, required: true },
  acceptedWithoutDispute: { type: Boolean, required: true, default: true },
  disputeNotes: { type: String },
  gapFlag: { type: Boolean, default: false }, // GAP 10a
  gapNote: { type: String, default: '' },     // GAP 10a
});

const DisclosureSchema = new Schema<DisclosureEntry>({
  disclosureTopic: { type: String, required: true },
  alignedFramework: { type: String, required: true, enum: ['GRI', 'ISSB', 'IFC', 'TNFD', 'NUPRC'] },
  whyValuable: { type: String, required: true },
  gapFlag: { type: Boolean, default: false }, // GAP 10a
  gapNote: { type: String, default: '' },     // GAP 10a
});

const ProjectTemplateSchema = new Schema<IProjectTemplate>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    sectionA: {
      name: String,
      referenceCode: String,
      projectType: String,
      location: String,
      operatingEnvironment: String,
      client: String,
      operator: String,
      duration: { start: Date, end: Date },
      valueScale: String,
      valueAmount: Number,
      description: String,
      dataReadinessTier: Number,
    },
    sectionB: { type: [IndicatorEntrySchema], default: [] },
    sectionC: { type: [RegulatoryRuleSchema], default: [] },
    sectionD: { type: [StakeholderSchema], default: [] },
    sectionE: { type: [DecisionSupportSchema], default: [] },
    sectionF: { type: [EvidenceSchema], default: [] },
    sectionG: {
      outcomesAchieved: String,
      measurementMethod: String,
      timeframe: String,
      outstandingIssues: String,
    },
    sectionH: {
      positiveImpacts: String,
      negativeImpacts: String,
      grievanceMechanism: String,
      grievanceOutcome: String,
    },
    sectionI: { type: [DisclosureSchema], default: [] },
    sectionJ: {
      dataDifficultToCollect: String,
      manualProcesses: String,
      automationOpportunity: String,
      priority: { type: String, enum: ['High', 'Medium', 'Low'] },
    },
    extractionStatus: {
      type: Map,
      of: { type: String, enum: ['not-started', 'in-progress', 'complete'] },
      default: extractionStatusDefault,
    },
  },
  { timestamps: true }
);

export const ProjectTemplate = mongoose.model<IProjectTemplate>(
  'ProjectTemplate',
  ProjectTemplateSchema
);
