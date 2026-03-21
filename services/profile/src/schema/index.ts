import { mergeTypeDefs } from '@graphql-tools/merge';
import { loadFilesSync } from '@graphql-tools/load-files';
import path from 'path';

const typesArray = loadFilesSync(path.join(__dirname), {
  extensions: ['graphql'],
  recursive: true,
});

export const typeDefs = mergeTypeDefs(typesArray);
