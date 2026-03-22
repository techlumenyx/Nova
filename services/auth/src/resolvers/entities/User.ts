import { userService } from '../../services';

export const User = {
  __resolveReference: async ({ id }: { id: string }) => {
    return userService.getById(id);
  },
};
