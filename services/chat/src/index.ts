import express from 'express';
import cors from 'cors';
import { json } from 'body-parser';
import http from 'http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';
import { resolvers } from './resolvers';
import { typeDefs }  from './schema';
import { buildContext } from './context';
import { logger } from '@nova/shared';

const PORT = process.env.PORT || 4004;

const schema = buildSubgraphSchema({ typeDefs, resolvers });

async function start() {
  const app = express();
  const httpServer = http.createServer(app);

  // WebSocket server for GraphQL subscriptions
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();

  app.use(cors());
  app.use(json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'chat' });
  });

  app.use(
    '/graphql',
    expressMiddleware(server, { context: buildContext }),
  );

  httpServer.listen(PORT, () => {
    logger.info(`Chat service running on port ${PORT}`);
    logger.info(`WebSocket subscriptions ready at ws://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  logger.error('Failed to start chat service', { error: err });
  process.exit(1);
});
