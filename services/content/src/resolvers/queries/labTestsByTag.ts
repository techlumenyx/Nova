import { labTestService } from '../../services';

export const labTestsByTag = (
  _: unknown,
  { tag, limit }: { tag: string; limit?: number },
) => labTestService.getByTag(tag, limit);
