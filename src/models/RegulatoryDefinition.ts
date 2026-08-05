import mongoose, { Document, Schema, Types } from 'mongoose';

export type RegulatoryFramework = 'GRI' | 'ISSB' | 'IFC' | 'TNFD' | 'NUPRC';

export interface IRegulatoryDefinition extends Document {
  _id: Types.ObjectId;
  framework: RegulatoryFramework;
  code: string;
  title: string;
  description: string;
  category: string;
  mandatory: boolean;
  applicableProjectTypes: string[];
  requiredSections: string[];
  createdAt: Date;
  updatedAt: Date;
}

const RegulatoryDefinitionSchema = new Schema<IRegulatoryDefinition>(
  {
    framework: {
      type: String,
      required: true,
      enum: ['GRI', 'ISSB', 'IFC', 'TNFD', 'NUPRC'],
    },
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, required: true, trim: true },
    mandatory: { type: Boolean, required: true, default: false },
    applicableProjectTypes: { type: [String], default: [] },
    requiredSections: { type: [String], default: [] },
  },
  { timestamps: true }
);

RegulatoryDefinitionSchema.index({ framework: 1, code: 1 });

export const RegulatoryDefinition = mongoose.model<IRegulatoryDefinition>(
  'RegulatoryDefinition',
  RegulatoryDefinitionSchema
);
