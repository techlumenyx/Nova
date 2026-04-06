import mongoose, { Schema, Document } from 'mongoose';

export interface IOtpRequest extends Document {
  target: string;
  targetType: 'PHONE' | 'EMAIL';
  otpHash: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
  // signup metadata — only present for signup OTPs
  signupName?: string;
  signupLanguage?: string;
}

const OtpRequestSchema = new Schema<IOtpRequest>(
  {
    target:         { type: String, required: true },
    targetType:     { type: String, enum: ['PHONE', 'EMAIL'], required: true },
    otpHash:        { type: String, required: true },
    expiresAt:      { type: Date, required: true },
    used:           { type: Boolean, default: false },
    signupName:     { type: String },
    signupLanguage: { type: String },
  },
  {
    timestamps: true,
    collection: 'auth_otp_requests',
  },
);

OtpRequestSchema.index({ target: 1, targetType: 1 });

export const OtpRequest = mongoose.model<IOtpRequest>('OtpRequest', OtpRequestSchema);
