import { labTestService } from '../../services';

export const labTestSuggestions = (
  _: unknown,
  { query }: { query: string },
) => labTestService.suggestions(query);
