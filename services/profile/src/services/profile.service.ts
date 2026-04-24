import { Profile, IProfile } from '../models/profile.model';

function calcBmi(heightValue?: number, weightValue?: number, heightUnit?: string, weightUnit?: string): number | undefined {
  if (!heightValue || !weightValue) return undefined;
  const heightM = heightUnit === 'FEET' ? heightValue * 0.3048 : heightValue / 100;
  const weightKg = weightUnit === 'LBS' ? weightValue * 0.453592 : weightValue;
  if (heightM <= 0) return undefined;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

function deriveIsComplete(p: Partial<IProfile>): boolean {
  return !!(p.gender && p.dateOfBirth && p.heightValue && p.weightValue);
}

export const profileService = {
  async getByUserId(userId: string): Promise<IProfile | null> {
    return Profile.findOne({ userId });
  },

  async upsert(userId: string, input: Partial<IProfile>): Promise<IProfile> {
    const bmi = calcBmi(input.heightValue, input.weightValue, input.heightUnit, input.weightUnit);
    const data = { ...input, ...(bmi !== undefined && { bmi }), isComplete: deriveIsComplete(input) };
    return Profile.findOneAndUpdate(
      { userId },
      { $set: data },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ) as Promise<IProfile>;
  },
};
