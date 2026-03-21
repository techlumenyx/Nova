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

const PORT = process.env.PORT || 4002;

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
});

async function start() {
  await server.start();

  const app = express();
  app.use(cors());
  app.use(json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'profile' });
  });

  // REST: SOS event logging (Module 2.11)
  app.post('/emergency/sos', (req, res) => {
    const { profileId, location } = req.body as { profileId?: string; location?: string };
    // TODO: log SOS event to DB
    logger.warn('SOS triggered', { profileId, location });
    res.json({ received: true });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, { context: buildContext }),
  );

  app.listen(PORT, () => {
    logger.info(`Profile service running on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start profile service', { error: err });
  process.exit(1);
});
