import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(__dirname, '../../../.env') });

// Set buffer timeout before any Mongoose model is imported
import mongoose from 'mongoose';
mongoose.set('bufferTimeoutMS', 30000);

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
import { logger, connectDB } from '@nova/shared';


const PORT = process.env.PORT || 4004;

const schema = buildSubgraphSchema({ typeDefs, resolvers });

async function start() {
  // ── Connect to backing services FIRST, before accepting any traffic ───────
  await connectDB();

  // ── Build HTTP + Apollo ───────────────────────────────────────────────────
  const app = express();
  const httpServer = http.createServer(app);

  // WebSocket server for GraphQL subscriptions
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const serverCleanup = useServer({
    schema,
    context: async (ctx) => {
      // Clients pass auth via connectionParams: { 'x-user-id': '...', 'x-user-profile': '...' }
      const params = (ctx.connectionParams ?? {}) as Record<string, string>;
      const userId = params['x-user-id'] ?? params['x-userId'] ?? undefined;
      let profile: import('./context').UserProfile | undefined;
      const profileRaw = params['x-user-profile'];
      if (profileRaw) {
        try { profile = JSON.parse(profileRaw); } catch { /* ignore */ }
      }
      return { userId, profile };
    },
  }, wsServer);

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
    expressMiddleware(server, { context: async ({ req }: { req: any }) => buildContext({ req }) }),
  );

  httpServer.listen(Number(PORT), '::', () => {
    logger.info(`Chat service running on port ${PORT}`);
    logger.info(`WebSocket subscriptions ready at ws://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  logger.error('Failed to start chat service', { error: err });
  process.exit(1);
});
