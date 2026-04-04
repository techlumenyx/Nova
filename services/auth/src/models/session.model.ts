import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}

const SessionSchema = new Schema<ISession>(
  {
    userId:       { type: String, required: true },
    refreshToken: { type: String, required: true, unique: true },
    expiresAt:    { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'auth_sessions',
  },
);

SessionSchema.index({ userId: 1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
