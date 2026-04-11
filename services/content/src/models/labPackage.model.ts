import mongoose, { Schema, Document } from 'mongoose';

export interface ILabPackage extends Document {
  name:      string;
  slug:      string;
  image?:    string;
  tags:      string[];
  testCount: number;
  price?:    number;
}

const LabPackageSchema = new Schema<ILabPackage>(
  {
    name:      { type: String, required: true },
    slug:      { type: String, required: true, unique: true },
    image:     String,
    tags:      [{ type: String }],
    testCount: { type: Number, required: true },
    price:     Number,
  },
  { timestamps: true, collection: 'content_lab_packages' },
);

LabPackageSchema.index({ name: 'text', tags: 'text' });
LabPackageSchema.index({ tags: 1 });

export const LabPackage = mongoose.model<ILabPackage>('LabPackage', LabPackageSchema);
