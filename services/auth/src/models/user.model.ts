import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email?: string;
  phone?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  language: 'EN' | 'HI' | 'HINGLISH';
  authProvider: 'OTP' | 'GOOGLE' | 'APPLE';
  googleId?: string;
  appleId?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name:          { type: String, required: true },
    email:         { type: String, unique: true, sparse: true },
    phone:         { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    language:      { type: String, enum: ['EN', 'HI', 'HINGLISH'], default: 'EN' },
    authProvider:  { type: String, enum: ['OTP', 'GOOGLE', 'APPLE'], default: 'OTP' },
    googleId:      { type: String, unique: true, sparse: true },
    appleId:       { type: String, unique: true, sparse: true },
    status:        { type: String, enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'], default: 'ACTIVE' },
  },
  {
    timestamps: true,
    collection: 'auth_users',
  },
);

export const User = mongoose.model<IUser>('User', UserSchema);
