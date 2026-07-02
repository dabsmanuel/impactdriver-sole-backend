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
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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
  availableDocs: {
    reports: boolean;
    monitoringData: boolean;
    gis: boolean;
    photographs: boolean;
    drawings: boolean;
  };
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
    availableDocs: {
      reports: { type: Boolean, default: false },
      monitoringData: { type: Boolean, default: false },
      gis: { type: Boolean, default: false },
      photographs: { type: Boolean, default: false },
      drawings: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

ProjectSchema.index({ projectType: 1, status: 1, dataReadinessTier: 1 });

export const Project = mongoose.model<IProject>('Project', ProjectSchema);
