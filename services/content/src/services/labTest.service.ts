import { LabTest } from '../models/labTest.model';
import { LabPackage } from '../models/labPackage.model';

const SUGGESTION_LIMIT = 3;

export const labTestService = {
  async search(query: string, limit = 10) {
    const regex = new RegExp(query, 'i');

    const [tests, packages] = await Promise.all([
      LabTest.find({ $or: [{ name: regex }, { tags: regex }, { shortDescription: regex }] })
        .limit(limit)
        .lean(),
      LabPackage.find({ $or: [{ name: regex }, { tags: regex }] })
        .limit(limit)
        .lean(),
    ]);

    return { query, tests, packages };
  },

  async suggestions(query: string) {
    const regex = new RegExp(query, 'i');

    const [testSuggestions, packageSuggestions] = await Promise.all([
      LabTest.find({ $or: [{ name: regex }, { tags: regex }] })
        .limit(SUGGESTION_LIMIT)
        .lean(),
      LabPackage.find({ $or: [{ name: regex }, { tags: regex }] })
        .limit(SUGGESTION_LIMIT)
        .lean(),
    ]);

    return { testSuggestions, packageSuggestions };
  },

  async getBySlug(slug: string) {
    return LabTest.findOne({ slug }).lean();
  },

  async getByTag(tag: string, limit = 10) {
    return LabTest.find({ tags: new RegExp(`^${tag}$`, 'i') })
      .limit(limit)
      .lean();
  },
};
