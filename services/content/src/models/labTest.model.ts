import mongoose, { Schema, Document } from 'mongoose';

export interface IPreparation {
  text: string;
}

export interface ISections {
  ranges?:               string;
  resultInterpretation?: string;
  riskAssessment?:       string;
  whatDetects?:          string;
  frequency?:            string;
  indications?:          string;
  parameters?:           string;
  risksLimitations?:     string;
}

export interface ILabTest extends Document {
  name:               string;
  subtitle?:          string;
  slug:               string;
  image?:             string;
  shortDescription:   string;
  description:        string;
  tags:               string[];
  sampleTypes:        string[];
  whenToTest:         string[];
  includedTestNames:  string[];
  preparations:       IPreparation[];
  sections:           ISections;
  price?:             number;
}

const SectionsSchema = new Schema<ISections>(
  {
    ranges:               String,
    resultInterpretation: String,
    riskAssessment:       String,
    whatDetects:          String,
    frequency:            String,
    indications:          String,
    parameters:           String,
    risksLimitations:     String,
  },
  { _id: false },
);

const LabTestSchema = new Schema<ILabTest>(
  {
    name:              { type: String, required: true },
    subtitle:          String,
    slug:              { type: String, required: true, unique: true },
    image:             String,
    shortDescription:  { type: String, required: true },
    description:       { type: String, required: true },
    tags:              [{ type: String }],
    sampleTypes:       [{ type: String }],
    whenToTest:        [{ type: String }],
    includedTestNames: [{ type: String }],
    preparations:      [{ type: { text: String }, _id: false }],
    sections:          { type: SectionsSchema, default: {} },
    price:             Number,
  },
  { timestamps: true, collection: 'content_lab_tests' },
);

LabTestSchema.index({ name: 'text', tags: 'text', shortDescription: 'text' });
LabTestSchema.index({ tags: 1 });

export const LabTest = mongoose.model<ILabTest>('LabTest', LabTestSchema);
