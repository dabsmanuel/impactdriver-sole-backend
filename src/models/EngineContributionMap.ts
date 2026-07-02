import mongoose, { Document, Schema, Types } from 'mongoose';

export const ENGINE_NAMES = [
  'Project Classification Engine',
  'Regulatory Rules Engine',
  'Indicator Library',
  'Materiality Engine',
  'Stakeholder Intelligence Engine',
  'Decision Support Engine',
  'Benchmarking Engine',
  'Reporting Engine',
] as const;

export type EngineName = (typeof ENGINE_NAMES)[number];

export interface EngineContribution {
  engine: EngineName;
  contributed: boolean;
  mostValuableInsight: string;
}

export interface IEngineContributionMap extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  contributions: EngineContribution[];
  createdAt: Date;
  updatedAt: Date;
}

const EngineContributionSchema = new Schema<EngineContribution>({
  engine: { type: String, required: true, enum: ENGINE_NAMES },
  contributed: { type: Boolean, default: false },
  mostValuableInsight: { type: String, default: '' },
});

const EngineContributionMapSchema = new Schema<IEngineContributionMap>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    contributions: {
      type: [EngineContributionSchema],
      default: () =>
        ENGINE_NAMES.map((engine) => ({ engine, contributed: false, mostValuableInsight: '' })),
    },
  },
  { timestamps: true }
);

export const EngineContributionMap = mongoose.model<IEngineContributionMap>(
  'EngineContributionMap',
  EngineContributionMapSchema
);
