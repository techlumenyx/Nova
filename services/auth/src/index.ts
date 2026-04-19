import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });
import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { resolvers } from './resolvers';
import { typeDefs } from './schema';
import { buildContext } from './context';
import { logger, connectDB } from '@nova/shared';

const PORT = process.env.PORT || 4001;

const schema = buildSubgraphSchema({ typeDefs, resolvers: resolvers as any });

const server = new ApolloServer({ schema });

async function start() {
  await connectDB();
  await server.start();

  const app = express();
  app.use(cors());
  app.use(json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'auth' });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }: { req: any }) => buildContext({ req }),
    }),
  );

  app.listen(Number(PORT), '::', () => {
    logger.info(`Auth service running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start auth service:', err);
  process.exit(1);
});
