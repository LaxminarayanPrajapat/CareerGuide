import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ROLES } from '../config/constants.js';

export interface StudentProfile {
  institution?: string;
  department?: string;
  yearOfStudy?: number;
  rollNumber?: string;
  batch?: string;
  graduationYear?: number;
  skillsInterests?: string[];
  objective?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  completionPercent: number;
}

const studentProfileSchema = new Schema<StudentProfile>(
  {
    institution: { type: String, trim: true, maxlength: 160 },
    department: { type: String, trim: true, maxlength: 120 },
    yearOfStudy: { type: Number, min: 1, max: 10 },
    rollNumber: { type: String, trim: true, maxlength: 60 },
    batch: { type: String, trim: true, maxlength: 60, index: true },
    graduationYear: { type: Number, min: 1950, max: 2100 },
    skillsInterests: { type: [String], default: [] },
    objective: { type: String, trim: true, maxlength: 1000 },
    linkedinUrl: { type: String, trim: true, maxlength: 300 },
    portfolioUrl: { type: String, trim: true, maxlength: 300 },
    completionPercent: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

export interface UserDocumentFields {
  fullName: string;
  email: string;
  passwordHash: string;
  role: (typeof ROLES)[number];
  isActive: boolean;
  tokenVersion: number;
  studentProfile: StudentProfile;
  assignedCounsellor?: Schema.Types.ObjectId;
  phone?: string;
  mustChangePassword: boolean;
  passwordChangedAt?: Date;
  lastLoginAt?: Date;
  loginCount: number;
  failedLoginCount: number;
  lockedUntil?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  createdBy?: Schema.Types.ObjectId;
  notes?: string;
}

const userSchema = new Schema<UserDocumentFields>(
  {
    fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ROLES, default: 'student', index: true },
    isActive: { type: Boolean, default: true, index: true },
    tokenVersion: { type: Number, default: 0 },
    studentProfile: { type: studentProfileSchema, default: () => ({}) },
    assignedCounsellor: { type: Schema.Types.ObjectId, ref: 'User', default: undefined, index: true },
    phone: { type: String, trim: true, maxlength: 25 },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    loginCount: { type: Number, default: 0 },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ fullName: 'text', email: 'text' });

/** Recomputes the profile completion indicator used on dashboards. */
userSchema.methods.recalculateProfileCompletion = function (this: HydratedDocument<UserDocumentFields>) {
  const p = this.studentProfile ?? ({} as StudentProfile);
  const checks = [
    Boolean(p.institution),
    Boolean(p.department),
    Boolean(p.yearOfStudy),
    Boolean(p.batch),
    Boolean(p.objective),
    Array.isArray(p.skillsInterests) && p.skillsInterests.length > 0,
  ];
  const done = checks.filter(Boolean).length;
  p.completionPercent = Math.round((done / checks.length) * 100);
  return p.completionPercent;
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('studentProfile') && !this.isNew) return next();
  (this as unknown as { recalculateProfileCompletion: () => number }).recalculateProfileCompletion();
  return next();
});

export type User = InferSchemaType<UserDocumentFields>;
export type UserDocument = HydratedDocument<UserDocumentFields>;
export const UserModel = model<UserDocumentFields>('User', userSchema);
