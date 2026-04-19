import mongoose from 'mongoose';
import { logger } from '../logger';

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;

  const url = process.env.MONGODB_URL;
  if (!url) throw new Error('MONGODB_URL is required');

  logger.info('[connectDB] Connecting to MongoDB...');

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
  connected = true;
  logger.info('[connectDB] Connected to MongoDB successfully');
}
