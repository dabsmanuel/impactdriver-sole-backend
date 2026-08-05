import mongoose, { Document, Schema, Types } from 'mongoose';

export const PROJECT_TYPES = [
  'oil spill remediation',
  'pipeline integrity',
  'soil/groundwater remediation',
  'decommissioning',
  'flare-out',
  'waste management',
  'infrastructure build',
  'EIA',
  'environmental audit',
  'flood management',
  'drainage infrastructure',
  'geotechnical survey',
  'community development',
  'training/capacity building',
  'engineering consultancy',
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const OPERATING_ENVIRONMENTS = [
  'onshore',
  'swamp',
  'offshore',
  'near-shore',
  'urban',
  'riverine',
] as const;

export type OperatingEnvironment = (typeof OPERATING_ENVIRONMENTS)[number];

export const PROJECT_STATUSES = [
  'inventoried',
  'prioritised',
  'digitising',
  'extraction-in-progress',
  'engine-mapped',
  'signed-off',
  // Flow B statuses
  'client-submitted',
  'ai-classified',
  'esg-validated',
  'report-ready',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type ProjectSource = 'flow-a' | 'flow-b';

export interface ESGClassification {
  taxonomyMatches: { category: string; subcategory: string; confidence: 'high' | 'medium' | 'low' }[];
  applicableStandards: string[];
  esgScores: { E: number; S: number; G: number };
  riskLevel: 'high' | 'medium' | 'low';
  applicableIndicators: string[];
  benchmarkPosition: 'above-average' | 'average' | 'below-average';
  classifiedAt: Date;
}

export const VALUE_SCALES = ['micro', 'small', 'medium', 'large', 'major'] as const;
export type ValueScale = (typeof VALUE_SCALES)[number];

export interface IProject extends Document {
  _id: Types.ObjectId;
  name: string;
  referenceCode: string;
  projectType: ProjectType;
  location: string;
  operatingEnvironment: OperatingEnvironment;
  client: string;
  operator: string;
  duration: { start: Date; end?: Date };
  valueScale: ValueScale;
  valueAmount?: number;
  description: string;
  dataReadinessTier: 1 | 2 | 3;
  status: ProjectStatus;
  source: ProjectSource;
  availableDocs: {
    reports: boolean;
    monitoringData: boolean;
    gis: boolean;
    photographs: boolean;
    drawings: boolean;
  };
  anonymisationApproved: boolean;
  anonymisationApprovedBy?: Types.ObjectId;
  anonymisationApprovedAt?: Date;
  reviewNotes?: string;
  lastReviewedBy?: Types.ObjectId;
  lastReviewedAt?: Date;
  reportApproved?: boolean;
  reportApprovedBy?: Types.ObjectId;
  reportApprovedAt?: Date;
  // Flow B fields
  esgClassification?: ESGClassification;
  esgLeadValidated?: boolean;
  esgLeadValidatedBy?: Types.ObjectId;
  esgLeadValidatedAt?: Date;
  esgLeadNotes?: string;
  clientReportReady?: boolean;
  clientReportReadyAt?: Date;
  clientReportReadyBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    referenceCode: { type: String, required: true, unique: true, trim: true, uppercase: true },
    projectType: { type: String, required: true, enum: PROJECT_TYPES },
    location: { type: String, required: true },
    operatingEnvironment: { type: String, required: true, enum: OPERATING_ENVIRONMENTS },
    client: { type: String, required: true },
    operator: { type: String, required: true },
    duration: {
      start: { type: Date, required: true },
      end: { type: Date },
    },
    valueScale: { type: String, required: true, enum: VALUE_SCALES },
    valueAmount: { type: Number },
    description: { type: String, required: true },
    dataReadinessTier: { type: Number, required: true, enum: [1, 2, 3] },
    status: { type: String, required: true, enum: PROJECT_STATUSES, default: 'inventoried' },
    source: { type: String, enum: ['flow-a', 'flow-b'], default: 'flow-a' },
    availableDocs: {
      reports: { type: Boolean, default: false },
      monitoringData: { type: Boolean, default: false },
      gis: { type: Boolean, default: false },
      photographs: { type: Boolean, default: false },
      drawings: { type: Boolean, default: false },
    },
    anonymisationApproved: { type: Boolean, default: false },
    anonymisationApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    anonymisationApprovedAt: { type: Date },
    reviewNotes: { type: String, default: '' },
    lastReviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastReviewedAt: { type: Date },
    reportApproved: { type: Boolean, default: false },
    reportApprovedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reportApprovedAt: { type: Date },
    // Flow B
    esgClassification: {
      type: {
        taxonomyMatches: [{ category: String, subcategory: String, confidence: String }],
        applicableStandards: [String],
        esgScores: { E: Number, S: Number, G: Number },
        riskLevel: String,
        applicableIndicators: [String],
        benchmarkPosition: String,
        classifiedAt: Date,
      },
      default: undefined,
    },
    esgLeadValidated: { type: Boolean, default: false },
    esgLeadValidatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    esgLeadValidatedAt: { type: Date },
    esgLeadNotes: { type: String },
    clientReportReady: { type: Boolean, default: false },
    clientReportReadyAt: { type: Date },
    clientReportReadyBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

ProjectSchema.index({ projectType: 1, status: 1, dataReadinessTier: 1 });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
