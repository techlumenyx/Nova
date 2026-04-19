import mongoose from 'mongoose';
import { logger } from '../logger';

let connected = false;

export async function connectDB(): Promise<void> {
  if (connected) return;

  const url = process.env.MONGODB_URL;
  if (!url) throw new Error('MONGODB_URL is required');

  await mongoose.connect(url, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    heartbeatFrequencyMS: 10000,
  });
  connected = true;
  logger.info('Connected to MongoDB');
}
