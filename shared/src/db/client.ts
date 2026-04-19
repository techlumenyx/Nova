import mongoose from 'mongoose';
import { logger } from '../logger';

export async function connectDB(): Promise<void> {
  if (mongoose.connection.readyState === 1) return; // already connected

  const url = process.env.MONGODB_URL;
  if (!url) throw new Error('MONGODB_URL is required');

  mongoose.connection.on('connected',    () => logger.info('[MongoDB] connected'));
  mongoose.connection.on('disconnected', () => logger.warn('[MongoDB] disconnected'));
  mongoose.connection.on('reconnected',  () => logger.info('[MongoDB] reconnected'));
  mongoose.connection.on('error',        (err) => logger.error('[MongoDB] error', { err }));

  await mongoose.connect(url, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    heartbeatFrequencyMS: 10000,
  });

  logger.info('[MongoDB] initial connection established');
}
