import { AuthenticationError } from '@nova/shared';
import type { Context } from '../context';
import { profileService } from '../services/profile.service';
import type { IProfile } from '../models/profile.model';

function toGql(p: IProfile) {
  return {
    id:          (p._id as any).toString(),
    userId:      p.userId,
    dateOfBirth: p.dateOfBirth?.toISOString().split('T')[0] ?? null,
    gender:      p.gender ?? null,
    heightValue: p.heightValue ?? null,
    weightValue: p.weightValue ?? null,
    heightUnit:  p.heightUnit,
    weightUnit:  p.weightUnit,
    bmi:         (p as any).bmi ?? null,
    city:        p.city ?? null,
    language:    p.language ?? null,
    conditions:  p.conditions ?? [],
    medications: p.medications ?? [],
    allergies:   p.allergies ?? null,
    isComplete:  p.isComplete,
    createdAt:   p.createdAt.toISOString(),
    updatedAt:   p.updatedAt.toISOString(),
  };
}

export const resolvers = {
  Query: {
    myProfile: async (_: unknown, __: unknown, ctx: Context) => {
      if (!ctx.userId) throw new AuthenticationError('Not authenticated');
      const p = await profileService.getByUserId(ctx.userId);
      return p ? toGql(p) : null;
    },
  },

  Mutation: {
    setupProfile: async (_: unknown, { input }: { input: any }, ctx: Context) => {
      if (!ctx.userId) throw new AuthenticationError('Not authenticated');
      const p = await profileService.upsert(ctx.userId, input);
      return toGql(p);
    },

    updateProfile: async (_: unknown, { input }: { input: any }, ctx: Context) => {
      if (!ctx.userId) throw new AuthenticationError('Not authenticated');
      const p = await profileService.upsert(ctx.userId, input);
      return toGql(p);
    },
  },

  Profile: {
    __resolveReference: async ({ id }: { id: string }) => {
      const p = await (await import('../models/profile.model')).Profile.findById(id);
      return p ? toGql(p) : null;
    },
  },
};
