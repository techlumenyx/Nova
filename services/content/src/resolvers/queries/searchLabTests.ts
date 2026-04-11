import { labTestService } from '../../services';

export const searchLabTests = (
  _: unknown,
  { query, limit }: { query: string; limit?: number },
) => labTestService.search(query, limit);
