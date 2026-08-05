import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export type UserRole =
  | 'uptonville_reviewer'
  | 'impact_driver_analyst'
  | 'steering_committee'
  | 'admin'
  | 'client_data_submitter'   // GAP 5a
  | 'client_executive';       // GAP 5a

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  company: string; // GAP 5a
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['uptonville_reviewer', 'impact_driver_analyst', 'steering_committee', 'admin', 'client_data_submitter', 'client_executive'],
      default: 'impact_driver_analyst',
    },
    company: { type: String, default: '' }, // GAP 5a
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods['comparePassword'] = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password as string);
};

export const User = mongoose.model<IUser>('User', UserSchema);
