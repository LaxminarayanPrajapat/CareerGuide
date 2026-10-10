import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let connecting: Promise<typeof mongoose> | null = null;

export async function connectDatabase(uri: string = env.mongoUri): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  connecting = mongoose.connect(uri, {
    dbName: env.dbName || undefined,
    serverSelectionTimeoutMS: 10000,
    autoIndex: !env.isProduction,
  });

  try {
    const conn = await connecting;
    logger.info('mongodb.connected', {
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    });
    return conn;
  } finally {
    connecting = null;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  logger.info('mongodb.disconnected');
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
