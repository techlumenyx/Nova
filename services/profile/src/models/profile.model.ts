import mongoose, { Schema, Document } from 'mongoose';

export interface IProfile extends Document {
  userId:      string;
  dateOfBirth?: Date;
  gender?:     'MALE' | 'FEMALE' | 'OTHER';
  heightValue?: number;
  weightValue?: number;
  heightUnit:  'CM' | 'FEET';
  weightUnit:  'KG' | 'LBS';
  bmi?:        number;
  // Chat-required fields
  city?:       string;
  language?:   'EN' | 'HI' | 'HINGLISH';
  conditions?: string[];
  medications?: { name: string; dosage: string }[];
  allergies?:  { drugs: string[]; food: string[]; environmental: string[] };
  isComplete:  boolean;
  createdAt:   Date;
  updatedAt:   Date;
}

const ProfileSchema = new Schema<IProfile>(
  {
    userId:      { type: String, required: true, unique: true, index: true },
    dateOfBirth: { type: Date },
    gender:      { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
    heightValue: { type: Number },
    weightValue: { type: Number },
    heightUnit:  { type: String, enum: ['CM', 'FEET'], default: 'CM' },
    weightUnit:  { type: String, enum: ['KG', 'LBS'], default: 'KG' },
    bmi:         { type: Number },
    city:        { type: String },
    language:    { type: String, enum: ['EN', 'HI', 'HINGLISH'], default: 'EN' },
    conditions:  [{ type: String }],
    medications: [{ name: { type: String }, dosage: { type: String } }],
    allergies:   {
      drugs:         [{ type: String }],
      food:          [{ type: String }],
      environmental: [{ type: String }],
    },
    isComplete: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'profiles' },
);

export const Profile = mongoose.model<IProfile>('Profile', ProfileSchema);
