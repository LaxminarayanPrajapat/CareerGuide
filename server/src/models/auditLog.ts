import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export interface AuditLogDocumentFields {
  actor?: Schema.Types.ObjectId;
  actorEmail?: string;
  actorRole?: string;
  action: string;
  category: 'auth' | 'access' | 'admin' | 'assessment' | 'report' | 'system' | 'security';
  targetType?: string;
  targetId?: string;
  outcome: 'success' | 'failure' | 'denied';
  message: string;
  /** Safe metadata only - never raw answer payloads, passwords or tokens. */
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'critical';
  createdAt?: Date;
}

const auditLogSchema = new Schema<AuditLogDocumentFields>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    actorEmail: { type: String, trim: true, lowercase: true },
    actorRole: { type: String },
    action: { type: String, required: true, index: true },
    category: { type: String, required: true, enum: ['auth', 'access', 'admin', 'assessment', 'report', 'system', 'security'], index: true },
    targetType: { type: String },
    targetId: { type: String },
    outcome: { type: String, enum: ['success', 'failure', 'denied'], default: 'success', index: true },
    message: { type: String, required: true, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String, maxlength: 300 },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ category: 1, severity: 1, createdAt: -1 });

export type AuditLog = InferSchemaType<AuditLogDocumentFields>;
export type AuditLogDocument = HydratedDocument<AuditLogDocumentFields>;
export const AuditLogModel = model<AuditLogDocumentFields>('AuditLog', auditLogSchema);
