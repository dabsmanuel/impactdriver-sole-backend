import mongoose, { Document, Schema, Types } from 'mongoose';
import { EngineName, ENGINE_NAMES } from './EngineContributionMap';

export interface IEngineSnapshot extends Document {
  _id: Types.ObjectId;
  engine: EngineName;
  version: number;
  data: unknown;
  projectIds: string[];
  jobId?: Types.ObjectId;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
}

const EngineSnapshotSchema = new Schema<IEngineSnapshot>(
  {
    engine: { type: String, required: true, enum: ENGINE_NAMES },
    version: { type: Number, required: true, min: 1 },
    data: { type: Schema.Types.Mixed, required: true },
    projectIds: { type: [String], default: [] },
    jobId: { type: Schema.Types.ObjectId, ref: 'IngestionJob' },
    isActive: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false } // immutable — no updatedAt
);

EngineSnapshotSchema.index({ engine: 1, isActive: 1 });
EngineSnapshotSchema.index({ engine: 1, version: -1 });

export const EngineSnapshot = mongoose.model<IEngineSnapshot>(
  'EngineSnapshot',
  EngineSnapshotSchema
);
