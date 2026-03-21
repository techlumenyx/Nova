import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { resolvers } from './resolvers';
import { typeDefs }  from './schema';
import { buildContext } from './context';
import { logger } from '@nova/shared';

const PORT = process.env.PORT || 4001;

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
});

async function start() {
  await server.start();

  const app = express();
  app.use(cors());
  app.use(json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth' });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, { context: buildContext }),
  );

  app.listen(PORT, () => {
    logger.info(`Auth service running on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start auth service', { error: err });
  process.exit(1);
});
