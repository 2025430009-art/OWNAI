import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let connected = false;

export function isMongoAvailable() {
  return connected && mongoose.connection.readyState === 1;
}

export async function initMongo() {
  const uri = config.mongodb?.uri;
  if (!uri) {
    console.warn('[DB] MONGODB_URI not set — using file fallback');
    return null;
  }

  try {
    await mongoose.connect(uri);
    connected = true;
    console.log('[DB] MongoDB connected');
    logger.info('MongoDB connected for PromptToVideo jobs');
    return true;
  } catch (err) {
    console.warn('[DB] MongoDB unavailable:', err.message);
    logger.warn('MongoDB unavailable — video metadata file fallback', { error: err.message });
    connected = false;
    return null;
  }
}

export async function disconnectMongo() {
  if (connected) {
    await mongoose.disconnect();
    connected = false;
  }
}
