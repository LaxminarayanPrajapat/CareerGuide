import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export interface SystemSettingDocumentFields {
  key: string;
  value: unknown;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  category: 'general' | 'assessment' | 'ai' | 'security' | 'report';
  label: string;
  description: string;
  /** Secrets are never stored here; this marks a setting as secret-backed. */
  isSecretBacked: boolean;
  updatedBy?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const systemSettingSchema = new Schema<SystemSettingDocumentFields>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    value: { type: Schema.Types.Mixed, default: null },
    valueType: { type: String, enum: ['string', 'number', 'boolean', 'json'], default: 'string' },
    category: {
      type: String,
      enum: ['general', 'assessment', 'ai', 'security', 'report'],
      default: 'general',
      index: true,
    },
    label: { type: String, required: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 600 },
    isSecretBacked: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export type SystemSetting = InferSchemaType<SystemSettingDocumentFields>;
export type SystemSettingDocument = HydratedDocument<SystemSettingDocumentFields>;
export const SystemSettingModel = model<SystemSettingDocumentFields>('SystemSetting', systemSettingSchema);
