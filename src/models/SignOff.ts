import mongoose, { Document, Schema, Types } from 'mongoose';

export type SignOffRole =
  | 'Uptonville Technical Reviewer'
  | 'Impact Driver Analyst'
  | 'Joint Steering Committee';

export interface SignatureEntry {
  role: SignOffRole;
  name: string;
  date?: Date;
  signed: boolean;
}

export interface ISignOff extends Document {
  _id: Types.ObjectId;
  project: Types.ObjectId;
  signatures: SignatureEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const SignatureSchema = new Schema<SignatureEntry>({
  role: {
    type: String,
    required: true,
    enum: ['Uptonville Technical Reviewer', 'Impact Driver Analyst', 'Joint Steering Committee'],
  },
  name: { type: String, default: '' },
  date: { type: Date },
  signed: { type: Boolean, default: false },
});

const SIGN_OFF_ROLES: SignOffRole[] = [
  'Uptonville Technical Reviewer',
  'Impact Driver Analyst',
  'Joint Steering Committee',
];

const SignOffSchema = new Schema<ISignOff>(
  {
    project: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true },
    signatures: {
      type: [SignatureSchema],
      default: () =>
        SIGN_OFF_ROLES.map((role) => ({ role, name: '', signed: false })),
    },
  },
  { timestamps: true }
);

export const SignOff = mongoose.model<ISignOff>('SignOff', SignOffSchema);
