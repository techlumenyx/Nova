import { labTestService } from '../../services';

export const labTest = (
  _: unknown,
  { slug }: { slug: string },
) => labTestService.getBySlug(slug);
