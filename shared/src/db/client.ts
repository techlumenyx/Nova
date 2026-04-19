import mongoose from 'mongoose';
import { logger } from '../logger';

const OPTS: mongoose.ConnectOptions = {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  connectTimeoutMS: 30000,
  maxPoolSize: 10,
  minPoolSize: 2,
  heartbeatFrequencyMS: 10000,
};

let _url: string | null = null;

export async function connectDB(): Promise<void> {
  const url = process.env.MONGODB_URL;
  if (!url) throw new Error('MONGODB_URL is required');

  if (mongoose.connection.readyState === 1) return;

  _url = url;
  mongoose.set('bufferTimeoutMS', 60000);

  mongoose.connection.on('connected',    () => logger.info('[MongoDB] connected'));
  mongoose.connection.on('reconnected',  () => logger.info('[MongoDB] reconnected'));
  mongoose.connection.on('error',        (err) => logger.error('[MongoDB] error', { err }));
  mongoose.connection.on('disconnected', async () => {
    logger.warn('[MongoDB] disconnected — reconnecting...');
    try {
      await mongoose.connect(_url!, OPTS);
    } catch (err) {
      logger.error('[MongoDB] reconnection failed', { err });
    }
  });

  await mongoose.connect(url, OPTS);
  logger.info('[MongoDB] initial connection established');
}
