import mongoose, { Document, Schema, Types } from 'mongoose';

export type PipelineStep =
  | 'tag'
  | 'normalise'
  | 'merge'
  | 'resolve-conflicts'
  | 'compile-rules'
  | 'validate'
  | 'lock-version';

export type StepStatus = 'pending' | 'running' | 'complete' | 'failed' | 'skipped';

export interface StepRecord {
  step: PipelineStep;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  inputRef: string;
  outputRef: string;
  notes: string;
  error?: string;
}

export interface ConflictRecord {
  engineName: string;
  field: string;
  existingValue: string;
  newValue: string;
  similarity: number;
  resolution: 'pending' | 'accepted-new' | 'confirmed-existing' | 'escalated';
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
}

export interface ValidationItem {
  definitionCode: string;
  framework: string;
  field: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
}

export interface IIngestionJob extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  triggeredBy: Types.ObjectId;
  status: 'pending' | 'running' | 'complete' | 'failed';
  currentStep: PipelineStep | 'complete';
  steps: StepRecord[];
  conflicts: ConflictRecord[];
  validationReport: ValidationItem[];
  snapshotIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const PIPELINE_STEPS: PipelineStep[] = [
  'tag',
  'normalise',
  'merge',
  'resolve-conflicts',
  'compile-rules',
  'validate',
  'lock-version',
];

const StepRecordSchema = new Schema<StepRecord>(
  {
    step: { type: String, required: true, enum: PIPELINE_STEPS },
    status: { type: String, required: true, enum: ['pending', 'running', 'complete', 'failed', 'skipped'], default: 'pending' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    inputRef: { type: String, default: '' },
    outputRef: { type: String, default: '' },
    notes: { type: String, default: '' },
    error: { type: String },
  },
  { _id: false }
);

const ConflictRecordSchema = new Schema<ConflictRecord>(
  {
    engineName: { type: String, required: true },
    field: { type: String, required: true },
    existingValue: { type: String, required: true },
    newValue: { type: String, required: true },
    similarity: { type: Number, required: true },
    resolution: {
      type: String,
      required: true,
      enum: ['pending', 'accepted-new', 'confirmed-existing', 'escalated'],
      default: 'pending',
    },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { _id: false }
);

const ValidationItemSchema = new Schema<ValidationItem>(
  {
    definitionCode: { type: String, required: true },
    framework: { type: String, required: true },
    field: { type: String, required: true },
    status: { type: String, required: true, enum: ['pass', 'fail', 'warning'] },
    message: { type: String, required: true },
  },
  { _id: false }
);

const IngestionJobSchema = new Schema<IIngestionJob>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'running', 'complete', 'failed'],
      default: 'pending',
    },
    currentStep: {
      type: String,
      required: true,
      enum: [...PIPELINE_STEPS, 'complete'],
      default: 'tag',
    },
    steps: {
      type: [StepRecordSchema],
      default: () =>
        PIPELINE_STEPS.map((step) => ({
          step,
          status: 'pending',
          inputRef: '',
          outputRef: '',
          notes: '',
        })),
    },
    conflicts: { type: [ConflictRecordSchema], default: [] },
    validationReport: { type: [ValidationItemSchema], default: [] },
    snapshotIds: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

IngestionJobSchema.index({ project: 1, createdAt: -1 });

export const IngestionJob = mongoose.model<IIngestionJob>('IngestionJob', IngestionJobSchema);
export { PIPELINE_STEPS };
