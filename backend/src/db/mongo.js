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
    logger.warn('MONGODB_URI not set — video metadata will use file fallback');
    return false;
  }

  try {
    await mongoose.connect(uri);
    connected = true;
    logger.info('MongoDB connected for PromptToVideo jobs');
    return true;
  } catch (error) {
    logger.warn('MongoDB unavailable — video metadata file fallback', { error: error.message });
    connected = false;
    return false;
  }
}

export async function disconnectMongo() {
  if (connected) {
    await mongoose.disconnect();
    connected = false;
  }
}
